import type { Metadata } from "next";
import { SubPage } from "@/components/ui/SubPage";
import { NewRecipe } from "@/features/recipes/components/NewRecipe";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Add recipe · Dialed Kitchen" };

export default async function NewRecipePage() {
  await requireUser();
  return (
    <SubPage backHref="/recipes" backLabel="Recipes" title="Add recipe">
      <NewRecipe />
    </SubPage>
  );
}
