"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getLanding } from "@/lib/api";
import { landingVerdict } from "@/lib/status";
import { Async, EmptyState, PageHead, Panel, useResource } from "@/components/console/ui";

const TEXT = "#93a4b3";
const GRID = "rgba(170,205,225,0.14)";

export default function LandingSpeedPage() {
  const [res, retry] = useResource(getLanding, "landing");

  return (
    <>
      <PageHead
        title="Landing speed"
        lead="How fast the panic transaction lands, by route. Shown as p50 (typical) and p95 (slow case) with the sample size, never the best run."
        onRefresh={retry}
        busy={res.status === "loading"}
      />
      <Async
        resource={res}
        retry={retry}
        what="landing stats"
        isEmpty={(d) => d.beam.n === 0 && d.rpc.n === 0}
        empty={
          <EmptyState title="Not measured yet">
            No landing samples are recorded. They come from real incidents and from{" "}
            <span className="mono text-text">rem canary</span> probes. Until then Rem shows nothing here instead of a
            placeholder zero.
          </EmptyState>
        }
      >
        {(d) => {
          const verdict = landingVerdict(d);
          const data = [
            { label: "p50 (typical)", Beam: d.beam.p50Ms, RPC: d.rpc.p50Ms },
            { label: "p95 (slow case)", Beam: d.beam.p95Ms, RPC: d.rpc.p95Ms },
          ];
          const rows: [string, string, string][] = [
            ["p50", `${d.beam.p50Ms} ms`, `${d.rpc.p50Ms} ms`],
            ["p95", `${d.beam.p95Ms} ms`, `${d.rpc.p95Ms} ms`],
            ["Median slots", `${d.beam.p50Slots}`, `${d.rpc.p50Slots}`],
            ["Samples (n)", `${d.beam.n}`, `${d.rpc.n}`],
          ];
          return (
            <>
              {verdict && (
                <div className="mb-12">
                  <p className="display max-w-3xl text-[clamp(1.4rem,2.8vw,2.1rem)] leading-snug">{verdict.text}</p>
                  {verdict.caveat && (
                    <p className="mt-3 flex items-start gap-2 text-[0.84rem] text-warn">
                      <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-warn" />
                      {verdict.caveat}
                    </p>
                  )}
                </div>
              )}

              <div className="grid gap-12 lg:grid-cols-[1.35fr_1fr]">
                <Panel title="Landing time, ms (lower is better)">
                  <div
                    className="h-72 w-full"
                    role="img"
                    aria-label={`Bar chart of landing time in milliseconds. Beam: p50 ${d.beam.p50Ms}, p95 ${d.beam.p95Ms}. RPC: p50 ${d.rpc.p50Ms}, p95 ${d.rpc.p95Ms}.`}
                  >
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
                </Panel>

                <Panel title="The numbers">
                  <table className="w-full text-left text-[0.88rem]">
                    <caption className="sr-only">Landing time by route</caption>
                    <thead>
                      <tr className="text-[0.8rem] text-muted">
                        <th scope="col" className="py-2 font-normal" />
                        <th scope="col" className="py-2 text-right font-normal">
                          <span className="inline-flex items-center gap-2">
                            <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
                            Solami Beam
                          </span>
                        </th>
                        <th scope="col" className="py-2 text-right font-normal">
                          <span className="inline-flex items-center gap-2">
                            <span aria-hidden="true" className="size-2 rounded-full" style={{ background: TEXT }} />
                            Fallback RPC
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(([label, beam, rpc]) => (
                        <tr key={label} className="border-t border-line">
                          <th scope="row" className="py-3 text-[0.8rem] font-normal text-muted">
                            {label}
                          </th>
                          <td className="mono py-3 text-right">{beam}</td>
                          <td className="mono py-3 text-right">{rpc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-4 text-[0.78rem] leading-5 text-muted">
                    A slot is about 400 ms on Solana. Fewer slots means the revoke landed sooner.
                  </p>
                </Panel>
              </div>
            </>
          );
        }}
      </Async>
    </>
  );
}
