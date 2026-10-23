-- Stores, items and price history (docs/decisions/0003 and 0010).
--
-- Everything belongs to a household (docs/decisions/0009): both partners see and edit the
-- same stores, items and prices. Every price is kept as history; each row's unit price
-- (per gram, per ml, or per item) is computed by the database from that row alone, so it
-- can never go stale, and the best price is simply the lowest one.

-- ─── Units (must match lib/units.ts; a test checks they agree) ───────────────

create function private.unit_dimension(unit text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case unit
    when 'oz' then 'weight' when 'lb' then 'weight' when 'g' then 'weight' when 'kg' then 'weight'
    when 'fl_oz' then 'volume' when 'qt' then 'volume' when 'gal' then 'volume'
    when 'ml' then 'volume' when 'l' then 'volume'
    when 'each' then 'count' when 'dozen' then 'count'
  end;
$$;

-- How many grams, millilitres or items one unit is.
create function private.unit_to_base(unit text)
returns numeric
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case unit
    when 'oz' then 28.349523125 when 'lb' then 453.59237 when 'g' then 1 when 'kg' then 1000
    when 'fl_oz' then 29.5735295625 when 'qt' then 946.352946 when 'gal' then 3785.411784
    when 'ml' then 1 when 'l' then 1000
    when 'each' then 1 when 'dozen' then 12
  end;
$$;

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.current_household_id()
    references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60 and name = btrim(name)),
  created_at timestamptz not null default now(),
  unique (id, household_id) -- lets prices check they're in the same household
);
create unique index stores_unique_name on public.stores (household_id, lower(name));

create table public.items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.current_household_id()
    references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80 and name = btrim(name)),
  dimension text not null check (dimension in ('weight', 'volume', 'count')),
  -- The unit prices are shown in for this item: $/lb, $/fl oz, $ each…
  compare_unit text not null check (private.unit_dimension(compare_unit) = dimension),
  created_at timestamptz not null default now(),
  unique (id, household_id)
);
create unique index items_unique_name on public.items (household_id, lower(name));

create table public.item_prices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.current_household_id()
    references public.households (id) on delete cascade,
  item_id uuid not null,
  store_id uuid not null,
  price numeric(10, 2) not null check (price > 0 and price < 100000),
  package_quantity numeric(12, 3) not null check (package_quantity > 0 and package_quantity < 1000000),
  package_unit text not null check (private.unit_dimension(package_unit) is not null),
  on_sale boolean not null default false,
  observed_on date not null, -- the shopper's local calendar date
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Price per gram, ml or item. Computed by the database from this row; never stale.
  -- (nullif: a zero quantity is left for the check above to reject with a clear message,
  -- instead of failing here with "division by zero".)
  unit_price_base numeric generated always as
    (price / nullif(package_quantity * private.unit_to_base(package_unit), 0)) stored,
  -- The item and store must belong to the same household as the price.
  foreign key (item_id, household_id) references public.items (id, household_id) on delete cascade,
  -- A store with recorded prices can't be deleted by accident (the history would go too).
  foreign key (store_id, household_id) references public.stores (id, household_id) on delete restrict
);

create index stores_household_id on public.stores (household_id);
create index items_household_id on public.items (household_id);
create index item_prices_household_id on public.item_prices (household_id);
create index item_prices_store on public.item_prices (store_id, household_id);
create index item_prices_created_by on public.item_prices (created_by);
-- Best price per item: the lowest unit price, newest first among equals.
create index item_prices_best on public.item_prices (item_id, unit_price_base, observed_on desc);
-- History per item, newest first; and "last price at this store".
create index item_prices_history on public.item_prices (item_id, observed_on desc, created_at desc);

-- A price's package unit must measure the same thing as its item (no pounds of milk).
create function private.check_price_unit_matches_item()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.unit_dimension(new.package_unit)
     is distinct from (select dimension from public.items where id = new.item_id) then
    raise exception 'That unit doesn''t fit this item'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger item_prices_unit_matches_item
  before insert or update of item_id, package_unit on public.item_prices
  for each row execute function private.check_price_unit_matches_item();

-- And an item can't switch between weight, volume and count once it has prices.
create function private.check_item_dimension_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.dimension <> old.dimension
     and exists (select 1 from public.item_prices where item_id = new.id) then
    raise exception 'This item already has prices in other units'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger items_dimension_change
  before update of dimension on public.items
  for each row execute function private.check_item_dimension_change();

-- ─── Best price per item ─────────────────────────────────────────────────────

-- security_invoker: the view runs with the asking user's rights, so RLS on item_prices
-- applies and each household sees only its own best prices.
create view public.item_best_prices with (security_invoker = true) as
  select distinct on (p.item_id)
    p.item_id, p.id as price_id, p.store_id, p.price, p.package_quantity, p.package_unit,
    p.on_sale, p.observed_on, p.unit_price_base
  from public.item_prices p
  order by p.item_id, p.unit_price_base asc, p.observed_on desc, p.created_at desc;

-- ─── Row-level security: household members only ──────────────────────────────

alter table public.stores enable row level security;
alter table public.items enable row level security;
alter table public.item_prices enable row level security;

revoke all on public.stores, public.items, public.item_prices, public.item_best_prices
  from anon, authenticated;
-- Only the columns people actually fill in can be written. household_id comes from the
-- default (your household), created_by from auth.uid(), and unit_price_base is computed,
-- so none of them can be set or forged by the app. (A table-wide grant would allow every
-- column; column grants are the way to restrict.)
grant select, delete on public.stores, public.items, public.item_prices to authenticated;
grant insert (name), update (name) on public.stores to authenticated;
grant insert (name, dimension, compare_unit), update (name, dimension, compare_unit)
  on public.items to authenticated;
grant insert (item_id, store_id, price, package_quantity, package_unit, on_sale, observed_on),
      update (store_id, price, package_quantity, package_unit, on_sale, observed_on)
  on public.item_prices to authenticated;
grant select on public.item_best_prices to authenticated;

create policy "Household members manage their stores" on public.stores
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

create policy "Household members manage their items" on public.items
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

create policy "Household members manage their prices" on public.item_prices
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

revoke all on function
  private.unit_dimension(text), private.unit_to_base(text),
  private.check_price_unit_matches_item(), private.check_item_dimension_change()
  from public, anon;
-- Used by check constraints and the generated column when the app writes rows.
grant execute on function private.unit_dimension(text), private.unit_to_base(text) to authenticated;
