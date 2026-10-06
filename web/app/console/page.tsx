"use client";

import Link from "next/link";
import { getAgents } from "@/lib/api";
import { formatUnits, shorten } from "@/lib/format";
import { needsAttention, nextStep, nonceText, overview, statusOrder } from "@/lib/status";
import type { Agent } from "@/lib/types";
import {
  AgentGlyph,
  Async,
  EmptyState,
  PageHead,
  StatusBadge,
  statusColor,
  useResource,
} from "@/components/console/ui";

function Legend() {
  return (
    <details className="group mb-6 border border-line">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-[0.82rem] text-muted transition-colors hover:text-text">
        What do these statuses mean?
        <span aria-hidden="true" className="text-[0.7rem] transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <dl className="grid gap-x-10 gap-y-3 border-t border-line px-4 py-4 text-[0.82rem] leading-6 sm:grid-cols-2">
        {(
          [
            ["armed", "Watching. The panic transaction is ready and still valid."],
            ["stale", "The nonce changed, so the saved panic transaction would fail. Re-sign it."],
            ["tripped", "A rule broke and the revoke was sent. The agent can no longer spend."],
            ["disarmed", "Rem is not acting on this agent."],
          ] as const
        ).map(([s, text]) => (
          <div key={s}>
            <dt className="mb-0.5">
              <StatusBadge status={s} />
            </dt>
            <dd className="text-muted">{text}</dd>
          </div>
        ))}
        <div>
          <dt className="mono mb-0.5 text-[0.82rem] text-text">brake</dt>
          <dd className="text-muted">Rem sends the revoke when a rule breaks.</dd>
        </div>
        <div>
          <dt className="mono mb-0.5 text-[0.82rem] text-text">alert</dt>
          <dd className="text-muted">Rem only notifies you. Use it to tune rules before enforcing.</dd>
        </div>
      </dl>
    </details>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  const step = nextStep(agent);
  const nonce = nonceText(agent);
  const attention = needsAttention(agent);
  const color = statusColor[agent.status];
  return (
    <li
      className="rule-card group relative flex flex-col rounded-[0.9rem] p-5 transition-colors hover:border-line-strong"
      style={attention ? { borderColor: `color-mix(in srgb, ${color} 45%, transparent)` } : undefined}
    >
      <div className="flex items-start gap-3.5">
        <AgentGlyph name={agent.name} status={agent.status} />
        <div className="min-w-0 flex-1">
          <h3 className="display truncate text-[1.2rem]">
            <Link
              href={`/console/agents/${encodeURIComponent(agent.name)}`}
              className="transition-colors after:absolute after:inset-0 after:rounded-[0.9rem] group-hover:text-accent"
            >
              {agent.name}
            </Link>
          </h3>
          <p className="mono mt-0.5 text-[0.72rem] text-muted">{shorten(agent.agentWallet, 8, 6)}</p>
        </div>
        <StatusBadge status={agent.status} />
      </div>

      <div className="mt-5">
        <p className="text-[0.95rem] text-text">{step.headline}</p>
        <p className="mt-1 text-[0.8rem] leading-5 text-muted">{step.short}</p>
      </div>

      <ul className="mb-6 mt-4 flex flex-wrap gap-2" aria-label="Agent settings">
        <li
          className={`mono rounded-full border px-2.5 py-1 text-[0.66rem] ${
            agent.mode === "brake" ? "border-accent/40 text-accent" : "border-line-strong text-muted"
          }`}
        >
          {agent.mode === "brake" ? "brake mode" : "alert mode"}
        </li>
        <li
          className={`mono rounded-full border px-2.5 py-1 text-[0.66rem] ${
            nonce.warn ? "border-warn/50 text-warn" : "border-line-strong text-muted"
          }`}
        >
          {nonce.warn ? "nonce changed" : agent.status === "tripped" ? "nonce used" : "nonce ok"}
        </li>
      </ul>

      <div className="mt-auto flex items-end justify-between gap-4 border-t border-line pt-4">
        <div>
          <p className="label">Allowance left</p>
          <p className="mt-1 text-text">
            <span className="mono text-[1.35rem]">{formatUnits(agent.allowanceRemaining)}</span>
            <span className="mono ml-1.5 text-[0.72rem] text-muted">USDC</span>
          </p>
        </div>
        <span aria-hidden="true" className="btn transition-colors group-hover:border-line-strong group-hover:bg-text/[0.04]">
          {attention ? "Fix this agent" : "View agent"}
        </span>
      </div>
    </li>
  );
}

export default function AgentsPage() {
  const [res, retry] = useResource(getAgents, "agents");

  return (
    <>
      <PageHead
        title="Agents"
        lead="Every agent Rem watches, those that need you first."
        onRefresh={retry}
        busy={res.status === "loading"}
      />
      <Async
        resource={res}
        retry={retry}
        what="agents"
        isEmpty={(d) => d.length === 0}
        empty={
          <EmptyState title="No agents registered">
            Rem only watches agents whose panic file was imported on the server. Run{" "}
            <span className="mono text-text">rem agent add --config rem.yaml --panic ./panic/demo-agent.json</span>,
            then refresh.
          </EmptyState>
        }
      >
        {(agents) => {
          const sorted = [...agents].sort(
            (a, b) => statusOrder[a.status] - statusOrder[b.status] || a.name.localeCompare(b.name),
          );
          const o = overview(agents);
          return (
            <>
              <p
                role="status"
                className="mb-6 flex items-center gap-3 text-[1.05rem] text-text"
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: o.attention > 0 ? "var(--warn)" : "var(--accent)" }}
                />
                {o.text}
              </p>

              <Legend />

              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {sorted.map((a) => (
                  <AgentCard key={a.name} agent={a} />
                ))}
              </ul>
            </>
          );
        }}
      </Async>
    </>
  );
}
