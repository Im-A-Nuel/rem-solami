import type { PolicyConfig, PolicyEvent, PolicyState, Rule, Verdict } from "./types.js";

// Pure and synchronous: (config, state, event) -> (verdict, next state). No clock, no I/O, no network.
// It runs on the gRPC receive path, so it must stay cheap and must never wait on anything.

const NS = 1_000_000_000n;
const WINDOW_10S = 10n * NS;
const WINDOW_60S = 60n * NS;

export interface Evaluation {
  verdict: Verdict;
  state: PolicyState;
}

export function evaluate(config: PolicyConfig, state: PolicyState, event: PolicyEvent): Evaluation {
  // Roll the windows forward first. The current event always counts toward its own windows.
  const txTimesNs = [...state.txTimesNs.filter((t) => t > event.seenAtNs - WINDOW_10S), event.seenAtNs];
  const outflows = state.outflows.filter((o) => o.atNs > event.seenAtNs - WINDOW_60S);
  if (event.amount !== null && event.amount > 0n) outflows.push({ atNs: event.seenAtNs, amount: event.amount });
  const next: PolicyState = { outflows, txTimesNs };

  const reasons = new Map<Rule, string>();

  if (config.allowDestinations && event.kind === "transfer" && event.destination !== null) {
    if (!config.allowDestinations.includes(event.destination)) {
      reasons.set("allow_destinations", `destination ${event.destination} is not in the allow list`);
    }
  }

  if (config.allowPrograms) {
    const stray = event.programIds.find((p) => !config.allowPrograms?.includes(p));
    if (stray !== undefined) reasons.set("allow_programs", `program ${stray} is not in the allow list`);
  }

  if (config.maxTxPer10s !== undefined && txTimesNs.length > config.maxTxPer10s) {
    reasons.set("max_tx_per_10s", `${txTimesNs.length} transactions in 10 s, limit ${config.maxTxPer10s}`);
  }

  if (config.maxOutPerMinute !== undefined) {
    const out = outflows.reduce((sum, o) => sum + o.amount, 0n);
    if (out > config.maxOutPerMinute) {
      reasons.set("max_out_per_minute", `${out} base units out in 60 s, limit ${config.maxOutPerMinute}`);
    }
  }

  // Fixed order so the same input always names the same rule.
  const order: Rule[] = ["allow_destinations", "allow_programs", "max_tx_per_10s", "max_out_per_minute"];
  const violated = order.filter((r) => reasons.has(r));
  const first = violated[0];
  if (first === undefined) return { verdict: { ok: true }, state: next };
  return {
    verdict: { ok: false, rule: first, reason: reasons.get(first) ?? "", violated },
    state: next,
  };
}
