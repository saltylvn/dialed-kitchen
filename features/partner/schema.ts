import { z } from "zod";

// Shapes of valid input and of what the database returns. Data crossing a trust boundary
// (a form, a URL, a database reply) is checked here before the app uses it.

export const inviteFormSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ message: "Enter your spouse's email address" }).max(254)),
});

const memberSchema = z.object({
  user_id: z.uuid(),
  email: z.string(),
  is_me: z.boolean(),
});

export const householdSchema = z.object({
  household_id: z.uuid(),
  is_creator: z.boolean(),
  members: z.array(memberSchema).min(1).max(2),
  open_invite: z
    .object({
      id: z.uuid(),
      invited_email: z.string(),
      expires_at: z.string(),
      expired: z.boolean(),
    })
    .nullable(),
});
export type Household = z.infer<typeof householdSchema>;

export const invitePreviewSchema = z.object({
  status: z.enum([
    "valid",
    "not_found",
    "wrong_account",
    "used",
    "revoked",
    "expired",
    "already_member",
  ]),
  inviter_email: z.string().optional(),
});
export type InvitePreview = z.infer<typeof invitePreviewSchema>;

// Our own messages from the database functions, safe to show as-is (lib/actionResult).
export const PARTNER_ERRORS = [
  "You already have a partner",
  "You can't invite yourself",
  "Invite not found",
  "This invite is no longer valid",
  "This invite is for a different account",
  "You're already in this household",
  "End your current partnership before joining another",
  "You don't have a partner",
  "The demo can't send invites",
] as const;
