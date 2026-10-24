import type { Metadata } from "next";
import Link from "next/link";
import { TabPage } from "@/components/ui/TabPage";
import { getMyHousehold } from "@/features/partner/queries";
import { PlanWeek } from "@/features/plan/components/PlanWeek";
import { GoToThisWeek, ThisWeekLink } from "@/features/plan/components/WeekLinks";
import { WeekGroceries } from "@/features/plan/components/WeekGroceries";
import { getRecipeChoices, getWeekPlan, getWeekShopping } from "@/features/plan/queries";
import { addDays } from "@/lib/dates";
import { weekDays, weekFromParam, weekRangeLabel } from "@/lib/plan";
import { requireUser } from "@/lib/server/auth";
import { summarizeWeek } from "@/lib/weekShopping";

export const metadata: Metadata = { title: "Plan · Dialed Kitchen" };

// The weekly meal plan, Monday to Sunday. ?week=<Monday> picks the week; the tab link adds
// it from the phone's clock, and a visit without it moves to this week (GoToThisWeek).
export default async function PlanPage({ searchParams }: PageProps<"/plan">) {
  const { joined, week: weekParam } = await searchParams;
  const week = weekFromParam(weekParam);
  const [, household, entries, recipes, shopping] = await Promise.all([
    requireUser(),
    getMyHousehold(),
    week ? getWeekPlan(week) : [],
    week ? getRecipeChoices() : [],
    week ? getWeekShopping(week) : [],
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
      {week ? (
        <>
          <nav aria-label="Week" className="mb-4 flex items-center gap-1">
            <Link
              href={`/plan?week=${addDays(week, -7)}`}
              aria-label="Previous week"
              className="-ml-3 flex size-12 items-center justify-center text-2xl"
            >
              <span aria-hidden>‹</span>
            </Link>
            <p className="font-medium" aria-live="polite">
              {weekRangeLabel(week)}
            </p>
            <Link
              href={`/plan?week=${addDays(week, 7)}`}
              aria-label="Next week"
              className="flex size-12 items-center justify-center text-2xl"
            >
              <span aria-hidden>›</span>
            </Link>
            <span className="ml-auto">
              <ThisWeekLink week={week} />
            </span>
          </nav>
          {shopping.length > 0 && (
            <WeekGroceries
              key={`groceries-${week}`}
              week={week}
              summary={summarizeWeek(shopping)}
            />
          )}
          <PlanWeek key={week} days={weekDays(week)} entries={entries} recipes={recipes} />
        </>
      ) : (
        <GoToThisWeek joined={Boolean(joined)} />
      )}
    </TabPage>
  );
}
