-- Which meals a recipe is for (docs/decisions/0021): any of Breakfast, Lunch, Snacks, Dinner.
-- The Recipes tab groups by them, and the Plan picker offers only that meal's recipes.
-- Empty means "not sorted yet" (existing recipes start there).

alter table public.recipes
  add column meals text[] not null default '{}'
    check (
      meals <@ array['breakfast', 'lunch', 'snacks', 'dinner']::text[]
      and cardinality(meals) <= 4
    );

grant insert (meals), update (meals) on public.recipes to authenticated;

-- save_recipe with nutrition and meals, still one transaction: saves everything with the
-- 9-argument version, then the meals (sorted and without repeats). security invoker, so
-- RLS, grants and the check above apply. The older versions stay, so the app version
-- running during a deploy keeps working.
create function public.save_recipe(
  recipe_id uuid,
  title text,
  servings smallint,
  source_type text,
  source_name text,
  source_url text,
  steps text[],
  ingredients jsonb,
  nutrition jsonb,
  meals text[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_id uuid;
begin
  saved_id := public.save_recipe(recipe_id, title, servings, source_type, source_name,
                                 source_url, steps, ingredients, nutrition);

  update public.recipes r
    -- In meal order, each once: {dinner, breakfast, dinner} → {breakfast, dinner}.
    set meals = array(
      select m from unnest(array['breakfast', 'lunch', 'snacks', 'dinner']) with ordinality as o(m, n)
      where m = any (save_recipe.meals)
      order by n
    )
    where r.id = saved_id;

  -- Anything that isn't one of the four meals is refused (the column check can't see it
  -- after the filtering above).
  if exists (
    select 1 from unnest(coalesce(save_recipe.meals, '{}')) as m
    where m not in ('breakfast', 'lunch', 'snacks', 'dinner')
  ) then
    raise exception 'Invalid meal' using errcode = 'check_violation';
  end if;

  return saved_id;
end;
$$;

revoke all on function public.save_recipe(uuid, text, smallint, text, text, text, text[], jsonb, jsonb, text[])
  from public, anon;
grant execute on function public.save_recipe(uuid, text, smallint, text, text, text, text[], jsonb, jsonb, text[])
  to authenticated;
