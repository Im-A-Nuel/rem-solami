/** Panic file written by `rem setup` and imported by `rem agent add`. See docs/SCHEMA.md. */
export interface PanicFile {
  version: 1;
  agent: string;
  owner: string;
  feePayer: string;
  nonceAccount: string;
  nonceValue: string;
  tokenAccounts: { address: string; mint: string }[];
  /** Instruction names in order. Informational; validation re-derives them from the transaction. */
  instructions: string[];
  /** Base64 legacy transaction. Owner signature present, fee payer signature empty. */
  transaction: string;
}

export type PanicInstructionName =
  | "AdvanceNonceAccount"
  | "SetComputeUnitLimit"
  | "SetComputeUnitPrice"
  | "Revoke";

export interface DecodedInstruction {
  program: string;
  instruction: PanicInstructionName;
  account?: string;
}

/** Why a panic transaction was refused. Stable codes so callers and tests do not match on prose. */
export type RejectionCode =
  | "undecodable"
  | "not_legacy"
  | "bad_file"
  | "blockhash_mismatch"
  | "fee_payer_mismatch"
  | "signer_set"
  | "owner_signature_invalid"
  | "fee_payer_signature_present"
  | "no_advance_nonce_first"
  | "advance_nonce_accounts"
  | "forbidden_program"
  | "forbidden_instruction"
  | "malformed_instruction"
  | "duplicate_compute_budget"
  | "revoke_account"
  | "revoke_coverage"
  | "unexpected_account"
  | "fee_too_high"
  | "instruction_list_mismatch";

export type ValidationResult =
  | { ok: true; decoded: DecodedInstruction[]; maxFeeLamports: number }
  | { ok: false; code: RejectionCode; message: string };
