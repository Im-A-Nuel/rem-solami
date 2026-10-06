"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usingSamples } from "@/lib/api";
import type { AgentMode, AgentStatus, IncidentStatus } from "@/lib/types";

export type Resource<T> =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "ready"; data: T };

export function useResource<T>(load: () => Promise<T>, key: string): [Resource<T>, () => void] {
  const [state, setState] = useState<Resource<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setState({ status: "loading" });
    load().then(
      (data) => live && setState({ status: "ready", data }),
      (error: Error) => live && setState({ status: "error", error }),
    );
    return () => {
      live = false;
    };
    // `load` is recreated every render by design; `key` identifies what is being loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return [state, retry];
}

export const statusColor: Record<AgentStatus, string> = {
  armed: "var(--accent)",
  stale: "var(--warn)",
  tripped: "var(--danger)",
  disarmed: "var(--muted)",
};

const statusText: Record<AgentStatus, string> = {
  armed: "Armed",
  stale: "Stale",
  tripped: "Tripped",
  disarmed: "Disarmed",
};

export function StatusBadge({ status, size = "md" }: { status: AgentStatus; size?: "md" | "lg" }) {
  return (
    <span className={`inline-flex items-center gap-2 text-text ${size === "lg" ? "text-[1.05rem]" : "text-[0.88rem]"}`}>
      <span
        aria-hidden="true"
        className={`rounded-full ${size === "lg" ? "size-2.5" : "size-2"}`}
        style={{ background: statusColor[status] }}
      />
      {statusText[status]}
    </span>
  );
}

/**
 * Placeholder identity for an agent: a small node graph whose shape comes from its name, with the
 * status as a badge dot. Stands in for a logo until the owner supplies one.
 */
export function AgentGlyph({ name, status }: { name: string; status: AgentStatus }) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  const rnd = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const pts = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * Math.PI * 2 + rnd() * 0.9;
    const r = 11 + rnd() * 7;
    return [Math.round((22 + Math.cos(a) * r) * 10) / 10, Math.round((22 + Math.sin(a) * r) * 10) / 10] as const;
  });
  return (
    <span className="relative inline-flex size-12 shrink-0">
      <svg viewBox="0 0 44 44" className="size-12 rounded-full border border-line-strong bg-bg" fill="none" aria-hidden="true">
        <g stroke="var(--muted)" strokeWidth="0.9" opacity="0.7">
          {pts.map(([x, y], i) => (
            <path key={i} d={`M22 22L${x} ${y}`} />
          ))}
        </g>
        <g fill="var(--text)" opacity="0.85">
          {pts.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.7" />
          ))}
        </g>
        <circle cx="22" cy="22" r="3.4" fill="var(--accent)" />
      </svg>
      <span
        aria-hidden="true"
        className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-bg"
        style={{ background: statusColor[status] }}
      />
    </span>
  );
}

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const map: Record<IncidentStatus, { color: string; text: string }> = {
    alerted: { color: "var(--warn)", text: "Alerted" },
    sent: { color: "var(--accent)", text: "Sent" },
    contained: { color: "var(--accent)", text: "Contained" },
    failed: { color: "var(--danger)", text: "Failed" },
  };
  const s = map[status];
  return (
    <span className="inline-flex items-center gap-2 text-[0.85rem] text-text">
      <span aria-hidden="true" className="size-2 rounded-full" style={{ background: s.color }} />
      {s.text}
    </span>
  );
}

export function ModeTag({ mode }: { mode: AgentMode }) {
  return (
    <span className="inline-flex flex-col">
      <span className="mono text-[0.82rem] text-text">{mode}</span>
      <span className="mt-0.5 text-[0.74rem] text-muted">{mode === "brake" ? "sends the revoke" : "alerts only"}</span>
    </span>
  );
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable, the text stays selectable */
    }
  };
  return { copied, copy };
}

export function Sig({ value, kind = "tx" }: { value: string; kind?: "tx" | "address" }) {
  const { copied, copy } = useCopy();
  const real = !value.startsWith("SAMPLE-") && !usingSamples;
  const href = real ? `https://solscan.io/${kind === "tx" ? "tx" : "account"}/${value}` : null;
  const short = value.length > 22 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;

  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mono break-all text-[0.8rem] text-text underline decoration-line-strong underline-offset-4 hover:decoration-accent"
        >
          {short}
        </a>
      ) : (
        <span className="mono break-all text-[0.8rem] text-text" title={value}>
          {short}
        </span>
      )}
      <button
        type="button"
        onClick={() => copy(value)}
        className="min-h-8 px-1 text-[0.72rem] tracking-wide text-muted hover:text-text"
        aria-label={`Copy ${value}`}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}

