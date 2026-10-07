import { readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { parse } from "yaml";
import { parsePolicy } from "../policy/index.js";
import { expandTree } from "./env.js";
import type { AgentConfig, RemConfig } from "./types.js";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const PLACEHOLDER = /^<[^>]+>$/;
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

type Obj = Record<string, unknown>;

function obj(v: unknown, where: string): Obj {
  if (v === null || typeof v !== "object" || Array.isArray(v)) throw new Error(`${where} must be a mapping.`);
  return v as Obj;
}

/** Unknown keys are errors so a typo can never silently drop a setting. */
function only(o: Obj, allowed: string[], where: string): void {
  for (const k of Object.keys(o)) {
    if (!allowed.includes(k)) throw new Error(`${where} has an unknown key "${k}". Allowed: ${allowed.join(", ")}.`);
  }
}

function str(v: unknown, where: string): string {
  if (typeof v !== "string") throw new Error(`${where} is required and must be text.`);
  if (PLACEHOLDER.test(v.trim())) throw new Error(`${where} is still a placeholder (${v}). Replace it with a real value.`);
  if (v.trim() === "") throw new Error(`${where} must not be empty.`);
  return v.trim();
}

function optStr(v: unknown, where: string): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") throw new Error(`${where} must be text.`);
  return v.trim() === "" ? undefined : str(v, where);
}

function address(v: unknown, where: string): string {
  const s = str(v, where);
  if (!BASE58.test(s)) throw new Error(`${where} is not a valid address: ${s}`);
  return s;
}

function url(v: unknown, where: string, protocols: string[]): string {
  const s = str(v, where);
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new Error(`${where} is not a valid URL.`);
  }
  if (!protocols.includes(u.protocol)) throw new Error(`${where} must start with ${protocols.join(" or ")}.`);
  return s;
}

function grpcEndpoint(v: unknown, where: string): string {
  const s = str(v, where);
  if (!/^(https?:\/\/)?[A-Za-z0-9.-]+(:\d{1,5})?(\/)?$/.test(s)) {
    throw new Error(`${where} must be host:port or an https URL.`);
  }
  return s;
}

function duration(v: unknown, where: string): number {
  const m = /^(\d+)(ms|s|m)$/.exec(String(v ?? "").trim());
  if (!m) throw new Error(`${where} must be a duration such as 500ms, 60s or 2m.`);
  const n = Number(m[1]);
  const ms = m[2] === "ms" ? n : m[2] === "s" ? n * 1000 : n * 60_000;
  if (ms < 1000) throw new Error(`${where} must be at least 1s.`);
  return ms;
}

function path(v: unknown, where: string, baseDir: string): string {
  const s = str(v, where);
  return isAbsolute(s) ? s : resolve(baseDir, s);
}

function agent(raw: unknown, i: number, baseDir: string): AgentConfig {
  const where = `agents[${i}]`;
  const a = obj(raw, where);
  only(a, ["name", "agent_wallet", "owner_wallet", "token_accounts", "nonce_account", "panic_tx_file", "mode", "policy"], where);

  const name = str(a.name, `${where}.name`);
  if (!NAME.test(name)) throw new Error(`${where}.name may only use letters, digits, dot, dash and underscore.`);

  const agentWallet = address(a.agent_wallet, `${where}.agent_wallet`);
  const ownerWallet = address(a.owner_wallet, `${where}.owner_wallet`);
  if (agentWallet === ownerWallet) throw new Error(`${where}: the agent wallet must differ from the owner wallet.`);

  if (!Array.isArray(a.token_accounts) || a.token_accounts.length === 0) {
    throw new Error(`${where}.token_accounts must list at least one token account.`);
  }
  const tokenAccounts = a.token_accounts.map((t, j) => address(t, `${where}.token_accounts[${j}]`));
  if (new Set(tokenAccounts).size !== tokenAccounts.length) throw new Error(`${where}.token_accounts has a duplicate.`);

  // The mode is explicit on purpose: whether Rem acts or only alerts is not something to default silently.
  if (a.mode !== "alert" && a.mode !== "brake") throw new Error(`${where}.mode must be "alert" or "brake".`);

  let policy;
  try {
    policy = parsePolicy(a.policy);
  } catch (cause) {
    throw new Error(`${where}: ${(cause as Error).message}`, { cause });
  }
  if (Object.keys(policy).length === 0) {
    throw new Error(`${where}.policy defines no rules, so this agent could never trip. Add at least one rule.`);
  }

  return {
    name,
    agentWallet,
    ownerWallet,
    tokenAccounts,
    nonceAccount: address(a.nonce_account, `${where}.nonce_account`),
    panicTxFile: path(a.panic_tx_file, `${where}.panic_tx_file`, baseDir),
    mode: a.mode,
    policy,
  };
}

