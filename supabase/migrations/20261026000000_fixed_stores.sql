-- A fixed set of stores (docs/decisions/0012): WinCo, Trader Joe's, Harmons, Smith's,
-- Costco and Walmart, in that order. Every household gets exactly these six; the app can
-- read them but not add, rename or delete stores. Changing the list means a new migration.

-- The allowed stores and their display order, defined once.
create function private.allowed_stores()
returns table (name text, sort_order smallint)
language sql
immutable
set search_path = ''
as $$
  values ('WinCo', 1::smallint), ('Trader Joe''s', 2::smallint), ('Harmons', 3::smallint),
         ('Smith''s', 4::smallint), ('Costco', 5::smallint), ('Walmart', 6::smallint);
$$;

alter table public.stores add column sort_order smallint;

-- Remove stores outside the list. If one still had prices, this fails (the foreign key
-- restricts) rather than silently deleting price history.
delete from public.stores s
where not exists (select 1 from private.allowed_stores() a where a.name = s.name);

-- Give every household all six, and set the display order.
insert into public.stores (household_id, name)
select h.id, a.name from public.households h cross join private.allowed_stores() a
on conflict (household_id, lower(name)) do nothing;

update public.stores s set sort_order = a.sort_order
from private.allowed_stores() a where a.name = s.name;

alter table public.stores alter column sort_order set not null;
alter table public.stores add constraint stores_allowed_name check (
  (name = 'WinCo' and sort_order = 1) or (name = 'Trader Joe''s' and sort_order = 2) or
  (name = 'Harmons' and sort_order = 3) or (name = 'Smith''s' and sort_order = 4) or
  (name = 'Costco' and sort_order = 5) or (name = 'Walmart' and sort_order = 6)
);

-- New households (every new user, and a partner who ends a partnership) get the six too.
create function private.seed_household_stores()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.stores (household_id, name, sort_order)
  select new.id, a.name, a.sort_order from private.allowed_stores() a;
  return new;
end;
$$;

create trigger households_seed_stores
  after insert on public.households
  for each row execute function private.seed_household_stores();

-- The app may only read stores now.
revoke insert, update, delete on public.stores from authenticated;

revoke all on function private.allowed_stores(), private.seed_household_stores()
  from public, anon, authenticated;
