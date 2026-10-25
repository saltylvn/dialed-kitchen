-- A shared demo account for hiring teams (docs/decisions/0026). One tap on the sign-in page
-- signs into a demo household full of sample data that resets daily. Guard rails:
--   * only Google can create accounts, except this one password account;
--   * the demo can't send partner invites;
--   * the demo's AI allowance is small (shared by every visitor).
-- The demo's password lives only on the server (env), never here.

create function private.demo_email()
returns text
language sql
immutable
set search_path = ''
as $$ select 'demo@dialed-kitchen.vercel.app'::text $$;

create function private.is_demo_user(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u where u.id = user_id and lower(u.email) = private.demo_email()
  );
$$;

-- ─── Account creation: Google only (plus the demo), at most 25 ──────────────────

create or replace function private.enforce_account_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Email sign-in is switched on only so the demo can sign in with a password: nobody else
  -- may create a password (or any non-Google) account.
  if coalesce(new.raw_app_meta_data ->> 'provider', '') <> 'google'
     and lower(coalesce(new.email, '')) <> private.demo_email() then
    raise exception 'Only Google sign-in can create accounts' using errcode = 'check_violation';
  end if;
  -- One sign-up at a time, so two at once can't both take the last place.
  perform pg_advisory_xact_lock(hashtext('dialed-kitchen:account-limit'));
  if (select count(*) from auth.users) >= 25 then
    raise exception 'Account limit reached' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- ─── Guard rails ──────────────────────────────────────────────────────────────

-- The demo is shared by strangers: it must never email anyone an invite.
create function private.block_demo_invites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_demo_user(new.created_by) then
    raise exception 'The demo can''t send invites' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger household_invites_no_demo
  before insert on public.household_invites
  for each row execute function private.block_demo_invites();

