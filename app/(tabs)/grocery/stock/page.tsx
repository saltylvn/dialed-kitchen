import { redirect } from "next/navigation";

// In stock is the bottom list of the Grocery page (docs/decisions/0030, 0034). This keeps old links
// and bookmarks working.
export default function InStockPage() {
  redirect("/grocery#in-stock");
}
