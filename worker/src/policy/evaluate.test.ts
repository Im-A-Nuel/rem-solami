import { describe, expect, it } from "vitest";
import { evaluate } from "./evaluate.js";
import { emptyState, type PolicyConfig, type PolicyEvent, type PolicyState } from "./types.js";

const MERCHANT = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
const STRANGER = "7Np1BuYJFzFJGfkwXA2dJrm1L9d3nvMhMEZWCgV5jQcx";
const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const COMPUTE = "ComputeBudget111111111111111111111111111111";
const OTHER_PROGRAM = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";

const sec = (s: number) => BigInt(Math.round(s * 1000)) * 1_000_000n;

let counter = 0;
function ev(at: number, over: Partial<PolicyEvent> = {}): PolicyEvent {
  return {
    signature: `sig-${counter++}`,
    slot: 1,
    seenAtNs: sec(at),
    kind: "transfer",
    programIds: [TOKEN],
    destination: MERCHANT,
    amount: null,
    ...over,
  };
}

/** Feeds events in order and returns each verdict, threading the state like the watcher does. */
function run(config: PolicyConfig, events: PolicyEvent[], start: PolicyState = emptyState) {
  let state = start;
  return events.map((e) => {
    const r = evaluate(config, state, e);
    state = r.state;
    return r.verdict;
  });
}

describe("allow_destinations", () => {
  const config: PolicyConfig = { allowDestinations: [MERCHANT] };

  it("passes a transfer to an allowed address", () => {
    expect(run(config, [ev(0)])[0]).toEqual({ ok: true });
  });

  it("flags a transfer to any other address", () => {
    const v = run(config, [ev(0, { destination: STRANGER })])[0];
    expect(v).toMatchObject({ ok: false, rule: "allow_destinations" });
    expect(v?.ok === false && v.reason).toContain(STRANGER);
  });

  it("ignores events that are not transfers to someone", () => {
    expect(
      run(config, [ev(0, { kind: "swap", destination: null }), ev(1, { kind: "other", destination: null })]),
    ).toEqual([{ ok: true }, { ok: true }]);
  });

  it("treats an empty list as nothing allowed, not as off", () => {
    expect(run({ allowDestinations: [] }, [ev(0)])[0]).toMatchObject({ ok: false, rule: "allow_destinations" });
  });

  it("is off when the rule is omitted", () => {
    expect(run({}, [ev(0, { destination: STRANGER })])[0]).toEqual({ ok: true });
  });
});

describe("allow_programs", () => {
  const config: PolicyConfig = { allowPrograms: [TOKEN, COMPUTE] };

  it("passes when every program is allowed", () => {
    expect(run(config, [ev(0, { programIds: [COMPUTE, TOKEN] })])[0]).toEqual({ ok: true });
  });

  it("flags a transaction that invokes any other program", () => {
    const v = run(config, [ev(0, { programIds: [TOKEN, OTHER_PROGRAM] })])[0];
    expect(v).toMatchObject({ ok: false, rule: "allow_programs" });
    expect(v?.ok === false && v.reason).toContain(OTHER_PROGRAM);
  });

  it("treats an empty list as nothing allowed", () => {
    expect(run({ allowPrograms: [] }, [ev(0)])[0]).toMatchObject({ ok: false, rule: "allow_programs" });
  });
});

describe("max_tx_per_10s", () => {
  const config: PolicyConfig = { maxTxPer10s: 3 };

  it("passes up to the limit and flags the transaction past it", () => {
    const v = run(config, [ev(0), ev(1), ev(2), ev(3)]);
    expect(v.slice(0, 3)).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(v[3]).toMatchObject({ ok: false, rule: "max_tx_per_10s" });
  });

  it("lets the window roll: a transaction exactly 10 s later no longer counts the first", () => {
    const v = run(config, [ev(0), ev(1), ev(2), ev(10)]);
    expect(v[3]).toEqual({ ok: true });
  });

  it("still flags one that is just inside the window", () => {
    const v = run(config, [ev(0), ev(1), ev(2), ev(9.999)]);
    expect(v[3]).toMatchObject({ ok: false, rule: "max_tx_per_10s" });
  });

  it("zero means no transactions are allowed", () => {
    expect(run({ maxTxPer10s: 0 }, [ev(0)])[0]).toMatchObject({ ok: false, rule: "max_tx_per_10s" });
  });
});

