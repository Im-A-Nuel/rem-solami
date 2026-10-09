import { readFileSync } from "node:fs";
import { Connection } from "@solana/web3.js";
import { checkAgent } from "../agent/add.js";
import { rpcChain } from "../chain/index.js";
import type { AgentConfig, RemConfig } from "../config/index.js";
import type { PanicFile } from "../nonce/index.js";
import type { Db } from "../store/index.js";
import {
  checkBeam,
  checkDatabase,
  checkFeePayer,
  checkGrpc,
  checkRpc,
  checkTelegram,
  compareClusters,
  type CheckResult,
} from "./checks.js";

export interface Section {
  title: string;
  results: CheckResult[];
}

export type AgentsInput = { agents: AgentConfig[] } | { error: string };

/** Runs every check in a fixed order. Nothing here sends a transaction or writes to the database. */
export async function runDoctor(p: { config: RemConfig; agents: AgentsInput; db: Db }): Promise<Section[]> {
  const { config } = p;
  const solamiRpc = await checkRpc("Solami RPC", config.solami.rpcUrl);
  const fallbackRpc = await checkRpc("Fallback RPC", config.fallbackRpcUrl);
  const grpc = await checkGrpc(config.solami.grpcEndpoint, config.solami.grpcToken);
  const beam = await checkBeam(config.solami.beamUrl);

  const solami: Section = { title: "Solami", results: [solamiRpc.result, grpc, beam] };

  const other: CheckResult[] = [fallbackRpc.result];
  const clusters = compareClusters(solamiRpc.cluster, fallbackRpc.cluster);
  if (clusters) other.push(clusters);
  other.push(await checkDatabase(p.db));
  other.push(await checkFeePayer(config.feePayerKeypair, new Connection(config.solami.rpcUrl, "confirmed")));
  other.push(await checkTelegram(config.telegram));

  const agents: CheckResult[] = [];
  if ("error" in p.agents) {
    agents.push({ name: "Agents in rem.yaml", status: "fail", detail: p.agents.error });
  } else {
    const chain = rpcChain(new Connection(config.solami.rpcUrl, "confirmed"));
    for (const a of p.agents.agents) {
      let file: PanicFile;
      try {
        file = JSON.parse(readFileSync(a.panicTxFile, "utf8")) as PanicFile;
      } catch {
        agents.push({ name: a.name, status: "fail", detail: `cannot read the panic file ${a.panicTxFile}. Run \`rem setup\` first.` });
        continue;
      }
      try {
        const c = await checkAgent({ chain, config: a, file });
        const status = c.status === "armed" ? "pass" : "warn";
        agents.push({ name: a.name, status, detail: [c.status, ...c.warnings].join(". ") });
      } catch (e) {
        agents.push({ name: a.name, status: "fail", detail: (e as Error).message });
      }
    }
  }

  return [solami, { title: "Services", results: other }, { title: "Agents", results: agents }];
}
