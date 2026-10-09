import { parseArgs } from "node:util";
import { createKeypairFile } from "../keys.js";
import { fromUserDir } from "./paths.js";

export const KEYGEN_USAGE = `Usage:
  rem keygen --out <file>

Creates a new keypair file (for example the fee payer, or a demo agent). It prints only the public key.
It refuses to overwrite an existing file.`;

export function runKeygen(argv: string[]): void {
  const { values: v } = parseArgs({ args: argv, options: { out: { type: "string" } }, strict: true, allowPositionals: false });
  if (!v.out) throw new Error(`Missing --out.\n\n${KEYGEN_USAGE}`);
  const path = fromUserDir(v.out);
  const pub = createKeypairFile(path);
  console.log(`Created ${path}`);
  console.log(`Public key: ${pub.toBase58()}`);
  console.log("The file is a secret. Never commit or share it (keys/ is git-ignored). The public key is safe to share.");
}
