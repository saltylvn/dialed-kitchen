-- At most 25 accounts (docs/decisions/0025). Dialed Kitchen is a personal and portfolio
-- project, not a public service: this caps sign-ups (and so cost and exposure) for good.
-- Existing accounts keep signing in; only creating a new account is refused.

-- Asked before every new account is created; raises when it must be refused. Neon manages
-- the sign-in tables and doesn't allow triggers on them (docs/decisions/0049), so instead of
-- a trigger, Neon Auth's blocking "user.before_create" webhook calls this, and refuses the
-- sign-up if it raises (or if the webhook can't be reached at all).
create function private.check_signup(email text, provider text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from neon_auth."user") >= 25 then
    raise exception 'Account limit reached' using errcode = 'check_violation';
  end if;
end;
$$;

revoke all on function private.check_signup(text, text) from public, anonymous, authenticated;

-- Whether new accounts can still be made, for the sign-in page's message. Answers yes or no
-- only, never how many accounts exist.
create function public.accepting_new_accounts()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from neon_auth."user") < 25;
$$;

revoke all on function public.accepting_new_accounts() from public;
grant execute on function public.accepting_new_accounts() to anonymous, authenticated;
