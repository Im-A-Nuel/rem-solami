"use client";

import type { Incident } from "@/lib/types";
import { formatMs } from "@/lib/format";
import { IncidentStatusBadge, Sig } from "./ui";

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="mono mt-1 text-[1rem] text-text">{value}</dd>
      {note && <dd className="mt-0.5 text-[0.72rem] text-muted">{note}</dd>}
    </div>
  );
}

export function IncidentList({ items, showAgent = true }: { items: Incident[]; showAgent?: boolean }) {
  return (
    <ol className="relative">
      {items.map((i, idx) => (
        <li key={i.id} className="relative grid grid-cols-[1.5rem_1fr] gap-x-4 pb-10 last:pb-0">
          <span aria-hidden="true" className="relative flex justify-center">
            <span className="z-10 mt-1.5 size-2.5 rounded-full border border-text bg-bg" />
            {idx < items.length - 1 && <span className="absolute bottom-[-2.5rem] top-4 w-px bg-line-strong" />}
          </span>

          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <p className="display text-[1.5rem]">
                Incident {i.id}
                {showAgent && <span className="text-muted"> · {i.agent}</span>}
              </p>
              <IncidentStatusBadge status={i.status} />
            </div>
            <p className="mt-1 text-[0.85rem] text-muted">
              Rule <span className="mono text-accent">{i.rule}</span> broke.{" "}
              {i.leakedTxCount === 1
                ? "1 transaction landed before the revoke."
                : `${i.leakedTxCount} transactions landed before the revoke.`}
            </p>

            <dl className="mt-5 grid gap-x-8 gap-y-3 text-[0.85rem] sm:grid-cols-[8.5rem_1fr]">
              <dt className="label self-center">Trigger tx</dt>
              <dd>
                <Sig value={i.triggerSignature} />
              </dd>
              <dt className="label self-center">Revoke tx</dt>
              <dd>
                {i.revokeSignature ? (
                  <Sig value={i.revokeSignature} />
                ) : (
                  <span className="text-muted">None sent. This agent is in alert mode, so Rem only notified.</span>
                )}
              </dd>
            </dl>

            <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-line pt-5 sm:grid-cols-4">
              <Metric label="Detection" value={formatMs(i.detectionMs)} note="seen to decision" />
              <Metric label="Send" value={formatMs(i.sendMs)} note="decision to sent" />
              <Metric
                label="Landing"
                value={i.landingMs === null ? "none" : formatMs(i.landingMs)}
                note={i.landingSlots === null ? undefined : `${i.landingSlots} slots`}
              />
              <Metric label="Landed via" value={i.landedVia ?? "none"} note="first route to land" />
            </dl>
          </div>
        </li>
      ))}
    </ol>
  );
}
