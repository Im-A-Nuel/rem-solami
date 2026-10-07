# Schema, Config, and API: Rem

Last updated: Oct 5, 2026

Amounts are `uint64` base units. Times are Unix nanoseconds (`int64`).

## Database Schema (Postgres on Neon)

### agents
| Field | Type | Constraint | Description |
| --- | --- | --- | --- |
| id | INTEGER | PRIMARY KEY | |
| name | TEXT | UNIQUE NOT NULL | From `rem.yaml` |
| agent_wallet | TEXT | NOT NULL | Delegate pubkey |
| owner_wallet | TEXT | NOT NULL | Token account owner and nonce authority |
| nonce_account | TEXT | NOT NULL | |
| nonce_value | TEXT | NOT NULL | Blockhash stored in the nonce at signing time |
| panic_tx | TEXT | NOT NULL | Base64, owner-signed, fee-payer signature empty |
| mode | TEXT | CHECK in ('alert','brake') | |
| status | TEXT | CHECK in ('armed','stale','tripped','disarmed') | |
| allowance | INTEGER | NOT NULL | Approved amount at setup |
| created_at | INTEGER | NOT NULL | |

### agent_token_accounts
| Field | Type | Constraint | Description |
| --- | --- | --- | --- |
| agent_id | INTEGER | FK agents.id | |
| token_account | TEXT | NOT NULL | Owner ATA delegated to the agent |
| mint | TEXT | NOT NULL | |
| PRIMARY KEY | | (agent_id, token_account) | |

### events
| Field | Type | Constraint | Description |
| --- | --- | --- | --- |
| signature | TEXT | PRIMARY KEY | Dedup key |
| agent_id | INTEGER | FK agents.id | |
| slot | INTEGER | NOT NULL | |
| seen_at | INTEGER | NOT NULL | gRPC receive time |
| kind | TEXT | NOT NULL | `transfer`, `swap`, `other` |
| program_ids | TEXT | NOT NULL | JSON array |
| destination | TEXT | NULL | |
| amount | INTEGER | NULL | |
| verdict | TEXT | CHECK in ('ok','violation') | |
| rule | TEXT | NULL | Rule name when violation |

### incidents
| Field | Type | Constraint | Description |
| --- | --- | --- | --- |
| id | INTEGER | PRIMARY KEY | |
| agent_id | INTEGER | FK agents.id | |
| trigger_signature | TEXT | FK events.signature | First violating tx |
| rule | TEXT | NOT NULL | |
| seen_at | INTEGER | NOT NULL | |
| decided_at | INTEGER | NOT NULL | |
| sent_at | INTEGER | NULL | Null in `alert` mode |
| revoke_signature | TEXT | NULL | |
| landed_slot | INTEGER | NULL | |
| landed_via | TEXT | CHECK in ('beam','rpc') | First to land |
| leaked_tx_count | INTEGER | NOT NULL DEFAULT 1 | Violating tx that landed before revoke |
| status | TEXT | CHECK in ('alerted','sent','contained','failed') | |

### landings
| Field | Type | Constraint | Description |
| --- | --- | --- | --- |
| signature | TEXT | PRIMARY KEY | |
| source | TEXT | CHECK in ('incident','canary') | |
| route | TEXT | CHECK in ('beam','rpc') | |
| sent_at | INTEGER | NOT NULL | |
| sent_slot | INTEGER | NOT NULL | Current slot at send |
| landed_slot | INTEGER | NULL | |
| landed_at | INTEGER | NULL | First time seen confirmed |

---

## Panic file format (`rem setup` output)

