-- A custom emoji per price-book item (docs/decisions/0028). The emoji is normally worked
-- out from the name (lib/foodEmoji.ts, decision 0023); this lets the household pick one
-- when the name isn't recognized or the guess is wrong. null = use the automatic one.
--
-- The app checks it's exactly one emoji (zod, with Unicode properties Postgres doesn't
-- have). The database is the backstop: short, and no letters, digits, spaces or markup,
-- so it can only ever hold a symbol, never text or HTML.
alter table public.items
  add column emoji text
    check (
      emoji is null
      or (char_length(emoji) between 1 and 16 and emoji !~ '[A-Za-z0-9[:space:]<>&"''\\]')
    );

-- Household members may set or clear it, like the name (column grants: nothing else opens up).
grant insert (emoji), update (emoji) on public.items to authenticated;
