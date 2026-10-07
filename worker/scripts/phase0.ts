// Phase 0 de-risk, on devnet. Proves the core claim of Rem before anything else is built:
//   1. a panic transaction signed by the owner earlier still lands later, with only the fee payer added;
//   2. after it lands the agent's delegate is gone, so the agent's next delegated transfer fails;
//   3. sending the same bytes again does nothing (the nonce has moved on).
//
// Usage: pnpm phase0            (PHASE0_WAIT_SECONDS=180 by default, RPC_URL to override devnet)
// Keys are generated into ../keys/phase0 (git-ignored). Only public keys are ever printed.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  approve,
  createMint,
  createTransferInstruction,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  NONCE_ACCOUNT_LENGTH,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { buildPanicFile, completePanicTx } from "../src/nonce/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const keyDir = resolve(root, "keys/phase0");
const panicDir = resolve(root, "panic");
const rpcUrl = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const waitSeconds = Number(process.env.PHASE0_WAIT_SECONDS ?? "180");
const connection = new Connection(rpcUrl, "confirmed");

const t0 = Date.now();
const log = (msg: string) => console.log(`[+${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s] ${msg}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadOrCreate(name: string): Keypair {
  mkdirSync(keyDir, { recursive: true });
  const path = resolve(keyDir, `${name}.json`);
  if (existsSync(path)) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
  const kp = Keypair.generate();
  writeFileSync(path, JSON.stringify(Array.from(kp.secretKey)), { mode: 0o600 });
  return kp;
}

async function ensureBalance(label: string, pk: PublicKey, minLamports: number) {
  const have = await connection.getBalance(pk);
  if (have >= minLamports) return log(`${label} ${pk.toBase58()} has ${(have / LAMPORTS_PER_SOL).toFixed(3)} SOL`);
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      log(`airdrop to ${label} (attempt ${attempt})`);
      const sig = await connection.requestAirdrop(pk, Math.max(minLamports - have, 0.2 * LAMPORTS_PER_SOL));
      const latest = await connection.getLatestBlockhash();
      await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
      return;
    } catch (cause) {
      log(`airdrop failed: ${(cause as Error).message.split("\n")[0]}`);
      await sleep(2000 * attempt);
    }
  }
  throw new Error(
    `Could not fund ${label}. Send devnet SOL to ${pk.toBase58()} from https://faucet.solana.com and run again.`,
  );
}

async function landed(signature: string, timeoutMs = 60_000): Promise<number> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { value } = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
    const s = value[0];
    if (s?.err) throw new Error(`transaction ${signature} failed: ${JSON.stringify(s.err)}`);
    if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) return s.slot;
    await sleep(500);
  }
  throw new Error(`transaction ${signature} did not land within ${timeoutMs / 1000}s`);
}

const checks: { name: string; pass: boolean; detail: string }[] = [];
const check = (name: string, pass: boolean, detail: string) => {
  checks.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"}  ${name}: ${detail}`);
};

