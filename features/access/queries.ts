import "server-only";
import { cache } from "react";
import { z } from "zod";
import { getCurrentUser } from "@/lib/server/auth";
import { createClient } from "@/lib/server/supabase";
import {
  adminOverviewSchema,
  waitlistEntrySchema,
  type AdminOverview,
  type WaitlistEntry,
} from "./schema";

// Whether the signed-in person is the admin (docs/decisions/0043). The database decides,
// by the account's email; once per request.
export const isAdmin = cache(async (): Promise<boolean> => {
  if (!(await getCurrentUser())) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("am_i_admin");
  if (error) {
    console.error("am_i_admin failed:", error.message);
    return false;
  }
  return data === true;
});

// Everything the admin page shows. RLS returns rows only to the admin.
export async function getAdminPage(): Promise<{
  overview: AdminOverview;
  entries: WaitlistEntry[];
}> {
  const supabase = await createClient();
  const [overview, entries] = await Promise.all([
    supabase.rpc("admin_overview").single(),
    supabase
      .from("waitlist")
      .select("id, email, name, note, status, created_at")
      .order("created_at", { ascending: true })
      .limit(500),
  ]);
  if (overview.error) throw new Error(`admin_overview failed: ${overview.error.message}`);
  if (entries.error) throw new Error(`waitlist read failed: ${entries.error.message}`);
  return {
    overview: adminOverviewSchema.parse(overview.data),
    entries: z.array(waitlistEntrySchema).parse(entries.data),
  };
}
