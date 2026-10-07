import type { Db } from "./db.js";

export interface EventInput {
  signature: string;
  agentId: number;
  slot: number | bigint;
  seenAtNs: bigint;
  kind: "transfer" | "swap" | "other";
  programIds: readonly string[];
  destination: string | null;
  amount: bigint | null;
  verdict: "ok" | "violation";
  rule: string | null;
}

/**
 * Stores an event. The signature is the primary key, so a transaction delivered twice (after a reconnect
 * replay, for example) is stored once. Returns true only when the row was new.
 */
export async function recordEvent(db: Db, e: EventInput): Promise<boolean> {
  const r = await db.query(
    `INSERT INTO events (signature, agent_id, slot, seen_at, kind, program_ids, destination, amount, verdict, rule)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)
     ON CONFLICT (signature) DO NOTHING`,
    [
      e.signature, e.agentId, e.slot.toString(), e.seenAtNs.toString(), e.kind, JSON.stringify(e.programIds),
      e.destination, e.amount === null ? null : e.amount.toString(), e.verdict, e.rule,
    ],
  );
  return r.rowCount > 0;
}

/**
 * Events from `sinceNs` on, oldest first, for rebuilding the policy windows after a restart. A restart must
 * not make Rem forget what the agent spent in the last minute.
 */
export async function loadRecentEvents(
  db: Db,
  agentId: number,
  sinceNs: bigint,
): Promise<{ seenAtNs: bigint; amount: bigint | null }[]> {
  const r = await db.query<{ seen_at: unknown; amount: unknown }>(
    "SELECT seen_at, amount FROM events WHERE agent_id = $1 AND seen_at >= $2 ORDER BY seen_at ASC",
    [agentId, sinceNs.toString()],
  );
  return r.rows.map((row) => ({
    seenAtNs: BigInt(String(row.seen_at)),
    amount: row.amount === null ? null : BigInt(String(row.amount)),
  }));
}
