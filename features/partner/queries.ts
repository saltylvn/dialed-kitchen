import "server-only";
import { cache } from "react";
import { hashInviteToken, isWellFormedInviteToken } from "@/lib/invites";
import { createClient } from "@/lib/server/supabase";
import { householdSchema, invitePreviewSchema, type Household, type InvitePreview } from "./schema";

// Reads for the Partner feature (data access layer: server-only, validated output).

// The signed-in user's household: members, and any open invite. Cached per request.
export const getMyHousehold = cache(async (): Promise<Household> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_household");
  if (error) throw new Error(`get_my_household failed: ${error.message}`);
  return householdSchema.parse(data);
});

// What an invite link leads to, for the person who opened it.
export async function getInvitePreview(token: string): Promise<InvitePreview> {
  if (!isWellFormedInviteToken(token)) return { status: "not_found" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_household_invite", {
    token_hash: hashInviteToken(token),
  });
  if (error) throw new Error(`get_household_invite failed: ${error.message}`);
  return invitePreviewSchema.parse(data);
}
