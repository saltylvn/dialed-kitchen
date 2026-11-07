import { redirect } from "next/navigation";

// In stock moved onto the Grocery List sub-tab (docs/decisions/0030). This keeps old links
// and bookmarks working.
export default function InStockPage() {
  redirect("/grocery#in-stock");
}
