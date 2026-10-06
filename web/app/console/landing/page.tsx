"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getLanding } from "@/lib/api";
import type { RouteStats } from "@/lib/types";
import { Async, EmptyState, PageHead, Panel, useResource } from "@/components/console/ui";

const TEXT = "#93a4b3";
const GRID = "rgba(170,205,225,0.14)";

function Route({ name, s, color }: { name: string; s: RouteStats; color: string }) {
  return (
    <div>
      <p className="label mb-4 flex items-center gap-3">
        <span aria-hidden="true" className="size-2 rounded-full" style={{ background: color }} />
        {name}
      </p>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
        <div>
          <dt className="label">p50</dt>
          <dd className="display mt-1 text-[2.2rem]">
            {s.p50Ms} <span className="mono text-[0.78rem] text-muted">ms</span>
          </dd>
        </div>
        <div>
          <dt className="label">p95</dt>
          <dd className="display mt-1 text-[2.2rem]">
            {s.p95Ms} <span className="mono text-[0.78rem] text-muted">ms</span>
          </dd>
        </div>
        <div>
          <dt className="label">Sample size</dt>
          <dd className="mono mt-1 text-[0.95rem]">n = {s.n}</dd>
        </div>
        <div>
          <dt className="label">Median slots</dt>
          <dd className="mono mt-1 text-[0.95rem]">{s.p50Slots}</dd>
        </div>
      </dl>
    </div>
  );
}

export default function LandingHealthPage() {
  const [res, retry] = useResource(getLanding, "landing");

  return (
    <>
      <PageHead
        title="Landing health"
        lead="How fast the panic transaction lands, by route. Numbers are p50 and p95 with the sample size. A single run is never shown as typical."
      />
      <Async
        resource={res}
        retry={retry}
        what="landing stats"
        isEmpty={(d) => d.beam.n === 0 && d.rpc.n === 0}
        empty={
          <EmptyState title="Not measured yet">
            No landing samples are recorded. They come from real incidents and from{" "}
            <span className="mono text-text">rem canary</span> probes. Until then Rem reports nothing here instead of a
            placeholder zero.
          </EmptyState>
        }
      >
        {(d) => {
          const data = [
            { label: "p50", Beam: d.beam.p50Ms, RPC: d.rpc.p50Ms },
            { label: "p95", Beam: d.beam.p95Ms, RPC: d.rpc.p95Ms },
          ];
          return (
            <div className="grid gap-14 lg:grid-cols-[1fr_1.2fr]">
              <div className="space-y-12">
                <Route name="Solami Beam" s={d.beam} color="var(--accent)" />
                <Route name="Fallback RPC" s={d.rpc} color={TEXT} />
              </div>
              <Panel title="Landing latency, ms">
                <div className="h-72 w-full" role="img" aria-label={`Bar chart. Beam p50 ${d.beam.p50Ms} ms, p95 ${d.beam.p95Ms} ms. RPC p50 ${d.rpc.p50Ms} ms, p95 ${d.rpc.p95Ms} ms.`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={6}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="label" stroke={TEXT} tickLine={false} axisLine={{ stroke: GRID }} fontSize={12} />
                      <YAxis stroke={TEXT} tickLine={false} axisLine={false} fontSize={12} />
                      <Tooltip
                        cursor={{ fill: "rgba(170,205,225,0.05)" }}
                        contentStyle={{ background: "#0a1018", border: `1px solid ${GRID}`, borderRadius: 0, fontSize: 12 }}
                        labelStyle={{ color: "#e7eef4" }}
                        formatter={(v) => [`${v} ms`]}
                      />
                      <Legend iconType="square" wrapperStyle={{ fontSize: 12, color: TEXT }} />
                      <Bar dataKey="Beam" fill="#4dd4ec" radius={0} maxBarSize={56} />
                      <Bar dataKey="RPC" fill={TEXT} radius={0} maxBarSize={56} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <table className="mono mt-6 w-full text-left text-[0.78rem]">
                  <caption className="sr-only">Landing latency by route</caption>
                  <thead>
                    <tr className="text-muted">
                      <th className="py-2 font-normal">Route</th>
                      <th className="py-2 font-normal">p50</th>
                      <th className="py-2 font-normal">p95</th>
                      <th className="py-2 font-normal">n</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ["Beam", d.beam],
                        ["RPC", d.rpc],
                      ] as const
                    ).map(([n, s]) => (
                      <tr key={n} className="border-t border-line">
                        <td className="py-2">{n}</td>
                        <td className="py-2">{s.p50Ms} ms</td>
                        <td className="py-2">{s.p95Ms} ms</td>
                        <td className="py-2">{s.n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            </div>
          );
        }}
      </Async>
    </>
  );
}
