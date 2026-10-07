import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { expandEnv } from "./env.js";
import { parseConfig } from "./load.js";
import { redactConfig, redactUrl } from "./redact.js";

const A = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"; // agent
const O = "7Np1BuYJFzFJGfkwXA2dJrm1L9d3nvMhMEZWCgV5jQcx"; // owner
const T = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"; // token account
const N = "Vote111111111111111111111111111111111111111"; // nonce account (any address)
const M = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"; // merchant

const ENV = {
  SOLAMI_GRPC_ENDPOINT: "grpc.example.dev:443",
  SOLAMI_GRPC_TOKEN: "super-secret-token",
  SOLAMI_RPC_URL: "https://rpc.example.dev/?api-key=SECRETKEY",
  SOLAMI_BEAM_URL: "https://beam.example.dev/send",
  FALLBACK_RPC_URL: "https://api.devnet.solana.com",
  REM_FEE_PAYER_KEYPAIR: "./keys/fee-payer.json",
  DATABASE_URL: "postgresql://rem_worker:DBPASSWORD@ep-test-123.neon.tech/neondb?sslmode=require",
};

const base = `
solami:
  grpc_endpoint: \${SOLAMI_GRPC_ENDPOINT}
  grpc_token: \${SOLAMI_GRPC_TOKEN}
  rpc_url: \${SOLAMI_RPC_URL}
  beam_url: \${SOLAMI_BEAM_URL}
fallback_rpc_url: \${FALLBACK_RPC_URL}
fee_payer_keypair: \${REM_FEE_PAYER_KEYPAIR}
database_url: \${DATABASE_URL}
agents:
  - name: demo-agent
    agent_wallet: ${A}
    owner_wallet: ${O}
    token_accounts: [${T}]
    nonce_account: ${N}
    panic_tx_file: ./panic/demo-agent.json
    mode: brake
    policy:
      allow_destinations: [${M}]
      max_tx_per_10s: 3
`;

const parse = (text: string, env: Record<string, string | undefined> = ENV) =>
  parseConfig(text, { env, baseDir: "/etc/rem" });

describe("expandEnv", () => {
  it("expands set variables and defaults", () => {
    expect(expandEnv("a-${X}-b", { X: "1" }, "t")).toBe("a-1-b");
    expect(expandEnv("${X:-fallback}", {}, "t")).toBe("fallback");
    expect(expandEnv("${X:-}", {}, "t")).toBe("");
    expect(expandEnv("${X:-fallback}", { X: "set" }, "t")).toBe("set");
  });

  it("fails on an unset or empty variable without a default, naming it but not any value", () => {
    expect(() => expandEnv("${NOPE}", {}, "solami.grpc_token")).toThrow(/NOPE is not set \(needed by solami\.grpc_token\)/);
    expect(() => expandEnv("${EMPTY}", { EMPTY: "" }, "x")).toThrow(/EMPTY is not set/);
  });

  it("leaves text without references alone", () => {
    expect(expandEnv("plain $text {no}", {}, "t")).toBe("plain $text {no}");
  });
});

