-- Partner sharing (docs/decisions/0009).
--
-- All app data belongs to a household. Every user always belongs to exactly one household:
-- their own (created automatically), or the one they joined as a spouse by invitation.
-- Rules enforced here in the database, not only in app code:
--   * each person is in exactly one household            (unique user_id)
--   * a household has at most two people                 (trigger, with a row lock)
--   * one open invite per household                      (partial unique index)
--   * invites are tied to an email, single-use, expire after 7 days, stored only as a hash
--   * only members can see a household, and all changes go through the functions below
--     (no direct writes to these tables from the app)

create schema if not exists private;

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table public.households (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  constraint one_household_per_person unique (user_id)
);

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  invited_email text not null
    check (invited_email = lower(btrim(invited_email))
           and char_length(invited_email) between 3 and 254
           and invited_email like '_%@_%'),
  -- SHA-256 of the random token in the invite link. The link itself is never stored.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  check (expires_at > created_at),
  check ((accepted_at is null) = (accepted_by is null))
);

-- One open (not accepted, not revoked) invite per household.
create unique index household_invites_one_open
  on public.household_invites (household_id)
  where accepted_at is null and revoked_at is null;

create index household_invites_household_id on public.household_invites (household_id);
create index households_created_by on public.households (created_by);
create index household_invites_created_by on public.household_invites (created_by);
create index household_invites_accepted_by on public.household_invites (accepted_by);

-- ─── At most two people per household ────────────────────────────────────────

create function private.enforce_two_member_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Lock the household row so two people joining at the same moment can't both slip in.
  perform 1 from public.households where id = new.household_id for update;
  if (select count(*) from public.household_members where household_id = new.household_id) >= 2 then
    raise exception 'A household can have at most two people'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger household_members_two_member_limit
  before insert on public.household_members
  for each row execute function private.enforce_two_member_limit();

-- ─── Helpers used by row-level security (and by every future data table) ─────

-- The signed-in user's household. Future tables use it as their household_id default.
create function private.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select household_id from public.household_members where user_id = auth.uid();
$$;

create function private.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household_id and user_id = auth.uid()
  );
$$;

-- Creates a household of one for a user (internal; never callable by the app).
create function private.create_solo_household(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_household_id uuid;
begin
  insert into public.households (created_by) values (target_user_id)
    returning id into new_household_id;
  insert into public.household_members (household_id, user_id)
    values (new_household_id, target_user_id);
  return new_household_id;
end;
$$;

-- ─── Every new user gets a household automatically ───────────────────────────

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.create_solo_household(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Users who signed up before this migration.
select private.create_solo_household(u.id)
from auth.users u
where not exists (select 1 from public.household_members m where m.user_id = u.id);

-- ─── Row-level security: members only, read only ─────────────────────────────

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;

-- Supabase grants table access to its API roles by default; start from nothing.
revoke all on public.households, public.household_members, public.household_invites
  from anon, authenticated;
grant select on public.households, public.household_members to authenticated;
-- household_invites: no direct access at all (it holds token hashes); use the functions.

create policy "Members can see their household"
  on public.households for select to authenticated
  using (private.is_household_member(id));

create policy "Members can see who is in their household"
  on public.household_members for select to authenticated
  using (private.is_household_member(household_id));

-- ─── App functions (the only way to change households) ───────────────────────
-- security definer: they run with the owner's rights, so each one checks the caller itself.

-- The caller's household, partner and open invite, for the Partner screen.
create function public.get_my_household()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'household_id', h.id,
    'is_creator', h.created_by = auth.uid(),
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'email', u.email,
        'is_me', m.user_id = auth.uid(),
        'joined_at', m.joined_at
      ) order by m.joined_at), '[]'::jsonb)
      from public.household_members m
      join auth.users u on u.id = m.user_id
      where m.household_id = h.id
    ),
    'open_invite', (
      select jsonb_build_object(
        'id', i.id,
        'invited_email', i.invited_email,
        'expires_at', i.expires_at,
        'expired', i.expires_at <= now()
      )
      from public.household_invites i
      where i.household_id = h.id and i.accepted_at is null and i.revoked_at is null
    )
  )
  from public.households h
  where h.id = private.current_household_id();
$$;

