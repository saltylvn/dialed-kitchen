import type { Metadata } from "next";
import { SubPage } from "@/components/ui/SubPage";
import { NewRecipe } from "@/features/recipes/components/NewRecipe";
import { requireUser } from "@/lib/server/auth";

// Reading a recipe from photos with AI can take a while (docs/decisions/0016).
export const maxDuration = 60;

export const metadata: Metadata = { title: "Add recipe · Dialed Kitchen" };

export default async function NewRecipePage() {
  await requireUser();
  return (
    <SubPage backHref="/recipes" backLabel="Recipes" title="Add recipe">
      <NewRecipe />
    </SubPage>
  );
}
