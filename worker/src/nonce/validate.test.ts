import {
  TOKEN_2022_PROGRAM_ID,
  createApproveInstruction,
  createRevokeInstruction,
} from "@solana/spl-token";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  type TransactionInstruction as Ix,
} from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { buildPanicFile, completePanicTx } from "./build.js";
import type { PanicFile, RejectionCode } from "./types.js";
import { validatePanicTx } from "./validate.js";

const key = () => Keypair.generate();
const owner = key();
const agent = key().publicKey;
const feePayer = key();
const nonceAccount = key().publicKey;
const nonceValue = key().publicKey.toBase58(); // any 32-byte base58 string works as a blockhash
const mint = key().publicKey;
const ataA = key().publicKey;
const ataB = key().publicKey;

const limit = () => ComputeBudgetProgram.setComputeUnitLimit({ units: 30_000 });
const price = (microLamports = 1_000_000) => ComputeBudgetProgram.setComputeUnitPrice({ microLamports });
const advance = (nonce = nonceAccount, auth = owner.publicKey) =>
  SystemProgram.nonceAdvance({ noncePubkey: nonce, authorizedPubkey: auth });
const revoke = (a: PublicKey) => createRevokeInstruction(a, owner.publicKey);

function baseFile(tokenAccounts: PublicKey[] = [ataA]): PanicFile {
  return buildPanicFile({
    owner,
    agent,
    feePayer: feePayer.publicKey,
    nonceAccount,
    nonceValue,
    tokenAccounts: tokenAccounts.map((address) => ({ address, mint })),
  });
}

interface Craft {
  ixs: Ix[];
  payer?: PublicKey;
  blockhash?: string;
  signers?: Keypair[];
  names?: string[];
  tokenAccounts?: PublicKey[];
  owner?: PublicKey;
}

/** Builds an arbitrary legacy transaction and wraps it in a file, so attacks can be expressed directly. */
function craft(c: Craft): PanicFile {
  const tx = new Transaction();
  tx.feePayer = c.payer ?? feePayer.publicKey;
  tx.recentBlockhash = c.blockhash ?? nonceValue;
  tx.add(...c.ixs);
  const signers = c.signers ?? [owner];
  if (signers.length > 0) tx.partialSign(...signers);
  const ta = c.tokenAccounts ?? [ataA];
  return {
    version: 1,
    agent: agent.toBase58(),
    owner: (c.owner ?? owner.publicKey).toBase58(),
    feePayer: feePayer.publicKey.toBase58(),
    nonceAccount: nonceAccount.toBase58(),
    nonceValue,
    tokenAccounts: ta.map((a) => ({ address: a.toBase58(), mint: mint.toBase58() })),
    instructions: c.names ?? ["AdvanceNonceAccount", "SetComputeUnitLimit", "SetComputeUnitPrice", "Revoke"],
    transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"),
  };
}

function expectRejected(file: PanicFile, code: RejectionCode) {
  const r = validatePanicTx(file);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.code).toBe(code);
}

describe("validatePanicTx: accepted", () => {
  it("accepts the transaction rem setup builds", () => {
    const r = validatePanicTx(baseFile());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.decoded.map((d) => d.instruction)).toEqual([
        "AdvanceNonceAccount",
        "SetComputeUnitLimit",
        "SetComputeUnitPrice",
        "Revoke",
      ]);
      expect(r.decoded[3]?.account).toBe(ataA.toBase58());
      expect(r.maxFeeLamports).toBe(10_000 + 30_000);
    }
  });

  it("accepts one Revoke per listed token account", () => {
    const r = validatePanicTx(baseFile([ataA, ataB]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.decoded.filter((d) => d.instruction === "Revoke")).toHaveLength(2);
  });

  it("accepts a transaction without compute budget instructions", () => {
    const f = craft({
      ixs: [advance(), revoke(ataA)],
      names: ["AdvanceNonceAccount", "Revoke"],
    });
    expect(validatePanicTx(f).ok).toBe(true);
  });
});

