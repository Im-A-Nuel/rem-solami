import type { DecodedInstruction } from "../nonce/index.js";
import type { Db } from "./db.js";

export type AgentMode = "alert" | "brake";
export type AgentStatus = "armed" | "stale" | "tripped" | "disarmed";

export interface AgentInput {
  name: string;
  agentWallet: string;
  ownerWallet: string;
  nonceAccount: string;
  nonceValue: string;
  /** Base64 owner-signed panic transaction, fee payer signature empty. Not a secret by design. */
  panicTx: string;
  /** What the panic transaction contains, decoded once at import so the dashboard never needs web3.js. */
  panicDecoded: DecodedInstruction[];
  mode: AgentMode;
  status: AgentStatus;
  nonceHealthy: boolean;
  allowance: bigint;
  allowanceRemaining: bigint;
  tokenAccounts: { address: string; mint: string }[];
}

export interface AgentRow extends AgentInput {
  id: number;
  createdAtNs: bigint;
  updatedAtNs: bigint;
}

/** pg returns BIGINT and NUMERIC as strings, PGlite may return bigint. Accept all of them. */
const big = (v: unknown): bigint => BigInt(String(v));

interface Row {
  id: number;
  name: string;
  agent_wallet: string;
  owner_wallet: string;
  nonce_account: string;
  nonce_value: string;
  panic_tx: string;
  panic_decoded: DecodedInstruction[];
  mode: AgentMode;
  status: AgentStatus;
  nonce_healthy: boolean;
  allowance: unknown;
  allowance_remaining: unknown;
  created_at: unknown;
  updated_at: unknown;
}

async function hydrate(db: Db, rows: Row[]): Promise<AgentRow[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const tokens = await db.query<{ agent_id: number; token_account: string; mint: string }>(
    "SELECT agent_id, token_account, mint FROM agent_token_accounts WHERE agent_id = ANY($1::int[]) ORDER BY token_account",
    [ids],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    agentWallet: r.agent_wallet,
    ownerWallet: r.owner_wallet,
    nonceAccount: r.nonce_account,
    nonceValue: r.nonce_value,
    panicTx: r.panic_tx,
    panicDecoded: r.panic_decoded,
    mode: r.mode,
    status: r.status,
    nonceHealthy: r.nonce_healthy,
    allowance: big(r.allowance),
    allowanceRemaining: big(r.allowance_remaining),
    createdAtNs: big(r.created_at),
    updatedAtNs: big(r.updated_at),
    tokenAccounts: tokens.rows
      .filter((t) => t.agent_id === r.id)
      .map((t) => ({ address: t.token_account, mint: t.mint })),
  }));
}

/** Inserts the agent, or replaces its panic file, mode and token accounts when the name already exists. */
export async function upsertAgent(db: Db, a: AgentInput, nowNs: bigint): Promise<number> {
  return db.transaction(async (tx) => {
    const r = await tx.query<{ id: number }>(
      `INSERT INTO agents (name, agent_wallet, owner_wallet, nonce_account, nonce_value, panic_tx, panic_decoded,
                           mode, status, nonce_healthy, allowance, allowance_remaining, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $13)
       ON CONFLICT (name) DO UPDATE SET
         agent_wallet = EXCLUDED.agent_wallet, owner_wallet = EXCLUDED.owner_wallet,
         nonce_account = EXCLUDED.nonce_account, nonce_value = EXCLUDED.nonce_value,
         panic_tx = EXCLUDED.panic_tx, panic_decoded = EXCLUDED.panic_decoded, mode = EXCLUDED.mode,
         status = EXCLUDED.status, nonce_healthy = EXCLUDED.nonce_healthy, allowance = EXCLUDED.allowance,
         allowance_remaining = EXCLUDED.allowance_remaining, updated_at = EXCLUDED.updated_at
       RETURNING id`,
      [
        a.name, a.agentWallet, a.ownerWallet, a.nonceAccount, a.nonceValue, a.panicTx, JSON.stringify(a.panicDecoded),
        a.mode, a.status, a.nonceHealthy, a.allowance.toString(), a.allowanceRemaining.toString(), nowNs.toString(),
      ],
    );
    const id = r.rows[0]?.id;
    if (id === undefined) throw new Error("Upserting the agent returned no id.");
    await tx.query("DELETE FROM agent_token_accounts WHERE agent_id = $1", [id]);
    for (const t of a.tokenAccounts) {
      await tx.query("INSERT INTO agent_token_accounts (agent_id, token_account, mint) VALUES ($1, $2, $3)", [
        id, t.address, t.mint,
      ]);
    }
    return id;
  });
}

export async function listAgents(db: Db): Promise<AgentRow[]> {
  const r = await db.query<Row>("SELECT * FROM agents ORDER BY name");
  return hydrate(db, r.rows);
}

export async function getAgentByName(db: Db, name: string): Promise<AgentRow | null> {
  const r = await db.query<Row>("SELECT * FROM agents WHERE name = $1", [name]);
  return (await hydrate(db, r.rows))[0] ?? null;
}

export interface AgentPatch {
  status?: AgentStatus;
  nonceHealthy?: boolean;
  allowanceRemaining?: bigint;
}

/** Updates only the fields given. Returns false when no agent has that name. */
export async function patchAgent(db: Db, name: string, patch: AgentPatch, nowNs: bigint): Promise<boolean> {
  const r = await db.query(
    `UPDATE agents SET
       status = COALESCE($2, status),
       nonce_healthy = COALESCE($3, nonce_healthy),
       allowance_remaining = COALESCE($4, allowance_remaining),
       updated_at = $5
     WHERE name = $1`,
    [name, patch.status ?? null, patch.nonceHealthy ?? null, patch.allowanceRemaining?.toString() ?? null, nowNs.toString()],
  );
  return r.rowCount > 0;
}
