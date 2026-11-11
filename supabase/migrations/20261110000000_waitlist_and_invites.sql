-- Invite-only sign-up (docs/decisions/0043). Anyone can join a waitlist; only the admin
-- (Google account saltylvn@gmail.com, "tylerpclark") can approve someone, which creates a
-- single-use invite code tied to their email. A new account is only created for an email
-- with a redeemed, unexpired, unused code, and still within the 25-account limit
-- (decision 0025). Existing accounts, the admin and the demo account are unaffected.

-- ─── Admin ───────────────────────────────────────────────────────────────────

-- Who can approve the waitlist. Kept in the private schema: the app can't read or change it.
create table private.admins (
  email text primary key check (email = lower(btrim(email))),
  display_name text not null
);
revoke all on private.admins from public, anon, authenticated;
insert into private.admins (email, display_name) values ('saltylvn@gmail.com', 'tylerpclark');

-- Whether the signed-in person is an admin, by their account's email.
create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    join private.admins a on a.email = lower(u.email)
    where u.id = auth.uid()
  );
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- For the app: show the Admin link and page only to the admin.
create function public.am_i_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin();
$$;
revoke all on function public.am_i_admin() from public, anon;
grant execute on function public.am_i_admin() to authenticated;

-- ─── Waitlist ────────────────────────────────────────────────────────────────

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (
    char_length(email) between 3 and 254
    and email = lower(btrim(email))
    and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  name text not null check (char_length(btrim(name)) between 1 and 80 and name = btrim(name)),
  note text check (note is null or (char_length(note) <= 300 and note = btrim(note))),
  status text not null default 'waiting' check (status in ('waiting', 'invited', 'joined', 'declined')),
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;
revoke all on public.waitlist from anon, authenticated;
-- Only the admin can read it, mark someone declined, or remove an entry. Joining goes
-- through join_waitlist below, never a direct insert.
grant select, delete on public.waitlist to authenticated;
grant update (status) on public.waitlist to authenticated;
create policy "Only the admin manages the waitlist" on public.waitlist
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- Join the waitlist (signed out). The same email twice is quietly ignored, so the page
-- can't be used to learn who has already asked. At most 500 people wait at once, so it
-- can't be flooded.
create function public.join_waitlist(email text, name text, note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e text := lower(btrim(join_waitlist.email));
begin
  if (select count(*) from public.waitlist where status = 'waiting') >= 500 then
    raise exception 'The waitlist is full' using errcode = 'check_violation';
  end if;
  insert into public.waitlist (email, name, note)
  values (e, btrim(join_waitlist.name), nullif(btrim(coalesce(join_waitlist.note, '')), ''))
  on conflict on constraint waitlist_email_key do nothing;
end;
$$;
revoke all on function public.join_waitlist(text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text) to anon, authenticated;

-- ─── Invite codes ────────────────────────────────────────────────────────────

-- One code per approval. Only its SHA-256 hash is kept (the app shows the code once, to the
-- admin), so a leaked database can't be used to sign up.
create table public.signup_invites (
  id uuid primary key default gen_random_uuid(),
  waitlist_id uuid references public.waitlist (id) on delete set null,
  email text not null check (email = lower(btrim(email))),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  redeemed_at timestamptz, -- the code was entered on the sign-in page
  used_at timestamptz      -- the account was created
);
-- One open code per email: approving again replaces the old one.
create unique index signup_invites_one_open_per_email
  on public.signup_invites (email) where used_at is null;
create index signup_invites_waitlist on public.signup_invites (waitlist_id);

alter table public.signup_invites enable row level security;
revoke all on public.signup_invites from anon, authenticated;
grant select, delete on public.signup_invites to authenticated;
create policy "Only the admin sees invite codes" on public.signup_invites
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- Approve someone on the waitlist (admin only): records their new code's hash, valid for
-- 7 days, replacing any earlier unused code for that email. Refused when every place is
-- taken by an account or an open code, so approvals never promise more than 25 accounts.
create function public.create_signup_invite(waitlist_id uuid, code_hash text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.waitlist;
  expires timestamptz;
begin
  if not private.is_admin() then
    raise exception 'Only the admin can approve the waitlist' using errcode = 'insufficient_privilege';
  end if;
  perform pg_advisory_xact_lock(hashtext('dialed-kitchen:account-limit'));

  select * into w from public.waitlist where id = create_signup_invite.waitlist_id;
  if w.id is null then
    raise exception 'Not on the waitlist' using errcode = 'no_data_found';
  end if;

  delete from public.signup_invites where email = w.email and used_at is null;

  if (select count(*) from auth.users)
     + (select count(*) from public.signup_invites where used_at is null and expires_at > now())
     >= 25 then
    raise exception 'No places left' using errcode = 'check_violation';
  end if;

  insert into public.signup_invites (waitlist_id, email, code_hash)
  values (w.id, w.email, create_signup_invite.code_hash)
  returning expires_at into expires;
  update public.waitlist set status = 'invited' where id = w.id;
  return expires;
end;
$$;
revoke all on function public.create_signup_invite(uuid, text) from public, anon;
grant execute on function public.create_signup_invite(uuid, text) to authenticated;

-- Enter a code on the sign-in page (signed out). Marks it redeemed and returns the email it
-- belongs to, so the page can say which Google account to continue with; null if the code
-- is wrong, used or expired.
create function public.redeem_signup_invite(code_hash text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  e text;
begin
  update public.signup_invites
  set redeemed_at = coalesce(redeemed_at, now())
  where signup_invites.code_hash = redeem_signup_invite.code_hash
    and used_at is null
    and expires_at > now()
  returning email into e;
  return e;
end;
$$;
revoke all on function public.redeem_signup_invite(text) from public;
grant execute on function public.redeem_signup_invite(text) to anon, authenticated;

-- What the admin page shows at the top: places used and left.
create function public.admin_overview()
returns table (accounts integer, open_invites integer, waiting integer, account_limit integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only the admin' using errcode = 'insufficient_privilege';
  end if;
  return query select
    (select count(*)::integer from auth.users),
    (select count(*)::integer from public.signup_invites where used_at is null and expires_at > now()),
    (select count(*)::integer from public.waitlist where status = 'waiting'),
    25;
end;
$$;
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

-- ─── The sign-up gate ────────────────────────────────────────────────────────

-- Every new account: still at most 25, and now only with a redeemed invite code for its
-- email (the admin and the demo account excepted). The code is then used up. Same trigger
-- as before (decision 0025), so existing accounts keep signing in untouched.
create or replace function private.enforce_account_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  e text := lower(new.email);
  invite uuid;
begin
  -- Kept from decision 0026: email sign-in is switched on only so the demo can sign in with
  -- a password; nobody else may create a password (or any non-Google) account. This also
  -- means the admin exception below only ever applies to the admin's real Google account.
  if coalesce(new.raw_app_meta_data ->> 'provider', '') <> 'google'
     and coalesce(e, '') <> private.demo_email() then
    raise exception 'Only Google sign-in can create accounts' using errcode = 'check_violation';
  end if;
  -- One sign-up at a time, so two at once can't both take the last place.
  perform pg_advisory_xact_lock(hashtext('dialed-kitchen:account-limit'));
  if (select count(*) from auth.users) >= 25 then
    raise exception 'Account limit reached' using errcode = 'check_violation';
  end if;

  if e in (select email from private.admins) or e = private.demo_email() then
    return new;
  end if;

  select id into invite from public.signup_invites
  where email = e and redeemed_at is not null and used_at is null and expires_at > now()
  order by created_at desc
  limit 1
  for update;
  if invite is null then
    raise exception 'Invite required' using errcode = 'check_violation';
  end if;

  update public.signup_invites set used_at = now() where id = invite;
  update public.waitlist set status = 'joined' where email = e;
  return new;
end;
$$;

-- Whether new accounts can still be made at all (for the sign-in page's message).
create or replace function public.accepting_new_accounts()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from auth.users) < 25;
$$;
