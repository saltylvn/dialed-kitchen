import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubPage } from "@/components/ui/SubPage";
import { getRecipeChoices, getWeekPlan, getWeekShopping } from "@/features/plan/queries";
import { formatAmount } from "@/lib/list";
import { batchRecipes, sharedIngredients, whenLabel } from "@/lib/mealPrep";
import { weekFromParam, weekRangeLabel } from "@/lib/plan";
import { requireUser } from "@/lib/server/auth";
import { isUnit } from "@/lib/units";

export const metadata: Metadata = { title: "Meal prep · Dialed Kitchen" };

const card = "border-border bg-surface rounded-2xl border p-4";
const heading = "text-muted text-[12px] tracking-[0.2em] uppercase";

// Meal prep for one week (docs/decisions/0022): recipes to batch-cook (planned more than
// once) and ingredients to prep once (shared by several meals), with the week's totals. The
// amounts come from the same week_shopping as the grocery list, so they always agree.
export default async function MealPrepPage({ searchParams }: PageProps<"/plan/prep">) {
  const { week: weekParam } = await searchParams;
  const week = weekFromParam(weekParam);
  if (!week) notFound();
  const [, entries, recipes, shopping] = await Promise.all([
    requireUser(),
    getWeekPlan(week),
    getRecipeChoices(),
    getWeekShopping(week),
  ]);

  const batches = batchRecipes(entries, new Map(recipes.map((r) => [r.id, r.title])));
  const shared = sharedIngredients(shopping);

  return (
    <SubPage backHref={`/plan?week=${week}`} backLabel="Plan" title="Meal prep">
      <p className="text-muted -mt-2 mb-4">{weekRangeLabel(week)}</p>
      <div className="space-y-4">
        {entries.length === 0 && (
          <p className={card}>Plan some meals for this week first, then come back to prep.</p>
        )}

        {entries.length > 0 && (
          <section aria-labelledby="batch-heading" className={card}>
            <h2 id="batch-heading" className={heading}>
              Batch cook
            </h2>
            {batches.length === 0 ? (
              <p className="text-muted mt-2">No recipe is planned twice this week.</p>
            ) : (
              <ul className="mt-1 divide-y divide-[var(--border)]">
                {batches.map((b) => (
                  <li key={b.recipeId} className="py-3">
                    <Link
                      href={`/recipes?open=${b.recipeId}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {b.title}
                    </Link>{" "}
                    <span className="text-muted">×{b.times}</span>
                    <p>Cook {b.servings} servings at once</p>
                    <p className="text-muted text-[15px]">
                      {b.uses.map((u) => whenLabel(u.date, u.meal)).join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {entries.length > 0 && (
          <section aria-labelledby="shared-heading" className={card}>
            <h2 id="shared-heading" className={heading}>
              Prep once
            </h2>
            <p className="text-muted mt-1 text-[15px]">
              Ingredients more than one meal uses: wash, chop or cook them together.
            </p>
            {shared.length === 0 ? (
              <p className="text-muted mt-2">No ingredient is shared between meals this week.</p>
            ) : (
              <ul className="mt-1 divide-y divide-[var(--border)]">
                {shared.map((s) => (
                  <li key={`${s.name}-${s.unit}`} className="py-3">
                    <p>
                      <span className="font-medium tabular-nums">
                        {formatAmount(s.quantity, isUnit(s.unit) ? s.unit : null)}
                      </span>{" "}
                      {s.name}
                    </p>
                    <p className="text-muted text-[15px]">
                      {s.uses.map((u) => `${whenLabel(u.date, u.meal)} (${u.recipe})`).join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </SubPage>
  );
}
