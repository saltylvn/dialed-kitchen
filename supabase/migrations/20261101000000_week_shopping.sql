-- From the meal plan to the grocery list (docs/decisions/0019): what a week's meals need,
-- with an estimated cost, and adding it to the list in one step.

-- What the week starting `week_start` needs, one row per ingredient:
--   * each recipe's ingredients scaled to the servings planned (planned / recipe servings);
--   * the same ingredient (by private.ingredient_key) combined across meals, converting
--     between units of the same kind (cups + tbsp, lb + oz); amounts without a unit
--     ("2 onions") and amounts that can't be converted stay on separate rows;
--   * whether it's In stock or already on the list;
--   * an estimated cost from the price book's best price, only when the units convert
--     (never guessed: otherwise null).
-- security invoker: runs as the caller, so RLS limits it to their own household.
create function public.week_shopping(week_start date)
returns table (
  name text,
  item_id uuid,
  quantity numeric,
  unit text,
  in_stock boolean,
  on_list boolean,
  est_cost numeric
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
      row_number() over (order by e.plan_date, e.meal, i.sort_order) as seq
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
    -- Best price per base unit × amount in base units, when both measure the same way.
    -- A bare number ("2 onions") prices against a per-each price.
    case
      when g.kind = 'none' or b.unit_price_base is null then null
      when g.kind = 'count_bare' and private.unit_dimension(b.package_unit) = 'count'
        then round(g.base_quantity * b.unit_price_base, 2)
      when g.kind = private.unit_dimension(b.package_unit)
        then round(g.base_quantity * b.unit_price_base, 2)
    end
  from grouped g
  left join public.item_best_prices b on b.item_id = g.item_id
  order by g.first_seq;
$$;

-- Adds everything the week needs that isn't In stock or already on the list, in one step.
-- Returns how many entries were added.
create function public.add_week_to_list(week_start date)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  added integer;
begin
  insert into public.grocery_list_items (name, item_id, quantity, unit, source)
  select btrim(left(w.name, 80)), w.item_id,
         -- An amount too small to store (a pinch scaled down) is listed without one.
         case when w.quantity >= 0.001 then least(w.quantity, 999999) end,
         case when w.quantity >= 0.001 then w.unit end,
         'meal_plan'
  from public.week_shopping(week_start) w
  where not w.in_stock and not w.on_list
  on conflict (household_id, item_id) where not checked and item_id is not null do nothing;

  get diagnostics added = row_count;
  return added;
end;
$$;

revoke all on function public.week_shopping(date), public.add_week_to_list(date) from public, anon;
grant execute on function public.week_shopping(date), public.add_week_to_list(date) to authenticated;
