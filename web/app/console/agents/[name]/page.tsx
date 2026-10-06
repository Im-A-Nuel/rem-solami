"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { getAgents, getIncidents, getPanic } from "@/lib/api";
import { checkPanic, formatUnits } from "@/lib/format";
import { instructionRole, nextStep, nonceText } from "@/lib/status";
import { IncidentList } from "@/components/console/IncidentList";
import {
  Async,
  Command,
  EmptyState,
  Fact,
  ModeTag,
  Panel,
  RemNotFound,
  Sig,
  StatusBadge,
  statusColor,
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
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-[0.8rem] text-muted">
        <Link href="/console" className="inline-flex min-h-11 items-center transition-colors hover:text-text">
          Agents
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-text">{name}</span>
      </nav>

      <Async resource={agents} retry={retryAgents} what="agent">
        {(list) => {
          const agent = list.find((a) => a.name === name);
          if (!agent) return <RemNotFound what="agent" name={name} backHref="/console" />;
          const step = nextStep(agent);
          const nonce = nonceText(agent);
          const color = statusColor[agent.status];

          return (
            <>
              <header className="mb-8">
                <h1 className="display text-[clamp(1.9rem,4.2vw,3rem)]">{agent.name}</h1>
                <p className="mt-2">
                  <Sig value={agent.agentWallet} kind="address" />
                </p>
              </header>

              {/* The answer first: what state is this agent in and what, if anything, should be done. */}
              <section
                aria-label="Status"
                className="mb-12 grid gap-x-12 gap-y-8 border p-6 lg:grid-cols-[1.25fr_1fr]"
                style={{ borderColor: `color-mix(in srgb, ${color} 40%, transparent)` }}
              >
                <div>
                  <StatusBadge status={agent.status} size="lg" />
                  <p className="display mt-3 text-[1.6rem]">{step.headline}</p>
                  <p className="mt-2 max-w-xl text-[0.88rem] leading-6 text-muted">{step.detail}</p>
                  {step.command && <Command text={step.command} />}
                </div>
                <dl>
                  <Fact label="Mode">
                    <ModeTag mode={agent.mode} />
                  </Fact>
                  <Fact label="Allowance left">
                    <span className="mono">{formatUnits(agent.allowanceRemaining)}</span>{" "}
                    <span className="mono text-[0.74rem] text-muted">USDC</span>
                  </Fact>
                  <Fact label="Nonce">
                    <span className={nonce.warn ? "text-warn" : ""}>{nonce.text}</span>
                  </Fact>
                </dl>
              </section>

              <div className="grid gap-14 lg:grid-cols-[1.1fr_1fr]">
                <Panel title="What Rem will send">
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
                          <p
                            role="status"
                            className="mb-5 flex items-start gap-3 text-[0.92rem] leading-6 text-text"
                          >
                            <span
                              aria-hidden="true"
                              className="mt-2 size-2 shrink-0 rounded-full"
                              style={{ background: check.ok ? "var(--accent)" : "var(--danger)" }}
                            />
                            <span>
                              {check.ok
                                ? "Safe to send: it only advances the nonce, sets compute budget, and revokes."
                                : `Do not trust this transaction. ${check.reason}`}
                            </span>
                          </p>

                          <ol className="border-b border-line">
                            {decoded.map((ix, i) => (
                              <li key={i} className="grid grid-cols-[1.6rem_1fr] gap-x-3 border-t border-line py-3.5">
                                <span className="mono pt-0.5 text-[0.78rem] text-muted">{i + 1}</span>
                                <span>
                                  <span className={`mono block text-[0.9rem] ${i === 0 ? "text-accent" : "text-text"}`}>
                                    {ix.instruction}
                                  </span>
                                  <span className="mt-0.5 block text-[0.8rem] text-muted">
                                    {instructionRole(ix.instruction)}
                                  </span>
                                </span>
                              </li>
                            ))}
                          </ol>

                          <details className="group mt-4">
                            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-[0.8rem] text-muted transition-colors hover:text-text">
                              <span aria-hidden="true" className="text-[0.7rem] transition-transform group-open:rotate-90">
                                ▸
                              </span>
                              Program and account addresses
                            </summary>
                            <ul className="mono mt-2 space-y-3 break-all text-[0.72rem] leading-5 text-muted">
                              {decoded.map((ix, i) => (
                                <li key={i}>
                                  <span className="text-text">{i + 1}. {ix.instruction}</span>
                                  <br />
                                  program {ix.program}
                                  {ix.account && (
                                    <>
                                      <br />
                                      account {ix.account}
                                    </>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </details>

                          <p className="mt-3 text-[0.74rem] leading-5 text-muted">
                            This is a display check. <span className="mono">nonce.Validate</span> on the server is the
                            authority and also verifies the owner signature and nonce value.
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
