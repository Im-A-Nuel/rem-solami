"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { getAgents, getIncidents, getPanic } from "@/lib/api";
import { checkPanic, formatUnits } from "@/lib/format";
import { IncidentList } from "@/components/console/IncidentList";
import {
  Async,
  EmptyState,
  ModeTag,
  Panel,
  RemNotFound,
  Sig,
  StatusBadge,
  useResource,
} from "@/components/console/ui";

export default function AgentPage() {
  const { name: raw } = useParams<{ name: string }>();
  const name = decodeURIComponent(raw);

  const [agents, retryAgents] = useResource(getAgents, "agents");
  const [panic, retryPanic] = useResource(() => getPanic(name), `panic:${name}`);
  const [incidents, retryIncidents] = useResource(() => getIncidents(name), `incidents:${name}`);

  return (
    <>
      <Link href="/console" className="label inline-flex min-h-11 items-center transition-colors hover:!text-text">
        Back to agents
      </Link>

      <Async resource={agents} retry={retryAgents} what="agent">
        {(list) => {
          const agent = list.find((a) => a.name === name);
          if (!agent) return <RemNotFound what="agent" name={name} backHref="/console" />;
          return (
            <>
              <header className="mb-12 mt-4 flex flex-wrap items-end justify-between gap-6">
                <div>
                  <h1 className="display text-[clamp(2.1rem,5vw,3.4rem)]">{agent.name}</h1>
                  <p className="mt-3">
                    <Sig value={agent.agentWallet} kind="address" />
                  </p>
                </div>
                <div className="flex gap-10">
                  <div>
                    <p className="label mb-1.5">Status</p>
                    <StatusBadge status={agent.status} showHint />
                  </div>
                  <div>
                    <p className="label mb-1.5">Mode</p>
                    <ModeTag mode={agent.mode} />
                  </div>
                  <div>
                    <p className="label mb-1.5">Allowance left</p>
                    <p className="mono text-[1.05rem]">
                      {formatUnits(agent.allowanceRemaining)} <span className="text-[0.74rem] text-muted">USDC</span>
                    </p>
                  </div>
                </div>
              </header>

              <div className="grid gap-14 lg:grid-cols-[1.15fr_1fr]">
                <Panel title="Panic transaction, decoded">
                  <Async
                    resource={panic}
                    retry={retryPanic}
                    what="the panic transaction"
                    isEmpty={(d) => d.decoded.length === 0}
                    empty={
                      <EmptyState title="Nothing to decode">
                        The server returned no instructions for this agent. Re-import its panic file with{" "}
                        <span className="mono text-text">rem agent add</span>.
                      </EmptyState>
                    }
                  >
                    {({ decoded }) => {
                      const check = checkPanic(decoded);
                      return (
                        <>
                          <ol className="border-b border-line">
                            {decoded.map((ix, i) => (
                              <li
                                key={i}
                                className={`grid grid-cols-[1.6rem_1fr] gap-x-3 border-t border-line py-3.5 ${i === 0 ? "bg-accent/[0.04]" : ""}`}
                              >
                                <span className="mono pt-0.5 text-[0.78rem] text-muted">{i + 1}</span>
                                <span>
                                  <span className={`mono block text-[0.92rem] ${i === 0 ? "text-accent" : "text-text"}`}>
                                    {ix.instruction}
                                  </span>
                                  <span className="mono mt-0.5 block break-all text-[0.72rem] text-muted">
                                    {ix.program}
                                  </span>
                                  {ix.account && (
                                    <span className="mono mt-0.5 block break-all text-[0.72rem] text-muted">
                                      account {ix.account}
                                    </span>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ol>
                          <p
                            role="status"
                            className={`mt-4 text-[0.85rem] ${check.ok ? "text-text" : "text-danger"}`}
                          >
                            <span className="mono mr-2">{check.ok ? "ALLOWED SET" : "REJECTED"}</span>
                            <span className="text-muted">{check.reason}</span>
                          </p>
                          <p className="mt-2 text-[0.76rem] leading-6 text-muted">
                            This is a display check of the decoded list. <span className="mono">nonce.Validate</span> on
                            the server is the authority and also verifies the owner signature and nonce value.
                          </p>
                        </>
                      );
                    }}
                  </Async>
                </Panel>

                <Panel title="Incidents">
                  <Async
                    resource={incidents}
                    retry={retryIncidents}
                    what="incidents"
                    isEmpty={(d) => d.items.length === 0}
                    empty={
                      <EmptyState title="No incidents">
                        Rem records one the first time a rule breaks for this agent.
                      </EmptyState>
                    }
                  >
                    {(page) => <IncidentList items={page.items} showAgent={false} />}
                  </Async>
                </Panel>
              </div>
            </>
          );
        }}
      </Async>
    </>
  );
}
