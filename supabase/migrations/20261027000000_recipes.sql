-- Recipes (docs/decisions/0013): a household's recipe box, with ingredients that can link to
-- the price book, saved in one step, and added to the grocery list in one tap.

-- ─── Kitchen units: cup, tbsp, tsp (must match lib/units.ts; a test checks) ──────────────

create or replace function private.unit_dimension(unit text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case unit
    when 'oz' then 'weight' when 'lb' then 'weight' when 'g' then 'weight' when 'kg' then 'weight'
    when 'fl_oz' then 'volume' when 'tsp' then 'volume' when 'tbsp' then 'volume'
    when 'cup' then 'volume' when 'qt' then 'volume' when 'gal' then 'volume'
    when 'ml' then 'volume' when 'l' then 'volume'
    when 'each' then 'count' when 'dozen' then 'count'
  end;
$$;

create or replace function private.unit_to_base(unit text)
returns numeric
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case unit
    when 'oz' then 28.349523125 when 'lb' then 453.59237 when 'g' then 1 when 'kg' then 1000
    when 'fl_oz' then 29.5735295625 when 'tsp' then 4.92892159375 when 'tbsp' then 14.78676478125
    when 'cup' then 236.5882365 when 'qt' then 946.352946 when 'gal' then 3785.411784
    when 'ml' then 1 when 'l' then 1000
    when 'each' then 1 when 'dozen' then 12
  end;
$$;

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.current_household_id()
    references public.households (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120 and title = btrim(title)),
  servings smallint not null default 4 check (servings between 1 and 50),
  source_type text not null default 'own'
    check (source_type in ('own', 'website', 'cookbook', 'magazine', 'other')),
  -- The cookbook or magazine title, or the website's name.
  source_name text check (source_name is null or char_length(source_name) between 1 and 120),
  source_url text check (source_url is null or (source_url ~ '^https://' and char_length(source_url) <= 2000)),
  steps text[] not null default '{}'
    check (cardinality(steps) <= 100 and array_position(steps, '') is null),
  -- Starred by either partner; shown at the top of the recipe box for both.
  favorite boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.current_household_id()
    references public.households (id) on delete cascade,
  recipe_id uuid not null,
  sort_order smallint not null check (sort_order between 0 and 199),
  quantity numeric(12, 3) check (quantity > 0 and quantity < 1000000),
  unit text check (unit is null or private.unit_dimension(unit) is not null),
  name text not null check (char_length(btrim(name)) between 1 and 200 and name = btrim(name)),
  item_id uuid, -- the price-book item this ingredient is, when it matches one
  check (unit is null or quantity is not null),
  unique (recipe_id, sort_order),
  foreign key (recipe_id, household_id) references public.recipes (id, household_id) on delete cascade,
  foreign key (item_id, household_id) references public.items (id, household_id) on delete set null (item_id)
);

create index recipes_household on public.recipes (household_id, favorite desc, lower(title));
create index recipes_created_by on public.recipes (created_by);
create index recipe_ingredients_recipe on public.recipe_ingredients (recipe_id, household_id);
create index recipe_ingredients_item on public.recipe_ingredients (item_id, household_id);
create index recipe_ingredients_household on public.recipe_ingredients (household_id);

-- ─── Row-level security ──────────────────────────────────────────────────────

alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;

revoke all on public.recipes, public.recipe_ingredients from anon, authenticated;
grant select, delete on public.recipes, public.recipe_ingredients to authenticated;
-- Writes go through save_recipe (below), which runs as the caller, so these grants and RLS
-- still apply to it.
grant insert (title, servings, source_type, source_name, source_url, steps, favorite),
      update (title, servings, source_type, source_name, source_url, steps, updated_at, favorite)
  on public.recipes to authenticated;
grant insert (recipe_id, sort_order, quantity, unit, name, item_id)
  on public.recipe_ingredients to authenticated;

create policy "Household members manage their recipes" on public.recipes
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

create policy "Household members manage their recipe ingredients" on public.recipe_ingredients
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

-- ─── Save a recipe and its ingredients together ──────────────────────────────

-- Creates (recipe_id null) or updates a recipe and replaces its ingredients, all in one
-- transaction: either everything saves or nothing does. security invoker: it runs with the
-- caller's own rights, so RLS, grants and constraints all apply as usual.
-- ingredients: [{ "quantity": 2, "unit": "cup", "name": "flour", "item_id": null }, …]
create function public.save_recipe(
  recipe_id uuid,
  title text,
  servings smallint,
  source_type text,
  source_name text,
  source_url text,
  steps text[],
  ingredients jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_id uuid := save_recipe.recipe_id;
begin
  if jsonb_typeof(ingredients) is distinct from 'array' or jsonb_array_length(ingredients) > 200 then
    raise exception 'Too many ingredients' using errcode = 'check_violation';
  end if;

  if saved_id is null then
    insert into public.recipes (title, servings, source_type, source_name, source_url, steps)
      values (save_recipe.title, save_recipe.servings, save_recipe.source_type,
              save_recipe.source_name, save_recipe.source_url, save_recipe.steps)
      returning id into saved_id;
  else
    update public.recipes r
      set title = save_recipe.title, servings = save_recipe.servings,
          source_type = save_recipe.source_type, source_name = save_recipe.source_name,
          source_url = save_recipe.source_url, steps = save_recipe.steps, updated_at = now()
      where r.id = saved_id;
    if not found then
      raise exception 'Recipe not found' using errcode = 'no_data_found';
    end if;
    delete from public.recipe_ingredients i where i.recipe_id = saved_id;
  end if;

  insert into public.recipe_ingredients (recipe_id, sort_order, quantity, unit, name, item_id)
  select saved_id, (e.ordinality - 1)::smallint,
         (e.value ->> 'quantity')::numeric, e.value ->> 'unit',
         btrim(e.value ->> 'name'), (e.value ->> 'item_id')::uuid
  from jsonb_array_elements(ingredients) with ordinality as e(value, ordinality);

  return saved_id;
end;
$$;

-- ─── Add a recipe's ingredients to the grocery list ──────────────────────────

-- Adds every ingredient to the household's list in one go. Linked items already on the list
-- (unchecked) are skipped rather than duplicated. Returns how many were added.
create function public.add_recipe_to_list(recipe_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  added integer;
begin
  if not exists (select 1 from public.recipes r where r.id = add_recipe_to_list.recipe_id) then
    raise exception 'Recipe not found' using errcode = 'no_data_found';
  end if;

  insert into public.grocery_list_items (name, item_id, quantity, unit)
  select coalesce(it.name, i.name), i.item_id, i.quantity, i.unit
  from public.recipe_ingredients i
  left join public.items it on it.id = i.item_id
  where i.recipe_id = add_recipe_to_list.recipe_id
  order by i.sort_order
  on conflict (household_id, item_id) where not checked and item_id is not null do nothing;

  get diagnostics added = row_count;
  return added;
end;
$$;

revoke all on function public.save_recipe(uuid, text, smallint, text, text, text, text[], jsonb),
  public.add_recipe_to_list(uuid) from public, anon;
grant execute on function public.save_recipe(uuid, text, smallint, text, text, text, text[], jsonb),
  public.add_recipe_to_list(uuid) to authenticated;
