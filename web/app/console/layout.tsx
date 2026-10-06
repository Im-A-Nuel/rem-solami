import type { Metadata } from "next";
import Shell from "@/components/console/Shell";

export const metadata: Metadata = {
  title: "Rem console",
  description: "Read-only view of Rem agents, panic transactions, incidents and landing health.",
};

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
