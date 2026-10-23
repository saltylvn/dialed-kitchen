import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SubPage } from "@/components/ui/SubPage";
import { deleteRecipe } from "@/features/recipes/actions";
import { RecipeForm } from "@/features/recipes/components/RecipeForm";
import { getRecipeForEdit } from "@/features/recipes/queries";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Edit recipe · Dialed Kitchen" };

export default async function EditRecipePage({ params }: PageProps<"/recipes/[id]/edit">) {
  const [, { id }] = await Promise.all([requireUser(), params]);
  const recipe = await getRecipeForEdit(id);
  if (!recipe) notFound();

  return (
    <SubPage backHref={`/recipes?open=${recipe.id}`} backLabel="Recipes" title="Edit recipe">
      <RecipeForm recipe={recipe} />
      <details className="mt-6 px-1">
        <summary className="text-muted min-h-12 cursor-pointer content-center text-[15px]">
          Delete this recipe…
        </summary>
        <p className="mt-2 text-[15px]">Removes {recipe.title} for both of you.</p>
        <form action={deleteRecipe} className="mt-3">
          <input type="hidden" name="recipeId" value={recipe.id} />
          <button
            type="submit"
            className="border-border min-h-12 w-full rounded-xl border font-medium"
          >
            Delete {recipe.title}
          </button>
        </form>
      </details>
    </SubPage>
  );
}
