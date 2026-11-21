"use client";

import { useState, useTransition } from "react";
import { WheelPicker } from "@/components/ui/WheelPicker";
import { BUDGET_CHOICES } from "@/lib/budget";
import { formatMoney } from "@/lib/pricing";
import { setWeeklyBudget } from "../actions";

// The household's weekly grocery budget (decision 0053), shared by the couple, on a swipe
// wheel in $25 steps. "None" turns it off.
export function BudgetForm({ budget }: { budget: number | null }) {
  const [amount, setAmount] = useState(budget ?? 0);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const options = BUDGET_CHOICES.includes(amount)
    ? BUDGET_CHOICES
    : [...BUDGET_CHOICES, amount].sort((a, b) => a - b);

  return (
    <section aria-labelledby="budget-heading" className="card p-4">
      <h2 id="budget-heading" className="label">
        Weekly grocery budget
      </h2>
      <p className="text-muted mt-2 text-[15px]">
        Shared with your partner. The Plan tab compares the week&apos;s groceries with it.
      </p>
      <div className="mt-3">
        <WheelPicker
          label="Weekly budget"
          options={options}
          value={amount}
          onChange={setAmount}
          format={(n) => (n === 0 ? "None" : formatMoney(n))}
          rows={3}
        />
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            const result = await setWeeklyBudget(amount === 0 ? null : amount);
            setMessage(
              result.ok
                ? { ok: true, text: amount === 0 ? "✓ Budget off" : "✓ Budget saved" }
                : { ok: false, text: result.error },
            );
          })
        }
        className="btn btn-primary mt-3 w-full"
      >
        {pending ? "Saving…" : "Save budget"}
      </button>
      {message && (
        <p role={message.ok ? "status" : "alert"} className="mt-2 text-[15px]">
          {message.ok ? message.text : `⚠️ ${message.text}`}
        </p>
      )}
    </section>
  );
}
