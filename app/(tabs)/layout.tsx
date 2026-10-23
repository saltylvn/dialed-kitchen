import { TabBar } from "@/components/ui/TabBar";

// The three main tabs share this layout: page content above, the tab bar fixed at the
// bottom. (tabs) is a route group: it groups the folders without adding to the URL.
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <TabBar />
    </>
  );
}
