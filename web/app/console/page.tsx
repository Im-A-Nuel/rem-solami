"use client";

import Link from "next/link";
import { getAgents } from "@/lib/api";
import { formatUnits, shorten } from "@/lib/format";
import { needsAttention, nextStep, overview, statusOrder } from "@/lib/status";
import type { Agent } from "@/lib/types";
import {
  Async,
  Command,
  EmptyState,
  ModeTag,
  PageHead,
  StatusBadge,
  statusColor,
  useResource,
} from "@/components/console/ui";

const COLS = "md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)_1.25rem]";

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

function AgentRow({ agent }: { agent: Agent }) {
  const step = nextStep(agent);
  const attention = needsAttention(agent);
  return (
    <li className="group relative border-t border-line transition-colors hover:bg-surface/60">
      <div className={`grid grid-cols-2 items-center gap-x-6 gap-y-3 px-1 py-5 ${COLS}`}>
        <div className="col-span-2 min-w-0 md:col-span-1">
          <Link
            href={`/console/agents/${encodeURIComponent(agent.name)}`}
            className="display block truncate text-[1.3rem] transition-colors after:absolute after:inset-0 group-hover:text-accent"
          >
            {agent.name}
          </Link>
          <span className="mono text-[0.72rem] text-muted">{shorten(agent.agentWallet, 10, 6)}</span>
        </div>

        <div>
          <span className="label mb-1 block md:hidden">Status</span>
          <StatusBadge status={agent.status} />
          <p className="mt-0.5 text-[0.76rem] text-muted">{step.headline}</p>
        </div>

        <div>
          <span className="label mb-1 block md:hidden">Mode</span>
          <ModeTag mode={agent.mode} />
        </div>

        <div className="col-span-2 flex items-baseline gap-3 md:col-span-1 md:block md:text-right">
          <span className="label block md:hidden">Allowance left</span>
          <span className="mono text-[0.95rem] text-text">{formatUnits(agent.allowanceRemaining)}</span>
          <span className="mono ml-1.5 text-[0.72rem] text-muted">USDC</span>
        </div>

        <span aria-hidden="true" className="hidden justify-self-end text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-text md:block">
          ›
        </span>
      </div>

      {attention && (
        <div className="relative z-10 px-1 pb-5">
          <p className="max-w-3xl text-[0.85rem] leading-6 text-text">
            <span className="mono mr-2 text-[0.7rem]" style={{ color: statusColor[agent.status] }}>
              NEXT STEP
            </span>
            {step.detail}
          </p>
          {step.command && (
            <details className="group mt-1">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 text-[0.8rem] text-muted transition-colors hover:text-text">
                <span aria-hidden="true" className="text-[0.7rem] transition-transform group-open:rotate-90">
                  ▸
                </span>
                Show the command
              </summary>
              <Command text={step.command} />
            </details>
          )}
        </div>
      )}
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

              <div
                aria-hidden="true"
                className={`label hidden gap-x-6 border-t border-line px-1 py-3 md:grid ${COLS}`}
              >
                <span>Agent</span>
                <span>Status</span>
                <span>Mode</span>
                <span className="text-right">Allowance left</span>
                <span />
              </div>
              <ul className="border-b border-line">
                {sorted.map((a) => (
                  <AgentRow key={a.name} agent={a} />
                ))}
              </ul>
            </>
          );
        }}
      </Async>
    </>
  );
}
