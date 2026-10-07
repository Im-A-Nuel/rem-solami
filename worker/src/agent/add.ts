import type { Chain } from "../chain/index.js";
import type { AgentConfig } from "../config/index.js";
import { validatePanicTx, type PanicFile } from "../nonce/index.js";
import { migrate, upsertAgent, type AgentStatus, type Db } from "../store/index.js";

export interface AddAgentResult {
  id: number;
  status: AgentStatus;
  warnings: string[];
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);

/**
 * Imports one agent. Nothing reaches the database unless every check passes: the panic file must be
 * valid and match rem.yaml, and the chain must agree about the nonce and the token accounts. The checks
 * stop a file written for someone else, or for a different setup, from being stored under this agent.
 */
export async function addAgent(p: {
  db: Db;
  chain: Chain;
  config: AgentConfig;
  file: PanicFile;
  nowNs: bigint;
}): Promise<AddAgentResult> {
  const { config, file, chain } = p;

  const v = validatePanicTx(file);
  if (!v.ok) throw new Error(`The panic file is not valid (${v.code}): ${v.message}`);

  // The file must be the one rem.yaml describes.
  const mismatches: string[] = [];
  if (file.agent !== config.agentWallet) mismatches.push("agent_wallet");
  if (file.owner !== config.ownerWallet) mismatches.push("owner_wallet");
  if (file.nonceAccount !== config.nonceAccount) mismatches.push("nonce_account");
  if (!sameSet(file.tokenAccounts.map((t) => t.address), config.tokenAccounts)) mismatches.push("token_accounts");
  if (mismatches.length > 0) {
    throw new Error(`The panic file does not match agent "${config.name}" in rem.yaml: ${mismatches.join(", ")} differ.`);
  }

  // One mint per agent: the allowance is stored as a single number, and base units of different mints
  // cannot be added together.
  const mints = new Set(file.tokenAccounts.map((t) => t.mint));
  if (mints.size !== 1) {
    throw new Error("This build tracks one mint per agent. Set up a separate agent for each mint.");
  }

  const warnings: string[] = [];

  // Chain: the nonce.
  const nonce = await chain.getNonce(file.nonceAccount);
  if (!nonce) throw new Error(`Nonce account ${file.nonceAccount} does not exist on this cluster.`);
  if (nonce.authority !== file.owner) throw new Error("The owner is not the authority of this nonce account.");
  const nonceHealthy = nonce.value === file.nonceValue;
  if (!nonceHealthy) {
    warnings.push("The nonce has changed since this file was signed, so it would fail if sent. Re-sign with `rem setup --refresh`.");
  }

  // Chain: the token accounts.
  let allowance = 0n;
  let delegatedToAgent = 0;
  for (const t of file.tokenAccounts) {
    const acct = await chain.getTokenAccount(t.address);
    if (!acct) throw new Error(`Token account ${t.address} does not exist on this cluster.`);
    if (acct.owner !== file.owner) throw new Error(`Token account ${t.address} is not owned by the owner.`);
    if (acct.mint !== t.mint) throw new Error(`Token account ${t.address} holds a different mint than the file says.`);
    if (acct.delegate === file.agent) {
      delegatedToAgent += 1;
      allowance += acct.delegatedAmount;
    } else {
      warnings.push(`The agent is not the delegate of ${t.address}, so there is nothing for Rem to revoke there.`);
    }
  }

  // Status: stale beats armed because a stale file cannot do its job. No delegation at all means disarmed.
  const status: AgentStatus = !nonceHealthy ? "stale" : delegatedToAgent === 0 ? "disarmed" : "armed";

  await migrate(p.db);
  const id = await upsertAgent(
    p.db,
    {
      name: config.name,
      agentWallet: config.agentWallet,
      ownerWallet: config.ownerWallet,
      nonceAccount: file.nonceAccount,
      nonceValue: file.nonceValue,
      panicTx: file.transaction,
      panicDecoded: v.decoded,
      mode: config.mode,
      status,
      nonceHealthy,
      allowance,
      allowanceRemaining: allowance,
      tokenAccounts: file.tokenAccounts,
    },
    p.nowNs,
  );
  return { id, status, warnings };
}
