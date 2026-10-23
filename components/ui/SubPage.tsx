import Link from "next/link";

// A page one level inside a tab (an item, a form): a back link, a title in the display
// font, and room at the bottom for the tab bar. Matches TabPage's spacing.
export function SubPage({
  backHref,
  backLabel,
  title,
  children,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="pt-screen mx-auto w-full max-w-md px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)]">
      <Link href={backHref} className="text-muted -ml-1 inline-flex min-h-12 items-center px-1">
        ‹ {backLabel}
      </Link>
      <h1 className="font-display mt-1 text-[34px] leading-tight font-light break-words italic">
        {title}
      </h1>
      <div className="mt-4">{children}</div>
    </main>
  );
}
