import { afterEach, describe, expect, it } from "vitest";
import type { DecodedInstruction } from "../nonce/index.js";
import { getAgentByName, listAgents, patchAgent, upsertAgent, type AgentInput } from "./agents.js";
import type { Db } from "./db.js";
import { loadRecentEvents, recordEvent, type EventInput } from "./events.js";
import { normalizePgUrl } from "./db.js";
import { migrate } from "./migrate.js";
import { MIGRATIONS } from "./migrations.js";
import { connectPglite } from "./testing.js";

const open: Db[] = [];
async function fresh(runMigrations = true): Promise<Db> {
  const db = await connectPglite();
  open.push(db);
  if (runMigrations) await migrate(db);
  return db;
}
afterEach(async () => {
  while (open.length) await open.pop()?.close();
});

const U64_MAX = 18446744073709551615n;
const decoded: DecodedInstruction[] = [
  { program: "11111111111111111111111111111111", instruction: "AdvanceNonceAccount", account: "NonceAcct" },
  { program: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", instruction: "Revoke", account: "Ata1" },
];

function agent(over: Partial<AgentInput> = {}): AgentInput {
  return {
    name: "demo-agent",
    agentWallet: "AgentWallet",
    ownerWallet: "OwnerWallet",
    nonceAccount: "NonceAcct",
    nonceValue: "NonceValue1",
    panicTx: "BASE64TX",
    panicDecoded: decoded,
    mode: "brake",
    status: "armed",
    nonceHealthy: true,
    allowance: 5_000_000n,
    allowanceRemaining: 5_000_000n,
    tokenAccounts: [{ address: "Ata1", mint: "MintA" }],
    ...over,
  };
}

function event(agentId: number, over: Partial<EventInput> = {}): EventInput {
  return {
    signature: "sig-1",
    agentId,
    slot: 100,
    seenAtNs: 1_000_000_000n,
    kind: "transfer",
    programIds: ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"],
    destination: "Dest",
    amount: 1_000n,
    verdict: "ok",
    rule: null,
    ...over,
  };
}

describe("migrate", () => {
  it("creates the schema once and does nothing the second time", async () => {
    const db = await fresh(false);
    expect(await migrate(db)).toEqual([1]);
    expect(await migrate(db)).toEqual([]);
    const tables = await db.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
    );
    expect(tables.rows.map((r) => r.table_name)).toEqual([
      "agent_token_accounts", "agents", "events", "incidents", "landings", "schema_migrations",
    ]);
  });

  it("applies a migration atomically: a failing one leaves nothing behind and is not recorded", async () => {
    const db = await fresh(false);
    const broken = [
      { version: 1, name: "ok", sql: "CREATE TABLE a (x INT);" },
      { version: 2, name: "broken", sql: "CREATE TABLE b (x INT); SELECT * FROM does_not_exist;" },
    ];
    await expect(migrate(db, broken)).rejects.toThrow();
    const b = await db.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'b'");
    expect(b.rowCount).toBe(0);
    const recorded = await db.query<{ version: number }>("SELECT version FROM schema_migrations ORDER BY version");
    expect(recorded.rows.map((r) => r.version)).toEqual([1]);
  });

  it("applies each migration once even when two starts race", async () => {
    const db = await fresh(false);
    const [a, b] = await Promise.all([migrate(db), migrate(db)]);
    expect([...a, ...b].sort()).toEqual([1]);
  });

  it("ships migrations with strictly increasing versions", () => {
    const versions = MIGRATIONS.map((m) => m.version);
    expect(versions).toEqual([...versions].sort((x, y) => x - y));
    expect(new Set(versions).size).toBe(versions.length);
  });
});

