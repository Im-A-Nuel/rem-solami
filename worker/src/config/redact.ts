import type { RemConfig } from "./types.js";

/** Keeps host and path, drops credentials and the query string (where API keys usually sit). */
export function redactUrl(value: string): string {
  try {
    const u = new URL(value);
    return `${u.protocol}//${u.host}${u.pathname === "/" ? "" : u.pathname}${u.search ? "?…" : ""}`;
  } catch {
    return "<unparseable url>";
  }
}

/** The only form of the config that may be logged or printed. */
export function redactConfig(c: RemConfig) {
  return {
    solami: {
      grpcEndpoint: c.solami.grpcEndpoint,
      grpcToken: "***",
      rpcUrl: redactUrl(c.solami.rpcUrl),
      beamUrl: redactUrl(c.solami.beamUrl),
      mirageWs: c.solami.mirageWs ? redactUrl(c.solami.mirageWs) : undefined,
    },
    fallbackRpcUrl: redactUrl(c.fallbackRpcUrl),
    feePayerKeypair: c.feePayerKeypair,
    dbPath: c.dbPath,
    apiAddr: c.apiAddr,
    telegram: c.telegram ? { botToken: "***", chatId: c.telegram.chatId } : undefined,
    nonceCheckIntervalMs: c.nonceCheckIntervalMs,
    agents: c.agents.map((a) => ({
      name: a.name,
      mode: a.mode,
      agentWallet: a.agentWallet,
      tokenAccounts: a.tokenAccounts.length,
      rules: Object.keys(a.policy),
    })),
  };
}
