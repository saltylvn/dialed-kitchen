// The app's three main tabs, in their bottom-bar order: Recipes · Plan · Grocery, with Plan
// in the middle (docs/decisions/0036). One source of truth for the tab bar, redirects and
// the Settings back link.
export const TABS = [
  { id: "recipes", href: "/recipes", label: "Recipes" },
  { id: "plan", href: "/plan", label: "Plan" },
  { id: "grocery", href: "/grocery", label: "Grocery" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

// Where the app opens (/ redirects here; the home-screen start_url matches): Plan, chosen by
// name, not by position, so reordering the tabs never changes it.
export const HOME_TAB = TABS.find((tab) => tab.id === "plan")!;

// The tab to return to from Settings (?from=grocery). Anything unknown falls back to the
// home tab, so the parameter can never point outside the app.
export function tabFromParam(value: string | string[] | undefined) {
  return TABS.find((tab) => tab.id === value) ?? HOME_TAB;
}