describe("validatePanicTx: the four spec cases", () => {
  it("rejects a transaction without AdvanceNonceAccount", () => {
    const f = craft({
      ixs: [limit(), price(), revoke(ataA)],
      names: ["SetComputeUnitLimit", "SetComputeUnitPrice", "Revoke"],
    });
    expectRejected(f, "no_advance_nonce_first");
  });

  it("rejects an extra transfer", () => {
    const f = craft({
      ixs: [
        advance(),
        limit(),
        price(),
        revoke(ataA),
        SystemProgram.transfer({ fromPubkey: owner.publicKey, toPubkey: key().publicKey, lamports: 1 }),
      ],
      names: ["AdvanceNonceAccount", "SetComputeUnitLimit", "SetComputeUnitPrice", "Revoke", "Transfer"],
    });
    expectRejected(f, "forbidden_program");
  });

  it("rejects AdvanceNonceAccount that is not first", () => {
    const f = craft({
      ixs: [limit(), advance(), price(), revoke(ataA)],
      names: ["SetComputeUnitLimit", "AdvanceNonceAccount", "SetComputeUnitPrice", "Revoke"],
    });
    expectRejected(f, "no_advance_nonce_first");
  });

  it("rejects a transfer placed before the advance", () => {
    const f = craft({
      ixs: [
        SystemProgram.transfer({ fromPubkey: owner.publicKey, toPubkey: key().publicKey, lamports: 1 }),
        advance(),
        revoke(ataA),
      ],
      names: ["Transfer", "AdvanceNonceAccount", "Revoke"],
    });
    expectRejected(f, "no_advance_nonce_first");
  });
});

describe("validatePanicTx: payload attacks", () => {
  it("rejects Approve smuggled in place of Revoke", () => {
    const f = craft({
      ixs: [advance(), limit(), price(), createApproveInstruction(ataA, key().publicKey, owner.publicKey, 1_000_000n)],
    });
    expectRejected(f, "forbidden_instruction");
  });

  it("rejects an unknown program", () => {
    const memo = new TransactionInstruction({
      programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
      keys: [],
      data: Buffer.from("hi"),
    });
    const f = craft({
      ixs: [advance(), limit(), price(), memo, revoke(ataA)],
      names: ["AdvanceNonceAccount", "SetComputeUnitLimit", "SetComputeUnitPrice", "Memo", "Revoke"],
    });
    expectRejected(f, "forbidden_program");
  });

  it("rejects Revoke through the Token-2022 program", () => {
    const f = craft({
      ixs: [advance(), limit(), price(), createRevokeInstruction(ataA, owner.publicKey, [], TOKEN_2022_PROGRAM_ID)],
    });
    expectRejected(f, "forbidden_program");
  });

  it("rejects a Revoke on a token account that is not listed", () => {
    const f = craft({ ixs: [advance(), limit(), price(), revoke(key().publicKey)] });
    expectRejected(f, "revoke_account");
  });

  it("rejects a file that lists a token account the transaction never revokes", () => {
    const f = craft({
      ixs: [advance(), limit(), price(), revoke(ataA)],
      tokenAccounts: [ataA, ataB],
    });
    expectRejected(f, "revoke_coverage");
  });

  it("rejects the same token account revoked twice", () => {
    const f = craft({
      ixs: [advance(), limit(), price(), revoke(ataA), revoke(ataA)],
      names: ["AdvanceNonceAccount", "SetComputeUnitLimit", "SetComputeUnitPrice", "Revoke", "Revoke"],
    });
    expectRejected(f, "revoke_coverage");
  });

  it("rejects AdvanceNonceAccount on a different nonce account", () => {
    const f = craft({ ixs: [advance(key().publicKey), limit(), price(), revoke(ataA)] });
    expectRejected(f, "advance_nonce_accounts");
  });

  it("rejects a repeated compute budget instruction", () => {
    const f = craft({
      ixs: [advance(), limit(), limit(), price(), revoke(ataA)],
      names: ["AdvanceNonceAccount", "SetComputeUnitLimit", "SetComputeUnitLimit", "SetComputeUnitPrice", "Revoke"],
    });
    expectRejected(f, "duplicate_compute_budget");
  });

  it("rejects other compute budget instructions", () => {
    const f = craft({
      ixs: [advance(), ComputeBudgetProgram.requestHeapFrame({ bytes: 65536 }), revoke(ataA)],
      names: ["AdvanceNonceAccount", "RequestHeapFrame", "Revoke"],
    });
    expectRejected(f, "forbidden_instruction");
  });

  it("rejects a priority fee that would drain the fee payer", () => {
    const f = craft({
      ixs: [advance(), limit(), price(10_000_000_000), revoke(ataA)],
    });
    expectRejected(f, "fee_too_high");
  });
});