```json
{
  "version": 1,
  "agent": "<AGENT_PUBKEY>",
  "owner": "<OWNER_PUBKEY>",
  "feePayer": "<REM_FEE_PAYER_PUBKEY>",
  "nonceAccount": "<NONCE_PUBKEY>",
  "nonceValue": "<BLOCKHASH_IN_NONCE>",
  "tokenAccounts": [{ "address": "<OWNER_USDC_ATA>", "mint": "<USDC_MINT>" }],
  "instructions": ["AdvanceNonceAccount", "SetComputeUnitLimit", "SetComputeUnitPrice", "Revoke"],
  "transaction": "<BASE64 partially signed, owner signature present, fee payer empty>"
}
```

`validatePanicTx` (`worker/src/nonce`) re-decodes `transaction` and must confirm:
1. Instruction 0 is `AdvanceNonceAccount` on `nonceAccount` with `owner` as authority.
2. Every other instruction is ComputeBudget or SPL `Revoke` on a listed token account with `owner` as owner.
3. Fee payer is `feePayer`, recent blockhash equals `nonceValue`.
4. Owner signature verifies against the message.

---

## Config (`rem.yaml`)

See [`rem.example.yaml`](../rem.example.yaml). Policy fields per agent:

| Field | Type | Rule |
| --- | --- | --- |
| `allow_destinations` | list of pubkeys | Delegated transfer to any other address is a violation |
| `max_out_per_minute` | uint64 base units | Sum of outflows in a rolling 60 s window |
| `max_tx_per_10s` | int | Count of agent tx in a rolling 10 s window |
| `allow_programs` | list of program ids | Any tx by the agent invoking another program is a violation |
| `max_slippage_bps` (P1) | int | Swap execution vs Blur reference price |

---

## CLI

| Command | Purpose |
| --- | --- |
| `rem setup --owner <keypair> --agent <pubkey> --mint <mint> --allowance <amount> --fee-payer <pubkey> --out <file>` | Owner machine: nonce account, approve, sign panic tx |
| `rem setup --refresh --owner <keypair> --agent-file <file>` | Re-sign after the nonce changed |
| `rem agent add --config rem.yaml --panic <file>` | Server: validate and import a panic file |
| `rem watch --config rem.yaml` | Stream, evaluate, broadcast |
| `rem canary --config rem.yaml` (P1) | Landing health probes every 10 min |

---

## HTTP API

Served by Next.js route handlers in `web/app/api`, reading Neon with a SELECT-only role. Read-only, same origin as the dashboard, so no CORS. No auth in the hackathon build.

**GET /agents**
```json
{ "items": [{ "name": "demo-agent", "agentWallet": "...", "mode": "brake", "status": "armed",
  "nonceHealthy": true, "allowanceRemaining": "5000000" }] }
```

**GET /agents/:name/panic**
```json
{ "decoded": [
  { "program": "11111111111111111111111111111111", "instruction": "AdvanceNonceAccount" },
  { "program": "ComputeBudget111111111111111111111111111111", "instruction": "SetComputeUnitPrice" },
  { "program": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "instruction": "Revoke", "account": "..." }
] }
```

**GET /incidents?agent=&cursor=**
```json
{ "items": [{ "id": 1, "agent": "demo-agent", "rule": "allow_destinations",
  "triggerSignature": "...", "revokeSignature": "...", "leakedTxCount": 1,
  "detectionMs": 3.2, "sendMs": 1.1, "landingSlots": 2, "landingMs": 900, "landedVia": "beam",
  "status": "contained" }], "nextCursor": null }
```

**GET /landing**
```json
{ "beam": { "n": 24, "p50Ms": 0, "p95Ms": 0, "p50Slots": 0 }, "rpc": { "n": 24, "p50Ms": 0, "p95Ms": 0, "p50Slots": 0 } }
```
(Zeros are placeholders until measured.)

### Error Response Format
```json
{ "error": { "code": "NOT_FOUND", "message": "agent not found" } }
```

---

## Telegram alert format

```
REM: demo-agent TRIPPED
rule: allow_destinations
leaked: <solscan link>  (1 tx)
revoke: <solscan link>  landed via beam in 2 slots
detection 3.2 ms | send 1.1 ms
```
