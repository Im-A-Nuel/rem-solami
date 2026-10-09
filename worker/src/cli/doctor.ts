import { parseArgs } from "node:util";
import { loadConfig, withSolamiDefaults, type AgentConfig, type RemConfig } from "../config/index.js";
import { runDoctor, type AgentsInput } from "../doctor/run.js";
import { formatResult } from "../doctor/format.js";
import { scrub, secretsOf } from "../doctor/scrub.js";
import { connectPg } from "../store/index.js";
import { fromUserDir } from "./paths.js";

export const DOCTOR_USAGE = `Usage:
  rem doctor [--config rem.yaml]

Checks that the keys and services in .env and rem.yaml actually work: Solami RPC, gRPC and Beam, the fallback
RPC, the database, the fee payer wallet, Telegram and each agent's panic file. It sends no transaction and
writes nothing. Everything printed has secrets masked, so the output is safe to paste.`;

export async function runDoctorCommand(argv: string[]): Promise<void> {
  const { values: v } = parseArgs({
    args: argv,
    options: { config: { type: "string" } },
    strict: true,
    allowPositionals: false,
  });
  const file = fromUserDir(v.config ?? "rem.yaml");

  let config: RemConfig;
  try {
    config = loadConfig(file, process.env, "skip");
  } catch (e) {
    // The message names a variable or a field, never a value.
    console.error(`Cannot start the checks: ${(e as Error).message}`);
    console.error("Fix .env (repo root) or rem.yaml and run `rem doctor` again.");
    process.exitCode = 1;
    return;
  }

  const secrets = secretsOf(config);
  let agents: AgentsInput;
  try {
    agents = { agents: loadConfig(file, process.env, "required").agents as AgentConfig[] };
  } catch (e) {
    agents = { error: scrub((e as Error).message, secrets) };
  }

  const db = connectPg(config.databaseUrl);
  let counts = { pass: 0, warn: 0, fail: 0, skip: 0 };
  try {
    console.log("rem doctor: nothing is sent or written.");
    const { derived } = withSolamiDefaults(process.env);
    if (derived.length > 0) console.log(`Built from SOLAMI_API_KEY because they were empty: ${derived.join(", ")}`);
    console.log("");
    const sections = await runDoctor({ config, agents, db });
    for (const s of sections) {
      console.log(s.title);
      for (const r of s.results) {
        counts[r.status] += 1;
        console.log(formatResult(r, secrets));
      }
      console.log("");
    }
  } finally {
    await db.close();
  }
  console.log(`${counts.pass} passed, ${counts.warn} warnings, ${counts.fail} failed, ${counts.skip} skipped`);
  if (counts.fail > 0) process.exitCode = 1;
}
