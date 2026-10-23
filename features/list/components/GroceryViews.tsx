import Link from "next/link";

// The Grocery tab's two views: the shopping list and the price book.
const VIEWS = [
  { href: "/grocery", label: "List" },
  { href: "/grocery/prices", label: "Prices" },
] as const;

export function GroceryViews({ current }: { current: "/grocery" | "/grocery/prices" }) {
  return (
    <nav aria-label="Grocery views" className="border-border bg-surface flex rounded-xl border p-1">
      {VIEWS.map(({ href, label }) => {
        const active = href === current;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 flex-1 items-center justify-center rounded-lg text-[15px] ${
              active ? "bg-bg border-border border font-medium" : "text-muted"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