/** A shell command the operator should run, with the copy button next to it. */
export function Command({ text, label = "Run on the owner's machine" }: { text: string; label?: string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="mt-4 border border-line bg-bg/60">
      <p className="label border-b border-line px-3 py-2">{label}</p>
      <div className="flex items-start justify-between gap-3 px-3 py-3">
        <code className="mono break-words text-[0.78rem] leading-6 text-text">{text}</code>
        <button
          type="button"
          onClick={() => copy(text)}
          className="min-h-8 shrink-0 px-1 text-[0.72rem] tracking-wide text-muted hover:text-text"
          aria-label="Copy command"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="border-t border-line px-3 py-2 text-[0.72rem] text-muted">
        Replace the <span className="mono">&lt;placeholders&gt;</span> with your own values.
      </p>
    </div>
  );
}

export function PageHead({
  title,
  lead,
  onRefresh,
  busy,
}: {
  title: string;
  lead?: ReactNode;
  onRefresh?: () => void;
  busy?: boolean;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
      <div>
        <h1 className="display text-[clamp(1.8rem,3.4vw,2.5rem)]">{title}</h1>
        {lead && <p className="mt-2 max-w-xl text-[0.88rem] leading-6 text-muted">{lead}</p>}
      </div>
      {onRefresh && (
        <button type="button" onClick={onRefresh} disabled={busy} className="btn disabled:opacity-50">
          {busy ? "Refreshing" : "Refresh"}
        </button>
      )}
    </header>
  );
}

export function Panel({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-t border-line pt-5">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 className="label !text-text">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-baseline gap-x-4 border-t border-line py-3 first:border-t-0 first:pt-0">
      <dt className="label">{label}</dt>
      <dd className="text-[0.88rem] text-text">{children}</dd>
    </div>
  );
}

export function LoadingState({ what }: { what: string }) {
  return (
    <div role="status" aria-live="polite" className="py-6">
      <p className="text-[0.88rem] text-muted">Loading {what}…</p>
      <div aria-hidden="true" className="mt-5 space-y-px">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse border-t border-line bg-surface/60"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export function ErrorState({ error, retry, what }: { error: Error; retry: () => void; what: string }) {
  return (
    <div role="alert" className="border border-danger/40 bg-danger/5 p-6">
      <p className="text-[0.95rem] text-text">Could not load {what}.</p>
      <p className="mono mt-2 break-words text-[0.78rem] text-muted">{error.message}</p>
      <p className="mt-3 text-[0.85rem] text-muted">
        {usingSamples
          ? "This is the sample API failing on purpose (?mock=error). Remove the parameter to continue."
          : "Check that `rem serve` is running and that NEXT_PUBLIC_REM_API points at it."}
      </p>
      <button type="button" onClick={retry} className="btn mt-5">
        Try again
      </button>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border border-dashed border-line-strong p-8">
      <p className="display text-2xl">{title}</p>
      <div className="mt-3 max-w-xl text-[0.88rem] leading-7 text-muted">{children}</div>
    </div>
  );
}

export function RemNotFound({ what, name, backHref }: { what: string; name: string; backHref: string }) {
  return (
    <div className="mt-6">
      <EmptyState title={`No ${what} named "${name}"`}>
        It may have been removed from <span className="mono text-text">rem.yaml</span>, or the link has a typo.{" "}
        <a href={backHref} className="text-text underline decoration-line-strong underline-offset-4 hover:decoration-accent">
          Back to the list
        </a>
        .
      </EmptyState>
    </div>
  );
}

/** Renders the right state for a resource so every page handles loading, error and empty the same way. */
export function Async<T>({
  resource,
  retry,
  what,
  isEmpty,
  empty,
  children,
}: {
  resource: Resource<T>;
  retry: () => void;
  what: string;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (resource.status === "loading") return <LoadingState what={what} />;
  if (resource.status === "error") return <ErrorState error={resource.error} retry={retry} what={what} />;
  if (isEmpty?.(resource.data)) return <>{empty}</>;
  return <>{children(resource.data)}</>;
}
