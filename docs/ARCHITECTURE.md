# System Architecture: Rem

Last updated: Oct 5, 2026

## Overview

Rem is a single Go binary with four subcommands and a read-only Next.js dashboard. The owner signs once on their own machine. After that, the server watches, decides, and broadcasts on its own. Its only on-chain capability is to land a revoke that the owner already signed.

## System Diagram

```
   OWNER MACHINE (once)                         SOLANA MAINNET
   +----------------------+   approve, nonce    +------------------------------+
   | rem setup            |-------------------->| owner USDC ATA (delegate =   |
   | signs panic tx       |                     | agent), nonce account        |
   +----------+-----------+                     +------+-----------------+-----+
              | panic.json (no keys)                   ^                 ^
              v                                        | agent tx        | panic tx lands
   +----------+---------------------------------+      |                 |
   | REM SERVER (Go)                            |  +---+-------+   +-----+--------+
   |                                            |  | Agent     |   | Solami Beam  |
   |  watch <--- Solami Yellowstone gRPC <------+--| (rogue?)  |   +-----+--------+
   |    |                                       |  +-----------+         ^
   |    v                                       |                        |
   |  policy --violation--> broadcast ----------+------------------------+
   |    |                       |               |
   |    v                       v               |
   |  store (SQLite) <---- confirm via RPC      |
   |    |                                       |
   |  api ---> dashboard (Next.js)   alert ---> Telegram
   +--------------------------------------------+
```

## Detection and response sequence

```
slot S    agent sends delegated transfer to unknown address
          gRPC delivers tx to watch            t_seen
          policy returns violation             t_decide
          broadcast adds fee-payer sig, sends  t_sent   (Beam + RPC in parallel)
slot S+k  revoke lands                          slot_landed
          confirm: delegate == none             status = contained
slot S+k+ agent's next transfer fails (no delegate)
```

Reported numbers: detection = `t_decide - t_seen`, send = `t_sent - t_decide`, landing = `slot_landed - S` in slots and milliseconds.

## Components

| Component | Responsibility |
| --- | --- |
| `cmd/rem setup` | Create nonce account, approve allowance, build and owner-sign panic tx, write `panic.json` |
| `internal/nonce` | Build and strictly validate panic transactions |
| `internal/watch` | gRPC subscribe with account filters, reconnect, `from_slot` replay, dedupe |
| `internal/policy` | Pure rule functions over an event and per-agent rolling state |
| `internal/broadcast` | Add fee-payer signature, send via Beam and fallback RPC, record timing, confirm |
| `internal/store` | SQLite schema and queries |
| `internal/alert` | Telegram messages |
| `internal/api` | JSON API for the dashboard |
| `web/` | Dashboard: agents, incidents, decoded panic tx, landing health |
| `scripts/rogue-agent` | Demo attacker using the agent's delegate rights |

## Tech Stack

### Backend
- Go 1.22+
- Yellowstone gRPC protos and client
- `github.com/gagliardetto/solana-go` for transaction building, signing, decoding
- SQLite via `modernc.org/sqlite`

### Frontend
- Next.js, Tailwind CSS, Recharts for landing histogram

### Blockchain
- Network: devnet for nonce and policy tests, mainnet-beta for the Solami demo
- Programs: System Program (durable nonce), SPL Token (approve, revoke), ComputeBudget

### Infrastructure
- One always-on VPS for `watch` and `serve`
- Dashboard on Vercel or served from the same VPS
- CI: GitHub Actions running `go vet`, `go test`, dashboard typecheck

## Key Design Decisions

- Decision: agent spends through an SPL delegate.
  - Reason: `revoke` cuts all of the agent's power in one instruction, independent of balance.
  - Alternatives: agent holds its own funded key. Rejected: nothing on-chain can stop a key holder.
- Decision: durable nonce panic tx signed in advance.
  - Reason: the transaction stays valid until used, so Rem never needs the owner key.
  - Alternatives: Rem holds the owner key. Rejected as custodial. Kept only as the documented kill-criteria fallback with a dedicated working-capital sub-wallet.
- Decision: Rem's own fee payer adds a signature at broadcast time.
  - Reason: the owner wallet does not need SOL at incident time; fee payer only holds SOL.
- Decision: high fixed priority fee inside the panic tx.
  - Reason: priority must be set at signing time; incidents justify overpaying.
- Decision: Beam and RPC sent in parallel.
  - Reason: maximizes landing chance and produces honest comparison data.
- Decision: in-memory synchronous policy evaluation.
  - Reason: no network call between receive and decide keeps detection latency near zero.

## Threat model

| Threat | Why it is safe / mitigation |
| --- | --- |
| Panic tx leaks | Contains only advance nonce + revoke. Worst case: the agent stops working. |
| Rem server compromised | Attacker can broadcast revoke and spend Rem's fee-payer SOL. No key can move user funds. |
| Agent holds owner key | Out of model. `rem setup` checks the agent pubkey differs from the owner and only has delegate rights. |
| Nonce used for another tx | Panic tx becomes invalid. Nonce check every 60 s marks agent `stale` and alerts for re-signing. |
| Owner wants to cancel | Owner advances the nonce; every tx signed with it dies immediately. |
| Losing the race to an attacker | Maximum loss equals the remaining allowance. Recommend a small allowance refilled on a schedule. |
| False positive | Only a revoke happens. Owner re-approves. `alert` mode lets owners tune rules first. |
| Replay of the panic tx | `AdvanceNonceAccount` is always the first instruction; after landing the nonce changes, so a second send fails. This matters because since Aug 12, 2026 the runtime no longer tracks nonce transactions in its status cache. |

Pre-signed durable nonce transactions have been used to drain a protocol. Rem's design answer is payload restriction: `internal/nonce.Validate` refuses any instruction beyond advance nonce, revoke, and compute budget, and the dashboard shows the decoded payload so anyone can verify it.

## Scalability Plan

- One gRPC subscription with all watched accounts in the filter; split into several subscriptions past a few hundred accounts.
- Policy state is per agent and in memory; shard agents across processes by hash if needed.
- SQLite is enough for the hackathon; move to Postgres when multiple watcher processes write.
