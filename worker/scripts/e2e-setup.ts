// End-to-end check of `rem setup` on devnet, driving the real CLI as a child process.
// Needs the funded phase0 keys (run `pnpm phase0` once, or fund keys/phase0/owner.json yourself).
//
// Usage: pnpm tsx scripts/e2e-setup.ts

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createMint, getAccount, getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { completePanicTx, validatePanicTx, type PanicFile } from "../src/nonce/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const worker = resolve(here, "..");
const root = resolve(worker, "..");
const rpc = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const connection = new Connection(rpc, "confirmed");

const load = (p: string) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(p, "utf8"))));
const owner = load(resolve(root, "keys/phase0/owner.json"));
const feePayer = load(resolve(root, "keys/phase0/feepayer.json"));
const agent = Keypair.generate();
const other = Keypair.generate();

mkdirSync(resolve(root, "keys/e2e"), { recursive: true });
const ownerPath = resolve(root, "keys/phase0/owner.json");
const otherPath = resolve(root, "keys/e2e/other.json");
writeFileSync(otherPath, JSON.stringify(Array.from(other.secretKey)));
const outPath = resolve(root, "panic/e2e-setup.json");

const t0 = Date.now();
const log = (m: string) => console.log(`[+${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s] ${m}`);
const checks: { name: string; pass: boolean; detail: string }[] = [];
const check = (name: string, pass: boolean, detail = "") => {
  checks.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `: ${detail}` : ""}`);
};

function rem(args: string[]) {
  const r = spawnSync(process.execPath, ["--import", "tsx", "src/cli/index.ts", "setup", ...args], {
    cwd: worker,
    encoding: "utf8",
    env: { ...process.env, RPC_URL: rpc },
  });
  return { code: r.status ?? -1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

async function main() {
  log(`RPC ${rpc}`);
  // Two mints with different decimals prove each allowance is converted with its own mint's decimals.
  const mintA = await createMint(connection, owner, owner.publicKey, null, 6);
  const mintB = await createMint(connection, owner, owner.publicKey, null, 9);
  for (const m of [mintA, mintB]) {
    const ata = (await getOrCreateAssociatedTokenAccount(connection, owner, m, owner.publicKey)).address;
    await mintTo(connection, owner, m, ata, owner, 10_000_000_000n);
  }
  const ataA = getAssociatedTokenAddressSync(mintA, owner.publicKey);
  const ataB = getAssociatedTokenAddressSync(mintB, owner.publicKey);
  const delegateOf = async (a: PublicKey) => getAccount(connection, a, "confirmed");

  const base = [
    "--owner", ownerPath, "--agent", agent.publicKey.toBase58(), "--mint", mintA.toBase58(), "--mint", mintB.toBase58(),
    "--allowance", "5", "--fee-payer", feePayer.publicKey.toBase58(), "--out", outPath, "--force",
  ];

  // --- guards that must refuse before anything is created or approved --------------------------------
  const noRpc = spawnSync(process.execPath, ["--import", "tsx", "src/cli/index.ts", "setup", ...base], {
    cwd: worker, encoding: "utf8", env: { ...process.env, RPC_URL: "" },
  });
  check("refuses to run without an explicit RPC", noRpc.status !== 0 && /--rpc/.test(`${noRpc.stdout}${noRpc.stderr}`));

  const same = rem([...base.slice(0, 2), "--agent", owner.publicKey.toBase58(), ...base.slice(4)]);
  check("refuses an agent equal to the owner", same.code !== 0 && /different key/.test(same.out), same.out.split("\n").at(-2) ?? "");
  check("nothing was approved by the refused run", (await delegateOf(ataA)).delegate === null);

  const badAmount = rem(base.map((a) => (a === "5" ? "0.0000000001" : a)));
  check("refuses an amount finer than the token", badAmount.code !== 0 && /decimal places/.test(badAmount.out));
  check("nothing was approved by the bad amount", (await delegateOf(ataA)).delegate === null);

  // --- the real setup --------------------------------------------------------------------------------
  const res = rem(base);
  check("setup exits 0", res.code === 0, res.code === 0 ? "" : res.out.slice(0, 300));
  if (res.code !== 0) return;
  const file = JSON.parse(readFileSync(outPath, "utf8")) as PanicFile;
  const v = validatePanicTx(file);
  check("the panic file passes validatePanicTx", v.ok, v.ok ? v.decoded.map((d) => d.instruction).join(", ") : v.message);
  check("one Revoke per mint", file.tokenAccounts.length === 2 && v.ok && v.decoded.filter((d) => d.instruction === "Revoke").length === 2);

  const a = await delegateOf(ataA);
  const b = await delegateOf(ataB);
  check("agent is delegate on both accounts", a.delegate?.equals(agent.publicKey) === true && b.delegate?.equals(agent.publicKey) === true);
  check("allowance is 5 in each mint's own decimals", a.delegatedAmount === 5_000_000n && b.delegatedAmount === 5_000_000_000n, `${a.delegatedAmount} and ${b.delegatedAmount}`);

  // --- no secret leaves the owner's machine -----------------------------------------------------------
  const sk = owner.secretKey;
  const needles = [
    JSON.stringify(Array.from(sk)),
    Array.from(sk).join(","),
    bs58.encode(sk),
    Buffer.from(sk).toString("base64"),
    Buffer.from(sk).toString("hex"),
    bs58.encode(sk.slice(0, 32)),
    Buffer.from(sk.slice(0, 32)).toString("hex"),
    Buffer.from(sk.slice(0, 32)).toString("base64"),
  ];
  const haystack = `${res.out}\n${readFileSync(outPath, "utf8")}`;
  const leaked = needles.filter((n) => haystack.includes(n));
  check("no owner secret key material in the output or the file", leaked.length === 0, `${needles.length} encodings checked`);

  // --- refuses to clobber, unless forced --------------------------------------------------------------
  const noForce = rem(base.filter((x) => x !== "--force"));
  check("refuses to overwrite the output without --force", noForce.code !== 0 && /already exists/.test(noForce.out));
  check("the existing file was not touched", readFileSync(outPath, "utf8").includes(file.nonceAccount));

  // --- refresh after the nonce changes -----------------------------------------------------------------
  const nonceKey = new PublicKey(file.nonceAccount);
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(SystemProgram.nonceAdvance({ noncePubkey: nonceKey, authorizedPubkey: owner.publicKey })),
    [owner],
  );
  const advanced = await connection.getNonce(nonceKey, "confirmed");
  check("the nonce moved, so the stored file is now stale", advanced?.nonce !== file.nonceValue);

  const wrongOwner = rem(["--refresh", "--owner", otherPath, "--agent-file", outPath]);
  check("refresh refuses a key that is not the owner", wrongOwner.code !== 0 && /not the owner/.test(wrongOwner.out));

  const refreshed = rem(["--refresh", "--owner", ownerPath, "--agent-file", outPath]);
  check("refresh exits 0", refreshed.code === 0, refreshed.code === 0 ? "" : refreshed.out.slice(0, 300));
  const file2 = JSON.parse(readFileSync(outPath, "utf8")) as PanicFile;
  check("refresh picked up the new nonce value", file2.nonceValue === advanced?.nonce && file2.nonceValue !== file.nonceValue);
  check("refresh kept the same accounts", file2.nonceAccount === file.nonceAccount && file2.agent === file.agent && file2.owner === file.owner && JSON.stringify(file2.tokenAccounts) === JSON.stringify(file.tokenAccounts));
  check("the refreshed file passes validatePanicTx", validatePanicTx(file2).ok);
  const stillA = await delegateOf(ataA);
  check("refresh approved nothing new", stillA.delegatedAmount === 5_000_000n);

  // --- the refreshed file really works -------------------------------------------------------------------
  const tx = completePanicTx(file2, feePayer);
  const sig = await connection.sendRawTransaction(tx.serialize(), { maxRetries: 5 });
  const start = Date.now();
  for (;;) {
    const s = (await connection.getSignatureStatuses([sig])).value[0];
    if (s?.err) throw new Error(`panic transaction failed: ${JSON.stringify(s.err)}`);
    if (s?.confirmationStatus === "confirmed" || s?.confirmationStatus === "finalized") break;
    if (Date.now() - start > 60_000) throw new Error("panic transaction did not land");
    await new Promise((r) => setTimeout(r, 500));
  }
  const ra = await delegateOf(ataA);
  const rb = await delegateOf(ataB);
  check("the refreshed panic transaction lands and clears both delegates", ra.delegate === null && rb.delegate === null, sig);
}

main()
  .catch((e: unknown) => {
    check("script completed", false, e instanceof Error ? e.message : String(e));
  })
  .finally(() => {
    if (existsSync(otherPath)) writeFileSync(otherPath, "[]");
    const failed = checks.filter((c) => !c.pass);
    console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
    if (failed.length > 0) process.exitCode = 1;
  });
