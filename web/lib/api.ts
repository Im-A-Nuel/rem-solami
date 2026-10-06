import {
  sampleAgents,
  sampleIncidents,
  sampleLanding,
  samplePanic,
} from "./fixtures";
import type {
  Agent,
  ApiErrorBody,
  Incident,
  IncidentPage,
  LandingStats,
  PanicDecoded,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_REM_API?.replace(/\/$/, "");

/** True when no Rem API is configured and the console runs on labelled sample data. */
export const usingSamples = !BASE;

export class RemApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "RemApiError";
  }
}

// ?mock=empty | error | slow lets the empty, error and loading states be exercised by hand.
function mockMode(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("mock");
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sample<T>(empty: T, data: T): Promise<T> {
  const mode = mockMode();
  await wait(mode === "slow" ? 2500 : 280);
  if (mode === "error") throw new RemApiError("UNAVAILABLE", "Sample API is set to fail (?mock=error).");
  return mode === "empty" ? empty : data;
}

async function request<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { headers: { accept: "application/json" } });
  } catch {
    throw new RemApiError("UNREACHABLE", `Cannot reach the Rem API at ${BASE}.`);
  }
  if (!res.ok) {
    let body: Partial<ApiErrorBody> = {};
    try {
      body = await res.json();
    } catch {
      /* non-JSON error body */
    }
    throw new RemApiError(body.error?.code ?? `HTTP_${res.status}`, body.error?.message ?? res.statusText);
  }
  return (await res.json()) as T;
}

export async function getAgents(): Promise<Agent[]> {
  if (!BASE) return sample([], sampleAgents);
  return (await request<{ items: Agent[] }>("/agents")).items;
}

export async function getPanic(name: string): Promise<PanicDecoded> {
  if (!BASE) {
    const decoded = samplePanic[name];
    if (!decoded) throw new RemApiError("NOT_FOUND", "agent not found");
    return sample({ decoded: [] }, { decoded });
  }
  return request<PanicDecoded>(`/agents/${encodeURIComponent(name)}/panic`);
}

export async function getIncidents(agent?: string): Promise<IncidentPage> {
  if (!BASE) {
    const items: Incident[] = agent ? sampleIncidents.filter((i) => i.agent === agent) : sampleIncidents;
    return sample({ items: [], nextCursor: null }, { items, nextCursor: null });
  }
  const q = agent ? `?agent=${encodeURIComponent(agent)}` : "";
  return request<IncidentPage>(`/incidents${q}`);
}

export async function getLanding(): Promise<LandingStats> {
  const none = { n: 0, p50Ms: 0, p95Ms: 0, p50Slots: 0 };
  if (!BASE) return sample({ beam: none, rpc: none }, sampleLanding);
  return request<LandingStats>("/landing");
}
