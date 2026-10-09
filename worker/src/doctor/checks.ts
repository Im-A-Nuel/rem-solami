import { PublicKey, type Connection } from "@solana/web3.js";
import { clusterOf, type Cluster } from "../nonce/index.js";
import { MIGRATIONS, type Db } from "../store/index.js";
import { loadKeypair } from "../keys.js";
import { connectGrpc, type GrpcClient } from "../watch/client.js";

// Each check answers one question and never throws: a failure is a result. None of them sends a
// transaction or writes to the database. Callers scrub everything printed (see scrub.ts).

export type Status = "pass" | "warn" | "fail" | "skip";
export interface CheckResult {
  name: string;
  status: Status;
  detail: string;
}

const result = (name: string, status: Status, detail: string): CheckResult => ({ name, status, detail });
const TIMEOUT_MS = 10_000;

function describeNetworkError(e: unknown): string {
  const err = e as { name?: string; message?: string; cause?: { code?: string } };
  if (err.name === "TimeoutError" || err.name === "AbortError") return `no answer within ${TIMEOUT_MS / 1000} s`;
  switch (err.cause?.code) {
    case "ENOTFOUND":
      return "the host name does not exist";
    case "ECONNREFUSED":
      return "the connection was refused";
    case "UND_ERR_CONNECT_TIMEOUT":
      return "could not connect in time";
    default:
      return err.message ?? "network error";
  }
}

interface Reply {
  http: number;
  json: { result?: unknown; error?: { message?: string } } | null;
  ms: number;
}

async function rpcCall(url: string, method: string): Promise<Reply> {
  const start = performance.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: [] }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  let json: Reply["json"] = null;
  try {
    json = (await res.json()) as Reply["json"];
  } catch {
    /* not JSON */
  }
  return { http: res.status, json, ms: Math.round(performance.now() - start) };
}

/** A Solana JSON-RPC endpoint: answers getSlot and says which cluster it is on. */
export async function checkRpc(name: string, url: string): Promise<{ result: CheckResult; cluster: Cluster | null }> {
  let slot: Reply;
  try {
    slot = await rpcCall(url, "getSlot");
  } catch (e) {
    return { result: result(name, "fail", describeNetworkError(e)), cluster: null };
  }
  if (slot.http === 401 || slot.http === 403) {
    return { result: result(name, "fail", `the key was rejected (HTTP ${slot.http})`), cluster: null };
  }
  if (slot.http === 429) return { result: result(name, "warn", "reachable but rate limited (HTTP 429)"), cluster: null };
  if (slot.http < 200 || slot.http >= 300) return { result: result(name, "fail", `HTTP ${slot.http}`), cluster: null };
  if (slot.json?.error) return { result: result(name, "fail", `RPC error: ${slot.json.error.message ?? "unknown"}`), cluster: null };
  if (typeof slot.json?.result !== "number") {
    return { result: result(name, "fail", "answered, but not like a Solana RPC. Check the URL."), cluster: null };
  }
  let cluster: Cluster | null = null;
  try {
    const g = await rpcCall(url, "getGenesisHash");
    if (typeof g.json?.result === "string") cluster = clusterOf(g.json.result);
  } catch {
    /* the cluster is a bonus */
  }
  return { result: result(name, "pass", `${cluster ?? "unknown cluster"}, slot ${slot.json.result}, ${slot.ms} ms`), cluster };
}

/** The landing endpoint. A harmless read is sent: this never submits a transaction. */
export async function checkBeam(url: string): Promise<CheckResult> {
  const name = "Beam (landing)";
  let r: Reply;
  try {
    r = await rpcCall(url, "getHealth");
  } catch (e) {
    return result(name, "fail", describeNetworkError(e));
  }
  if (r.http === 401 || r.http === 403) return result(name, "fail", `the key was rejected (HTTP ${r.http})`);
  if (r.http === 429) return result(name, "warn", "reachable but rate limited (HTTP 429)");
  if (r.http === 404 || r.http === 405) return result(name, "warn", `reachable but HTTP ${r.http}: is this the right URL?`);
  if (r.http < 200 || r.http >= 300) return result(name, "fail", `HTTP ${r.http}`);
  if (r.json === null) return result(name, "warn", "reachable, but the answer was not JSON-RPC");
  return result(name, "pass", `reachable, key accepted, ${r.ms} ms (no transaction was sent, so landing access is not proven)`);
}

/**
 * Solami answers with a JSON string such as {"version":{"package":"yellowstone-grpc-geyser","version":"15.2.1"}}.
 * Other servers or clients give an object or a plain string. Pull the version out of any of them.
 */
export function grpcVersion(raw: unknown): string {
  const dig = (x: unknown, depth = 0): string | null => {
    if (typeof x === "string") return x.length < 40 && !x.trim().startsWith("{") ? x : null;
    if (x && typeof x === "object" && "version" in x && depth < 4) return dig((x as { version: unknown }).version, depth + 1);
    return null;
  };
  if (typeof raw === "string") {
    try {
      return dig(JSON.parse(raw)) ?? dig(raw) ?? "unknown";
    } catch {
      return dig(raw) ?? "unknown";
    }
  }
  return dig(raw) ?? "unknown";
}

function describeGrpcError(e: unknown): string {
  const err = e as { code?: number; details?: string; message?: string };
  if (err.code === 16 || err.code === 7) return "the token was rejected";
  if (err.code === 14) return "cannot reach the endpoint. Check the host, and that it speaks TLS.";
  if (err.code === 12) return "the endpoint is not a Yellowstone gRPC service";
  return err.details ?? err.message ?? "gRPC error";
}

