import { ed25519 } from "@noble/curves/ed25519.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  ComputeBudgetProgram,
  PublicKey,
  SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
  SystemProgram,
  VersionedTransaction,
} from "@solana/web3.js";
import type { DecodedInstruction, PanicFile, RejectionCode, ValidationResult } from "./types.js";

// Security critical. The panic transaction is signed in advance and stays valid until it is used, so the
// only defence against a malicious or tampered file is refusing everything that is not exactly the
// expected shape. Every check fails closed: the first problem found rejects the whole transaction.

export interface ValidateOptions {
  /** Ceiling on what one panic send may cost the fee payer, in lamports. Rem's fee payer holds little SOL. */
  maxFeeLamports?: number;
}

export const DEFAULT_MAX_FEE_LAMPORTS = 5_000_000; // 0.005 SOL

const SYSTEM_NONCE_ADVANCE = 4; // SystemInstruction::AdvanceNonceAccount
const CB_SET_UNIT_LIMIT = 2;
const CB_SET_UNIT_PRICE = 3;
const SPL_REVOKE = 5;
const LAMPORTS_PER_SIGNATURE = 5000;

const reject = (code: RejectionCode, message: string): ValidationResult => ({ ok: false, code, message });

const isZero = (sig: Uint8Array) => sig.every((b) => b === 0);

function parseKey(value: string): PublicKey | null {
  try {
    return new PublicKey(value);
  } catch {
    return null;
  }
}

/**
 * Re-decodes `file.transaction` and confirms it is exactly: AdvanceNonceAccount first, optional
 * ComputeBudget limit and price, then one SPL Token Revoke per listed token account. Also checks the
 * file's own fields against the transaction and verifies the owner signature.
 */
