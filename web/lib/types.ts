// Mirrors docs/SCHEMA.md. Amounts are base-unit strings (uint64 does not fit a JS number).

export type AgentStatus = "armed" | "stale" | "tripped" | "disarmed";
export type AgentMode = "alert" | "brake";
export type LandedVia = "beam" | "rpc";
export type IncidentStatus = "alerted" | "sent" | "contained" | "failed";

export interface Agent {
  name: string;
  agentWallet: string;
  mode: AgentMode;
  status: AgentStatus;
  nonceHealthy: boolean;
  allowanceRemaining: string;
}

export interface PanicInstruction {
  program: string;
  instruction: string;
  account?: string;
}

export interface PanicDecoded {
  decoded: PanicInstruction[];
}

export interface Incident {
  id: number;
  agent: string;
  rule: string;
  triggerSignature: string;
  revokeSignature: string | null;
  leakedTxCount: number;
  detectionMs: number;
  sendMs: number | null;
  landingSlots: number | null;
  landingMs: number | null;
  landedVia: LandedVia | null;
  status: IncidentStatus;
}

export interface IncidentPage {
  items: Incident[];
  nextCursor: string | null;
}

export interface RouteStats {
  n: number;
  p50Ms: number;
  p95Ms: number;
  p50Slots: number;
}

export interface LandingStats {
  beam: RouteStats;
  rpc: RouteStats;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
