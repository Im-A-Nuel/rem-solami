export type EventKind = "transfer" | "swap" | "other";

/** One parsed agent transaction as the watcher hands it to policy. */
export interface PolicyEvent {
  signature: string;
  slot: number;
  /** Wall-clock at gRPC receive, Unix nanoseconds. Policy never reads the clock itself. */
  seenAtNs: bigint;
  kind: EventKind;
  programIds: readonly string[];
  /** Receiving address of a delegated transfer, if there is one. */
  destination: string | null;
  /** Tokens leaving the watched account in this transaction, in base units. Null when nothing leaves. */
  amount: bigint | null;
}

/**
 * Per-agent rules from rem.yaml. An omitted rule is off. An empty list is not "off": an empty
 * allow_destinations or allow_programs allows nothing, so a mistake fails closed.
 */
export interface PolicyConfig {
  allowDestinations?: readonly string[];
  allowPrograms?: readonly string[];
  maxTxPer10s?: number;
  maxOutPerMinute?: bigint;
}

export type Rule = "allow_destinations" | "allow_programs" | "max_tx_per_10s" | "max_out_per_minute";

export type Verdict =
  | { ok: true }
  | {
      ok: false;
      /** First rule that broke, in the fixed order below. */
      rule: Rule;
      reason: string;
      /** Every rule that broke on this event. */
      violated: Rule[];
    };

/** Rolling windows. Immutable: evaluate returns the next state instead of mutating this one. */
export interface PolicyState {
  readonly outflows: readonly { atNs: bigint; amount: bigint }[];
  readonly txTimesNs: readonly bigint[];
}

export const emptyState: PolicyState = { outflows: [], txTimesNs: [] };
