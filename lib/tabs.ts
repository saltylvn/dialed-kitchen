// The app's three main tabs, in order. One source of truth for the tab bar, redirects and
// the Settings back link.
export const TABS = [
  { id: "plan", href: "/plan", label: "Plan" },
  { id: "recipes", href: "/recipes", label: "Recipes" },
  { id: "grocery", href: "/grocery", label: "Grocery" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export const HOME_TAB = TABS[0];

// The tab to return to from Settings (?from=grocery). Anything unknown falls back to the
// first tab, so the parameter can never point outside the app.
export function tabFromParam(value: string | string[] | undefined) {
  return TABS.find((tab) => tab.id === value) ?? HOME_TAB;
}
