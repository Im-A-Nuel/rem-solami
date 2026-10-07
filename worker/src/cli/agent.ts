import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { Connection } from "@solana/web3.js";
import { addAgent } from "../agent/add.js";
import { rpcChain } from "../chain/index.js";
import { loadConfig, type AgentConfig } from "../config/index.js";
import type { PanicFile } from "../nonce/index.js";
import { connectPg } from "../store/index.js";
import { fromUserDir } from "./paths.js";
import { nowNs } from "../time.js";

export const AGENT_USAGE = `Usage:
  rem agent add --config rem.yaml [--panic <file>] [--name <agent>]

Validates a panic file against rem.yaml and the chain, then stores the agent in the database.
Without --panic, every agent in rem.yaml is imported from its own panic_tx_file.`;

function readPanic(path: string): PanicFile {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as PanicFile;
  } catch (cause) {
    throw new Error(`Cannot read the panic file ${path}`, { cause });
  }
}

export async function runAgent(argv: string[]): Promise<void> {
  const [sub, ...rest] = argv;
  if (sub !== "add") throw new Error(`Unknown subcommand "${sub ?? ""}".\n\n${AGENT_USAGE}`);

  const { values: v } = parseArgs({
    args: rest,
    options: { config: { type: "string" }, panic: { type: "string" }, name: { type: "string" } },
    strict: true,
    allowPositionals: false,
  });
  if (!v.config) throw new Error(`Missing --config.\n\n${AGENT_USAGE}`);

  const config = loadConfig(fromUserDir(v.config));
  let targets: { agent: AgentConfig; file: PanicFile }[];
  if (v.panic) {
    const file = readPanic(fromUserDir(v.panic));
    const agent = config.agents.find((a) => a.agentWallet === file.agent);
    if (!agent) throw new Error(`No agent in rem.yaml has the wallet ${file.agent} that this panic file is for.`);
    targets = [{ agent, file }];
  } else {
    targets = config.agents
      .filter((a) => !v.name || a.name === v.name)
      .map((agent) => ({ agent, file: readPanic(agent.panicTxFile) }));
    if (targets.length === 0) throw new Error(`No agent named "${v.name}" in rem.yaml.`);
  }

  const db = connectPg(config.databaseUrl);
  const chain = rpcChain(new Connection(config.solami.rpcUrl, "confirmed"));
  try {
    for (const { agent, file } of targets) {
      const r = await addAgent({ db, chain, config: agent, file, nowNs: nowNs() });
      console.log(`${agent.name}: ${r.status} (id ${r.id}, mode ${agent.mode})`);
      for (const w of r.warnings) console.log(`  warning: ${w}`);
    }
  } finally {
    await db.close();
  }
}
