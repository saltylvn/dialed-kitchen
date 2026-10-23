-- The household's shared grocery list, and "last price at this store" (docs/decisions/0011).
--
-- One list per household: both partners add to it and check things off. A list entry can be
-- linked to a price-book item (so it shows best and store prices) or just be typed text.

create table public.grocery_list_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default private.current_household_id()
    references public.households (id) on delete cascade,
  -- Optional link to the price book. If that item is deleted, the entry stays on the list
  -- as plain text (only item_id is cleared; household_id must stay).
  item_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 80 and name = btrim(name)),
  quantity numeric(12, 3) check (quantity > 0 and quantity < 1000000),
  unit text check (unit is null or private.unit_dimension(unit) is not null),
  checked boolean not null default false,
  checked_at timestamptz,
  source text not null default 'manual' check (source in ('manual', 'meal_plan')),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (unit is null or quantity is not null), -- "lb" alone means nothing
  check (checked = (checked_at is not null)),
  foreign key (item_id, household_id) references public.items (id, household_id)
    on delete set null (item_id)
);

-- The same price-book item can't be on the list twice while it's still to buy.
create unique index grocery_list_items_one_open_per_item
  on public.grocery_list_items (household_id, item_id)
  where not checked and item_id is not null;

create index grocery_list_items_household on public.grocery_list_items (household_id, checked, created_at);
create index grocery_list_items_item on public.grocery_list_items (item_id, household_id);
create index grocery_list_items_created_by on public.grocery_list_items (created_by);

-- Keep checked_at in step with checked, so the app only flips one column.
create function private.set_checked_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.checked is distinct from old.checked or tg_op = 'INSERT' then
    new.checked_at := case when new.checked then now() end;
  end if;
  return new;
end;
$$;

create trigger grocery_list_items_checked_at
  before insert or update of checked on public.grocery_list_items
  for each row execute function private.set_checked_at();

alter table public.grocery_list_items enable row level security;

revoke all on public.grocery_list_items from anon, authenticated;
grant select, delete on public.grocery_list_items to authenticated;
grant insert (item_id, name, quantity, unit, source), update (name, quantity, unit, checked)
  on public.grocery_list_items to authenticated;

create policy "Household members manage their list" on public.grocery_list_items
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

-- ─── Last price at each store ────────────────────────────────────────────────

-- The most recent price for each item at each store ("Last here: $1.99/lb"). Runs with the
-- asking user's rights (RLS on item_prices applies).
create view public.item_latest_store_prices with (security_invoker = true) as
  select distinct on (p.item_id, p.store_id)
    p.item_id, p.store_id, p.id as price_id, p.price, p.package_quantity, p.package_unit,
    p.on_sale, p.observed_on, p.unit_price_base
  from public.item_prices p
  order by p.item_id, p.store_id, p.observed_on desc, p.created_at desc;

create index item_prices_latest_at_store
  on public.item_prices (store_id, item_id, observed_on desc, created_at desc);

revoke all on public.item_latest_store_prices from anon, authenticated;
grant select on public.item_latest_store_prices to authenticated;

revoke all on function private.set_checked_at() from public, anon, authenticated;
