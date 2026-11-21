-- Faster planning (docs/decisions/0053): repeat a week, plan leftovers, and a weekly
-- grocery budget for the household.

-- ─── Leftovers ───────────────────────────────────────────────────────────────

-- A planned meal can be leftovers of another one ("Monday's chili, again for Tuesday lunch").
-- It's the same recipe, so its servings still count toward what to buy and cook (you cook
-- once, enough for both); the link only says "don't cook this again". If the original is
-- removed, the leftovers stay as an ordinary planned meal.
alter table public.meal_plan_entries
  add constraint meal_plan_entries_id_household unique (id, household_id),
  add column leftover_of uuid,
  add constraint meal_plan_entries_leftover_of
    foreign key (leftover_of, household_id)
    references public.meal_plan_entries (id, household_id)
    on delete set null (leftover_of),
  add constraint meal_plan_entries_not_own_leftovers check (leftover_of is distinct from id);

create index meal_plan_entries_leftover_of on public.meal_plan_entries (leftover_of);

-- Plans leftovers of `source` on `day` at `meal`: the same recipe, `servings` servings,
-- linked back to it. security invoker: RLS decides which plan entries the caller can see.
create function public.plan_leftovers(source uuid, day date, meal text, servings smallint)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  s record;
  saved uuid;
begin
  select e.id, e.recipe_id, e.plan_date into s
    from public.meal_plan_entries e where e.id = source;
  if s.id is null then
    raise exception 'Meal not found' using errcode = 'no_data_found';
  end if;
  if day < s.plan_date or day > s.plan_date + 6 then
    raise exception 'Leftovers must be within a week after the meal' using errcode = 'check_violation';
  end if;
  insert into public.meal_plan_entries (plan_date, meal, recipe_id, servings, leftover_of)
    values (day, meal, s.recipe_id, servings, s.id)
    returning id into saved;
  return saved;
end;
$$;

revoke all on function public.plan_leftovers(uuid, date, text, smallint) from public, anonymous;
grant execute on function public.plan_leftovers(uuid, date, text, smallint) to authenticated;

-- ─── Repeat a week ───────────────────────────────────────────────────────────

-- Copies every planned meal of the week starting `from_week` to the week starting
-- `to_week` (both Mondays), day for day, skipping any that are already planned there (same
-- day, meal and recipe), so it's safe to tap twice. Leftover links are copied too, pointing
-- at the new week's meals. Returns how many meals were added. security invoker: RLS applies.
create function public.copy_plan_week(from_week date, to_week date)
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
  if extract(isodow from from_week) <> 1 or extract(isodow from to_week) <> 1 then
    raise exception 'Weeks start on a Monday' using errcode = 'check_violation';
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

revoke all on function public.copy_plan_week(date, date) from public, anonymous;
grant execute on function public.copy_plan_week(date, date) to authenticated;

-- ─── Weekly budget ───────────────────────────────────────────────────────────

-- What the household means to spend on groceries in a week (optional), shared by the couple.
alter table public.households
  add column weekly_budget numeric(10, 2) check (weekly_budget > 0 and weekly_budget <= 10000);

-- Sets (or clears, with null) the caller's household budget. security definer: members
-- can't otherwise update their household row.
create function public.set_weekly_budget(amount numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  hh uuid := private.current_household_id();
begin
  if hh is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;
  update public.households h set weekly_budget = round(amount, 2) where h.id = hh;
end;
$$;

revoke all on function public.set_weekly_budget(numeric) from public, anonymous;
grant execute on function public.set_weekly_budget(numeric) to authenticated;

-- Leftover links can be written through plan_leftovers and copy_plan_week (both run as the
-- caller), so the column needs the same insert grant as the others.
grant insert (leftover_of) on public.meal_plan_entries to authenticated;
