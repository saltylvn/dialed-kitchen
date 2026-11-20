-- The sign-up gate's own database login (docs/decisions/0049).
--
-- Neon Auth calls the app's webhook before and after it creates an account. That webhook
-- runs with no signed-in user, so it can't use the Data API; it connects as this role
-- instead. Least privilege: the role can run the two sign-up functions and nothing else
-- (no tables, no other functions). It is created here without a password and unable to
-- log in; `npm run db:gate-password` gives it one, kept only in the app's server
-- environment, never in this repository.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'signup_gate') then
    create role signup_gate nologin noinherit;
  end if;
end;
$$;

grant usage on schema private to signup_gate;
grant execute on function private.check_signup(text, text), private.finish_signup(uuid)
  to signup_gate;
