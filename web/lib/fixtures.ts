import type { Agent, Incident, LandingStats, PanicInstruction } from "./types";

// Sample data only. Every wallet and signature starts with "SAMPLE-" so none can be mistaken
// for a real address. Program ids are the real ones. The console shows a visible banner
// whenever these fixtures are the data source.

export const SYSTEM_PROGRAM = "11111111111111111111111111111111";
export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const COMPUTE_BUDGET_PROGRAM = "ComputeBudget111111111111111111111111111111";

export const sampleAgents: Agent[] = [
  {
    name: "demo-agent",
    agentWallet: "SAMPLE-agent-wallet-demo",
    mode: "brake",
    status: "tripped",
    nonceHealthy: false,
    allowanceRemaining: "0",
  },
  {
    name: "trader-sample",
    agentWallet: "SAMPLE-agent-wallet-trader",
    mode: "alert",
    status: "armed",
    nonceHealthy: true,
    allowanceRemaining: "3200000",
  },
  {
    name: "api-payer-sample",
    agentWallet: "SAMPLE-agent-wallet-payer",
    mode: "brake",
    status: "stale",
    nonceHealthy: false,
    allowanceRemaining: "5000000",
  },
];

const panicBase: PanicInstruction[] = [
  { program: SYSTEM_PROGRAM, instruction: "AdvanceNonceAccount", account: "SAMPLE-nonce-account" },
  { program: COMPUTE_BUDGET_PROGRAM, instruction: "SetComputeUnitLimit" },
  { program: COMPUTE_BUDGET_PROGRAM, instruction: "SetComputeUnitPrice" },
  { program: TOKEN_PROGRAM, instruction: "Revoke", account: "SAMPLE-owner-usdc-ata" },
];

export const samplePanic: Record<string, PanicInstruction[]> = {
  "demo-agent": panicBase,
  "trader-sample": panicBase,
  "api-payer-sample": panicBase,
};

export const sampleIncidents: Incident[] = [
  {
    id: 2,
    agent: "trader-sample",
    rule: "max_tx_per_10s",
    triggerSignature: "SAMPLE-sig-trigger-2",
    revokeSignature: null,
    leakedTxCount: 1,
    detectionMs: 2.7,
    sendMs: null,
    landingSlots: null,
    landingMs: null,
    landedVia: null,
    status: "alerted",
  },
  {
    id: 1,
    agent: "demo-agent",
    rule: "allow_destinations",
    triggerSignature: "SAMPLE-sig-trigger-1",
    revokeSignature: "SAMPLE-sig-revoke-1",
    leakedTxCount: 1,
    detectionMs: 3.2,
    sendMs: 1.1,
    landingSlots: 2,
    landingMs: 900,
    landedVia: "beam",
    status: "contained",
  },
];

export const sampleLanding: LandingStats = {
  beam: { n: 24, p50Ms: 410, p95Ms: 880, p50Slots: 1 },
  rpc: { n: 24, p50Ms: 620, p95Ms: 1400, p50Slots: 2 },
};
