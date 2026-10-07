import type { PolicyConfig } from "./types.js";

const KEYS = new Set(["allow_destinations", "allow_programs", "max_tx_per_10s", "max_out_per_minute"]);
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function addressList(name: string, v: unknown): string[] {
  if (!Array.isArray(v)) throw new Error(`policy.${name} must be a list of addresses`);
  return v.map((item) => {
    if (typeof item !== "string" || !BASE58.test(item)) {
      throw new Error(`policy.${name} contains something that is not a valid address: ${String(item)}`);
    }
    return item;
  });
}

/**
 * Turns the `policy:` block of rem.yaml into a PolicyConfig. Strict on purpose: an unknown key, such as
 * a misspelt rule name, is an error and not a silently disabled rule.
 */
export function parsePolicy(raw: unknown): PolicyConfig {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("policy must be a mapping of rule names to values");
  }
  const obj = raw as Record<string, unknown>;
  for (const k of Object.keys(obj)) {
    if (!KEYS.has(k)) throw new Error(`policy has an unknown rule "${k}". Known rules: ${[...KEYS].join(", ")}`);
  }

  const config: PolicyConfig = {};
  if (obj.allow_destinations !== undefined) config.allowDestinations = addressList("allow_destinations", obj.allow_destinations);
  if (obj.allow_programs !== undefined) config.allowPrograms = addressList("allow_programs", obj.allow_programs);

  if (obj.max_tx_per_10s !== undefined) {
    const n = obj.max_tx_per_10s;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0) {
      throw new Error("policy.max_tx_per_10s must be a whole number, zero or more");
    }
    config.maxTxPer10s = n;
  }

  if (obj.max_out_per_minute !== undefined) {
    const v = obj.max_out_per_minute;
    // YAML numbers are fine up to 2^53. Larger amounts must be quoted so they stay exact.
    if (typeof v === "number") {
      if (!Number.isSafeInteger(v) || v < 0) throw new Error("policy.max_out_per_minute must be a whole number of base units");
      config.maxOutPerMinute = BigInt(v);
    } else if (typeof v === "string" && /^\d+$/.test(v)) {
      config.maxOutPerMinute = BigInt(v);
    } else {
      throw new Error("policy.max_out_per_minute must be a whole number of base units (quote it if above 2^53)");
    }
  }
  return config;
}
