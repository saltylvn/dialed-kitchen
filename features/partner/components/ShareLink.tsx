"use client";

import { useState } from "react";

// Shows a freshly created invite link with Share (the iPhone share sheet: Messages, Mail…)
// and Copy buttons. The link is shown only this once.
export function ShareLink({ link, email }: { link: string; email: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function share() {
    try {
      await navigator.share({ title: "Join my kitchen on Dialed Kitchen", url: link });
    } catch {
      // Closing the share sheet isn't an error worth showing.
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-4">
      <p className="font-medium">Invite link for {email}</p>
      <p className="text-muted mt-1 text-[15px]">
        Send it by text. It works once, only for {email}, for 7 days. For your security it&apos;s
        shown only now.
      </p>
      <p className="border-border bg-bg mt-3 rounded-lg border p-3 text-[15px] break-all select-all">
        {link}
      </p>
      <div className="mt-3 flex gap-3">
        {canShare && (
          <button
            type="button"
            onClick={share}
            className="bg-accent text-on-accent min-h-12 flex-1 rounded-xl font-medium"
          >
            Share
          </button>
        )}
        <button
          type="button"
          onClick={copy}
          className="border-border bg-surface min-h-12 flex-1 rounded-xl border font-medium"
        >
          {copied ? "✓ Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
