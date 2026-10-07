import { Keypair } from "@solana/web3.js";
import { afterEach, describe, expect, it } from "vitest";
import type { Chain, NonceState, TokenAccountState } from "../chain/index.js";
import type { AgentConfig } from "../config/index.js";
import { buildPanicFile, type PanicFile } from "../nonce/index.js";
import { getAgentByName, listAgents, migrate, type Db } from "../store/index.js";
import { connectPglite } from "../store/testing.js";
import { addAgent } from "./add.js";

const k = () => Keypair.generate();
const owner = k();
const agent = k().publicKey;
const feePayer = k().publicKey;
const nonceAccount = k().publicKey;
const nonceValue = k().publicKey.toBase58();
const mint = k().publicKey;
const ata = k().publicKey;

const file = (over: { tokenAccounts?: { address: typeof ata; mint: typeof mint }[] } = {}): PanicFile =>
  buildPanicFile({
    owner,
    agent,
    feePayer,
    nonceAccount,
    nonceValue,
    tokenAccounts: over.tokenAccounts ?? [{ address: ata, mint }],
  });

const config = (over: Partial<AgentConfig> = {}): AgentConfig => ({
  name: "demo-agent",
  agentWallet: agent.toBase58(),
  ownerWallet: owner.publicKey.toBase58(),
  tokenAccounts: [ata.toBase58()],
  nonceAccount: nonceAccount.toBase58(),
  panicTxFile: "/tmp/panic.json",
  mode: "brake",
  policy: { maxTxPer10s: 3 },
  ...over,
});

interface World {
  nonce?: NonceState | null;
  tokens?: Record<string, TokenAccountState | null>;
}
const chain = (w: World = {}): Chain => ({
  async getNonce() {
    return w.nonce === undefined ? { value: nonceValue, authority: owner.publicKey.toBase58() } : w.nonce;
  },
  async getTokenAccount(account) {
    if (w.tokens && account in w.tokens) return w.tokens[account] ?? null;
    return { owner: owner.publicKey.toBase58(), mint: mint.toBase58(), delegate: agent.toBase58(), delegatedAmount: 5_000_000n };
  },
});

const open: Db[] = [];
const fresh = async () => {
  const db = await connectPglite();
  open.push(db);
  return db;
};
afterEach(async () => {
  while (open.length) await open.pop()?.close();
});

const add = (db: Db, c: Chain, f: PanicFile = file(), cfg: AgentConfig = config()) =>
  addAgent({ db, chain: c, config: cfg, file: f, nowNs: 1_000n });

describe("addAgent", () => {
  it("stores a valid, matching, healthy agent as armed with the allowance read from the chain", async () => {
    const db = await fresh();
    const r = await add(db, chain());
    expect(r).toMatchObject({ status: "armed", warnings: [] });
    const got = await getAgentByName(db, "demo-agent");
    expect(got).toMatchObject({
      status: "armed",
      mode: "brake",
      nonceHealthy: true,
      allowance: 5_000_000n,
      allowanceRemaining: 5_000_000n,
      nonceValue,
    });
    expect(got?.panicDecoded.map((d) => d.instruction)).toEqual([
      "AdvanceNonceAccount", "SetComputeUnitLimit", "SetComputeUnitPrice", "Revoke",
    ]);
    expect(got?.tokenAccounts).toEqual([{ address: ata.toBase58(), mint: mint.toBase58() }]);
  });

  it("runs the migrations itself, so a fresh database works", async () => {
    const db = await fresh();
    await add(db, chain());
    expect(await listAgents(db)).toHaveLength(1);
  });

  it("marks the agent stale, and still stores it, when the nonce has moved on", async () => {
    const db = await fresh();
    const r = await add(db, chain({ nonce: { value: k().publicKey.toBase58(), authority: owner.publicKey.toBase58() } }));
    expect(r.status).toBe("stale");
    expect(r.warnings.join(" ")).toMatch(/setup --refresh/);
    expect((await getAgentByName(db, "demo-agent"))?.nonceHealthy).toBe(false);
  });

  it("marks the agent disarmed with a warning when it is not the delegate", async () => {
    const db = await fresh();
    const r = await add(
      db,
      chain({ tokens: { [ata.toBase58()]: { owner: owner.publicKey.toBase58(), mint: mint.toBase58(), delegate: null, delegatedAmount: 0n } } }),
    );
    expect(r.status).toBe("disarmed");
    expect(r.warnings.join(" ")).toMatch(/not the delegate/);
    expect((await getAgentByName(db, "demo-agent"))?.allowance).toBe(0n);
  });

  it("re-importing updates the same agent", async () => {
    const db = await fresh();
    const a = await add(db, chain());
    const b = await add(db, chain(), file(), config({ mode: "alert" }));
    expect(b.id).toBe(a.id);
    expect((await getAgentByName(db, "demo-agent"))?.mode).toBe("alert");
  });
});

