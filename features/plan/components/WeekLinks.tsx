"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useToday } from "@/components/useToday";
import { mondayOf } from "@/lib/plan";

// The phone knows today's date; the server doesn't (it can't know the time zone). These
// small pieces read it in the browser.

// "This week", shown only when looking at another week.
export function ThisWeekLink({ week }: { week: string }) {
  const today = useToday();
  if (!today || mondayOf(today) === week) return null;
  return (
    <Link
      href={`/plan?week=${mondayOf(today)}`}
      className="border-border flex min-h-12 items-center rounded-xl border px-3 font-medium"
    >
      This week
    </Link>
  );
}

// Opening /plan with no week (the home-screen icon, an old link) moves to this week.
export function GoToThisWeek({ joined }: { joined: boolean }) {
  const router = useRouter();
  const today = useToday();
  useEffect(() => {
    if (today) router.replace(`/plan?week=${mondayOf(today)}${joined ? "&joined=1" : ""}`);
  }, [today, joined, router]);
  return null;
}
