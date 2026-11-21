-- Plan shows seven days starting today, not Monday to Sunday (docs/decisions/0054), so
-- "Repeat last week" copies the seven days before today into today and the six after.
-- copy_plan_week no longer needs Mondays: any start works, as long as the two weeks are a
-- whole number of weeks apart, so every meal lands on the same weekday it was planned on.
-- Everything else is as in 20261123000000_faster_planning.sql.
create or replace function public.copy_plan_week(from_week date, to_week date)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  shift integer := to_week - from_week;
  e record;
  new_id uuid;
  copies jsonb := '{}'; -- old entry id → new entry id
  added integer := 0;
begin
  if shift % 7 <> 0 then
    raise exception 'Weeks must be whole weeks apart' using errcode = 'check_violation';
  end if;
  if shift = 0 then
    return 0;
  end if;

  -- Originals first, so leftovers can point at their copies.
  for e in
    select p.id, p.plan_date, p.meal, p.recipe_id, p.servings, p.leftover_of
    from public.meal_plan_entries p
    where p.household_id = private.current_household_id()
      and p.plan_date between from_week and from_week + 6
    order by (p.leftover_of is not null), p.plan_date, p.created_at
  loop
    if exists (
      select 1 from public.meal_plan_entries t
      where t.household_id = private.current_household_id()
        and t.plan_date = e.plan_date + shift and t.meal = e.meal and t.recipe_id = e.recipe_id
    ) then
      continue;
    end if;
    insert into public.meal_plan_entries (plan_date, meal, recipe_id, servings, leftover_of)
      values (e.plan_date + shift, e.meal, e.recipe_id, e.servings,
              (copies ->> e.leftover_of::text)::uuid)
      returning id into new_id;
    copies := copies || jsonb_build_object(e.id::text, new_id);
    added := added + 1;
  end loop;
  return added;
end;
$$;
