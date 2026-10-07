/**
 * Turns a human amount such as "5" or "0.5" into base units using string arithmetic only.
 * Money never goes through a float: 0.1 + 0.2 style errors must be impossible here.
 */
export function parseAmount(text: string, decimals: number): bigint {
  const t = text.trim();
  if (!/^\d+(\.\d+)?$/.test(t)) throw new Error(`"${text}" is not an amount. Use digits with an optional decimal point, for example 5 or 0.5.`);
  const [whole = "0", frac = ""] = t.split(".");
  if (frac.length > decimals) {
    throw new Error(`"${text}" has more than ${decimals} decimal places, which this token cannot represent.`);
  }
  const base = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0") || "0");
  if (base <= 0n) throw new Error("The allowance must be greater than zero.");
  return base;
}

export type Cluster = "mainnet-beta" | "devnet" | "testnet" | "unknown";

const GENESIS: Record<string, Cluster> = {
  "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d": "mainnet-beta",
  EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG: "devnet",
  "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY": "testnet",
};

export const clusterOf = (genesisHash: string): Cluster => GENESIS[genesisHash] ?? "unknown";
