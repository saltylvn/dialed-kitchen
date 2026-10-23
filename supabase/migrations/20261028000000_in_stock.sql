-- "In stock" (docs/decisions/0014): what the household already has in the kitchen, shared by
-- both partners and kept in step with the grocery list. Marking something In stock takes it
-- off the list; clearing bought items puts them In stock; recipes add only what's needed.

-- The name used to match an ingredient, a list entry and an In stock entry:
-- "Chicken thighs, boneless" and "chicken thighs" are the same thing.
-- Must match matchKey() in lib/ingredients.ts (a test checks).
create function private.ingredient_key(name text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    nullif(lower(btrim(regexp_replace(name, '[,(].*$', ''))), ''),
    lower(btrim(name))
  );
$$;

create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.current_household_id()
    references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200 and name = btrim(name)),
  key text generated always as (private.ingredient_key(name)) stored,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (household_id, key)
);

create index pantry_items_created_by on public.pantry_items (created_by);
-- Matching list entries by key when something is marked In stock.
create index grocery_list_items_key on public.grocery_list_items (household_id, private.ingredient_key(name))
  where not checked;

alter table public.pantry_items enable row level security;
revoke all on public.pantry_items from anon, authenticated;
grant select, delete on public.pantry_items to authenticated;
grant insert (name) on public.pantry_items to authenticated;

create policy "Household members manage what's in stock" on public.pantry_items
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

-- ─── Mark In stock (or not), keeping the grocery list in step ─────────────────

-- in_stock = true: record it, and take it off the grocery list (entries not yet bought).
-- in_stock = false: it's used up; remove it from In stock.
-- Returns how many list entries were removed. security invoker: runs as the caller (RLS).
create function public.set_in_stock(name text, in_stock boolean)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  k text := private.ingredient_key(set_in_stock.name);
  removed integer := 0;
begin
  if in_stock then
    insert into public.pantry_items (name) values (btrim(set_in_stock.name))
      on conflict (household_id, key) do nothing;
    delete from public.grocery_list_items g
      where not g.checked and private.ingredient_key(g.name) = k;
    get diagnostics removed = row_count;
  else
    delete from public.pantry_items p where p.key = k;
  end if;
  return removed;
end;
$$;

-- ─── After shopping: bought items go In stock ────────────────────────────────

-- Removes the checked (bought) entries from the list and records them as In stock, in one
-- step. Returns how many were cleared.
create function public.clear_checked_into_stock()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cleared integer;
begin
  insert into public.pantry_items (name)
    select distinct on (private.ingredient_key(g.name)) g.name
    from public.grocery_list_items g
    where g.checked
    on conflict (household_id, key) do nothing;
  delete from public.grocery_list_items g where g.checked;
  get diagnostics cleared = row_count;
  return cleared;
end;
$$;

-- ─── Recipes add only what's needed ──────────────────────────────────────────

create or replace function public.add_recipe_to_list(recipe_id uuid)
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
    -- Skip what's In stock (matched by the ingredient's name or its price-book item's name).
    and not exists (
      select 1 from public.pantry_items p
      where p.key in (private.ingredient_key(i.name), private.ingredient_key(coalesce(it.name, i.name)))
    )
  order by i.sort_order
  on conflict (household_id, item_id) where not checked and item_id is not null do nothing;

  get diagnostics added = row_count;
  return added;
end;
$$;

revoke all on function public.set_in_stock(text, boolean), public.clear_checked_into_stock()
  from public, anon;
grant execute on function public.set_in_stock(text, boolean), public.clear_checked_into_stock()
  to authenticated;
-- Used by the generated column and the list index when the app writes rows.
revoke all on function private.ingredient_key(text) from public, anon;
grant execute on function private.ingredient_key(text) to authenticated;
