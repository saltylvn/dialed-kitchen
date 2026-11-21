import type { Metadata } from "next";
import { Wordmark } from "@/components/ui/Wordmark";
import { demoPassword } from "@/lib/server/demo";

export const metadata: Metadata = { title: "Open on your iPhone · Dialed Kitchen" };

// What every device other than an iPhone sees (proxy.ts, docs/decisions/0056): how to open
// the app on an iPhone, and the demo for hiring teams, which works anywhere.
export default function IPhonePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center px-4 pt-[max(env(safe-area-inset-top),4.5rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)] text-center">
      <h1>
        <Wordmark />
      </h1>
      <div aria-hidden className="bg-primary mt-9 mb-8 h-px w-7" />

      <p className="heading-1">Made for your iPhone.</p>
      <p className="text-muted mt-4">
        Dialed Kitchen is built for the store aisle, one hand on the basket.
      </p>

      <ol className="card mt-8 w-full space-y-3 p-5 text-left">
        <li>
          <span className="label block">1</span>
          On your iPhone, open Safari and go to
          <span className="mt-1 block text-[22px] font-medium tracking-[-0.015em] break-all select-all">
            dialed-kitchen.vercel.app
          </span>
        </li>
        <li>
          <span className="label block">2</span>
          Tap Share, then <span className="font-medium">Add to Home Screen</span>.
        </li>
      </ol>

      {demoPassword() && (
        <form action="/auth/demo" method="post" className="mt-auto w-full pt-10">
          <button type="submit" className="btn btn-secondary w-full">
            Try the demo here
          </button>
          <p className="text-muted mt-2 text-[14px]">
            For hiring teams: a shared demo kitchen with sample data, reset daily.
          </p>
        </form>
      )}
    </main>
  );
}
