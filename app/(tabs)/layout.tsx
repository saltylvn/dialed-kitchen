import { TabBar } from "@/components/ui/TabBar";
import { signOut } from "@/features/auth/actions";
import { isDemoEmail } from "@/lib/demo";
import { getCurrentUser } from "@/lib/server/auth";

// The three main tabs share this layout: page content above, the tab bar fixed at the
// bottom. (tabs) is a route group: it groups the folders without adding to the URL.
// In the shared demo account, a banner says so (docs/decisions/0026).
export default async function TabsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <>
      {isDemoEmail(user?.email) && (
        <div
          role="note"
          className="bg-surface border-border fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4rem)] z-10 border-t px-4 py-2"
        >
          <div className="mx-auto flex max-w-md items-center gap-3 text-[14px]">
            <p className="min-w-0 flex-1">
              <span className="font-medium">You&apos;re in the demo.</span> Sample data resets
              daily.
            </p>
            <form action={signOut}>
              <button type="submit" className="min-h-11 shrink-0 font-medium underline">
                Leave demo
              </button>
            </form>
          </div>
        </div>
      )}
      {children}
      {/* Room for the demo banner, so it never covers the end of a page. */}
      {isDemoEmail(user?.email) && <div aria-hidden className="h-12" />}
      <TabBar />
    </>
  );
}