describe("agents", () => {
  it("stores an agent with its token accounts and reads it back exactly", async () => {
    const db = await fresh();
    const id = await upsertAgent(db, agent(), 123n);
    const got = await getAgentByName(db, "demo-agent");
    expect(got).toMatchObject({
      id,
      name: "demo-agent",
      mode: "brake",
      status: "armed",
      nonceHealthy: true,
      allowance: 5_000_000n,
      createdAtNs: 123n,
      updatedAtNs: 123n,
      tokenAccounts: [{ address: "Ata1", mint: "MintA" }],
    });
    expect(got?.panicDecoded).toEqual(decoded);
  });

  it("keeps uint64 amounts exact", async () => {
    const db = await fresh();
    await upsertAgent(db, agent({ allowance: U64_MAX, allowanceRemaining: U64_MAX - 1n }), 1n);
    const got = await getAgentByName(db, "demo-agent");
    expect(got?.allowance).toBe(U64_MAX);
    expect(got?.allowanceRemaining).toBe(U64_MAX - 1n);
  });

  it("replaces the panic file and token accounts on a second import, keeping the id", async () => {
    const db = await fresh();
    const id1 = await upsertAgent(db, agent(), 1n);
    const id2 = await upsertAgent(
      db,
      agent({
        panicTx: "NEWTX",
        nonceValue: "NonceValue2",
        mode: "alert",
        tokenAccounts: [{ address: "Ata2", mint: "MintB" }, { address: "Ata3", mint: "MintC" }],
      }),
      2n,
    );
    expect(id2).toBe(id1);
    const got = await getAgentByName(db, "demo-agent");
    expect(got).toMatchObject({ panicTx: "NEWTX", nonceValue: "NonceValue2", mode: "alert", createdAtNs: 1n, updatedAtNs: 2n });
    expect(got?.tokenAccounts.map((t) => t.address)).toEqual(["Ata2", "Ata3"]);
    expect(await listAgents(db)).toHaveLength(1);
  });

  it("lists agents by name with their own token accounts", async () => {
    const db = await fresh();
    await upsertAgent(db, agent({ name: "zeta", tokenAccounts: [{ address: "AtaZ", mint: "M" }] }), 1n);
    await upsertAgent(db, agent({ name: "alpha", tokenAccounts: [{ address: "AtaA", mint: "M" }] }), 1n);
    const all = await listAgents(db);
    expect(all.map((a) => a.name)).toEqual(["alpha", "zeta"]);
    expect(all[0]?.tokenAccounts).toEqual([{ address: "AtaA", mint: "M" }]);
    expect(all[1]?.tokenAccounts).toEqual([{ address: "AtaZ", mint: "M" }]);
  });

  it("returns null and an empty list when there is nothing", async () => {
    const db = await fresh();
    expect(await getAgentByName(db, "nope")).toBeNull();
    expect(await listAgents(db)).toEqual([]);
  });

  it("patches only the fields given", async () => {
    const db = await fresh();
    await upsertAgent(db, agent(), 1n);
    expect(await patchAgent(db, "demo-agent", { status: "stale", nonceHealthy: false }, 9n)).toBe(true);
    let got = await getAgentByName(db, "demo-agent");
    expect(got).toMatchObject({ status: "stale", nonceHealthy: false, allowanceRemaining: 5_000_000n, updatedAtNs: 9n });
    await patchAgent(db, "demo-agent", { allowanceRemaining: 42n }, 10n);
    got = await getAgentByName(db, "demo-agent");
    expect(got).toMatchObject({ status: "stale", allowanceRemaining: 42n });
    expect(await patchAgent(db, "missing", { status: "armed" }, 11n)).toBe(false);
  });

  it("rejects values the schema forbids", async () => {
    const db = await fresh();
    await expect(upsertAgent(db, agent({ mode: "yolo" as never }), 1n)).rejects.toThrow();
    await expect(upsertAgent(db, agent({ status: "dead" as never }), 1n)).rejects.toThrow();
    await expect(upsertAgent(db, agent({ allowance: -1n }), 1n)).rejects.toThrow();
    expect(await listAgents(db)).toEqual([]); // the failed imports left nothing behind
  });

  it("rolls back the whole import when a token account insert fails", async () => {
    const db = await fresh();
    await expect(
      upsertAgent(db, agent({ tokenAccounts: [{ address: "Ata1", mint: "M" }, { address: "Ata1", mint: "M" }] }), 1n),
    ).rejects.toThrow();
    expect(await listAgents(db)).toEqual([]);
  });

  it("deletes an agent's token accounts and events with it", async () => {
    const db = await fresh();
    const id = await upsertAgent(db, agent(), 1n);
    await recordEvent(db, event(id));
    await db.query("DELETE FROM agents WHERE id = $1", [id]);
    expect((await db.query("SELECT 1 FROM agent_token_accounts")).rowCount).toBe(0);
    expect((await db.query("SELECT 1 FROM events")).rowCount).toBe(0);
  });
});

