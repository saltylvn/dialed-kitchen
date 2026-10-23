import type { Metadata } from "next";
import { EmptyState, TabPage } from "@/components/ui/TabPage";
import { getMyHousehold } from "@/features/partner/queries";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Plan · Dialed Kitchen" };

export default async function PlanPage({ searchParams }: PageProps<"/plan">) {
  const [, household, { joined }] = await Promise.all([
    requireUser(),
    getMyHousehold(),
    searchParams,
  ]);
  const partner = household.members.find((m) => !m.is_me);

  return (
    <TabPage tab="plan">
      {joined && partner && (
        <p
          role="status"
          className="border-border bg-surface mb-4 rounded-xl border p-3 text-center"
        >
          🎉 You now share your kitchen with {partner.email}.
        </p>
      )}
      <EmptyState
        heading="Plan your week"
        body="Pick meals for the days ahead, and your grocery list builds itself with an estimated cost."
      />
    </TabPage>
  );
}