describe("validatePanicTx: signatures, signers and metadata", () => {
  it("rejects a transaction the owner has not signed", () => {
    const f = craft({ ixs: [advance(), limit(), price(), revoke(ataA)], signers: [] });
    expectRejected(f, "owner_signature_invalid");
  });

  it("rejects a transaction altered after signing", () => {
    const f = baseFile();
    const bytes = Buffer.from(f.transaction, "base64");
    bytes[bytes.length - 1] = 4; // Revoke discriminator 5 -> 4
    expectRejected({ ...f, transaction: bytes.toString("base64") }, "owner_signature_invalid");
  });

  it("rejects a stored file that already carries the fee payer signature", () => {
    const f = craft({
      ixs: [advance(), limit(), price(), revoke(ataA)],
      signers: [owner, feePayer],
    });
    expectRejected(f, "fee_payer_signature_present");
  });

  it("rejects a transaction paid by someone other than the fee payer in the file", () => {
    const f = craft({ ixs: [advance(), limit(), price(), revoke(ataA)], payer: key().publicKey });
    expectRejected(f, "fee_payer_mismatch");
  });

  it("rejects an extra signer", () => {
    const extra = key();
    const f = craft({
      ixs: [advance(nonceAccount, extra.publicKey), limit(), price(), revoke(ataA)],
      signers: [owner, extra],
    });
    expectRejected(f, "signer_set");
  });

  it("rejects a blockhash that is not the nonce value", () => {
    const f = craft({ ixs: [advance(), limit(), price(), revoke(ataA)], blockhash: key().publicKey.toBase58() });
    expectRejected(f, "blockhash_mismatch");
  });

  it("rejects a file whose instruction list does not match the transaction", () => {
    const f = { ...baseFile(), instructions: ["AdvanceNonceAccount", "Revoke"] };
    expectRejected(f, "instruction_list_mismatch");
  });

  it("rejects an owner that is also the agent", () => {
    expectRejected({ ...baseFile(), agent: owner.publicKey.toBase58() }, "bad_file");
  });

  it("rejects an owner that is also the fee payer", () => {
    expectRejected({ ...baseFile(), feePayer: owner.publicKey.toBase58() }, "bad_file");
  });

  it("rejects a versioned transaction", () => {
    const msg = new TransactionMessage({
      payerKey: feePayer.publicKey,
      recentBlockhash: nonceValue,
      instructions: [advance(), revoke(ataA)],
    }).compileToV0Message();
    const vtx = new VersionedTransaction(msg);
    vtx.sign([feePayer]);
    const f = { ...baseFile(), transaction: Buffer.from(vtx.serialize()).toString("base64") };
    expectRejected(f, "not_legacy");
  });

  it("rejects bytes that are not a transaction", () => {
    expectRejected({ ...baseFile(), transaction: "bm90IGEgdHJhbnNhY3Rpb24=" }, "undecodable");
  });

  it("rejects public keys that do not parse", () => {
    expectRejected({ ...baseFile(), nonceAccount: "not-a-key" }, "bad_file");
  });

  it("rejects a file with no token accounts", () => {
    expectRejected({ ...baseFile(), tokenAccounts: [] }, "bad_file");
  });
});

describe("completePanicTx", () => {
  it("adds the fee payer signature and yields a fully signed transaction", () => {
    const tx = completePanicTx(baseFile(), feePayer);
    expect(tx.verifySignatures()).toBe(true);
  });

  it("refuses to sign a tampered file", () => {
    const f = baseFile();
    const bytes = Buffer.from(f.transaction, "base64");
    bytes[bytes.length - 1] = 4;
    expect(() => completePanicTx({ ...f, transaction: bytes.toString("base64") }, feePayer)).toThrow(
      /refusing to sign/,
    );
  });

  it("refuses a fee payer key that is not the one in the file", () => {
    expect(() => completePanicTx(baseFile(), key())).toThrow(/does not match/);
  });
});
