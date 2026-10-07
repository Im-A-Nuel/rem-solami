import { createRevokeInstruction } from "@solana/spl-token";
import { ComputeBudgetProgram, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import type { PanicFile } from "./types.js";
import { validatePanicTx, type ValidateOptions } from "./validate.js";

export interface BuildPanicParams {
  /** Owner keypair. Used on the owner's machine only, never on the server. */
  owner: Keypair;
  agent: PublicKey;
  feePayer: PublicKey;
  nonceAccount: PublicKey;
  /** Blockhash currently stored in the nonce account. */
  nonceValue: string;
  tokenAccounts: { address: PublicKey; mint: PublicKey }[];
  computeUnitLimit?: number;
  /** Priority price in micro-lamports per compute unit. Fixed at signing time, so it is set generously. */
  computeUnitPriceMicroLamports?: number | bigint;
}

// A revoke is cheap. 30k units at 1M micro-lamports is 30,000 lamports of priority fee.
const DEFAULT_LIMIT = 30_000;
const DEFAULT_PRICE_MICRO = 1_000_000;

/**
 * Builds the panic transaction and signs it with the owner key only. Instruction order is fixed:
 * AdvanceNonceAccount, SetComputeUnitLimit, SetComputeUnitPrice, then one Revoke per token account.
 * The result is validated before it is returned, so a builder bug cannot produce a file the server refuses.
 */
export function buildPanicFile(p: BuildPanicParams, opts?: ValidateOptions): PanicFile {
  const tx = new Transaction();
  tx.feePayer = p.feePayer;
  tx.recentBlockhash = p.nonceValue;
  tx.add(
    SystemProgram.nonceAdvance({ noncePubkey: p.nonceAccount, authorizedPubkey: p.owner.publicKey }),
    ComputeBudgetProgram.setComputeUnitLimit({ units: p.computeUnitLimit ?? DEFAULT_LIMIT }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: p.computeUnitPriceMicroLamports ?? DEFAULT_PRICE_MICRO }),
    ...p.tokenAccounts.map((t) => createRevokeInstruction(t.address, p.owner.publicKey)),
  );
  tx.partialSign(p.owner);

  const file: PanicFile = {
    version: 1,
    agent: p.agent.toBase58(),
    owner: p.owner.publicKey.toBase58(),
    feePayer: p.feePayer.toBase58(),
    nonceAccount: p.nonceAccount.toBase58(),
    nonceValue: p.nonceValue,
    tokenAccounts: p.tokenAccounts.map((t) => ({ address: t.address.toBase58(), mint: t.mint.toBase58() })),
    instructions: [
      "AdvanceNonceAccount",
      "SetComputeUnitLimit",
      "SetComputeUnitPrice",
      ...p.tokenAccounts.map(() => "Revoke"),
    ],
    transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"),
  };

  const result = validatePanicTx(file, opts);
  if (!result.ok) throw new Error(`built panic transaction failed validation (${result.code}): ${result.message}`);
  return file;
}

/**
 * Adds the fee payer's signature to a stored panic file at broadcast time. Refuses to sign anything that
 * does not pass validation, so a tampered file never gets Rem's signature.
 */
export function completePanicTx(file: PanicFile, feePayer: Keypair, opts?: ValidateOptions): Transaction {
  if (feePayer.publicKey.toBase58() !== file.feePayer) {
    throw new Error("the provided fee payer key does not match the fee payer in the panic file");
  }
  const result = validatePanicTx(file, opts);
  if (!result.ok) throw new Error(`refusing to sign panic transaction (${result.code}): ${result.message}`);
  const tx = Transaction.from(Buffer.from(file.transaction, "base64"));
  tx.partialSign(feePayer);
  return tx;
}
