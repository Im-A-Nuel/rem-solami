import { describe, expect, it } from "vitest";
import { clusterOf, parseAmount } from "./amount.js";

describe("parseAmount", () => {
  it("converts whole and fractional amounts exactly", () => {
    expect(parseAmount("5", 6)).toBe(5_000_000n);
    expect(parseAmount("0.5", 6)).toBe(500_000n);
    expect(parseAmount("0.000001", 6)).toBe(1n);
    expect(parseAmount("1.25", 2)).toBe(125n);
    expect(parseAmount("7", 0)).toBe(7n);
  });

  it("is exact where floats are not", () => {
    expect(parseAmount("0.1", 18)).toBe(100_000_000_000_000_000n);
    expect(parseAmount("9007199254740993", 0)).toBe(9007199254740993n); // above 2^53
  });

  it("rejects more precision than the token has", () => {
    expect(() => parseAmount("0.0000001", 6)).toThrow(/decimal places/);
    expect(() => parseAmount("1.5", 0)).toThrow(/decimal places/);
  });

  it("rejects zero, negatives and anything that is not a plain amount", () => {
    for (const bad of ["0", "0.000", "-1", "+1", "1e6", "1,5", "", " ", "abc", ".5", "5.", "0x10"]) {
      expect(() => parseAmount(bad, 6), bad).toThrow();
    }
  });
});

describe("clusterOf", () => {
  it("recognises the public clusters by genesis hash", () => {
    expect(clusterOf("5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d")).toBe("mainnet-beta");
    expect(clusterOf("EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG")).toBe("devnet");
    expect(clusterOf("4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY")).toBe("testnet");
  });

  it("calls anything else unknown", () => {
    expect(clusterOf("somethingelse")).toBe("unknown");
  });
});
