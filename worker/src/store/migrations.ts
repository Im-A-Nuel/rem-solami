// Embedded as strings so nothing depends on where the process runs or which files were copied.
// Types follow docs/SCHEMA.md. Money is NUMERIC(20,0) (a uint64 does not fit BIGINT). Times are BIGINT
// Unix nanoseconds. The pg driver returns both as strings, which the repositories turn into bigint.

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "initial schema",
    sql: `
CREATE TABLE agents (
  id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name                TEXT NOT NULL UNIQUE,
  agent_wallet        TEXT NOT NULL,
  owner_wallet        TEXT NOT NULL,
  nonce_account       TEXT NOT NULL,
  nonce_value         TEXT NOT NULL,
  panic_tx            TEXT NOT NULL,
  panic_decoded       JSONB NOT NULL,
  mode                TEXT NOT NULL CHECK (mode IN ('alert', 'brake')),
  status              TEXT NOT NULL CHECK (status IN ('armed', 'stale', 'tripped', 'disarmed')),
  nonce_healthy       BOOLEAN NOT NULL DEFAULT TRUE,
  allowance           NUMERIC(20, 0) NOT NULL CHECK (allowance >= 0),
  allowance_remaining NUMERIC(20, 0) NOT NULL CHECK (allowance_remaining >= 0),
  created_at          BIGINT NOT NULL,
  updated_at          BIGINT NOT NULL
);

CREATE TABLE agent_token_accounts (
  agent_id      INTEGER NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
  token_account TEXT NOT NULL,
  mint          TEXT NOT NULL,
  PRIMARY KEY (agent_id, token_account)
);

CREATE TABLE events (
  signature   TEXT PRIMARY KEY,
  agent_id    INTEGER NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
  slot        BIGINT NOT NULL,
  seen_at     BIGINT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('transfer', 'swap', 'other')),
  program_ids JSONB NOT NULL,
  destination TEXT,
  amount      NUMERIC(20, 0) CHECK (amount IS NULL OR amount >= 0),
  verdict     TEXT NOT NULL CHECK (verdict IN ('ok', 'violation')),
  rule        TEXT,
  CHECK ((verdict = 'violation') = (rule IS NOT NULL))
);
CREATE INDEX events_agent_seen ON events (agent_id, seen_at DESC);

CREATE TABLE incidents (
  id                INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  agent_id          INTEGER NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
  trigger_signature TEXT NOT NULL REFERENCES events (signature),
  rule              TEXT NOT NULL,
  seen_at           BIGINT NOT NULL,
  decided_at        BIGINT NOT NULL,
  sent_at           BIGINT,
  revoke_signature  TEXT,
  landed_slot       BIGINT,
  landed_via        TEXT CHECK (landed_via IN ('beam', 'rpc')),
  leaked_tx_count   INTEGER NOT NULL DEFAULT 1 CHECK (leaked_tx_count >= 0),
  status            TEXT NOT NULL CHECK (status IN ('alerted', 'sent', 'contained', 'failed'))
);
CREATE INDEX incidents_agent ON incidents (agent_id, id DESC);

-- One row per route: the same signature is sent through Beam and the fallback RPC in parallel.
CREATE TABLE landings (
  signature   TEXT NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('incident', 'canary')),
  route       TEXT NOT NULL CHECK (route IN ('beam', 'rpc')),
  sent_at     BIGINT NOT NULL,
  sent_slot   BIGINT NOT NULL,
  landed_slot BIGINT,
  landed_at   BIGINT,
  PRIMARY KEY (signature, route)
);
`,
  },
];
