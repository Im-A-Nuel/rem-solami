"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const links = [
  { href: "#watch", label: "Mechanism" },
  { href: "#act", label: "Panic tx" },
  { href: "#proof", label: "Proof" },
  { href: "#threat", label: "Threat model" },
];

export function Glyph({ size = 30 }: { size?: number }) {
  // Placeholder mark until the owner supplies a logo: a small node graph around a lit core.
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1" opacity="0.7">
        <path d="M16 16 6 8M16 16l11-6M16 16 8 26M16 16l9 9M6 8l-2 9M27 10l2 8" />
      </g>
      <g fill="currentColor" opacity="0.9">
        <circle cx="6" cy="8" r="1.6" />
        <circle cx="27" cy="10" r="1.6" />
        <circle cx="8" cy="26" r="1.6" />
        <circle cx="25" cy="25" r="1.6" />
      </g>
      <circle cx="16" cy="16" r="3.2" fill="var(--accent)" />
    </svg>
  );
}

export default function Nav() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLink = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    firstLink.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      data-nav
      className="fixed inset-x-0 top-0 z-40 flex items-center justify-between bg-gradient-to-b from-bg/95 via-bg/70 to-transparent px-5 pb-8 pt-5 sm:px-10"
    >
      <div className="flex items-center gap-10">
        <a href="#top" aria-label="Rem, back to top" className="flex items-center gap-3 text-text">
          <Glyph />
          <span className="label !text-text">Rem</span>
        </a>
        <nav aria-label="Sections" className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="label py-3 transition-colors hover:!text-text">
              {l.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <Link href="/console" className="btn hidden sm:inline-flex">
          Console
        </Link>
        <button
          ref={toggleRef}
          type="button"
          className="flex size-11 items-center justify-center md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="relative block h-3 w-6">
            <span
              className={`absolute left-0 h-px w-6 bg-text transition-all ${open ? "top-1.5 rotate-45" : "top-0"}`}
            />
            <span
              className={`absolute left-0 h-px w-6 bg-text transition-all ${open ? "top-1.5 -rotate-45" : "top-3"}`}
            />
          </span>
        </button>
      </div>

      {open && (
        <div
          id="mobile-menu"
          className="fixed inset-0 -z-10 flex flex-col justify-center gap-2 bg-bg/95 px-8 backdrop-blur-sm md:hidden"
        >
          {links.map((l, i) => (
            <a
              key={l.href}
              ref={i === 0 ? firstLink : undefined}
              href={l.href}
              onClick={() => setOpen(false)}
              className="display py-2 text-4xl"
            >
              {l.label}
            </a>
          ))}
          <Link href="/console" className="btn mt-6 self-start" onClick={() => setOpen(false)}>
            Console
          </Link>
        </div>
      )}
    </header>
  );
}
