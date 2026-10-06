"use client";

import { useMemo, useState } from "react";
import { getAgents, getIncidents } from "@/lib/api";
import { IncidentList } from "@/components/console/IncidentList";
import { Async, EmptyState, PageHead, useResource } from "@/components/console/ui";

export default function IncidentsPage() {
  const [agent, setAgent] = useState<string | null>(null);
  const [agents] = useResource(getAgents, "agents");
  const [res, retry] = useResource(() => getIncidents(), "incidents");

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    if (res.status === "ready") for (const i of res.data.items) m.set(i.agent, (m.get(i.agent) ?? 0) + 1);
    return m;
  }, [res]);

  const names = agents.status === "ready" ? agents.data.map((a) => a.name) : [];
  const total = res.status === "ready" ? res.data.items.length : 0;

  return (
    <>
      <PageHead
        title="Incidents"
        lead="Each time a rule broke, newest first: what happened, how fast Rem reacted, and the transactions to check on-chain."
        onRefresh={retry}
        busy={res.status === "loading"}
      />

      <Async
        resource={res}
        retry={retry}
        what="incidents"
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState title="No incidents yet">
            Rem records an incident the first time a policy breaks. Nothing has tripped a rule so far.
          </EmptyState>
        }
      >
        {(page) => {
          const shown = agent ? page.items.filter((i) => i.agent === agent) : page.items;
          return (
            <>
              {names.length > 1 && (
                <div role="group" aria-label="Filter by agent" className="mb-8 flex flex-wrap gap-2">
                  {[null, ...names].map((n) => {
                    const count = n === null ? total : (counts.get(n) ?? 0);
                    const active = agent === n;
                    return (
                      <button
                        key={n ?? "all"}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setAgent(n)}
                        className={`inline-flex min-h-11 items-center gap-2 border px-4 text-[0.8rem] transition-colors ${
                          active ? "border-accent text-text" : "border-line text-muted hover:text-text"
                        }`}
                      >
                        {n ?? "All agents"}
                        <span className="mono text-[0.72rem] text-muted">{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {shown.length === 0 ? (
                <EmptyState title={`No incidents for ${agent}`}>
                  This agent has not broken a rule.{" "}
                  <button
                    type="button"
                    onClick={() => setAgent(null)}
                    className="text-text underline decoration-line-strong underline-offset-4 hover:decoration-accent"
                  >
                    Show all agents
                  </button>
                  .
                </EmptyState>
              ) : (
                <IncidentList items={shown} />
              )}
            </>
          );
        }}
      </Async>
    </>
  );
}
