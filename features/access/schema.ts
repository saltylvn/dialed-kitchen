import { z } from "zod";

// Invite-only sign-up (docs/decisions/0043): the waitlist form, the invite-code form, and
// the admin page's data. The database checks all of this again.

export const waitlistFormSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80, "Use 80 characters or fewer"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ message: "Enter your email address" }).max(254)),
  note: z
    .string()
    .trim()
    .max(300, "Keep the note to 300 characters")
    .transform((s) => (s === "" ? null : s)),
});

export const inviteCodeFormSchema = z.object({
  code: z.string().trim().min(1, "Enter your invite code").max(40, "That isn't an invite code"),
});

export const WAITLIST_STATUSES = ["waiting", "invited", "joined", "declined"] as const;

export const waitlistEntrySchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
  note: z.string().nullable(),
  status: z.enum(WAITLIST_STATUSES),
  created_at: z.string(),
});
export type WaitlistEntry = z.infer<typeof waitlistEntrySchema>;

export const adminOverviewSchema = z.object({
  accounts: z.number().int(),
  open_invites: z.number().int(),
  waiting: z.number().int(),
  account_limit: z.number().int(),
});
export type AdminOverview = z.infer<typeof adminOverviewSchema>;

// Friendly messages raised by the database functions, safe to show as-is.
export const ACCESS_ERRORS = ["The waitlist is full", "No places left"] as const;
