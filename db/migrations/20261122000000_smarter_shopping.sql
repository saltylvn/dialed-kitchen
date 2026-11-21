-- Smarter shopping (docs/decisions/0052).
--
-- 1. "Cheapest now": for each item, every store's most recent price, then the lowest of
--    those. Unlike the best price ever (item_best_prices, still used by the price book and
--    "New best price!"), an old sale or a store that has since raised its price no longer
--    sets the estimate or tells you where to shop.
-- 2. The week's estimated cost (week_shopping) now uses it. Same return type, so
--    add_week_to_list keeps working unchanged.
-- 3. restock(names): after a receipt is saved, what was bought goes In stock and off the
--    grocery list, in one step.

create view public.item_cheapest_now with (security_invoker = true) as
  select distinct on (l.item_id)
    l.item_id, l.store_id, l.price_id, l.package_unit, l.observed_on, l.unit_price_base
  from public.item_latest_store_prices l
  order by l.item_id, l.unit_price_base asc, l.observed_on desc;

revoke all on public.item_cheapest_now from anonymous, authenticated;
grant select on public.item_cheapest_now to authenticated;

create or replace function public.week_shopping(week_start date)
returns table (
  name text,
  item_id uuid,
  quantity numeric,
  unit text,
  in_stock boolean,
  on_list boolean,
  est_cost numeric,
  uses jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with lines as (
    select
      coalesce(it.name, i.name) as name,
      i.item_id,
      i.unit,
      i.quantity * e.servings::numeric / r.servings as quantity,
      private.unit_dimension(i.unit) as dimension,
      private.ingredient_key(i.name) as own_key,
      private.ingredient_key(coalesce(it.name, i.name)) as key,
      e.id as entry_id,
      e.plan_date,
      e.meal,
      r.title as recipe,
      row_number() over (
        order by e.plan_date,
          array_position(array['breakfast', 'lunch', 'snacks', 'dinner'], e.meal),
          i.sort_order
      ) as seq
    from public.meal_plan_entries e
    join public.recipes r on r.id = e.recipe_id
    join public.recipe_ingredients i on i.recipe_id = r.id
    left join public.items it on it.id = i.item_id
    where e.plan_date between week_start and week_start + 6
  ),
  grouped as (
    select
      key,
      -- 'unit' rows convert to one unit; 'count' is a bare number; 'none' has no amount.
      case when dimension is not null then dimension
           when quantity is not null then 'count_bare'
           else 'none' end as kind,
      (array_agg(name order by seq))[1] as name,
      (array_agg(item_id order by seq) filter (where item_id is not null))[1] as item_id,
      -- Shown in the unit used first; summed through the base unit (g, ml, each).
      (array_agg(unit order by seq) filter (where unit is not null))[1] as unit,
      sum(quantity * coalesce(private.unit_to_base(unit), 1)) as base_quantity,
      array_agg(distinct own_key) || array_agg(distinct key) as keys,
      -- Where it's used: one entry per planned meal, in week order.
      jsonb_agg(
        jsonb_build_object('entry', entry_id, 'date', plan_date, 'meal', meal, 'recipe', recipe)
        order by seq
      ) as uses,
      min(seq) as first_seq
    from lines
    group by key,
      case when dimension is not null then dimension
           when quantity is not null then 'count_bare'
           else 'none' end
  )
  select
    g.name,
    g.item_id,
    case when g.kind = 'none' then null
         else round(g.base_quantity / coalesce(private.unit_to_base(g.unit), 1), 3) end,
    g.unit,
    exists (select 1 from public.pantry_items p where p.key = any (g.keys)),
    exists (
      select 1 from public.grocery_list_items l
      where not l.checked and private.ingredient_key(l.name) = any (g.keys)
    ),
    -- The cheapest current price (each store's latest, then the lowest; decision 0052)
    -- per base unit × amount in base units, when both measure the same way. A bare number
    -- ("2 onions") prices against a per-each price.
    case
      when g.kind = 'none' or b.unit_price_base is null then null
      when g.kind = 'count_bare' and private.unit_dimension(b.package_unit) = 'count'
        then round(g.base_quantity * b.unit_price_base, 2)
      when g.kind = private.unit_dimension(b.package_unit)
        then round(g.base_quantity * b.unit_price_base, 2)
    end,
    g.uses
  from grouped g
  left join public.item_cheapest_now b on b.item_id = g.item_id
  order by g.first_seq;
$$;

-- Bought it: each name goes In stock (once), and matching entries still on the grocery list
-- come off. Returns how many list entries were removed. security invoker: runs as the
-- caller, so RLS and the In stock rules apply as for a tap.
create function public.restock(names text[])
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  removed integer;
begin
  if coalesce(cardinality(names), 0) > 200 then
    raise exception 'Too many items' using errcode = 'check_violation';
  end if;
  insert into public.pantry_items (name)
    select distinct on (private.ingredient_key(n)) btrim(n)
    from unnest(names) as n
    where btrim(coalesce(n, '')) <> ''
    on conflict (household_id, key) do nothing;
  delete from public.grocery_list_items g
    where not g.checked
      and private.ingredient_key(g.name) in (select private.ingredient_key(n) from unnest(names) as n);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.restock(text[]) from public, anonymous;
grant execute on function public.restock(text[]) to authenticated;
