-- A photo per price-book item, shown in place of the emoji (docs/decisions/0029).
--
-- The phone shrinks the photo to a small square JPEG (320 px, ~20 KB) before sending it,
-- so it fits in the database. Kept here rather than in file storage so it follows the same
-- rules as every other row: household RLS, and it goes away with its item (on delete
-- cascade), when a partner leaves, or when the demo resets. Its own table keeps the
-- items table lean: lists read only "has a photo, and when it changed".
create table public.item_photos (
  item_id uuid primary key,
  household_id uuid not null default private.current_household_id()
    references public.households (id) on delete cascade,
  -- A JPEG (every JPEG starts with FF D8 FF), at most 100 KB.
  photo bytea not null check (
    octet_length(photo) between 4 and 100000
    and substring(photo from 1 for 3) = '\xffd8ff'::bytea
  ),
  updated_at timestamptz not null default now(),
  -- The item must belong to the same household as the photo.
  foreign key (item_id, household_id) references public.items (id, household_id) on delete cascade
);

create index item_photos_household on public.item_photos (household_id);

-- A replaced photo gets a new updated_at, which the app puts in the photo's address so
-- phones fetch the new one instead of a cached copy.
create function private.touch_item_photo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger item_photos_touch
  before update on public.item_photos
  for each row execute function private.touch_item_photo();

alter table public.item_photos enable row level security;

revoke all on public.item_photos from anon, authenticated;
grant select, delete on public.item_photos to authenticated;
grant insert (item_id, photo), update (photo) on public.item_photos to authenticated;

create policy "Household members manage their item photos" on public.item_photos
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));
