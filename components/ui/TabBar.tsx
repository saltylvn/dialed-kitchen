"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TABS, type TabId } from "@/lib/tabs";

// The bottom tab bar: Plan · Recipes · Grocery (the list and prices). A small client
// component (it only needs the current path to highlight the active tab); the pages
// themselves stay on the server. The active tab is marked three ways (bar, weight,
// aria-current), never by color alone.

const ICONS: Record<TabId, () => React.JSX.Element> = {
  plan: PlanIcon,
  recipes: RecipesIcon,
  grocery: GroceryIcon,
};

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="border-border bg-surface fixed inset-x-0 bottom-0 z-10 border-t pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map(({ id, href, label }) => {
          const Icon = ICONS[id];
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-16 flex-col items-center justify-center gap-1 text-[13px] ${
                  active ? "text-text font-medium" : "text-muted"
                }`}
              >
                {active && (
                  <span aria-hidden className="bg-accent absolute top-0 h-0.5 w-10 rounded-full" />
                )}
                <Icon />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Simple line icons, drawn with the current text color.
const iconProps = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function PlanIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

function RecipesIcon() {
  return (
    <svg {...iconProps}>
      <path d="M5 4.5h11a2.5 2.5 0 0 1 2.5 2.5v12.5H7.5A2.5 2.5 0 0 1 5 17V4.5Z" />
      <path d="M5 17a2.5 2.5 0 0 1 2.5-2.5h11M9 8.5h6" />
    </svg>
  );
}

function GroceryIcon() {
  return (
    <svg {...iconProps}>
      <path d="M5 8.5h14l-1.2 10a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8.5Z" />
      <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
    </svg>
  );
}
