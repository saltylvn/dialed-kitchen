import { redirect } from "next/navigation";
import { HOME_TAB } from "@/lib/tabs";

// Opening the app lands on the first tab.
export default function Home() {
  redirect(HOME_TAB.href);
}
