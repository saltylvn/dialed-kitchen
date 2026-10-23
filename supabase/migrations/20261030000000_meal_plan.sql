-- The weekly meal plan (docs/decisions/0017): which recipe, for which meal, on which day,
-- for how many. Shared by the household, like everything else.

create table public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.current_household_id()
    references public.households (id) on delete cascade,
  -- The household's own calendar date (not a timestamp), so a plan never shifts a day.
  plan_date date not null check (plan_date between date '2020-01-01' and date '2100-12-31'),
  -- Exactly these four (lib/plan.ts MEALS): snacks come after lunch, before dinner.
  meal text not null check (meal in ('breakfast', 'lunch', 'snacks', 'dinner')),
  recipe_id uuid not null,
  servings smallint not null check (servings between 1 and 50),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Only the household's own recipes; deleting a recipe takes it off the plan.
  foreign key (recipe_id, household_id) references public.recipes (id, household_id) on delete cascade
);

create index meal_plan_entries_week on public.meal_plan_entries (household_id, plan_date);
create index meal_plan_entries_recipe on public.meal_plan_entries (recipe_id, household_id);
create index meal_plan_entries_created_by on public.meal_plan_entries (created_by);

-- A guard against runaway inserts (a bug or a stuck button), not a real-life limit.
create function private.limit_meals_per_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('meal_plan:' || new.household_id::text || new.plan_date::text));
  if (select count(*) from public.meal_plan_entries e
      where e.household_id = new.household_id and e.plan_date = new.plan_date) >= 20 then
    raise exception 'Too many meals that day' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function private.limit_meals_per_day() from public, anon, authenticated;

create trigger meal_plan_entries_limit
  before insert on public.meal_plan_entries
  for each row execute function private.limit_meals_per_day();

-- ─── Row-level security ──────────────────────────────────────────────────────

alter table public.meal_plan_entries enable row level security;

revoke all on public.meal_plan_entries from anon, authenticated;
grant select, delete on public.meal_plan_entries to authenticated;
grant insert (plan_date, meal, recipe_id, servings),
      update (meal, servings)
  on public.meal_plan_entries to authenticated;

create policy "Household members manage their meal plan" on public.meal_plan_entries
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));
