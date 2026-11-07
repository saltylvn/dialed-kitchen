import { z } from "zod";
import { getCurrentUser } from "@/lib/server/auth";
import { createClient } from "@/lib/server/supabase";

// An item's photo (docs/decisions/0029), served by the app itself so it's same-origin (the
// strict CSP needs no change) and read with the signed-in person's session (RLS: only
// their household's photos). The address carries ?v=<when it changed>, so a phone can
// keep it cached for good and still fetches a replaced photo.
export async function GET(_request: Request, ctx: RouteContext<"/grocery/items/[id]/photo">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return notFound();
  if (!(await getCurrentUser())) return new Response(null, { status: 401 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("item_photos")
    .select("photo")
    .eq("item_id", id)
    .maybeSingle();
  if (error) {
    console.error("item photo read failed:", error.message);
    return new Response(null, { status: 500 });
  }
  // bytea arrives as hex text: \xffd8ff…
  const hex = z
    .string()
    .regex(/^\\x[0-9a-f]+$/)
    .safeParse(data?.photo);
  if (!hex.success) return notFound();

  return new Response(Buffer.from(hex.data.slice(2), "hex"), {
    headers: {
      "Content-Type": "image/jpeg",
      // Private: never stored by a shared cache or CDN, only by this person's browser.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function notFound() {
  return new Response(null, { status: 404 });
}
