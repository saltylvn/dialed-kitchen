-- Adding a recipe to the grocery list never duplicates an entry (docs/decisions/0014).
-- Before, only price-book items were protected (by a unique index); a plain-text ingredient
-- like "ground beef" was added again each time. Now anything already on the list and not
-- yet bought is skipped, matched by name the same way as In stock (private.ingredient_key),
-- and a recipe that names the same thing twice adds it once.

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
  select name, item_id, quantity, unit
  from (
    select distinct on (private.ingredient_key(coalesce(it.name, i.name)))
      coalesce(it.name, i.name) as name, i.item_id, i.quantity, i.unit, i.sort_order,
      private.ingredient_key(i.name) as own_key,
      private.ingredient_key(coalesce(it.name, i.name)) as key
    from public.recipe_ingredients i
    left join public.items it on it.id = i.item_id
    where i.recipe_id = add_recipe_to_list.recipe_id
    order by private.ingredient_key(coalesce(it.name, i.name)), i.sort_order
  ) needed
  -- Not In stock (by the ingredient's own name or its price-book item's name)…
  where not exists (select 1 from public.pantry_items p where p.key in (needed.own_key, needed.key))
    -- …and not already on the list waiting to be bought.
    and not exists (
      select 1 from public.grocery_list_items g
      where not g.checked and private.ingredient_key(g.name) in (needed.own_key, needed.key)
    )
  order by needed.sort_order
  on conflict (household_id, item_id) where not checked and item_id is not null do nothing;

  get diagnostics added = row_count;
  return added;
end;
$$;
