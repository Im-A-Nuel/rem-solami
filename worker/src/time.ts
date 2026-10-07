/**
 * Wall-clock time as Unix nanoseconds (bigint), for the timestamps Rem stores: gRPC receive, decision and
 * send. Resolution is about a microsecond. Use `process.hrtime.bigint()` for measuring durations, because
 * the wall clock can step.
 */
export function nowNs(): bigint {
  return BigInt(Math.round((performance.timeOrigin + performance.now()) * 1_000)) * 1_000n;
}
