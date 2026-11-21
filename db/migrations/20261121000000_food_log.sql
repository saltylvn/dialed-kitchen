-- Calorie counting (docs/decisions/0051): each person's daily goal, and a log of what each
-- person actually ate. The plan is what the household means to eat; the log is what one
-- person did eat. Both are private to the person (body data), unlike the rest of the app,
-- which the couple shares.

-- ─── Goals ───────────────────────────────────────────────────────────────────

-- One current goal per person. Calories required, protein optional.
create table public.nutrition_goals (
  user_id uuid primary key default auth.uid() references neon_auth."user" (id) on delete cascade,
  calories smallint not null check (calories between 500 and 10000),
  protein_g smallint check (protein_g between 0 and 1000),
  updated_at timestamptz not null default now()
);

alter table public.nutrition_goals enable row level security;
revoke all on public.nutrition_goals from anonymous, authenticated;
grant select on public.nutrition_goals to authenticated;

create policy "People see their own goal" on public.nutrition_goals
  for select to authenticated using (user_id = auth.uid());

-- Sets (or replaces) the caller's goal. The only way to write a goal.
create function public.set_my_goal(calories integer, protein_g integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;
  insert into public.nutrition_goals (user_id, calories, protein_g)
    values (caller, calories, protein_g)
  on conflict (user_id) do update
    set calories = excluded.calories, protein_g = excluded.protein_g, updated_at = now()
    where public.nutrition_goals.user_id = caller;
end;
$$;

revoke all on function public.set_my_goal(integer, integer) from public, anonymous;
grant execute on function public.set_my_goal(integer, integer) to authenticated;

-- ─── The food log ────────────────────────────────────────────────────────────

create table public.food_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references neon_auth."user" (id) on delete cascade,
  -- The person's own calendar date (not a timestamp), like the plan.
  log_date date not null check (log_date between date '2020-01-01' and date '2100-12-31'),
  meal text not null check (meal in ('breakfast', 'lunch', 'snacks', 'dinner')),
  -- Where it came from: a planned meal, or typed in (quick add). Kept as history if the
  -- plan entry or recipe is later deleted.
  plan_entry_id uuid references public.meal_plan_entries (id) on delete set null,
  recipe_id uuid references public.recipes (id) on delete set null,
  label text not null check (char_length(btrim(label)) between 1 and 80),
  -- Servings eaten, as a multiple of the recipe's serving (½ … 10).
  portion numeric(4, 2) not null default 1 check (portion > 0 and portion <= 10),
  -- A snapshot of the numbers when it was logged, so editing a recipe later never rewrites
  -- what was eaten. Null means unknown, never zero.
  calories smallint check (calories between 0 and 20000),
  protein_g numeric(6, 1) check (protein_g between 0 and 2000),
  carbs_g numeric(6, 1) check (carbs_g between 0 and 2000),
  fat_g numeric(6, 1) check (fat_g between 0 and 2000),
  created_at timestamptz not null default now(),
  -- A planned meal is logged at most once per person (tapping twice changes nothing).
  unique (user_id, plan_entry_id)
);

create index food_log_user_day on public.food_log (user_id, log_date);
create index food_log_household on public.food_log (household_id);
create index food_log_plan_entry on public.food_log (plan_entry_id);
create index food_log_recipe on public.food_log (recipe_id);

alter table public.food_log enable row level security;
revoke all on public.food_log from anonymous, authenticated;
-- Reading and deleting your own rows directly; every write goes through the functions
-- below, which work out the numbers and the household themselves.
grant select, delete on public.food_log to authenticated;

create policy "People see their own food log" on public.food_log
  for select to authenticated using (user_id = auth.uid());
create policy "People delete from their own food log" on public.food_log
  for delete to authenticated using (user_id = auth.uid());

-- The portion the caller usually eats of a recipe: their most recent one, else 1.
create function private.usual_portion(person uuid, target_recipe uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select f.portion from public.food_log f
      where f.user_id = person and f.recipe_id = target_recipe
      order by f.created_at desc limit 1),
    1);
$$;

revoke all on function private.usual_portion(uuid, uuid) from public, anonymous, authenticated;

-- A guard against runaway inserts (a stuck button), not a real-life limit.
create function private.check_log_room(person uuid, day date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.food_log f where f.user_id = person and f.log_date = day) >= 60 then
    raise exception 'Too many entries that day' using errcode = 'check_violation';
  end if;
end;
$$;

