import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Keypair, type PublicKey } from "@solana/web3.js";

/**
 * Reads a Solana CLI style keypair file (a JSON array of 64 bytes). Error messages name the path but
 * never include any of the file's contents.
 */
export function loadKeypair(path: string): Keypair {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (cause) {
    throw new Error(`Cannot read the keypair file ${path}`, { cause });
  }
  let bytes: unknown;
  try {
    bytes = JSON.parse(raw);
  } catch {
    throw new Error(`${path} is not a JSON keypair file (expected an array of 64 numbers).`);
  }
  if (!Array.isArray(bytes) || bytes.length !== 64 || !bytes.every((b) => Number.isInteger(b) && b >= 0 && b <= 255)) {
    throw new Error(`${path} is not a valid keypair file (expected an array of 64 bytes).`);
  }
  try {
    return Keypair.fromSecretKey(Uint8Array.from(bytes as number[]), { skipValidation: false });
  } catch {
    throw new Error(`${path} does not hold a consistent keypair.`);
  }
}

/**
 * Creates a new keypair file in the same format the Solana CLI uses. Refuses to overwrite: the flag "wx"
 * fails if the file exists, so a key that holds funds can never be replaced by accident. Returns only the
 * public key, so nothing secret is ever printed.
 */
export function createKeypairFile(path: string): PublicKey {
  const kp = Keypair.generate();
  mkdirSync(dirname(path), { recursive: true });
  try {
    writeFileSync(path, JSON.stringify(Array.from(kp.secretKey)), { flag: "wx", mode: 0o600 });
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`${path} already exists. Refusing to overwrite a key. Pick another path, or delete it yourself if you are sure.`, { cause });
    }
    throw new Error(`Cannot write the keypair file ${path}`, { cause });
  }
  return kp.publicKey;
}