-- Invite your spouse. Replaces any earlier open invite. The app creates the random token
-- and sends only its SHA-256 hash, so the database never sees a usable link.
create function public.create_household_invite(invited_email text, token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  my_household uuid := private.current_household_id();
  email_normalized text := lower(btrim(invited_email));
  caller_email text;
  new_invite_id uuid;
begin
  if caller is null or my_household is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;

  perform 1 from public.households where id = my_household for update;

  if (select count(*) from public.household_members where household_id = my_household) >= 2 then
    raise exception 'You already have a partner' using errcode = 'check_violation';
  end if;

  select lower(email) into caller_email from auth.users where id = caller;
  if email_normalized = caller_email then
    raise exception 'You can''t invite yourself' using errcode = 'check_violation';
  end if;

  update public.household_invites
    set revoked_at = now()
    where household_id = my_household and accepted_at is null and revoked_at is null;

  insert into public.household_invites (household_id, invited_email, token_hash, created_by)
    values (my_household, email_normalized, create_household_invite.token_hash, caller)
    returning id into new_invite_id;
  return new_invite_id;
end;
$$;

-- Cancel your household's open invite.
create function public.revoke_household_invite(invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.household_invites
    set revoked_at = now()
    where id = invite_id
      and household_id = private.current_household_id()
      and accepted_at is null and revoked_at is null;
  if not found then
    raise exception 'Invite not found' using errcode = 'no_data_found';
  end if;
end;
$$;

-- What the invite page shows before accepting. Reveals details only to the invited person.
create function public.get_household_invite(token_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  invite public.household_invites;
  caller_email text;
  inviter_email text;
begin
  select * into invite from public.household_invites i where i.token_hash = get_household_invite.token_hash;
  if invite.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select lower(email) into caller_email from auth.users where id = auth.uid();
  if caller_email is distinct from invite.invited_email then
    return jsonb_build_object('status', 'wrong_account');
  end if;

  select email into inviter_email from auth.users where id = invite.created_by;
  return jsonb_build_object(
    'status', case
      when invite.accepted_at is not null then 'used'
      when invite.revoked_at is not null then 'revoked'
      when invite.expires_at <= now() then 'expired'
      when private.current_household_id() = invite.household_id then 'already_member'
      else 'valid'
    end,
    'inviter_email', inviter_email
  );
end;
$$;

-- Join your spouse's household. The caller must be signed in with the invited email, and
-- must not already have a partner. Their solo household is set aside (kept, never merged).
create function public.accept_household_invite(token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_email text;
  invite public.household_invites;
  old_household uuid := private.current_household_id();
begin
  if caller is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;

  select * into invite from public.household_invites i
    where i.token_hash = accept_household_invite.token_hash
    for update;

  if invite.id is null or invite.accepted_at is not null or invite.revoked_at is not null
     or invite.expires_at <= now() then
    raise exception 'This invite is no longer valid' using errcode = 'check_violation';
  end if;

  select lower(email) into caller_email from auth.users where id = caller;
  if caller_email is distinct from invite.invited_email then
    raise exception 'This invite is for a different account' using errcode = 'insufficient_privilege';
  end if;

  if old_household = invite.household_id then
    raise exception 'You''re already in this household' using errcode = 'check_violation';
  end if;

  if old_household is not null
     and (select count(*) from public.household_members where household_id = old_household) >= 2 then
    raise exception 'End your current partnership before joining another' using errcode = 'check_violation';
  end if;

  delete from public.household_members where user_id = caller;
  -- The two-member trigger rejects this if the household is somehow already full.
  insert into public.household_members (household_id, user_id) values (invite.household_id, caller);

  update public.household_invites
    set accepted_at = now(), accepted_by = caller
    where id = invite.id;

  return invite.household_id;
end;
$$;

-- End the partnership (either partner can). The household and its data stay with the
-- person who created it; the other partner starts fresh in a new household of their own.
create function public.end_partnership()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  my_household uuid := private.current_household_id();
  household_creator uuid;
  leaving_user uuid;
begin
  if caller is null or my_household is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;

  select created_by into household_creator from public.households where id = my_household for update;

  select user_id into leaving_user from public.household_members
    where household_id = my_household and user_id <> household_creator;

  if leaving_user is null then
    raise exception 'You don''t have a partner' using errcode = 'check_violation';
  end if;

  delete from public.household_members where user_id = leaving_user;
  perform private.create_solo_household(leaving_user);
end;
$$;

-- ─── Who may call what ───────────────────────────────────────────────────────

-- Postgres lets everyone run new functions by default; lock that down.
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function
  public.get_my_household(),
  public.create_household_invite(text, text),
  public.revoke_household_invite(uuid),
  public.get_household_invite(text),
  public.accept_household_invite(text),
  public.end_partnership()
  from public, anon;

grant execute on function
  public.get_my_household(),
  public.create_household_invite(text, text),
  public.revoke_household_invite(uuid),
  public.get_household_invite(text),
  public.accept_household_invite(text),
  public.end_partnership()
  to authenticated;

-- RLS policies call these as the signed-in user.
grant usage on schema private to authenticated;
grant execute on function private.is_household_member(uuid), private.current_household_id()
  to authenticated;
