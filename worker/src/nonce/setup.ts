import {
  createApproveInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";
import {
  Keypair,
  NONCE_ACCOUNT_LENGTH,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  type Connection,
} from "@solana/web3.js";
import { parseAmount } from "./amount.js";
import { buildPanicFile } from "./build.js";
import type { PanicFile } from "./types.js";
import { validatePanicTx } from "./validate.js";

// On-chain steps of `rem setup`. These run on the OWNER's machine: they use the owner keypair and the
// result is a file with no secret in it. The server never sees this key.

type Log = (message: string) => void;

export interface SetupParams {
  connection: Connection;
  owner: Keypair;
  agent: PublicKey;
  mints: PublicKey[];
  /** Human amount per token account, such as "5". Converted with each mint's own decimals. */
  allowance: string;
  feePayer: PublicKey;
  log?: Log;
}

export interface SetupResult {
  file: PanicFile;
  allowances: { tokenAccount: string; mint: string; baseUnits: bigint }[];
}

async function ownerTokenAccount(connection: Connection, owner: PublicKey, mint: PublicKey) {
  const address = getAssociatedTokenAddressSync(mint, owner);
  let account;
  try {
    account = await getAccount(connection, address, "confirmed");
  } catch (cause) {
    throw new Error(
      `The owner has no token account ${address.toBase58()} for mint ${mint.toBase58()}. Create and fund it first.`,
      { cause },
    );
  }
  if (!account.owner.equals(owner)) throw new Error(`Token account ${address.toBase58()} is not owned by the owner.`);
  return { address, account };
}

/**
 * 1. checks everything it can without spending or granting anything,
 * 2. creates the nonce account,
 * 3. builds and validates the panic transaction (so a bug cannot leave an unprotected agent),
 * 4. only then approves the agent as delegate and checks the approval on-chain.
 */
export async function setupAgent(p: SetupParams): Promise<SetupResult> {
  const log: Log = p.log ?? (() => {});
  if (p.owner.publicKey.equals(p.agent)) throw new Error("The agent must be a different key from the owner.");
  if (p.owner.publicKey.equals(p.feePayer)) throw new Error("The fee payer must be a different key from the owner.");
  if (p.mints.length === 0) throw new Error("At least one mint is required.");
  const unique = new Set(p.mints.map((m) => m.toBase58()));
  if (unique.size !== p.mints.length) throw new Error("A mint was given more than once.");

  // Check phase: nothing is changed yet.
  const targets: { mint: PublicKey; address: PublicKey; baseUnits: bigint }[] = [];
  for (const mint of p.mints) {
    const { decimals } = await getMint(p.connection, mint, "confirmed"); // also rejects non-SPL-Token mints
    const baseUnits = parseAmount(p.allowance, decimals);
    const { address, account } = await ownerTokenAccount(p.connection, p.owner.publicKey, mint);
    if (account.delegate && !account.delegate.equals(p.agent)) {
      log(`note: ${address.toBase58()} currently delegates to ${account.delegate.toBase58()}; approving replaces it`);
    }
    targets.push({ mint, address, baseUnits });
  }

  // Nonce account with the owner as authority.
  const nonceKey = Keypair.generate();
  const rent = await p.connection.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH);
  await sendAndConfirmTransaction(
    p.connection,
    SystemProgram.createNonceAccount({
      fromPubkey: p.owner.publicKey,
      noncePubkey: nonceKey.publicKey,
      authorizedPubkey: p.owner.publicKey,
      lamports: rent,
    }),
    [p.owner, nonceKey],
  );
  const nonce = await p.connection.getNonce(nonceKey.publicKey, "confirmed");
  if (!nonce) throw new Error("The nonce account was created but could not be read back.");
  log(`nonce account ${nonceKey.publicKey.toBase58()}`);

  // Build and validate the panic transaction BEFORE granting any spending power.
  const file = buildPanicFile({
    owner: p.owner,
    agent: p.agent,
    feePayer: p.feePayer,
    nonceAccount: nonceKey.publicKey,
    nonceValue: nonce.nonce,
    tokenAccounts: targets.map((t) => ({ address: t.address, mint: t.mint })),
  });

  // Grant the delegate rights last.
  const approve = new Transaction().add(
    ...targets.map((t) => createApproveInstruction(t.address, p.agent, p.owner.publicKey, t.baseUnits)),
  );
  await sendAndConfirmTransaction(p.connection, approve, [p.owner]);
  for (const t of targets) {
    const after = await getAccount(p.connection, t.address, "confirmed");
    if (!after.delegate?.equals(p.agent) || after.delegatedAmount !== t.baseUnits) {
      throw new Error(`Approval on ${t.address.toBase58()} did not match what was requested.`);
    }
  }

  return {
    file,
    allowances: targets.map((t) => ({ tokenAccount: t.address.toBase58(), mint: t.mint.toBase58(), baseUnits: t.baseUnits })),
  };
}

/**
 * Re-signs the panic transaction after the nonce value changed. Only the nonce value moves: the same
 * owner, agent, fee payer, nonce account and token accounts go into the new file, and nothing is
 * approved or created. The old file is validated first so a foreign file is never re-signed.
 */
export async function refreshPanicFile(p: { connection: Connection; owner: Keypair; file: PanicFile }): Promise<PanicFile> {
  const old = validatePanicTx(p.file);
  if (!old.ok) throw new Error(`The existing panic file is not valid (${old.code}): ${old.message}`);
  if (p.owner.publicKey.toBase58() !== p.file.owner) {
    throw new Error("This owner key is not the owner recorded in the panic file.");
  }
  const nonceAccount = new PublicKey(p.file.nonceAccount);
  const nonce = await p.connection.getNonce(nonceAccount, "confirmed");
  if (!nonce) throw new Error("The nonce account does not exist on this cluster.");
  if (!nonce.authorizedPubkey.equals(p.owner.publicKey)) {
    throw new Error("The owner is not the authority of this nonce account.");
  }
  return buildPanicFile({
    owner: p.owner,
    agent: new PublicKey(p.file.agent),
    feePayer: new PublicKey(p.file.feePayer),
    nonceAccount,
    nonceValue: nonce.nonce,
    tokenAccounts: p.file.tokenAccounts.map((t) => ({ address: new PublicKey(t.address), mint: new PublicKey(t.mint) })),
  });
}
