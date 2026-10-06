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

const statusStyle: Record<AgentStatus, { color: string; text: string; hint: string }> = {
  armed: { color: "var(--accent)", text: "Armed", hint: "Watching, panic tx ready" },
  stale: { color: "var(--warn)", text: "Stale", hint: "Nonce changed, owner must re-sign" },
  tripped: { color: "var(--danger)", text: "Tripped", hint: "Revoke sent, agent stopped" },
  disarmed: { color: "var(--muted)", text: "Disarmed", hint: "Not enforcing" },
};

export function StatusBadge({ status, showHint = false }: { status: AgentStatus; showHint?: boolean }) {
  const s = statusStyle[status];
  return (
    <span className="inline-flex flex-col">
      <span className="inline-flex items-center gap-2 text-[0.85rem] font-normal text-text">
        <span aria-hidden="true" className="size-2 rounded-full" style={{ background: s.color }} />
        {s.text}
      </span>
      {showHint && <span className="mt-0.5 text-[0.74rem] text-muted">{s.hint}</span>}
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
      <span className="mt-0.5 text-[0.74rem] text-muted">
        {mode === "brake" ? "Sends the panic tx" : "Alerts only"}
      </span>
    </span>
  );
}

export function Sig({ value, kind = "tx" }: { value: string; kind?: "tx" | "address" }) {
  const [copied, setCopied] = useState(false);
  const real = !value.startsWith("SAMPLE-") && !usingSamples;
  const href = real ? `https://solscan.io/${kind === "tx" ? "tx" : "account"}/${value}` : null;
  const short = value.length > 22 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable, value stays selectable */
    }
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="mono break-all text-[0.8rem] text-text underline decoration-line-strong underline-offset-4 hover:decoration-accent">
          {short}
        </a>
      ) : (
        <span className="mono break-all text-[0.8rem] text-text" title={value}>
          {short}
        </span>
      )}
      <button
        type="button"
        onClick={copy}
        className="min-h-8 px-1 text-[0.72rem] tracking-wide text-muted hover:text-text"
        aria-label={`Copy ${value}`}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}

export function PageHead({ title, lead }: { title: string; lead?: ReactNode }) {
  return (
    <header className="mb-10">
      <h1 className="display text-[clamp(2rem,4vw,3rem)]">{title}</h1>
      {lead && <p className="mt-3 max-w-2xl text-[0.92rem] leading-7 text-muted">{lead}</p>}
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

export function LoadingState({ what }: { what: string }) {
  return (
    <div role="status" aria-live="polite" className="py-6">
      <p className="text-[0.88rem] text-muted">Loading {what}…</p>
      <div aria-hidden="true" className="mt-5 space-y-px">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse border-t border-line bg-surface/60" style={{ animationDelay: `${i * 120}ms` }} />
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
