import type { CheckResult } from "./checks.js";
import { scrub } from "./scrub.js";

const LABEL = { pass: "PASS", warn: "WARN", fail: "FAIL", skip: "SKIP" } as const;

/**
 * The only way `rem doctor` turns a result into text. The whole line is scrubbed, so a secret cannot
 * reach the terminal through a name or a detail, however the message was produced.
 */
export function formatResult(r: CheckResult, secrets: readonly string[]): string {
  return scrub(`  ${LABEL[r.status]}  ${r.name.padEnd(20)} ${r.detail}`, secrets);
}
