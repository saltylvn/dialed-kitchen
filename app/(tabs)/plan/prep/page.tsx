import { redirect } from "next/navigation";

// The separate meal-prep page was removed: meal prep happens on the Plan tab
// (docs/decisions/0041). This keeps old links and bookmarks working.
export default function MealPrepPage() {
  redirect("/plan");
}
