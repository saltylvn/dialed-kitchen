// The weekly budget wheel (docs/decisions/0053): none, then $25 to $1,000 in $25 steps.
export const BUDGET_CHOICES = [0, ...Array.from({ length: 40 }, (_, i) => (i + 1) * 25)];
