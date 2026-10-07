import { describe, expect, it } from "vitest";
import { parsePolicy } from "./config.js";

const A = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
const P = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

describe("parsePolicy", () => {
  it("parses a full policy block like the one in rem.example.yaml", () => {
    expect(
      parsePolicy({
        allow_destinations: [A],
        max_out_per_minute: 2000000,
        max_tx_per_10s: 3,
        allow_programs: [P],
      }),
    ).toEqual({ allowDestinations: [A], maxOutPerMinute: 2_000_000n, maxTxPer10s: 3, allowPrograms: [P] });
  });

  it("leaves omitted rules off", () => {
    expect(parsePolicy({})).toEqual({});
  });

  it("keeps an empty list as an empty list so it fails closed", () => {
    expect(parsePolicy({ allow_destinations: [] })).toEqual({ allowDestinations: [] });
  });

  it("rejects an unknown rule instead of silently ignoring it", () => {
    expect(() => parsePolicy({ max_tx_per_10: 3 })).toThrow(/unknown rule "max_tx_per_10"/);
    expect(() => parsePolicy({ allow_destination: [A] })).toThrow(/unknown rule/);
  });

  it("rejects addresses that are not addresses", () => {
    expect(() => parsePolicy({ allow_destinations: ["<KNOWN_MERCHANT_OR_POOL>"] })).toThrow(
      /not a valid address/,
    );
    expect(() => parsePolicy({ allow_programs: [123] })).toThrow(/not a valid address/);
    expect(() => parsePolicy({ allow_destinations: A })).toThrow(/list of addresses/);
  });

  it("rejects bad numbers", () => {
    expect(() => parsePolicy({ max_tx_per_10s: -1 })).toThrow(/whole number/);
    expect(() => parsePolicy({ max_tx_per_10s: 1.5 })).toThrow(/whole number/);
    expect(() => parsePolicy({ max_tx_per_10s: "3" })).toThrow(/whole number/);
    expect(() => parsePolicy({ max_out_per_minute: -5 })).toThrow(/base units/);
    expect(() => parsePolicy({ max_out_per_minute: 1.2 })).toThrow(/base units/);
    expect(() => parsePolicy({ max_out_per_minute: "12abc" })).toThrow(/base units/);
  });

  it("accepts a quoted amount above 2^53 and keeps it exact", () => {
    expect(parsePolicy({ max_out_per_minute: "18446744073709551615" }).maxOutPerMinute).toBe(
      18446744073709551615n,
    );
  });

  it("refuses an unquoted number above 2^53 because it is no longer exact", () => {
    expect(() => parsePolicy({ max_out_per_minute: 1e20 })).toThrow(/base units/);
  });

  it("rejects a policy that is not a mapping", () => {
    expect(() => parsePolicy(null)).toThrow(/mapping/);
    expect(() => parsePolicy([])).toThrow(/mapping/);
    expect(() => parsePolicy("allow_destinations")).toThrow(/mapping/);
  });
});