async function main() {
  log(`RPC ${rpcUrl}`);
  const owner = loadOrCreate("owner");
  const agent = loadOrCreate("agent");
  const feePayer = loadOrCreate("feepayer");
  log(`owner ${owner.publicKey.toBase58()}`);
  log(`agent ${agent.publicKey.toBase58()}`);
  log(`feePayer ${feePayer.publicKey.toBase58()}`);

  await ensureBalance("owner", owner.publicKey, 0.1 * LAMPORTS_PER_SOL);
  await ensureBalance("feePayer", feePayer.publicKey, 0.02 * LAMPORTS_PER_SOL);

  // A test mint stands in for USDC: the proof only needs approve and revoke on a token account.
  const mint = await createMint(connection, owner, owner.publicKey, null, 6);
  const ownerAta = (await getOrCreateAssociatedTokenAccount(connection, owner, mint, owner.publicKey)).address;
  const destAta = (await getOrCreateAssociatedTokenAccount(connection, owner, mint, Keypair.generate().publicKey))
    .address;
  await mintTo(connection, owner, mint, ownerAta, owner, 5_000_000n);
  log(`mint ${mint.toBase58()}, owner token account ${ownerAta.toBase58()}`);

  await approve(connection, owner, ownerAta, agent.publicKey, owner, 5_000_000n);
  const delegateOf = async () => (await getAccount(connection, ownerAta, "confirmed")).delegate?.toBase58() ?? null;
  check("agent is the delegate after approve", (await delegateOf()) === agent.publicKey.toBase58(), "delegate set");

  // Durable nonce account, owner as authority.
  const nonceKp = Keypair.generate();
  const rent = await connection.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH);
  await sendAndConfirmTransaction(
    connection,
    SystemProgram.createNonceAccount({
      fromPubkey: owner.publicKey,
      noncePubkey: nonceKp.publicKey,
      authorizedPubkey: owner.publicKey,
      lamports: rent,
    }),
    [owner, nonceKp],
  );
  const nonce0 = await connection.getNonce(nonceKp.publicKey, "confirmed");
  if (!nonce0) throw new Error("nonce account was not created");
  log(`nonce account ${nonceKp.publicKey.toBase58()} value ${nonce0.nonce}`);

  // The owner signs once, offline. From here on the owner key is not used for the panic transaction.
  const file = buildPanicFile({
    owner,
    agent: agent.publicKey,
    feePayer: feePayer.publicKey,
    nonceAccount: nonceKp.publicKey,
    nonceValue: nonce0.nonce,
    tokenAccounts: [{ address: ownerAta, mint }],
  });
  mkdirSync(panicDir, { recursive: true });
  writeFileSync(resolve(panicDir, "phase0.json"), JSON.stringify(file, null, 2));
  log(`panic file written (${file.instructions.join(", ")})`);

  // The agent can spend through its delegate while armed.
  const agentTransfer = async () => {
    const tx = new Transaction().add(createTransferInstruction(ownerAta, destAta, agent.publicKey, 100_000n));
    return sendAndConfirmTransaction(connection, tx, [owner, agent]); // owner pays the fee, agent authorises
  };
  await agentTransfer();
  check("agent can spend through its delegate before the panic", true, "delegated transfer landed");

  log(`waiting ${waitSeconds}s with the signed panic transaction stored...`);
  await sleep(waitSeconds * 1000);

  // Incident: Rem adds only its fee payer signature and sends.
  const tx = completePanicTx(file, feePayer);
  const sendSlot = await connection.getSlot("confirmed");
  const tSend = Date.now();
  const signature = await connection.sendRawTransaction(tx.serialize(), { maxRetries: 5 });
  const landedSlot = await landed(signature);
  const landMs = Date.now() - tSend;
  log(`panic tx ${signature} landed at slot ${landedSlot} (${landedSlot - sendSlot} slots, ${landMs} ms)`);
  check("panic transaction signed earlier lands later", true, `${signature}`);

  check("delegate is cleared after the panic", (await delegateOf()) === null, "delegate is none");
  const nonce1 = await connection.getNonce(nonceKp.publicKey, "confirmed");
  check("nonce advanced when the panic landed", nonce1?.nonce !== nonce0.nonce, "stored value changed");

  let afterFailed = false;
  let afterMsg = "";
  try {
    await agentTransfer();
  } catch (cause) {
    afterFailed = true;
    afterMsg = (cause as Error).message.split("\n")[0] ?? "";
  }
  check("agent's next delegated transfer fails", afterFailed, afterMsg || "it unexpectedly succeeded");

  // Replay: re-approve, then resend the exact same bytes. If the replay executed, the delegate would vanish again.
  await approve(connection, owner, ownerAta, agent.publicKey, owner, 5_000_000n);
  check("agent re-approved for the replay test", (await delegateOf()) === agent.publicKey.toBase58(), "delegate set");
  try {
    await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
  } catch {
    /* an RPC may refuse outright, which is also a pass */
  }
  await sleep(20_000);
  check("replaying the same panic bytes does nothing", (await delegateOf()) === agent.publicKey.toBase58(), "delegate survived");

  const failed = checks.filter((c) => !c.pass);
  const summary = {
    rpc: rpcUrl,
    waitSeconds,
    panicSignature: signature,
    sendToLandSlots: landedSlot - sendSlot,
    sendToLandMs: landMs,
    note: "single run, not a latency measurement",
    checks,
  };
  writeFileSync(resolve(panicDir, "phase0-result.json"), JSON.stringify(summary, null, 2));
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((e: unknown) => {
  console.error(`\nphase0 failed: ${(e as Error).message}`);
  process.exitCode = 1;
});
