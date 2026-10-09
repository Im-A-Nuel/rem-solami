import { describe, expect, it } from "vitest";
import { parseConfig } from "../config/index.js";
import { scrub, secretsOf } from "./scrub.js";

const A = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
const O = "7Np1BuYJFzFJGfkwXA2dJrm1L9d3nvMhMEZWCgV5jQcx";
const T = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const N = "Vote111111111111111111111111111111111111111";

const yaml = `
solami:
  grpc_endpoint: grpc.example.dev:443
  grpc_token: GRPCTOKEN-abcdef123456
  rpc_url: https://rpc.example.dev/sol?api_key=RPCKEY-abcdef123456
  beam_url: https://rpc.example.dev/sol?api_key=SWQOSKEY-abcdef123456
fallback_rpc_url: https://api.devnet.solana.com
fee_payer_keypair: ./keys/fee-payer.json
database_url: postgresql://rem_worker:p%40ss-DBSECRET-9876@ep-test.neon.tech/neondb?sslmode=require
telegram:
  bot_token: "123456:TELEGRAMTOKEN-abcdef"
  chat_id: "42"
agents:
  - name: demo
    agent_wallet: ${A}
    owner_wallet: ${O}
    token_accounts: [${T}]
    nonce_account: ${N}
    panic_tx_file: ./p.json
    mode: brake
    policy: { max_tx_per_10s: 3 }
`;
const config = parseConfig(yaml, { env: {}, baseDir: "/x" });
const secrets = secretsOf(config);

describe("secretsOf", () => {
  it("collects tokens, URL keys, database passwords and the Telegram token", () => {
    const joined = secrets.join("\n");
    for (const s of [
      "GRPCTOKEN-abcdef123456",
      "RPCKEY-abcdef123456",
      "SWQOSKEY-abcdef123456",
      "TELEGRAMTOKEN-abcdef",
      "p%40ss-DBSECRET-9876",
      "p@ss-DBSECRET-9876", // the decoded form of the percent-encoded password
    ]) {
      expect(joined).toContain(s);
    }
  });

  it("ignores values too short to scrub safely", () => {
    const c = parseConfig(yaml.replace("GRPCTOKEN-abcdef123456", "abc"), { env: {}, baseDir: "/x" });
    expect(secretsOf(c)).not.toContain("abc");
  });
});

describe("scrub", () => {
  it("masks every secret wherever it appears", () => {
    const messy = [
      "fetch failed: https://rpc.example.dev/sol?api_key=RPCKEY-abcdef123456",
      "x-token GRPCTOKEN-abcdef123456 rejected",
      "password authentication failed for postgresql://rem_worker:p%40ss-DBSECRET-9876@ep-test.neon.tech/neondb",
      "bot123456:TELEGRAMTOKEN-abcdef/getMe",
      "key SWQOSKEY-abcdef123456 and again SWQOSKEY-abcdef123456",
      "decoded p@ss-DBSECRET-9876",
    ].join("\n");
    const out = scrub(messy, secrets);
    for (const s of secrets) expect(out).not.toContain(s);
    expect(out).toContain("***");
  });

  it("leaves ordinary text alone", () => {
    expect(scrub("mainnet-beta, slot 123, 210 ms", secrets)).toBe("mainnet-beta, slot 123, 210 ms");
  });

  it("handles regex characters in a secret", () => {
    expect(scrub("a (b+c)* d", ["(b+c)*"])).toBe("a *** d");
  });
});
