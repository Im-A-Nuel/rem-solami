import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createKeypairFile, loadKeypair } from "./keys.js";

const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "rem-keys-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop() as string, { recursive: true, force: true });
});

describe("createKeypairFile", () => {
  it("writes a keypair the loader can read and returns only the public key", () => {
    const path = join(tmp(), "nested", "fee-payer.json");
    const pub = createKeypairFile(path);
    expect(loadKeypair(path).publicKey.equals(pub)).toBe(true);
    const bytes = JSON.parse(readFileSync(path, "utf8")) as number[];
    expect(bytes).toHaveLength(64);
    expect(Object.keys(pub)).not.toContain("secretKey");
  });

  it("refuses to overwrite an existing key and leaves it untouched", () => {
    const path = join(tmp(), "k.json");
    createKeypairFile(path);
    const before = readFileSync(path, "utf8");
    expect(() => createKeypairFile(path)).toThrow(/already exists.*Refusing to overwrite/);
    expect(readFileSync(path, "utf8")).toBe(before);
  });

  it("creates different keys each time", () => {
    const d = tmp();
    expect(createKeypairFile(join(d, "a.json")).equals(createKeypairFile(join(d, "b.json")))).toBe(false);
  });

  it("leaves nothing behind when the path cannot be written", () => {
    const d = tmp();
    createKeypairFile(join(d, "a.json"));
    // A path whose parent is a file, not a directory.
    expect(() => createKeypairFile(join(d, "a.json", "b.json"))).toThrow();
    expect(existsSync(join(d, "a.json", "b.json"))).toBe(false);
  });
});
