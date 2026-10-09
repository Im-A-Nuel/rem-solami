import { describe, expect, it } from "vitest";
import { formatResult } from "./format.js";

const SECRET = "SECRETKEY-abcdef123456";

describe("formatResult", () => {
  it("labels each status and aligns the name", () => {
    expect(formatResult({ name: "Solami RPC", status: "pass", detail: "mainnet-beta" }, [])).toBe(
      "  PASS  Solami RPC           mainnet-beta",
    );
    expect(formatResult({ name: "x", status: "fail", detail: "d" }, [])).toContain("FAIL");
    expect(formatResult({ name: "x", status: "warn", detail: "d" }, [])).toContain("WARN");
    expect(formatResult({ name: "x", status: "skip", detail: "d" }, [])).toContain("SKIP");
  });

  it("masks a secret in the detail", () => {
    const line = formatResult(
      { name: "Beam", status: "fail", detail: `https://rpc.example.dev/sol?api_key=${SECRET} refused` },
      [SECRET],
    );
    expect(line).not.toContain(SECRET);
    expect(line).toContain("***");
  });

  it("masks a secret even in the name", () => {
    expect(formatResult({ name: SECRET, status: "pass", detail: "ok" }, [SECRET])).not.toContain(SECRET);
  });
});
