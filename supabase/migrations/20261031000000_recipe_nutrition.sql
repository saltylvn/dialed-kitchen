-- Nutrition per serving on recipes (docs/decisions/0018): calories and macros, all optional.
-- They feed the Calories and Macros totals on the Plan tab.

alter table public.recipes
  add column calories smallint check (calories between 0 and 5000),
  add column protein_g numeric(5, 1) check (protein_g between 0 and 1000),
  add column carbs_g numeric(5, 1) check (carbs_g between 0 and 1000),
  add column fat_g numeric(5, 1) check (fat_g between 0 and 1000);

grant insert (calories, protein_g, carbs_g, fat_g),
      update (calories, protein_g, carbs_g, fat_g)
  on public.recipes to authenticated;

-- save_recipe plus nutrition, still in one transaction: saves the recipe and ingredients
-- with the existing function, then its nutrition. security invoker, like save_recipe, so
-- RLS, grants and the checks above all apply. The 8-argument version stays, so the app
-- version running during a deploy keeps working.
-- nutrition: { "calories": 450, "protein_g": 32.5, "carbs_g": null, "fat_g": 12 }
create function public.save_recipe(
  recipe_id uuid,
  title text,
  servings smallint,
  source_type text,
  source_name text,
  source_url text,
  steps text[],
  ingredients jsonb,
  nutrition jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_id uuid;
begin
  if jsonb_typeof(nutrition) is distinct from 'object' then
    raise exception 'Invalid nutrition' using errcode = 'check_violation';
  end if;

  saved_id := public.save_recipe(recipe_id, title, servings, source_type, source_name,
                                 source_url, steps, ingredients);

  update public.recipes r
    set calories = (nutrition ->> 'calories')::smallint,
        protein_g = (nutrition ->> 'protein_g')::numeric,
        carbs_g = (nutrition ->> 'carbs_g')::numeric,
        fat_g = (nutrition ->> 'fat_g')::numeric
    where r.id = saved_id;

  return saved_id;
end;
$$;

revoke all on function public.save_recipe(uuid, text, smallint, text, text, text, text[], jsonb, jsonb)
  from public, anon;
grant execute on function public.save_recipe(uuid, text, smallint, text, text, text, text[], jsonb, jsonb)
  to authenticated;