/** Parses rem.yaml text. Env expansion happens first, then strict validation of the whole tree. */
export function parseConfig(
  text: string,
  opts: { env?: Record<string, string | undefined>; baseDir: string },
): RemConfig {
  let tree: unknown;
  try {
    tree = parse(text);
  } catch (cause) {
    throw new Error(`rem.yaml is not valid YAML: ${(cause as Error).message}`, { cause });
  }
  const c = obj(expandTree(tree, opts.env ?? process.env), "rem.yaml");
  only(
    c,
    ["solami", "fallback_rpc_url", "fee_payer_keypair", "database_url", "telegram", "nonce_check_interval", "agents"],
    "rem.yaml",
  );

  const s = obj(c.solami, "solami");
  only(s, ["grpc_endpoint", "grpc_token", "rpc_url", "beam_url", "mirage_ws"], "solami");

  const mirage = optStr(s.mirage_ws, "solami.mirage_ws");
  const solami: RemConfig["solami"] = {
    grpcEndpoint: grpcEndpoint(s.grpc_endpoint, "solami.grpc_endpoint"),
    grpcToken: str(s.grpc_token, "solami.grpc_token"),
    rpcUrl: url(s.rpc_url, "solami.rpc_url", ["http:", "https:"]),
    beamUrl: url(s.beam_url, "solami.beam_url", ["http:", "https:"]),
  };
  if (mirage !== undefined) solami.mirageWs = url(mirage, "solami.mirage_ws", ["ws:", "wss:"]);

  // Telegram is optional: both fields empty turns alerts off, exactly one set is a mistake.
  let telegram: RemConfig["telegram"];
  if (c.telegram !== undefined && c.telegram !== null) {
    const t = obj(c.telegram, "telegram");
    only(t, ["bot_token", "chat_id"], "telegram");
    const token = optStr(t.bot_token, "telegram.bot_token");
    const chat = optStr(t.chat_id, "telegram.chat_id");
    if ((token === undefined) !== (chat === undefined)) {
      throw new Error("telegram needs both bot_token and chat_id, or neither.");
    }
    if (token !== undefined && chat !== undefined) telegram = { botToken: token, chatId: chat };
  }

  if (!Array.isArray(c.agents) || c.agents.length === 0) throw new Error("agents must list at least one agent.");
  const agents = c.agents.map((a, i) => agent(a, i, opts.baseDir));
  const names = new Set(agents.map((a) => a.name));
  if (names.size !== agents.length) throw new Error("agents has two entries with the same name.");

  const config: RemConfig = {
    solami,
    fallbackRpcUrl: url(c.fallback_rpc_url, "fallback_rpc_url", ["http:", "https:"]),
    feePayerKeypair: path(c.fee_payer_keypair, "fee_payer_keypair", opts.baseDir),
    databaseUrl: url(c.database_url, "database_url", ["postgres:", "postgresql:"]),
    nonceCheckIntervalMs: c.nonce_check_interval === undefined ? 60_000 : duration(c.nonce_check_interval, "nonce_check_interval"),
    agents,
  };
  if (telegram) config.telegram = telegram;
  return config;
}

export function loadConfig(file: string, env: Record<string, string | undefined> = process.env): RemConfig {
  const abs = resolve(file);
  let text: string;
  try {
    text = readFileSync(abs, "utf8");
  } catch (cause) {
    throw new Error(`Cannot read the config file ${abs}`, { cause });
  }
  return parseConfig(text, { env, baseDir: dirname(abs) });
}
