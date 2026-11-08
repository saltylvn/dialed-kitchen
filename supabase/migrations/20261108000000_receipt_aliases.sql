-- Receipt lines the household has matched to price-book items, per store
-- (docs/decisions/0033). Receipts abbreviate ("KS ORG EGGS 24CT"); once you've said that's
-- "Organic eggs" at Costco, the next Costco receipt suggests it straight away.
--
-- receipt_text is the printed line in capitals with single spaces (lib/receipt.ts
-- receiptKey); the check below keeps that form, so two spellings can't both be stored.
create table public.receipt_aliases (
  household_id uuid not null default private.current_household_id()
    references public.households (id) on delete cascade,
  store_id uuid not null,
  receipt_text text not null check (
    char_length(receipt_text) between 1 and 80
    and receipt_text = upper(regexp_replace(btrim(receipt_text), '\s+', ' ', 'g'))
  ),
  item_id uuid not null,
  updated_at timestamptz not null default now(),
  primary key (household_id, store_id, receipt_text),
  -- The store and item must belong to the same household; deleting either forgets the match.
  foreign key (store_id, household_id) references public.stores (id, household_id) on delete cascade,
  foreign key (item_id, household_id) references public.items (id, household_id) on delete cascade
);

create index receipt_aliases_item on public.receipt_aliases (item_id, household_id);
create index receipt_aliases_store on public.receipt_aliases (store_id, household_id);

-- A changed match gets a new updated_at.
create function private.touch_receipt_alias()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger receipt_aliases_touch
  before update on public.receipt_aliases
  for each row execute function private.touch_receipt_alias();

alter table public.receipt_aliases enable row level security;

revoke all on public.receipt_aliases from anon, authenticated;
grant select, delete on public.receipt_aliases to authenticated;
-- The app saves matches with an upsert, which on conflict rewrites every column it sent
-- (store_id, receipt_text, item_id), so all three may be updated; household_id and
-- updated_at can't be set by the app.
grant insert (store_id, receipt_text, item_id), update (store_id, receipt_text, item_id)
  on public.receipt_aliases to authenticated;

create policy "Household members manage their receipt matches" on public.receipt_aliases
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));