-- The daily AI limit, with a small shared allowance for the demo (protects the free quota).
create or replace function public.take_ai_request(daily_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  allowed integer := daily_limit;
begin
  if caller is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;
  if daily_limit < 1 or daily_limit > 500 then
    raise exception 'Invalid limit' using errcode = 'check_violation';
  end if;
  if private.is_demo_user(caller) then
    allowed := least(daily_limit, 10);
  end if;
  perform pg_advisory_xact_lock(hashtext('ai_requests:' || caller::text));
  if (select count(*) from public.ai_requests
      where user_id = caller and created_at > now() - interval '24 hours') >= allowed then
    return false;
  end if;
  insert into public.ai_requests (user_id) values (caller);
  return true;
end;
$$;

revoke all on function private.is_demo_user(uuid), private.block_demo_invites(),
  private.demo_email() from public, anon, authenticated;

-- ─── Sample data ──────────────────────────────────────────────────────────────

-- When the demo household was last reset (one row).
create table private.demo_state (
  id boolean primary key default true check (id),
  last_reset_at timestamptz
);
insert into private.demo_state (id) values (true);

-- A recipe with its ingredients, linked to the household's price-book items by name.
create function private.demo_recipe(
  hh uuid, title text, servings smallint, meals text[], favorite boolean,
  nutrition numeric[], steps text[], ingredients jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  rid uuid;
begin
  insert into public.recipes (household_id, title, servings, source_type, steps, favorite,
                              meals, calories, protein_g, carbs_g, fat_g)
  values (hh, title, servings, 'own', steps, favorite, meals,
          nutrition[1]::smallint, nutrition[2], nutrition[3], nutrition[4])
  returning id into rid;

  insert into public.recipe_ingredients (household_id, recipe_id, sort_order, quantity, unit, name, item_id)
  select hh, rid, (e.ordinality - 1)::smallint, (e.value ->> 'q')::numeric, e.value ->> 'u',
         e.value ->> 'n',
         (select it.id from public.items it
          where it.household_id = hh
            and private.ingredient_key(it.name) = private.ingredient_key(e.value ->> 'n'))
  from jsonb_array_elements(ingredients) with ordinality as e(value, ordinality);
  return rid;
end;
$$;

-- Replaces everything in the demo household with fresh sample data: a price book with
-- history across stores, six recipes, this week's plan, In stock items and a short list.
create function private.reset_demo_household()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  demo uuid := (select id from auth.users where lower(email) = private.demo_email());
  hh uuid;
  monday date := date_trunc('week', current_date)::date;
  oats uuid; bowl uuid; lemon uuid; tacos uuid; parfait uuid; fried uuid;
begin
  if demo is null then return; end if;
  select household_id into hh from public.household_members where user_id = demo;
  if hh is null then return; end if;

  delete from public.meal_plan_entries where household_id = hh;
  delete from public.grocery_list_items where household_id = hh;
  delete from public.pantry_items where household_id = hh;
  delete from public.recipes where household_id = hh;
  delete from public.items where household_id = hh;

  insert into public.items (household_id, name, dimension, compare_unit) values
    (hh, 'Chicken thighs', 'weight', 'lb'), (hh, 'Jasmine rice', 'weight', 'lb'),
    (hh, 'Eggs', 'count', 'each'), (hh, 'Greek yogurt', 'weight', 'oz'),
    (hh, 'Ground turkey', 'weight', 'lb'), (hh, 'Yellow onion', 'count', 'each'),
    (hh, 'Avocado', 'count', 'each'), (hh, 'Tortillas', 'count', 'each'),
    (hh, 'Milk', 'volume', 'gal');

  insert into public.item_prices (household_id, item_id, store_id, price, package_quantity,
                                  package_unit, on_sale, observed_on)
  select hh, i.id, s.id, p.price, p.qty, p.unit, p.sale, current_date - p.days_ago
  from (values
    ('Chicken thighs', 'Costco', 12.95, 5, 'lb', false, 150),
    ('Chicken thighs', 'Walmart', 3.12, 1, 'lb', false, 60),
    ('Chicken thighs', 'Smith''s', 5.98, 2, 'lb', false, 30),
    ('Chicken thighs', 'Costco', 11.45, 5, 'lb', false, 12),
    ('Chicken thighs', 'WinCo', 2.49, 1, 'lb', false, 5),
    ('Jasmine rice', 'Walmart', 4.48, 2, 'lb', false, 90),
    ('Jasmine rice', 'Costco', 21.99, 25, 'lb', false, 45),
    ('Jasmine rice', 'WinCo', 9.98, 10, 'lb', false, 20),
    ('Eggs', 'Trader Joe''s', 3.99, 12, 'each', false, 40),
    ('Eggs', 'WinCo', 3.28, 12, 'each', false, 15),
    ('Eggs', 'Costco', 5.99, 24, 'each', false, 8),
    ('Greek yogurt', 'Trader Joe''s', 4.99, 32, 'oz', false, 25),
    ('Greek yogurt', 'Costco', 6.49, 48, 'oz', false, 10),
    ('Greek yogurt', 'WinCo', 4.98, 32, 'oz', true, 5),
    ('Ground turkey', 'Costco', 15.99, 4, 'lb', false, 35),
    ('Ground turkey', 'WinCo', 4.48, 1, 'lb', false, 7),
    ('Yellow onion', 'Smith''s', 0.79, 1, 'each', false, 50),
    ('Yellow onion', 'WinCo', 0.49, 1, 'each', false, 6),
    ('Avocado', 'Trader Joe''s', 1.29, 1, 'each', false, 20),
    ('Avocado', 'Costco', 5.99, 6, 'each', false, 9),
    ('Tortillas', 'WinCo', 2.98, 20, 'each', false, 14),
    ('Milk', 'Walmart', 3.48, 1, 'gal', false, 30),
    ('Milk', 'Costco', 3.29, 1, 'gal', false, 11)
  ) as p(item, store, price, qty, unit, sale, days_ago)
  join public.items i on i.household_id = hh and i.name = p.item
  join public.stores s on s.household_id = hh and s.name = p.store;

  oats := private.demo_recipe(hh, 'Overnight oats', 2::smallint, '{breakfast}', true,
    '{380,18,52,10}', '{"Stir everything together in a jar.","Cover and refrigerate overnight.","Top with blueberries in the morning."}',
    '[{"q":1,"u":"cup","n":"rolled oats"},{"q":1,"u":"cup","n":"milk"},{"q":0.5,"u":"cup","n":"greek yogurt"},{"q":1,"u":"tbsp","n":"honey"},{"q":0.5,"u":"cup","n":"blueberries"}]');
  bowl := private.demo_recipe(hh, 'Teriyaki chicken rice bowl', 4::smallint, '{lunch,dinner}', false,
    '{610,38,72,16}', '{"Cook the rice.","Sear the chicken thighs, then glaze with teriyaki sauce.","Steam the broccoli.","Serve over rice with sliced green onions."}',
    '[{"q":1.5,"u":"lb","n":"chicken thighs"},{"q":2,"u":"cup","n":"jasmine rice"},{"q":0.333,"u":"cup","n":"teriyaki sauce"},{"q":2,"u":"cup","n":"broccoli florets"},{"q":2,"n":"green onions"}]');
  lemon := private.demo_recipe(hh, 'Lemon garlic chicken', 4::smallint, '{dinner}', false,
    '{540,42,30,24}', '{"Brown the chicken in olive oil, 5 minutes a side.","Add the garlic and lemon juice; simmer 20 minutes.","Serve with rice."}',
    '[{"q":2,"u":"lb","n":"chicken thighs"},{"q":4,"n":"cloves garlic"},{"q":1,"n":"lemon"},{"q":1,"u":"tbsp","n":"olive oil"},{"q":1,"u":"cup","n":"jasmine rice"}]');
  tacos := private.demo_recipe(hh, 'Turkey tacos', 4::smallint, '{dinner}', true,
    '{520,34,40,22}', '{"Brown the turkey with the diced onion.","Warm the tortillas.","Fill with turkey, cheese, salsa and sliced avocado."}',
    '[{"q":1,"u":"lb","n":"ground turkey"},{"q":8,"n":"tortillas"},{"q":1,"u":"cup","n":"shredded cheese"},{"q":1,"u":"cup","n":"salsa"},{"q":2,"n":"avocado"},{"q":1,"n":"yellow onion"}]');
  parfait := private.demo_recipe(hh, 'Greek yogurt parfait', 1::smallint, '{snacks,breakfast}', false,
    '{290,20,38,7}', '{"Layer yogurt, granola and berries.","Drizzle with honey."}',
    '[{"q":0.75,"u":"cup","n":"greek yogurt"},{"q":0.5,"u":"cup","n":"granola"},{"q":0.5,"u":"cup","n":"blueberries"},{"q":1,"u":"tsp","n":"honey"}]');
  fried := private.demo_recipe(hh, 'Veggie fried rice', 4::smallint, '{lunch}', false,
    '{430,14,62,14}', '{"Scramble the eggs and set aside.","Fry the onion and peas, add the rice and soy sauce.","Stir the eggs back in."}',
    '[{"q":3,"u":"cup","n":"jasmine rice"},{"q":3,"n":"eggs"},{"q":1,"u":"cup","n":"frozen peas"},{"q":2,"u":"tbsp","n":"soy sauce"},{"q":1,"n":"yellow onion"}]');

  insert into public.meal_plan_entries (household_id, plan_date, meal, recipe_id, servings) values
    (hh, monday, 'breakfast', oats, 2), (hh, monday, 'dinner', tacos, 4),
    (hh, monday + 1, 'lunch', bowl, 4), (hh, monday + 2, 'dinner', lemon, 4),
    (hh, monday + 3, 'breakfast', oats, 2), (hh, monday + 3, 'dinner', tacos, 4),
    (hh, monday + 4, 'lunch', fried, 4), (hh, monday + 5, 'snacks', parfait, 1),
    (hh, monday + 6, 'dinner', bowl, 4);

  insert into public.pantry_items (household_id, name) values
    (hh, 'Salt'), (hh, 'Olive oil'), (hh, 'Honey'), (hh, 'Soy sauce');

  insert into public.grocery_list_items (household_id, name, quantity, unit) values
    (hh, 'Bananas', 6, null), (hh, 'Coffee', null, null);

  update private.demo_state set last_reset_at = now();
end;
$$;

revoke all on function private.demo_recipe(uuid, text, smallint, text[], boolean, numeric[], text[], jsonb),
  private.reset_demo_household() from public, anon, authenticated;

-- Called right after the demo signs in: resets the sample data once a day. Does nothing for
-- anyone else, and tells callers only whether a reset happened.
create function public.refresh_demo_if_stale()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_demo_user(auth.uid()) then
    return false;
  end if;
  -- One reset at a time.
  perform pg_advisory_xact_lock(hashtext('dialed-kitchen:demo-reset'));
  if (select last_reset_at from private.demo_state) > now() - interval '24 hours' then
    return false;
  end if;
  perform private.reset_demo_household();
  return true;
end;
$$;

revoke all on function public.refresh_demo_if_stale() from public, anon;
grant execute on function public.refresh_demo_if_stale() to authenticated;
