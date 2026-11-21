"use client";

import { useState, useTransition } from "react";
import { WheelPicker } from "@/components/ui/WheelPicker";
import { DEFAULT_GOAL, GOAL_CALORIES, GOAL_PROTEIN, type Goal } from "@/lib/foodLog";
import { setGoal } from "../actions";

// My daily goal (docs/decisions/0051): calories and protein, each on a swipe wheel. Private:
// a partner never sees it.
export function GoalForm({ goal }: { goal: Goal | null }) {
  const [calories, setCalories] = useState(goal?.calories ?? DEFAULT_GOAL.calories);
  const [protein, setProtein] = useState(goal?.protein ?? DEFAULT_GOAL.protein ?? 0);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section id="goal" aria-labelledby="goal-heading" className="card scroll-mt-4 p-4">
      <h2 id="goal-heading" className="label">
        Daily goal
      </h2>
      <p className="text-muted mt-2 text-[15px]">Just for you; your partner sees only their own.</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <WheelPicker
          label="Calories"
          showLabel
          options={GOAL_CALORIES}
          value={calories}
          onChange={setCalories}
          format={(n) => n.toLocaleString("en-US")}
          rows={3}
        />
        <WheelPicker
          label="Protein (g)"
          showLabel
          options={GOAL_PROTEIN}
          value={protein}
          onChange={setProtein}
          rows={3}
        />
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            const result = await setGoal(calories, protein);
            setMessage(
              result.ok ? { ok: true, text: "✓ Goal saved" } : { ok: false, text: result.error },
            );
          })
        }
        className="btn btn-primary mt-3 w-full"
      >
        {pending ? "Saving…" : goal ? "Update goal" : "Save goal"}
      </button>
      {message && (
        <p role={message.ok ? "status" : "alert"} className="mt-2 text-[15px]">
          {message.ok ? message.text : `⚠️ ${message.text}`}
        </p>
      )}
    </section>
  );
}
