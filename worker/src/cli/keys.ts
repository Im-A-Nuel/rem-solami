import { readFileSync } from "node:fs";
import { Keypair } from "@solana/web3.js";

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