export function validatePanicTx(file: PanicFile, opts: ValidateOptions = {}): ValidationResult {
  const maxFee = opts.maxFeeLamports ?? DEFAULT_MAX_FEE_LAMPORTS;

  // File fields -------------------------------------------------------------------------------------
  const owner = parseKey(file.owner);
  const agent = parseKey(file.agent);
  const feePayer = parseKey(file.feePayer);
  const nonceAccount = parseKey(file.nonceAccount);
  if (!owner || !agent || !feePayer || !nonceAccount) {
    return reject("bad_file", "owner, agent, feePayer and nonceAccount must be valid public keys.");
  }
  if (owner.equals(agent)) return reject("bad_file", "The agent must not be the owner.");
  if (owner.equals(feePayer)) return reject("bad_file", "The fee payer must not be the owner.");
  if (file.tokenAccounts.length === 0) return reject("bad_file", "At least one token account is required.");
  const listed = new Map<string, PublicKey>();
  for (const t of file.tokenAccounts) {
    const k = parseKey(t.address);
    if (!k) return reject("bad_file", `Token account ${t.address} is not a valid public key.`);
    if (listed.has(k.toBase58())) return reject("bad_file", `Token account ${t.address} is listed twice.`);
    listed.set(k.toBase58(), k);
  }

  // Decode ------------------------------------------------------------------------------------------
  let tx: VersionedTransaction;
  try {
    tx = VersionedTransaction.deserialize(Buffer.from(file.transaction, "base64"));
  } catch (cause) {
    return reject("undecodable", `Transaction could not be decoded: ${(cause as Error).message}`);
  }
  // Legacy only: a v0 message can pull accounts from lookup tables that this check cannot see.
  if (tx.message.version !== "legacy") return reject("not_legacy", "Only legacy transactions are accepted.");

  const msg = tx.message;
  const keys = msg.staticAccountKeys;
  const key = (i: number) => keys[i];

  if (msg.recentBlockhash !== file.nonceValue) {
    return reject("blockhash_mismatch", "The transaction's blockhash is not the nonce value in the file.");
  }

  // Signers: exactly the fee payer then the owner -----------------------------------------------------
  const { numRequiredSignatures } = msg.header;
  const k0 = key(0);
  const k1 = key(1);
  if (!k0 || !k0.equals(feePayer)) return reject("fee_payer_mismatch", "The first account is not the fee payer.");
  if (numRequiredSignatures !== 2 || !k1 || !k1.equals(owner)) {
    return reject("signer_set", "The only signers must be the fee payer and the owner.");
  }
  const [feeSig, ownerSig] = tx.signatures;
  if (!feeSig || !ownerSig) return reject("signer_set", "Signature slots are missing.");
  if (!isZero(feeSig)) {
    return reject("fee_payer_signature_present", "The fee payer signature must be empty in a stored file.");
  }
  if (isZero(ownerSig) || !ed25519.verify(ownerSig, msg.serialize(), owner.toBytes())) {
    return reject("owner_signature_invalid", "The owner signature is missing or does not match the message.");
  }

  // Instructions --------------------------------------------------------------------------------------
  const ixs = msg.compiledInstructions;
  const first = ixs[0];
  if (!first) return reject("no_advance_nonce_first", "The transaction has no instructions.");

  const decoded: DecodedInstruction[] = [];

  // 0: AdvanceNonceAccount, always first so the nonce is consumed and the tx cannot be replayed.
  const firstProgram = key(first.programIdIndex);
  if (
    !firstProgram?.equals(SystemProgram.programId) ||
    first.data.length !== 4 ||
    Buffer.from(first.data).readUInt32LE(0) !== SYSTEM_NONCE_ADVANCE
  ) {
    return reject("no_advance_nonce_first", "Instruction 1 must be AdvanceNonceAccount.");
  }
  const adv = first.accountKeyIndexes.map(key);
  if (
    adv.length !== 3 ||
    !adv[0]?.equals(nonceAccount) ||
    !adv[1]?.equals(SYSVAR_RECENT_BLOCKHASHES_PUBKEY) ||
    !adv[2]?.equals(owner)
  ) {
    return reject(
      "advance_nonce_accounts",
      "AdvanceNonceAccount must act on the listed nonce account with the owner as authority.",
    );
  }
  decoded.push({
    program: SystemProgram.programId.toBase58(),
    instruction: "AdvanceNonceAccount",
    account: nonceAccount.toBase58(),
  });

  // 1..n: compute budget (at most one limit, one price) and Revoke
  let sawLimit = false;
  let sawPrice = false;
  let limit = 200_000; // runtime default when no limit instruction is present
  let priceMicro = 0n;
  const revoked = new Set<string>();

  for (const ix of ixs.slice(1)) {
    const program = key(ix.programIdIndex);
    if (!program) return reject("malformed_instruction", "An instruction points at a missing program account.");
    const data = Buffer.from(ix.data);

    if (program.equals(ComputeBudgetProgram.programId)) {
      if (ix.accountKeyIndexes.length !== 0) {
        return reject("malformed_instruction", "Compute budget instructions take no accounts.");
      }
      if (data[0] === CB_SET_UNIT_LIMIT && data.length === 5) {
        if (sawLimit) return reject("duplicate_compute_budget", "SetComputeUnitLimit appears twice.");
        sawLimit = true;
        limit = data.readUInt32LE(1);
        decoded.push({ program: program.toBase58(), instruction: "SetComputeUnitLimit" });
      } else if (data[0] === CB_SET_UNIT_PRICE && data.length === 9) {
        if (sawPrice) return reject("duplicate_compute_budget", "SetComputeUnitPrice appears twice.");
        sawPrice = true;
        priceMicro = data.readBigUInt64LE(1);
        decoded.push({ program: program.toBase58(), instruction: "SetComputeUnitPrice" });
      } else {
        return reject("forbidden_instruction", "Only SetComputeUnitLimit and SetComputeUnitPrice are allowed.");
      }
      continue;
    }

    if (program.equals(TOKEN_PROGRAM_ID)) {
      // Revoke is discriminator 5 with no data. Approve, Transfer, SetAuthority, CloseAccount and the
      // rest are different discriminators and are refused here.
      if (data.length !== 1 || data[0] !== SPL_REVOKE) {
        return reject("forbidden_instruction", "The only SPL Token instruction allowed is Revoke.");
      }
      // Exactly [source, owner]. A third account would make the owner a multisig signer set.
      if (ix.accountKeyIndexes.length !== 2) {
        return reject("revoke_account", "Revoke must have exactly a source account and the owner.");
      }
      const source = key(ix.accountKeyIndexes[0] ?? -1);
      const authority = key(ix.accountKeyIndexes[1] ?? -1);
      if (!source || !listed.has(source.toBase58())) {
        return reject("revoke_account", "Revoke targets a token account that is not listed in the file.");
      }
      if (!authority?.equals(owner)) return reject("revoke_account", "Revoke must be authorised by the owner.");
      if (revoked.has(source.toBase58())) {
        return reject("revoke_coverage", `Token account ${source.toBase58()} is revoked more than once.`);
      }
      revoked.add(source.toBase58());
      decoded.push({ program: program.toBase58(), instruction: "Revoke", account: source.toBase58() });
      continue;
    }

    return reject("forbidden_program", `Program ${program.toBase58()} is not allowed in a panic transaction.`);
  }

  if (revoked.size !== listed.size) {
    return reject("revoke_coverage", "Every listed token account must be revoked.");
  }

  // Every account the message names must be accounted for above ----------------------------------------
  const allowedKeys = new Set<string>([
    feePayer.toBase58(),
    owner.toBase58(),
    nonceAccount.toBase58(),
    SYSVAR_RECENT_BLOCKHASHES_PUBKEY.toBase58(),
    SystemProgram.programId.toBase58(),
    ComputeBudgetProgram.programId.toBase58(),
    TOKEN_PROGRAM_ID.toBase58(),
    ...listed.keys(),
  ]);
  for (const k of keys) {
    if (!allowedKeys.has(k.toBase58())) {
      return reject("unexpected_account", `The message references an unexpected account ${k.toBase58()}.`);
    }
  }

  // Fee ceiling: the fee payer pays this on every send ---------------------------------------------------
  const priorityLamports = (BigInt(limit) * priceMicro) / 1_000_000n;
  const fee = BigInt(LAMPORTS_PER_SIGNATURE * numRequiredSignatures) + priorityLamports;
  if (fee > BigInt(maxFee)) {
    return reject("fee_too_high", `The transaction could cost ${fee} lamports, above the ${maxFee} ceiling.`);
  }

  // File's own description must match what is really in the transaction -----------------------------------
  const names = decoded.map((d) => d.instruction);
  if (file.instructions.length !== names.length || file.instructions.some((n, i) => n !== names[i])) {
    return reject("instruction_list_mismatch", "The file's instruction list does not match the transaction.");
  }

  return { ok: true, decoded, maxFeeLamports: Number(fee) };
}
