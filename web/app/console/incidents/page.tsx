"use client";

import { useState } from "react";
import { getAgents, getIncidents } from "@/lib/api";
import { IncidentList } from "@/components/console/IncidentList";
import { Async, EmptyState, PageHead, useResource } from "@/components/console/ui";

export default function IncidentsPage() {
  const [agent, setAgent] = useState<string | null>(null);
  const [agents] = useResource(getAgents, "agents");
  const [res, retry] = useResource(() => getIncidents(agent ?? undefined), `incidents:${agent ?? "all"}`);

  const names = agents.status === "ready" ? agents.data.map((a) => a.name) : [];

  return (
    <>
      <PageHead
        title="Incidents"
        lead="Newest first. Each incident shows the rule that broke, the transactions on-chain, and the measured latency from seen to landed."
      />

      {names.length > 0 && (
        <div role="group" aria-label="Filter by agent" className="mb-10 flex flex-wrap gap-2">
          {[null, ...names].map((n) => (
            <button
              key={n ?? "all"}
              type="button"
              aria-pressed={agent === n}
              onClick={() => setAgent(n)}
              className={`min-h-11 border px-4 text-[0.78rem] transition-colors ${
                agent === n ? "border-accent text-text" : "border-line text-muted hover:text-text"
              }`}
            >
              {n ?? "All agents"}
            </button>
          ))}
        </div>
      )}

      <Async
        resource={res}
        retry={retry}
        what="incidents"
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState title="No incidents">
            {agent ? `${agent} has not tripped a rule.` : "No agent has tripped a rule."} Rem records an incident the
            first time a policy breaks.
          </EmptyState>
        }
      >
        {(page) => <IncidentList items={page.items} />}
      </Async>
    </>
  );
}
