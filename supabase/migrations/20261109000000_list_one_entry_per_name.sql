-- One entry per thing on the grocery list (docs/decisions/0038). "Bananas", "bananas" and
-- "Bananas, ripe" are the same entry, matched by private.ingredient_key like In stock and
-- recipes. Until now only entries linked to a price-book item were kept unique.

-- 1. Merge entries that are already there twice: keep the one linked to the price book,
--    else the oldest. (Two rows for the same linked item go the same way.)
delete from public.grocery_list_items g
using (
  select id,
    row_number() over (
      partition by household_id, private.ingredient_key(name)
      order by (item_id is null), created_at, id
    ) as n
  from public.grocery_list_items
) d
where g.id = d.id and d.n > 1;

delete from public.grocery_list_items g
using (
  select id,
    row_number() over (partition by household_id, item_id order by created_at, id) as n
  from public.grocery_list_items
  where item_id is not null
) d
where g.id = d.id and d.n > 1;

-- 2. Entries ticked into the old Shopping kart (decision 0034) are on the list again
--    (decision 0035), and ticking now moves an item In stock. Un-tick them, so marking one
--    In stock takes it off the list like any other (set_in_stock matches unticked entries).
update public.grocery_list_items set checked = false where checked;

-- 3. The rule, kept by the database: a second entry with the same name is refused. It also
--    serves the In stock lookup, so the old partial index is no longer needed.
drop index public.grocery_list_items_key;
create unique index grocery_list_items_one_per_name
  on public.grocery_list_items (household_id, private.ingredient_key(name));