describe("parseConfig", () => {
  it("parses a complete config and resolves paths against the config directory", () => {
    const c = parse(base);
    expect(c.solami.grpcEndpoint).toBe("grpc.example.dev:443");
    expect(c.databaseUrl).toContain("ep-test-123.neon.tech");
    expect(c.feePayerKeypair.replaceAll("\\", "/")).toContain("/etc/rem");
    expect(c.nonceCheckIntervalMs).toBe(60_000);
    expect(c.agents[0]).toMatchObject({ name: "demo-agent", mode: "brake", agentWallet: A });
    expect(c.agents[0]?.policy).toEqual({ allowDestinations: [M], maxTxPer10s: 3 });
    expect(c.telegram).toBeUndefined();
    expect(c.solami.mirageWs).toBeUndefined();
  });

  it("stops when a required variable is missing", () => {
    expect(() => parse(base, { ...ENV, SOLAMI_GRPC_TOKEN: undefined })).toThrow(/SOLAMI_GRPC_TOKEN is not set/);
  });

  it("rejects an unknown key anywhere, so a typo cannot drop a setting", () => {
    expect(() => parse(`${base}\nfallback_rpc: x`)).toThrow(/unknown key "fallback_rpc"/);
    expect(() => parse(base.replace("mode: brake", "mode: brake\n    modee: alert"))).toThrow(/unknown key "modee"/);
    expect(() => parse(base.replace("grpc_token:", "grpc_tokn:"))).toThrow(/unknown key "grpc_tokn"/);
  });

  it("rejects placeholders that were never filled in", () => {
    expect(() => parse(base.replace(A, "<AGENT_PUBKEY>"))).toThrow(/still a placeholder/);
  });

  it("requires an explicit mode", () => {
    expect(() => parse(base.replace("    mode: brake\n", ""))).toThrow(/mode must be "alert" or "brake"/);
    expect(() => parse(base.replace("mode: brake", "mode: maybe"))).toThrow(/mode must be/);
  });

  it("rejects an agent that equals its owner, duplicate names and an empty agent list", () => {
    expect(() => parse(base.replace(`owner_wallet: ${O}`, `owner_wallet: ${A}`))).toThrow(/must differ/);
    const twice = base + base.split("agents:")[1]!.split("\n").slice(1).join("\n");
    expect(() => parse(twice)).toThrow(/same name/);
    expect(() => parse(base.split("agents:")[0] + "agents: []")).toThrow(/at least one agent/);
  });

  it("rejects a policy with no rules and bad policy values", () => {
    expect(() => parse(base.replace(/ {4}policy:[\s\S]*$/, "    policy: {}\n"))).toThrow(/no rules/);
    expect(() => parse(base.replace("max_tx_per_10s: 3", "max_tx_per_10: 3"))).toThrow(/agents\[0\]: .*unknown rule/);
  });

  it("rejects bad addresses, URLs, durations and api_addr", () => {
    expect(() => parse(base.replace(N, "not-an-address"))).toThrow(/not a valid address/);
    expect(() => parse(base, { ...ENV, SOLAMI_BEAM_URL: "ftp://x" })).toThrow(/must start with/);
    expect(() => parse(base, { ...ENV, DATABASE_URL: "mysql://x/y" })).toThrow(/must start with postgres/);
    expect(() => parse(base, { ...ENV, DATABASE_URL: "not a url" })).toThrow(/not a valid URL/);
    expect(() => parse(`${base}\nnonce_check_interval: soon`)).toThrow(/duration/);
    expect(() => parse(`${base}\nnonce_check_interval: 200ms`)).toThrow(/at least 1s/);
  });

  it("accepts a duration in minutes", () => {
    expect(parse(`${base}\nnonce_check_interval: 2m`).nonceCheckIntervalMs).toBe(120_000);
  });

  it("treats empty telegram values as alerts off and a half-set pair as an error", () => {
    const off = parse(`${base}\ntelegram:\n  bot_token: \${TG:-}\n  chat_id: \${TC:-}`);
    expect(off.telegram).toBeUndefined();
    expect(() => parse(`${base}\ntelegram:\n  bot_token: abc\n  chat_id: \${TC:-}`)).toThrow(/both bot_token and chat_id/);
    const on = parse(`${base}\ntelegram:\n  bot_token: abc\n  chat_id: "123"`);
    expect(on.telegram).toEqual({ botToken: "abc", chatId: "123" });
  });

  it("reports invalid YAML", () => {
    expect(() => parse("solami: [unclosed")).toThrow(/not valid YAML/);
  });
});

describe("the shipped rem.example.yaml", () => {
  const text = readFileSync(resolve(import.meta.dirname, "../../../rem.example.yaml"), "utf8");

  it("refuses to run until its placeholders are replaced", () => {
    expect(() => parse(text)).toThrow(/still a placeholder/);
  });

  it("parses once the placeholders are filled in", () => {
    const filled = text
      .replace("<AGENT_PUBKEY>", A)
      .replace("<OWNER_PUBKEY>", O)
      .replace("<OWNER_USDC_ATA>", T)
      .replace("<NONCE_ACCOUNT_PUBKEY>", N)
      .replace("<KNOWN_MERCHANT_OR_POOL>", M);
    const c = parse(filled);
    expect(c.agents[0]?.mode).toBe("brake");
    expect(c.agents[0]?.policy.maxOutPerMinute).toBe(2_000_000n);
    expect(c.agents[0]?.policy.allowPrograms).toHaveLength(2);
    expect(c.telegram).toBeUndefined();
  });
});

describe("redaction", () => {
  const c = parse(base);

  it("masks tokens and strips query strings from URLs", () => {
    const shown = JSON.stringify(redactConfig(c));
    expect(shown).not.toContain("super-secret-token");
    expect(shown).not.toContain("SECRETKEY");
    expect(shown).not.toContain("DBPASSWORD");
    expect(shown).toContain("ep-test-123.neon.tech");
    expect(shown).toContain("***");
    expect(shown).toContain("rpc.example.dev");
  });

  it("drops URL credentials", () => {
    expect(redactUrl("https://user:pass@host.dev/path?key=1")).toBe("https://host.dev/path?…");
    expect(redactUrl("wss://ws.dev/stream")).toBe("wss://ws.dev/stream");
  });
});
