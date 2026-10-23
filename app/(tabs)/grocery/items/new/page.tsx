import type { Metadata } from "next";
import { SubPage } from "@/components/ui/SubPage";
import { CreateItemForm } from "@/features/prices/components/CreateItemForm";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Add item · Dialed Kitchen" };

export default async function NewItemPage() {
  await requireUser();
  return (
    <SubPage backHref="/grocery" backLabel="Grocery" title="Add item">
      <CreateItemForm />
    </SubPage>
  );
}
