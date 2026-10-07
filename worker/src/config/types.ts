import type { PolicyConfig } from "../policy/index.js";

export type AgentMode = "alert" | "brake";

export interface AgentConfig {
  name: string;
  agentWallet: string;
  ownerWallet: string;
  tokenAccounts: string[];
  nonceAccount: string;
  /** Absolute path of the panic file written by `rem setup`. */
  panicTxFile: string;
  mode: AgentMode;
  policy: PolicyConfig;
}

export interface RemConfig {
  solami: {
    grpcEndpoint: string;
    /** Secret. Never log this: use redactConfig. */
    grpcToken: string;
    rpcUrl: string;
    beamUrl: string;
    mirageWs?: string;
  };
  fallbackRpcUrl: string;
  /** Absolute path of Rem's fee payer keypair file. The file is read at startup, never copied into config. */
  feePayerKeypair: string;
  /** Absolute path of the SQLite file. */
  dbPath: string;
  apiAddr: string;
  telegram?: { botToken: string; chatId: string };
  nonceCheckIntervalMs: number;
  agents: AgentConfig[];
}
