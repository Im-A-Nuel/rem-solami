"use client";

import Link from "next/link";
import type { Incident } from "@/lib/types";
import { formatMs } from "@/lib/format";
import { incidentSummary, type Tone } from "@/lib/status";
import { IncidentStatusBadge, Sig } from "./ui";

const toneColor: Record<Tone, string> = {
  ok: "var(--accent)",
  warn: "var(--warn)",
  bad: "var(--danger)",
};

function Step({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="text-[0.74rem] text-muted">{label}</dt>
      <dd className="mono mt-0.5 text-[0.95rem] text-text">{value}</dd>
      {note && <dd className="text-[0.72rem] text-muted">{note}</dd>}
    </div>
  );
}

export function IncidentList({ items, showAgent = true }: { items: Incident[]; showAgent?: boolean }) {
  return (
    <ol>
      {items.map((i, idx) => {
        const summary = incidentSummary(i);
        const sent = i.sendMs !== null;
        return (
          <li key={i.id} className="relative grid grid-cols-[1.25rem_1fr] gap-x-4 pb-9 last:pb-0">
            <span aria-hidden="true" className="relative flex justify-center">
              <span
                className="z-10 mt-2 size-2.5 rounded-full border-2 bg-bg"
                style={{ borderColor: toneColor[summary.tone] }}
              />
              {idx < items.length - 1 && <span className="absolute bottom-[-2.25rem] top-5 w-px bg-line-strong" />}
            </span>

            <article>
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <h3 className="display text-[1.3rem]">
                  {showAgent ? (
                    <Link
                      href={`/console/agents/${encodeURIComponent(i.agent)}`}
                      className="transition-colors hover:text-accent"
                    >
                      {i.agent}
                    </Link>
                  ) : (
                    <>Incident {i.id}</>
                  )}
                </h3>
                <IncidentStatusBadge status={i.status} />
              </div>

              <p className="mt-1.5 text-[0.9rem] leading-6 text-text">{summary.text}</p>
              <p className="mt-1 text-[0.8rem] text-muted">
                {showAgent && <>Incident {i.id}. </>}Broke rule <span className="mono text-accent">{i.rule}</span>.
              </p>

              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                <Step label="Seen to decided" value={formatMs(i.detectionMs)} />
                <Step label="Decided to sent" value={sent ? formatMs(i.sendMs) : "not sent"} />
                <Step
                  label="Landing time"
                  value={i.landingMs === null ? "not landed" : formatMs(i.landingMs)}
                  note={i.landingSlots === null ? undefined : `${i.landingSlots} slots after the trigger`}
                />
                <Step label="Landed via" value={i.landedVia ?? "none"} />
              </dl>

              <dl className="mt-5 space-y-2 border-t border-line pt-4 text-[0.8rem]">
                <div className="flex flex-wrap items-center gap-x-4">
                  <dt className="w-28 shrink-0 text-muted">Trigger tx</dt>
                  <dd>
                    <Sig value={i.triggerSignature} />
                  </dd>
                </div>
                <div className="flex flex-wrap items-center gap-x-4">
                  <dt className="w-28 shrink-0 text-muted">Revoke tx</dt>
                  <dd>{i.revokeSignature ? <Sig value={i.revokeSignature} /> : <span className="text-muted">none sent</span>}</dd>
                </div>
              </dl>
            </article>
          </li>
        );
      })}
    </ol>
  );
}