/** Yellowstone gRPC: authenticates and answers version, ping and slot. */
export async function checkGrpc(
  endpoint: string,
  token: string,
  connect: (endpoint: string, token: string) => GrpcClient = connectGrpc,
): Promise<CheckResult> {
  const name = "gRPC stream";
  let client: GrpcClient | undefined;
  try {
    client = connect(endpoint, token);
    const start = performance.now();
    const work = (async () => {
      const raw = await client.getVersion();
      await client.ping(1);
      const slot = await client.getSlot();
      return { raw, slot };
    })();
    const timer = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("no answer within 12 s")), 12_000));
    const { raw, slot } = await Promise.race([work, timer]);
    return result(name, "pass", `version ${grpcVersion(raw)}, slot ${slot}, ${Math.round(performance.now() - start)} ms`);
  } catch (e) {
    return result(name, "fail", describeGrpcError(e));
  } finally {
    try {
      client?._client.close();
    } catch {
      /* already closed */
    }
  }
}

/** Connected, what version, which role, and whether the schema is there and current. */
export async function checkDatabase(db: Db): Promise<CheckResult> {
  const name = "Database";
  try {
    const start = performance.now();
    await db.query("SELECT 1");
    const ms = Math.round(performance.now() - start);
    const info = await db.query<{ v: string; u: string }>("SELECT current_setting('server_version') AS v, current_user AS u");
    const where = `Postgres ${info.rows[0]?.v ?? "?"} as role ${info.rows[0]?.u ?? "?"}, ${ms} ms`;
    const reg = await db.query<{ t: string | null }>("SELECT to_regclass('public.schema_migrations')::text AS t");
    if (!reg.rows[0]?.t) return result(name, "warn", `${where}. No schema yet: the first \`rem agent add\` creates it.`);
    const m = await db.query<{ v: number | null }>("SELECT max(version) AS v FROM schema_migrations");
    const have = m.rows[0]?.v ?? 0;
    const want = MIGRATIONS.at(-1)?.version ?? 0;
    if (have < want) return result(name, "warn", `${where}. Schema is at ${have}, code expects ${want}: run \`rem agent add\` to migrate.`);
    return result(name, "pass", `${where}, schema ${have}`);
  } catch (e) {
    const err = e as { message?: string; code?: string };
    return result(name, "fail", err.code === "28P01" ? "authentication failed: wrong user or password" : (err.message ?? "database error"));
  }
}

const LAMPORTS_PER_SOL = 1_000_000_000;
const FEE_PAYER_LOW = 5_000_000; // 0.005 SOL: enough for the fee ceiling of one panic send
const FEE_PAYER_CAP = 50_000_000; // 0.05 SOL: the most Rem's fee payer should ever hold

export function judgeFeePayerBalance(lamports: number): { status: Status; detail: string } {
  const sol = (lamports / LAMPORTS_PER_SOL).toFixed(4);
  if (lamports === 0) return { status: "fail", detail: `0 SOL. Rem could not pay to send the panic transaction.` };
  if (lamports < FEE_PAYER_LOW) return { status: "warn", detail: `${sol} SOL is low. Top it up to about 0.01 SOL.` };
  if (lamports > FEE_PAYER_CAP) return { status: "warn", detail: `${sol} SOL is more than the 0.05 SOL this wallet should hold.` };
  return { status: "pass", detail: `${sol} SOL` };
}

export async function checkFeePayer(
  keyPath: string,
  connection: Pick<Connection, "getBalance">,
  load: typeof loadKeypair = loadKeypair,
): Promise<CheckResult> {
  const name = "Fee payer";
  let pubkey: PublicKey;
  try {
    pubkey = load(keyPath).publicKey;
  } catch (e) {
    return result(name, "fail", `${(e as Error).message}. Create a keypair file there (a fresh key that holds only SOL).`);
  }
  try {
    const j = judgeFeePayerBalance(await connection.getBalance(pubkey));
    return result(name, j.status, `${pubkey.toBase58()}, ${j.detail}`);
  } catch (e) {
    return result(name, "warn", `${pubkey.toBase58()}, could not read the balance: ${describeNetworkError(e)}`);
  }
}

/** Telegram, if configured: the bot token works and the bot can reach the chat. Nothing is sent. */
export async function checkTelegram(
  tg: { botToken: string; chatId: string } | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<CheckResult> {
  const name = "Telegram alerts";
  if (!tg) return result(name, "skip", "not configured, so no alerts will be sent");
  const call = async (method: string, query = "") => {
    const res = await fetchImpl(`https://api.telegram.org/bot${tg.botToken}/${method}${query}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { http: res.status, body: (await res.json().catch(() => null)) as { ok?: boolean; result?: Record<string, unknown> } | null };
  };
  try {
    const me = await call("getMe");
    if (me.http === 401 || me.body?.ok === false) return result(name, "fail", "Telegram rejected the bot token");
    const chat = await call("getChat", `?chat_id=${encodeURIComponent(tg.chatId)}`);
    if (chat.body?.ok !== true) {
      return result(name, "fail", `the bot works but cannot reach chat ${tg.chatId}. Send the bot a message first.`);
    }
    return result(name, "pass", `bot @${String(me.body?.result?.username ?? "?")} can reach the chat`);
  } catch (e) {
    return result(name, "fail", describeNetworkError(e));
  }
}

/** Solami's RPC and the fallback RPC must be on the same cluster, or one of the two sends can never land. */
export function compareClusters(solami: Cluster | null, fallback: Cluster | null): CheckResult | null {
  if (!solami || !fallback || solami === "unknown" || fallback === "unknown" || solami === fallback) return null;
  return result(
    "Cluster match",
    "warn",
    `Solami RPC is on ${solami} but the fallback RPC is on ${fallback}. A send through the fallback would never land. Point FALLBACK_RPC_URL at ${solami}.`,
  );
}