describe("events", () => {
  it("stores an event once and ignores a replayed signature", async () => {
    const db = await fresh();
    const id = await upsertAgent(db, agent(), 1n);
    expect(await recordEvent(db, event(id))).toBe(true);
    expect(await recordEvent(db, event(id))).toBe(false);
    expect((await db.query("SELECT 1 FROM events")).rowCount).toBe(1);
  });

  it("keeps uint64 amounts exact", async () => {
    const db = await fresh();
    const id = await upsertAgent(db, agent(), 1n);
    await recordEvent(db, event(id, { signature: "big", amount: U64_MAX, seenAtNs: 5n }));
    const [row] = await loadRecentEvents(db, id, 0n);
    expect(row?.amount).toBe(U64_MAX);
  });

  it("requires a rule exactly when the verdict is a violation", async () => {
    const db = await fresh();
    const id = await upsertAgent(db, agent(), 1n);
    await expect(recordEvent(db, event(id, { signature: "a", verdict: "violation", rule: null }))).rejects.toThrow();
    await expect(recordEvent(db, event(id, { signature: "b", verdict: "ok", rule: "allow_programs" }))).rejects.toThrow();
    expect(await recordEvent(db, event(id, { signature: "c", verdict: "violation", rule: "allow_programs" }))).toBe(true);
  });

  it("rejects an event for an agent that does not exist", async () => {
    const db = await fresh();
    await expect(recordEvent(db, event(999))).rejects.toThrow();
  });

  it("loads recent events oldest first, only for that agent and only since the cutoff", async () => {
    const db = await fresh();
    const a = await upsertAgent(db, agent({ name: "a", tokenAccounts: [{ address: "T1", mint: "M" }] }), 1n);
    const b = await upsertAgent(db, agent({ name: "b", tokenAccounts: [{ address: "T2", mint: "M" }] }), 1n);
    await recordEvent(db, event(a, { signature: "old", seenAtNs: 10n, amount: 1n }));
    await recordEvent(db, event(a, { signature: "late", seenAtNs: 300n, amount: null }));
    await recordEvent(db, event(a, { signature: "mid", seenAtNs: 200n, amount: 2n }));
    await recordEvent(db, event(b, { signature: "other", seenAtNs: 250n, amount: 9n }));
    const rows = await loadRecentEvents(db, a, 100n);
    expect(rows).toEqual([
      { seenAtNs: 200n, amount: 2n },
      { seenAtNs: 300n, amount: null },
    ]);
  });
});

describe("landings and incidents", () => {
  it("keeps one landing per route for the same signature", async () => {
    const db = await fresh();
    const ins = (route: string) =>
      db.query("INSERT INTO landings (signature, source, route, sent_at, sent_slot) VALUES ('s', 'incident', $1, 1, 1)", [route]);
    await ins("beam");
    await ins("rpc");
    await expect(ins("beam")).rejects.toThrow();
    await expect(ins("carrier-pigeon")).rejects.toThrow();
  });

  it("only links an incident to an event that exists", async () => {
    const db = await fresh();
    const id = await upsertAgent(db, agent(), 1n);
    const insert = (sig: string) =>
      db.query(
        "INSERT INTO incidents (agent_id, trigger_signature, rule, seen_at, decided_at, status) VALUES ($1, $2, 'allow_programs', 1, 2, 'alerted')",
        [id, sig],
      );
    await expect(insert("no-such-event")).rejects.toThrow();
    await recordEvent(db, event(id, { signature: "real", verdict: "violation", rule: "allow_programs" }));
    await insert("real");
    expect((await db.query("SELECT 1 FROM incidents")).rowCount).toBe(1);
  });
});

describe("normalizePgUrl", () => {
  it("says verify-full outright for the modes pg is about to change, and keeps the rest of the URL", () => {
    const url = "postgresql://user:p%40ss@ep-x-pooler.neon.tech/neondb?sslmode=require&application_name=rem";
    const out = normalizePgUrl(url);
    expect(out).toContain("sslmode=verify-full");
    expect(out).toContain("application_name=rem");
    expect(out).toContain("p%40ss");
    expect(out).toContain("ep-x-pooler.neon.tech");
    expect(normalizePgUrl("postgres://u:p@h/db?sslmode=prefer")).toContain("sslmode=verify-full");
    expect(normalizePgUrl("postgres://u:p@h/db?sslmode=verify-ca")).toContain("sslmode=verify-full");
  });

  it("leaves other settings alone", () => {
    for (const url of [
      "postgres://u:p@h/db?sslmode=verify-full",
      "postgres://u:p@h/db?sslmode=disable",
      "postgres://u:p@h/db",
      "postgres://u:p@h/db?uselibpqcompat=true&sslmode=require",
      "not a url",
    ]) {
      expect(normalizePgUrl(url)).toBe(url);
    }
  });
});