describe("addAgent refuses, and stores nothing", () => {
  const refused = async (run: (db: Db) => Promise<unknown>, message: RegExp) => {
    const db = await fresh();
    await migrate(db); // the refusal happens before addAgent would migrate, so prepare the tables to inspect
    await expect(run(db)).rejects.toThrow(message);
    expect(await listAgents(db)).toEqual([]);
  };

  it("a tampered panic file", async () => {
    const f = file();
    const bytes = Buffer.from(f.transaction, "base64");
    bytes[bytes.length - 1] = 4;
    await refused((db) => add(db, chain(), { ...f, transaction: bytes.toString("base64") }), /not valid/);
  });

  it("a file for a different agent wallet", async () => {
    await refused((db) => add(db, chain(), file(), config({ agentWallet: k().publicKey.toBase58() })), /agent_wallet/);
  });

  it("a file for a different owner, nonce account or token account", async () => {
    await refused((db) => add(db, chain(), file(), config({ ownerWallet: k().publicKey.toBase58() })), /owner_wallet/);
    await refused((db) => add(db, chain(), file(), config({ nonceAccount: k().publicKey.toBase58() })), /nonce_account/);
    await refused((db) => add(db, chain(), file(), config({ tokenAccounts: [k().publicKey.toBase58()] })), /token_accounts/);
  });

  it("a file that revokes more accounts than rem.yaml lists", async () => {
    const two = file({ tokenAccounts: [{ address: ata, mint }, { address: k().publicKey, mint }] });
    await refused((db) => add(db, chain(), two), /token_accounts/);
  });

  it("more than one mint", async () => {
    const other = k().publicKey;
    const second = k().publicKey;
    const f = file({ tokenAccounts: [{ address: ata, mint }, { address: second, mint: other }] });
    await refused(
      (db) => add(db, chain(), f, config({ tokenAccounts: [ata.toBase58(), second.toBase58()] })),
      /one mint per agent/,
    );
  });

  it("a nonce account that does not exist, or that someone else controls", async () => {
    await refused((db) => add(db, chain({ nonce: null })), /does not exist/);
    await refused((db) => add(db, chain({ nonce: { value: nonceValue, authority: k().publicKey.toBase58() } })), /not the authority/);
  });

  it("a token account that is missing, foreign or of another mint", async () => {
    const id = ata.toBase58();
    await refused((db) => add(db, chain({ tokens: { [id]: null } })), /does not exist/);
    await refused(
      (db) => add(db, chain({ tokens: { [id]: { owner: k().publicKey.toBase58(), mint: mint.toBase58(), delegate: null, delegatedAmount: 0n } } })),
      /not owned by the owner/,
    );
    await refused(
      (db) => add(db, chain({ tokens: { [id]: { owner: owner.publicKey.toBase58(), mint: k().publicKey.toBase58(), delegate: null, delegatedAmount: 0n } } })),
      /different mint/,
    );
  });
});
