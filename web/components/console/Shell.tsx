"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usingSamples } from "@/lib/api";
import { Glyph } from "@/components/landing/Nav";

const tabs = [
  { href: "/console", label: "Agents", match: (p: string) => p === "/console" || p.startsWith("/console/agents") },
  { href: "/console/incidents", label: "Incidents", match: (p: string) => p.startsWith("/console/incidents") },
  { href: "/console/landing", label: "Landing health", match: (p: string) => p.startsWith("/console/landing") },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-1 px-5 sm:px-8">
          <div className="flex flex-wrap items-center gap-x-10">
            <Link href="/" aria-label="Rem, back to the site" className="flex items-center gap-3 py-4 text-text">
              <Glyph size={26} />
              <span className="label !text-text">Rem console</span>
            </Link>
            <nav aria-label="Console" className="-mb-px flex">
              {tabs.map((t) => {
                const active = t.match(path);
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center border-b px-3 py-4 text-[0.8rem] transition-colors sm:px-4 ${
                      active ? "border-accent text-text" : "border-transparent text-muted hover:text-text"
                    }`}
                  >
                    {t.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <Link href="/" className="label py-3 transition-colors hover:!text-text">
            Back to site
          </Link>
        </div>
      </header>

      {usingSamples && (
        <div role="note" className="border-b border-warn/30 bg-warn/[0.06]">
          <p className="mx-auto max-w-6xl px-5 py-2.5 text-[0.8rem] text-text sm:px-8">
            <span className="mono mr-2 text-warn">SAMPLE DATA</span>
            <span className="text-muted">
              No Rem API is configured, so every wallet, signature and number here is a fixture. Set{" "}
              <span className="mono text-text">NEXT_PUBLIC_REM_API</span> to read the live API.
            </span>
          </p>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">{children}</main>
    </div>
  );
}
