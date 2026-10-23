-- A daily limit on AI requests per person (docs/decisions/0016). The Gemini free quota is
-- shared by everyone who can sign in, so no one person can use it all up.

create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index ai_requests_user_recent on public.ai_requests (user_id, created_at desc);

alter table public.ai_requests enable row level security;
revoke all on public.ai_requests from anon, authenticated;
grant select on public.ai_requests to authenticated;

create policy "People see their own AI requests" on public.ai_requests
  for select to authenticated using (user_id = auth.uid());

-- Takes one AI request from the caller's allowance for the last 24 hours, if any is left.
-- Returns true (and records the request) or false (over the limit). The per-person lock
-- makes "count, then record" one step: two requests at the same moment can't both slip
-- past the limit. The request is recorded before the AI answers, so failures still count
-- and can't be used to hammer the service.
create function public.take_ai_request(daily_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'Not signed in' using errcode = 'insufficient_privilege';
  end if;
  if daily_limit < 1 or daily_limit > 500 then
    raise exception 'Invalid limit' using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(hashtext('ai_requests:' || caller::text));

  if (select count(*) from public.ai_requests
      where user_id = caller and created_at > now() - interval '24 hours') >= daily_limit then
    return false;
  end if;

  insert into public.ai_requests (user_id) values (caller);
  return true;
end;
$$;

revoke all on function public.take_ai_request(integer) from public, anon;
grant execute on function public.take_ai_request(integer) to authenticated;
