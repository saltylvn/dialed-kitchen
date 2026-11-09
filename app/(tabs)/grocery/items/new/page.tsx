import type { Metadata } from "next";
import { SubPage } from "@/components/ui/SubPage";
import { CreateItemForm } from "@/features/prices/components/CreateItemForm";
import { itemFormSchema } from "@/features/prices/schema";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Add item · Dialed Kitchen" };

// ?name= fills in the name (Log price on a list entry that isn't in the price book yet).
// It's only a starting value: validated like the form, and dropped if it isn't valid.
export default async function NewItemPage({ searchParams }: PageProps<"/grocery/items/new">) {
  const [, { name }] = await Promise.all([requireUser(), searchParams]);
  const defaultName = itemFormSchema.shape.name.safeParse(name);
  return (
    <SubPage backHref="/grocery/prices" backLabel="Price book" title="Add item">
      <CreateItemForm defaultName={defaultName.success ? defaultName.data : ""} />
    </SubPage>
  );
}