describe("max_out_per_minute", () => {
  const config: PolicyConfig = { maxOutPerMinute: 2_000_000n };

  it("passes at exactly the limit and flags one base unit over", () => {
    expect(run(config, [ev(0, { amount: 2_000_000n })])[0]).toEqual({ ok: true });
    expect(run(config, [ev(0, { amount: 2_000_001n })])[0]).toMatchObject({
      ok: false,
      rule: "max_out_per_minute",
    });
  });

  it("adds outflows across transactions in the window", () => {
    const v = run(config, [ev(0, { amount: 1_200_000n }), ev(20, { amount: 800_000n }), ev(40, { amount: 1n })]);
    expect(v[1]).toEqual({ ok: true });
    expect(v[2]).toMatchObject({ ok: false, rule: "max_out_per_minute" });
  });

  it("drops an outflow once it is a full 60 s old", () => {
    const v = run(config, [ev(0, { amount: 2_000_000n }), ev(60, { amount: 2_000_000n })]);
    expect(v[1]).toEqual({ ok: true });
  });

  it("keeps an outflow that is still inside the window", () => {
    const v = run(config, [ev(0, { amount: 2_000_000n }), ev(59.999, { amount: 1n })]);
    expect(v[1]).toMatchObject({ ok: false, rule: "max_out_per_minute" });
  });

  it("counts swap outflows and ignores events with no amount", () => {
    const v = run(config, [
      ev(0, { kind: "swap", destination: null, amount: 1_500_000n }),
      ev(1, { amount: null }),
      ev(2, { kind: "swap", destination: null, amount: 600_000n }),
    ]);
    expect(v[1]).toEqual({ ok: true });
    expect(v[2]).toMatchObject({ ok: false, rule: "max_out_per_minute" });
  });

  it("is exact above 2^53", () => {
    const limit = 2n ** 60n;
    expect(run({ maxOutPerMinute: limit }, [ev(0, { amount: limit })])[0]).toEqual({ ok: true });
    expect(run({ maxOutPerMinute: limit }, [ev(0, { amount: limit + 1n })])[0]).toMatchObject({ ok: false });
  });
});

describe("verdicts and state", () => {
  it("names the first rule in a fixed order and lists every rule that broke", () => {
    const config: PolicyConfig = {
      allowDestinations: [MERCHANT],
      allowPrograms: [TOKEN],
      maxTxPer10s: 0,
      maxOutPerMinute: 1n,
    };
    const v = run(config, [ev(0, { destination: STRANGER, programIds: [OTHER_PROGRAM], amount: 5n })])[0];
    expect(v).toMatchObject({
      ok: false,
      rule: "allow_destinations",
      violated: ["allow_destinations", "allow_programs", "max_tx_per_10s", "max_out_per_minute"],
    });
  });

  it("still counts a violating transaction toward the windows", () => {
    const config: PolicyConfig = { allowDestinations: [MERCHANT], maxTxPer10s: 2 };
    const v = run(config, [ev(0, { destination: STRANGER }), ev(1), ev(2)]);
    expect(v[2]).toMatchObject({ ok: false, rule: "max_tx_per_10s" });
  });

  it("does not mutate the state it is given", () => {
    const show = (s: PolicyState) =>
      JSON.stringify(s, (_k, x: unknown) => (typeof x === "bigint" ? x.toString() : x));
    const first = evaluate({ maxTxPer10s: 5 }, emptyState, ev(0, { amount: 10n }));
    const snapshot = show(first.state);
    evaluate({ maxTxPer10s: 5 }, first.state, ev(1, { amount: 10n }));
    expect(show(first.state)).toBe(snapshot);
    expect(emptyState.txTimesNs).toHaveLength(0);
  });

  it("gives the same answer for the same inputs", () => {
    const e = ev(0, { destination: STRANGER });
    const a = evaluate({ allowDestinations: [MERCHANT] }, emptyState, e);
    const b = evaluate({ allowDestinations: [MERCHANT] }, emptyState, e);
    expect(a).toEqual(b);
  });

  it("stays well inside the 5 ms budget per event under load", () => {
    const config: PolicyConfig = {
      allowDestinations: [MERCHANT],
      allowPrograms: [TOKEN],
      maxTxPer10s: 1_000_000,
      maxOutPerMinute: 10n ** 18n,
    };
    let state = emptyState;
    const n = 5000;
    const start = performance.now();
    for (let i = 0; i < n; i++) {
      state = evaluate(config, state, ev(i * 0.002, { amount: 1n })).state; // 500 events per second
    }
    const perEvent = (performance.now() - start) / n;
    expect(perEvent).toBeLessThan(5);
  });
});
