import type { PanicInstruction } from "./types";

// USDC has 6 decimals. Per-mint decimals will come from the API once it exposes them.
const USDC_DECIMALS = 6n;

/** Formats a base-unit integer string without ever converting to a float. */
export function formatUnits(base: string, decimals: bigint = USDC_DECIMALS): string {
  let n: bigint;
  try {
    n = BigInt(base);
  } catch {
    return base;
  }
  const scale = 10n ** decimals;
  const whole = n / scale;
  const frac = (n % scale).toString().padStart(Number(decimals), "0").replace(/0+$/, "");
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac ? `${wholeStr}.${frac}` : wholeStr;
}

export function shorten(value: string, head = 6, tail = 6): string {
  return value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function formatMs(ms: number | null): string {
  if (ms === null) return "none";
  return ms < 10 ? `${ms.toFixed(1)} ms` : `${Math.round(ms)} ms`;
}

const ALLOWED_AFTER_ADVANCE = new Set([
  "SetComputeUnitLimit",
  "SetComputeUnitPrice",
  "RequestHeapFrame",
  "Revoke",
]);

export interface PanicCheck {
  ok: boolean;
  reason: string;
}

/**
 * Display-side check of the decoded panic transaction. It mirrors the rule in
 * docs/ARCHITECTURE.md (advance nonce first, then only compute budget and revoke) so an
 * operator can see it at a glance. internal/nonce.Validate on the server stays authoritative.
 */
export function checkPanic(ix: PanicInstruction[]): PanicCheck {
  if (ix.length === 0) return { ok: false, reason: "No instructions decoded." };
  if (ix[0].instruction !== "AdvanceNonceAccount") {
    return { ok: false, reason: "Instruction 1 is not AdvanceNonceAccount." };
  }
  if (!ix.some((i) => i.instruction === "Revoke")) {
    return { ok: false, reason: "No Revoke instruction present." };
  }
  const extra = ix.slice(1).find((i) => !ALLOWED_AFTER_ADVANCE.has(i.instruction));
  if (extra) return { ok: false, reason: `Unexpected instruction: ${extra.instruction}.` };
  return { ok: true, reason: "Advance nonce first, then only compute budget and revoke." };
}
