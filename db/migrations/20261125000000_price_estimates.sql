-- AI price estimates for the weekly cost (docs/decisions/0057). When a planned ingredient
-- has no price in the price book, one Gemini request estimates a typical price, saved here
-- per household and ingredient and always shown as "~ estimate". A real price in the price
-- book always wins; an estimate older than 90 days is asked for again.
create table public.price_estimates (
  household_id uuid not null default private.current_household_id()
    references public.households (id) on delete cascade,
  -- The ingredient's match key (lib/ingredients.ts matchKey): lowercase, before any comma.
  key text not null check (char_length(key) between 1 and 120 and key = lower(btrim(key))),
  -- What the price measures, like item_cheapest_now: per gram, millilitre or item.
  dimension text not null check (dimension in ('weight', 'volume', 'count')),
  unit_price_base numeric(12, 6) not null check (unit_price_base > 0 and unit_price_base <= 200),
  model text not null check (char_length(model) between 1 and 80),
  estimated_on date not null default current_date,
  primary key (household_id, key, dimension)
);

alter table public.price_estimates enable row level security;

revoke all on public.price_estimates from anonymous, authenticated;
grant select, delete on public.price_estimates to authenticated;
-- Saved with an upsert, which on conflict rewrites the columns it sent; household_id can't
-- be set by the app.
grant insert (key, dimension, unit_price_base, model, estimated_on),
  update (key, dimension, unit_price_base, model, estimated_on)
  on public.price_estimates to authenticated;

create policy "Household members manage their price estimates" on public.price_estimates
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));
