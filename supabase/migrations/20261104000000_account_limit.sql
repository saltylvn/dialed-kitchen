-- At most 25 accounts (docs/decisions/0025). Dialed Kitchen is a personal and portfolio
-- project, not a public service: this caps sign-ups (and so cost and exposure) for good.
-- Existing accounts keep signing in; only creating a new account is refused.

create function private.enforce_account_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- One sign-up at a time, so two at once can't both take the last place.
  perform pg_advisory_xact_lock(hashtext('dialed-kitchen:account-limit'));
  if (select count(*) from auth.users) >= 25 then
    raise exception 'Account limit reached' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_account_limit() from public, anon, authenticated;

create trigger enforce_account_limit
  before insert on auth.users
  for each row execute function private.enforce_account_limit();

-- Whether new accounts can still be made, for the sign-in page's message. Answers yes or no
-- only, never how many accounts exist.
create function public.accepting_new_accounts()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from auth.users) < 25;
$$;

revoke all on function public.accepting_new_accounts() from public;
grant execute on function public.accepting_new_accounts() to anon, authenticated;
