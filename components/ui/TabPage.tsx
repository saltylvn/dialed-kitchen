import Link from "next/link";
import { TABS, type TabId } from "@/lib/tabs";

// The shared frame of each tab: the tab's name as a large title, Settings top-right,
// and room at the bottom for the tab bar. Keeps all three tabs lined up identically.
export function TabPage({ tab, children }: { tab: TabId; children: React.ReactNode }) {
  const title = TABS.find((t) => t.id === tab)?.label;
  return (
    <main className="pt-screen mx-auto w-full max-w-md px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)]">
      <header className="flex min-h-12 items-center justify-between">
        <h1 className="heading-1">{title}</h1>
        <Link
          href={`/settings?from=${tab}`}
          aria-label="Settings"
          className="text-muted -mr-2 flex size-12 items-center justify-center text-2xl"
        >
          <span aria-hidden>⚙︎</span>
        </Link>
      </header>
      <div className="mt-4">{children}</div>
    </main>
  );
}

// An empty-state card: an invitation, not an apology.
export function EmptyState({ heading, body }: { heading: string; body: string }) {
  return (
    <section className="border-border rounded-lg border border-dashed px-6 py-10 text-center">
      <h2 className="text-[20px] font-medium">{heading}</h2>
      <p className="text-muted mt-2">{body}</p>
    </section>
  );
}
