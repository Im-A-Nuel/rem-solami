import type { Agent, AgentStatus, Incident, LandingStats } from "./types";

// Plain-language layer over the API types: what each state means and what the operator should do.
// Commands come from docs/SCHEMA.md (CLI section).

export const statusOrder: Record<AgentStatus, number> = { stale: 0, tripped: 1, armed: 2, disarmed: 3 };

export const needsAttention = (a: Agent) => a.status === "stale" || a.status === "tripped";

export interface NextStep {
  headline: string;
  /** One line for cards and lists. */
  short: string;
  detail: string;
  command?: string;
}

export function nextStep(a: Agent): NextStep {
  switch (a.status) {
    case "stale":
      return {
        headline: "Needs re-signing",
        short: "The nonce changed. Re-sign to protect it again.",
        detail:
          "The nonce changed, so the saved panic transaction would fail if it were sent. Re-sign it on the owner's machine to protect this agent again.",
        command: "rem setup --refresh --owner <keypair> --agent-file <file>",
      };
    case "tripped":
      return {
        headline: "Stopped by Rem",
        short: "The agent can no longer spend. Approve and sign again to resume.",
        detail:
          "The panic transaction landed and cleared the agent's delegate, so it cannot spend. To resume, approve a new allowance and sign a fresh panic transaction on the owner's machine.",
        command:
          "rem setup --owner <keypair> --agent <pubkey> --mint <mint> --allowance <amount> --fee-payer <pubkey> --out <file>",
      };
    case "armed":
      return a.mode === "brake"
        ? {
            headline: "Protected",
            short: "Rem sends the revoke if a rule breaks.",
            detail: "Rem sends the panic transaction the moment a rule breaks.",
          }
        : {
            headline: "Watching, alert only",
            short: "Rem alerts you if a rule breaks. Nothing is revoked.",
            detail:
              "Rem notifies you when a rule breaks but does not send the panic transaction. Set the agent to brake mode in rem.yaml to enforce.",
          };
    case "disarmed":
      return { headline: "Not enforcing", short: "Rem is not acting on this agent.", detail: "Rem is not acting on this agent." };
  }
}

export function nonceText(a: Agent): { text: string; warn: boolean } {
  if (a.status === "tripped") return { text: "Advanced by the panic transaction", warn: false };
  if (a.nonceHealthy) return { text: "Matches the signed value", warn: false };
  return { text: "Changed since signing", warn: true };
}

export function overview(agents: Agent[]): { attention: number; text: string } {
  const attention = agents.filter(needsAttention).length;
  const n = agents.length;
  const noun = n === 1 ? "agent" : "agents";
  if (attention > 0) {
    return { attention, text: `${attention} of ${n} ${noun} ${attention === 1 ? "needs" : "need"} your attention.` };
  }
  const armed = agents.filter((a) => a.status === "armed").length;
  if (armed === n) return { attention, text: `All ${n} ${noun} ${n === 1 ? "is" : "are"} armed.` };
  return { attention, text: `${armed} of ${n} ${noun} armed, the rest are not enforcing.` };
}

/** What each instruction in the panic transaction does, in words. */
export function instructionRole(name: string): string {
  switch (name) {
    case "AdvanceNonceAccount":
      return "Makes the transaction single-use";
    case "SetComputeUnitLimit":
      return "Sets the compute limit";
    case "SetComputeUnitPrice":
      return "Sets the priority fee";
    case "Revoke":
      return "Removes the agent's spending rights";
    default:
      return "Not part of the allowed set";
  }
}

export type Tone = "ok" | "warn" | "bad";

export function incidentSummary(i: Incident): { tone: Tone; text: string } {
  switch (i.status) {
    case "contained": {
      const through =
        i.leakedTxCount === 1
          ? "1 transaction got through before the revoke landed"
          : `${i.leakedTxCount} transactions got through before the revoke landed`;
      return { tone: "ok", text: `Stopped. ${through}.` };
    }
    case "alerted":
      return { tone: "warn", text: "A rule broke. Alert only, so nothing was revoked." };
    case "sent":
      return { tone: "warn", text: "Revoke sent. Waiting for it to land." };
    case "failed":
      return { tone: "bad", text: "The revoke did not land. The agent may still be able to spend." };
  }
}

export interface LandingVerdict {
  text: string;
  caveat: string | null;
}

export function landingVerdict(s: LandingStats): LandingVerdict | null {
  const { beam, rpc } = s;
  if (beam.n === 0 && rpc.n === 0) return null;
  if (beam.n === 0 || rpc.n === 0) {
    return { text: `Only ${beam.n === 0 ? "RPC" : "Beam"} has samples so far, so there is nothing to compare yet.`, caveat: null };
  }
  const diff = Math.abs(beam.p50Ms - rpc.p50Ms);
  const n = Math.min(beam.n, rpc.n);
  const caveat = n < 20 ? `Only ${n} samples per route. The target is 20 or more before these numbers are quoted.` : null;
  if (diff === 0) return { text: `Beam and RPC land at the same median, ${beam.p50Ms} ms.`, caveat };
  const beamFaster = beam.p50Ms < rpc.p50Ms;
  const [fast, slow, f, sl] = beamFaster ? ["Beam", "RPC", beam, rpc] : ["RPC", "Beam", rpc, beam];
  return {
    text: `${fast} lands the panic transaction ${diff} ms faster than ${slow} at the median (${f.p50Ms} against ${sl.p50Ms} ms).`,
    caveat,
  };
}
