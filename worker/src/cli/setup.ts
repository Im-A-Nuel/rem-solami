import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { Connection, PublicKey } from "@solana/web3.js";
import { clusterOf, refreshPanicFile, setupAgent, type PanicFile } from "../nonce/index.js";
import { loadKeypair } from "./keys.js";
import { fromUserDir } from "./paths.js";

export const SETUP_USAGE = `Usage:
  rem setup --owner <keypair.json> --agent <pubkey> --mint <mint> [--mint <mint> ...]
            --allowance <amount> --fee-payer <pubkey> --out <file> [options]
  rem setup --refresh --owner <keypair.json> --agent-file <file> [--out <file>] [options]

Run this on the OWNER's machine. The owner key never leaves it, and the output file holds no secret.

  --allowance   Tokens the agent may spend per token account, as a plain amount: 5 or 0.5
  --fee-payer   Public key of Rem's fee payer (it only needs a little SOL)
  --refresh     Re-sign the panic transaction after the nonce changed (nothing is approved or created)
Options:
  --rpc <url>        RPC endpoint (or set RPC_URL)
  --allow-mainnet    Required to act on mainnet-beta
  --force            Overwrite an existing output file`;

const options = {
  owner: { type: "string" },
  agent: { type: "string" },
  mint: { type: "string", multiple: true },
  allowance: { type: "string" },
  "fee-payer": { type: "string" },
  out: { type: "string" },
  refresh: { type: "boolean" },
  "agent-file": { type: "string" },
  rpc: { type: "string" },
  "allow-mainnet": { type: "boolean" },
  force: { type: "boolean" },
} as const;

function need<T>(value: T | undefined, flag: string): T {
  if (value === undefined) throw new Error(`Missing --${flag}.\n\n${SETUP_USAGE}`);
  return value;
}

function pubkey(value: string, flag: string): PublicKey {
  try {
    return new PublicKey(value);
  } catch {
    throw new Error(`--${flag} is not a valid public key: ${value}`);
  }
}

function writeOut(path: string, file: PanicFile, overwrite: boolean) {
  const out = resolve(path);
  if (existsSync(out) && !overwrite) throw new Error(`${out} already exists. Use --force to overwrite it.`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(file, null, 2)}\n`);
  return out;
}

export async function runSetup(argv: string[]): Promise<void> {
  const { values: v } = parseArgs({ args: argv, options, strict: true, allowPositionals: false });

  const rpc = v.rpc ?? process.env.RPC_URL;
  if (!rpc) throw new Error(`Pass --rpc <url> or set RPC_URL, so it is always explicit which cluster this acts on.`);
  const connection = new Connection(rpc, "confirmed");

  const cluster = clusterOf(await connection.getGenesisHash());
  console.log(`Cluster: ${cluster}`);
  if (cluster === "mainnet-beta" && !v["allow-mainnet"]) {
    throw new Error("This is mainnet-beta. Re-run with --allow-mainnet if that is what you intend.");
  }

  const owner = loadKeypair(fromUserDir(need(v.owner, "owner")));

  if (v.refresh) {
    const agentFile = fromUserDir(need(v["agent-file"], "agent-file"));
    const old = JSON.parse(readFileSync(agentFile, "utf8")) as PanicFile;
    const file = await refreshPanicFile({ connection, owner, file: old });
    const out = writeOut(v.out ? fromUserDir(v.out) : agentFile, file, true);
    console.log(`Re-signed. New nonce value ${file.nonceValue}`);
    console.log(`Panic file: ${out}`);
    console.log("Copy it to the server again with `rem agent add`.");
    return;
  }

  const agent = pubkey(need(v.agent, "agent"), "agent");
  const feePayer = pubkey(need(v["fee-payer"], "fee-payer"), "fee-payer");
  const mints = need(v.mint, "mint").map((m) => pubkey(m, "mint"));
  const allowance = need(v.allowance, "allowance");
  const outPath = fromUserDir(need(v.out, "out"));
  if (existsSync(outPath) && !v.force) {
    throw new Error(`${outPath} already exists. Use --force to overwrite it.`);
  }

  const { file, allowances } = await setupAgent({
    connection,
    owner,
    agent,
    mints,
    allowance,
    feePayer,
    log: (m) => console.log(m),
  });
  const out = writeOut(outPath, file, true);

  console.log("\nSetup complete");
  console.log(`  owner          ${file.owner}`);
  console.log(`  agent          ${file.agent}`);
  console.log(`  fee payer      ${file.feePayer}`);
  console.log(`  nonce account  ${file.nonceAccount}`);
  for (const a of allowances) console.log(`  token account  ${a.tokenAccount}  allowance ${a.baseUnits} base units`);
  console.log(`  panic tx       ${file.instructions.join(", ")}`);
  console.log(`  panic file     ${out}`);
  console.log("\nThe panic file holds the owner's signature on exactly those instructions and no key.");
  console.log("Copy it to the server and run `rem agent add --config rem.yaml --panic <file>`.");
}
