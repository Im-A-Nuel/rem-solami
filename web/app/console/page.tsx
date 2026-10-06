"use client";

import Link from "next/link";
import { getAgents } from "@/lib/api";
import { formatUnits, shorten } from "@/lib/format";
import type { Agent } from "@/lib/types";
import { Async, ModeTag, PageHead, StatusBadge, useResource } from "@/components/console/ui";

function nonceText(a: Agent) {
  if (a.status === "tripped") return { text: "Advanced by the panic tx", tone: "text-muted" };
  if (a.nonceHealthy) return { text: "Matches the signed value", tone: "text-text" };
  return { text: "Changed, re-sign needed", tone: "text-warn" };
}

function Summary({ agents }: { agents: Agent[] }) {
  const count = (s: Agent["status"]) => agents.filter((a) => a.status === s).length;
  const parts = [
    ["armed", count("armed")],
    ["stale", count("stale")],
    ["tripped", count("tripped")],
    ["disarmed", count("disarmed")],
  ].filter(([, n]) => (n as number) > 0);
  return (
    <p className="mono mb-6 text-[0.8rem] text-muted">
      {agents.length} {agents.length === 1 ? "agent" : "agents"}
      {parts.map(([label, n]) => (
        <span key={label as string}>
          {" · "}
          <span className="text-text">{n}</span> {label}
        </span>
      ))}
    </p>
  );
}

export default function AgentsPage() {
  const [res, retry] = useResource(getAgents, "agents");

  return (
    <>
      <PageHead
        title="Agents"
        lead="Each agent spends through an SPL delegate. Open one to read its decoded panic transaction and incident history."
      />
      <Async
        resource={res}
        retry={retry}
        what="agents"
        isEmpty={(d) => d.length === 0}
        empty={
          <div className="border border-dashed border-line-strong p-8">
            <p className="display text-2xl">No agents registered</p>
            <p className="mt-3 max-w-xl text-[0.88rem] leading-7 text-muted">
              Rem only watches agents whose panic file was imported on the server. Run{" "}
              <span className="mono text-text">rem agent add --config rem.yaml --panic ./panic/demo-agent.json</span>,
              then reload.
            </p>
          </div>
        }
      >
        {(agents) => (
          <>
            <Summary agents={agents} />
            <div
              aria-hidden="true"
              className="label hidden grid-cols-[minmax(0,1.5fr)_1fr_1fr_1.3fr_0.9fr] gap-6 border-t border-line px-1 py-3 md:grid"
            >
              <span>Agent</span>
              <span>Status</span>
              <span>Mode</span>
              <span>Nonce</span>
              <span className="text-right">Allowance left</span>
            </div>
            <ul>
              {agents.map((a) => {
                const nonce = nonceText(a);
                return (
                  <li key={a.name} className="border-t border-line">
                    <Link
                      href={`/console/agents/${encodeURIComponent(a.name)}`}
                      className="group grid gap-x-6 gap-y-3 px-1 py-5 transition-colors hover:bg-surface/70 md:grid-cols-[minmax(0,1.5fr)_1fr_1fr_1.3fr_0.9fr] md:items-center"
                    >
                      <span>
                        <span className="display block text-[1.45rem] group-hover:text-accent">{a.name}</span>
                        <span className="mono text-[0.74rem] text-muted">{shorten(a.agentWallet, 10, 6)}</span>
                      </span>
                      <span>
                        <span className="label mb-1 block md:hidden">Status</span>
                        <StatusBadge status={a.status} showHint />
                      </span>
                      <span>
                        <span className="label mb-1 block md:hidden">Mode</span>
                        <ModeTag mode={a.mode} />
                      </span>
                      <span className={`text-[0.85rem] ${nonce.tone}`}>
                        <span className="label mb-1 block md:hidden">Nonce</span>
                        {nonce.text}
                      </span>
                      <span className="md:text-right">
                        <span className="label mb-1 block md:hidden">Allowance left</span>
                        <span className="mono text-[0.95rem] text-text">{formatUnits(a.allowanceRemaining)}</span>
                        <span className="mono ml-1.5 text-[0.74rem] text-muted">USDC</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Async>
    </>
  );
}