revoke all on function private.check_log_room(uuid, date) from public, anonymous, authenticated;

-- "Ate it": logs one of the household's planned meals for the caller, at `portion`
-- servings (null: their usual portion). Logging the same meal again updates the portion.
-- The numbers are copied from the recipe now. Returns the log entry's id.
create function public.log_planned_meal(entry_id uuid, portion numeric default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  e record;
  amount numeric;
  saved uuid;
begin
  if caller is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;
  select p.id, p.household_id, p.plan_date, p.meal, r.id as recipe_id, r.title,
         r.calories, r.protein_g, r.carbs_g, r.fat_g
    into e
    from public.meal_plan_entries p
    join public.recipes r on r.id = p.recipe_id and r.household_id = p.household_id
    where p.id = entry_id and private.is_household_member(p.household_id);
  if e.id is null then
    raise exception 'Meal not found' using errcode = 'no_data_found';
  end if;

  amount := coalesce(portion, private.usual_portion(caller, e.recipe_id));
  if amount <= 0 or amount > 10 then
    raise exception 'Portion must be ½ to 10' using errcode = 'check_violation';
  end if;
  perform private.check_log_room(caller, e.plan_date);

  insert into public.food_log as f (household_id, user_id, log_date, meal, plan_entry_id,
                               recipe_id, label, portion, calories, protein_g, carbs_g, fat_g)
  values (e.household_id, caller, e.plan_date, e.meal, e.id, e.recipe_id, left(e.title, 80),
          amount, round(e.calories * amount), round(e.protein_g * amount, 1),
          round(e.carbs_g * amount, 1), round(e.fat_g * amount, 1))
  on conflict (user_id, plan_entry_id) do update
    set portion = excluded.portion, calories = excluded.calories,
        protein_g = excluded.protein_g, carbs_g = excluded.carbs_g, fat_g = excluded.fat_g
    where f.user_id = caller
  returning f.id into saved;
  return saved;
end;
$$;

revoke all on function public.log_planned_meal(uuid, numeric) from public, anonymous;
grant execute on function public.log_planned_meal(uuid, numeric) to authenticated;

-- "Ate the plan": logs every planned meal of `day` the caller hasn't logged yet, each at
-- their usual portion. Returns how many were logged.
create function public.log_day_as_planned(day date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  entry record;
  logged integer := 0;
begin
  if caller is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;
  for entry in
    select p.id from public.meal_plan_entries p
    where p.household_id = private.current_household_id() and p.plan_date = day
      and not exists (select 1 from public.food_log f
                      where f.user_id = caller and f.plan_entry_id = p.id)
    order by p.created_at
  loop
    perform public.log_planned_meal(entry.id, null);
    logged := logged + 1;
  end loop;
  return logged;
end;
$$;

revoke all on function public.log_day_as_planned(date) from public, anonymous;
grant execute on function public.log_day_as_planned(date) to authenticated;

-- Quick add: something that isn't a planned recipe ("Protein bar", 200 kcal, 20 g).
create function public.log_quick(day date, meal text, label text, calories integer,
                                 protein_g numeric default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  hh uuid := private.current_household_id();
  saved uuid;
begin
  if caller is null or hh is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;
  if calories is null then
    raise exception 'Enter the calories' using errcode = 'check_violation';
  end if;
  perform private.check_log_room(caller, day);
  insert into public.food_log (household_id, user_id, log_date, meal, label, portion,
                               calories, protein_g)
  values (hh, caller, day, meal, btrim(label), 1, calories, protein_g)
  returning id into saved;
  return saved;
end;
$$;

revoke all on function public.log_quick(date, text, text, integer, numeric) from public, anonymous;
grant execute on function public.log_quick(date, text, text, integer, numeric) to authenticated;

-- ─── The shared demo ─────────────────────────────────────────────────────────

-- The daily demo reset also clears the demo account's food log and goal, so every visitor
-- starts from the same clean sample (docs/decisions/0026).
create or replace function public.refresh_demo_if_stale()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  demo uuid := auth.uid();
begin
  if not private.is_demo_user(demo) then
    return false;
  end if;
  -- One reset at a time.
  perform pg_advisory_xact_lock(hashtext('dialed-kitchen:demo-reset'));
  if (select last_reset_at from private.demo_state) > now() - interval '24 hours' then
    return false;
  end if;
  perform private.reset_demo_household();
  delete from public.food_log where user_id = demo;
  delete from public.nutrition_goals where user_id = demo;
  return true;
end;
$$;
