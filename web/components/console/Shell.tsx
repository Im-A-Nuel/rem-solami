"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getAgents, getIncidents, usingSamples } from "@/lib/api";
import { needsAttention } from "@/lib/status";
import { Glyph } from "@/components/landing/Nav";
import { useResource } from "./ui";

const tabs = [
  { href: "/console", label: "Agents", match: (p: string) => p === "/console" || p.startsWith("/console/agents") },
  { href: "/console/incidents", label: "Incidents", match: (p: string) => p.startsWith("/console/incidents") },
  { href: "/console/landing", label: "Landing speed", short: "Speed", match: (p: string) => p.startsWith("/console/landing") },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [agents] = useResource(getAgents, "shell:agents");
  const [incidents] = useResource(() => getIncidents(), "shell:incidents");

  const attention = agents.status === "ready" ? agents.data.filter(needsAttention).length : 0;
  const incidentCount = incidents.status === "ready" ? incidents.data.items.length : null;

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 border-b border-line bg-bg">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-x-6 px-5 sm:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-x-8">
            <Link href="/" aria-label="Rem, back to the site" className="flex shrink-0 items-center gap-3 py-3 text-text">
              <Glyph size={24} />
              <span className="label hidden !text-text sm:inline">Rem console</span>
            </Link>
            <nav aria-label="Console" className="-mb-px flex min-w-0 overflow-x-auto">
              {tabs.map((t) => {
                const active = t.match(path);
                const isAgents = t.href === "/console";
                const isIncidents = t.href === "/console/incidents";
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-[0.82rem] transition-colors sm:px-4 ${
                      active ? "border-accent text-text" : "border-transparent text-muted hover:text-text"
                    }`}
                  >
                    {"short" in t ? (
                      <>
                        <span className="hidden sm:inline">{t.label}</span>
                        <span className="sm:hidden">{t.short}</span>
                      </>
                    ) : (
                      t.label
                    )}
                    {isAgents && attention > 0 && (
                      <span className="mono rounded-full bg-warn/15 px-1.5 text-[0.68rem] text-warn">
                        {attention}
                        <span className="sr-only"> need attention</span>
                      </span>
                    )}
                    {isIncidents && incidentCount !== null && incidentCount > 0 && (
                      <span className="mono text-[0.7rem] text-muted">
                        {incidentCount}
                        <span className="sr-only"> total</span>
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
          <Link href="/" className="label shrink-0 py-3 transition-colors hover:!text-text">
            <span className="hidden sm:inline">Back to site</span>
            <span className="sm:hidden">Site</span>
          </Link>
        </div>
      </header>

      {usingSamples && (
        <div role="note" className="border-b border-warn/30 bg-warn/[0.06]">
          <p className="mx-auto max-w-6xl px-5 py-2 text-[0.78rem] text-text sm:px-8">
            <span className="mono mr-2 text-warn">SAMPLE DATA</span>
            <span className="text-muted">
              No Rem API is configured, so every wallet, signature and number here is a fixture. Set{" "}
              <span className="mono text-text">NEXT_PUBLIC_REM_API</span> to read the live API.
            </span>
          </p>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-12">{children}</main>
    </div>
  );
}
