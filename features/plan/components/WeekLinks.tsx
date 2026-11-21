"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useToday } from "@/components/useToday";

// The phone knows today's date; the server doesn't (it can't know the time zone). These
// small pieces read it in the browser. Plan shows seven days starting today
// (docs/decisions/0054).

// "Today", shown only when looking at other days.
export function TodayLink({ start }: { start: string }) {
  const today = useToday();
  if (!today || start === today) return null;
  return (
    <Link
      href={`/plan?start=${today}`}
      className="border-border flex min-h-12 items-center rounded-lg border px-3 font-medium"
    >
      Today
    </Link>
  );
}

// Opening /plan with no start (the home-screen icon, an old ?week= link) moves to today.
export function GoToToday({ joined }: { joined: boolean }) {
  const router = useRouter();
  const today = useToday();
  useEffect(() => {
    if (today) router.replace(`/plan?start=${today}${joined ? "&joined=1" : ""}`);
  }, [today, joined, router]);
  return null;
}
