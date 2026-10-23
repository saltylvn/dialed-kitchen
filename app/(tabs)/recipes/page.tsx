import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, TabPage } from "@/components/ui/TabPage";
import { RecipeBox } from "@/features/recipes/components/RecipeBox";
import { listRecipes } from "@/features/recipes/queries";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Recipes · Dialed Kitchen" };

// The recipe box: favorites first, then the rest. Tap a recipe to open it and cook from it.
// ?open=<id> opens one (after saving it, for example).
export default async function RecipesPage({ searchParams }: PageProps<"/recipes">) {
  const [, recipes, { open }] = await Promise.all([requireUser(), listRecipes(), searchParams]);
  const openId = typeof open === "string" && recipes.some((r) => r.id === open) ? open : null;

  return (
    <TabPage tab="recipes">
      <div className="mb-5 flex justify-end">
        <Link
          href="/recipes/new"
          className="bg-accent text-on-accent flex min-h-12 items-center rounded-xl px-4 font-medium"
        >
          Add recipe
        </Link>
      </div>
      {recipes.length === 0 ? (
        <EmptyState
          heading="Your recipe box"
          body="Add the recipes you two make, from a website, a cookbook, a magazine or your own. Star favorites to keep them at the top."
        />
      ) : (
        <RecipeBox recipes={recipes} initialOpenId={openId} />
      )}
    </TabPage>
  );
}
