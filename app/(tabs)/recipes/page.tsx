import type { Metadata } from "next";
import { EmptyState, TabPage } from "@/components/ui/TabPage";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Recipes · Dialed Kitchen" };

export default async function RecipesPage() {
  await requireUser();

  return (
    <TabPage tab="recipes">
      <EmptyState
        heading="Your recipe box"
        body="Save favorites from websites, or snap a page from a cookbook or magazine."
      />
    </TabPage>
  );
}
