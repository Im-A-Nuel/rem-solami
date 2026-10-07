import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fromUserDir } from "./paths.js";

describe("fromUserDir", () => {
  it("resolves from INIT_CWD, where the user typed the command", () => {
    expect(fromUserDir("./panic/x.json", { INIT_CWD: resolve("/repo") })).toBe(resolve("/repo", "panic/x.json"));
  });

  it("falls back to the current directory", () => {
    expect(fromUserDir("rem.yaml", {})).toBe(resolve(process.cwd(), "rem.yaml"));
  });

  it("keeps an absolute path as it is", () => {
    const abs = resolve("/keys/owner.json");
    expect(fromUserDir(abs, { INIT_CWD: resolve("/repo") })).toBe(abs);
  });
});
