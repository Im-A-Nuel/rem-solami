# CLAUDE.md

## Project
Rem: non-custodial emergency brake for AI agent wallets. Streams agent tx via Solami gRPC, broadcasts a pre-signed durable-nonce `revoke` via Solami Beam on policy violation.

## Stack
- Go 1.22+ single binary (`cmd/rem`)
- Yellowstone gRPC client, `github.com/gagliardetto/solana-go`
- SQLite via `modernc.org/sqlite` (no cgo)
- Dashboard: Next.js in `web/` (read-only consumer of the Go API)
- Alerts: Telegram Bot API over plain HTTP

## Commands
```bash
go build -o bin/rem ./cmd/rem
go test ./...
go vet ./...
./bin/rem setup --owner ./keys/owner.json --agent <PUBKEY> --mint <MINT> --allowance 5 --out ./panic/x.json
./bin/rem watch --config rem.yaml
./bin/rem serve --config rem.yaml
cd web && pnpm dev
```

## Project Structure
```
cmd/rem/            subcommands only, no logic
internal/nonce/     panic tx build + validate (security critical)
internal/watch/     gRPC subscribe, reconnect, replay
internal/policy/    pure functions: (event, state) -> verdict
internal/broadcast/ Beam send, RPC confirm, timing
internal/store/     SQLite schema + queries
internal/alert/     Telegram
internal/api/       HTTP handlers for dashboard
scripts/rogue-agent demo attacker
```

## Key Conventions
- Package names: short, lowercase, no underscores.
- Errors: wrap with `fmt.Errorf("context: %w", err)`. No panics outside `main`.
- Time: record `time.Now()` at gRPC receive, decision, send. Store as Unix nanoseconds.
- Amounts: `uint64` base units. Never `float64` for money.
- Config: everything comes from `rem.yaml` with `${ENV}` expansion. No hardcoded addresses.
- Commits: conventional commits.

## Architecture Notes
- The panic tx contains exactly: `AdvanceNonceAccount` (first), SPL `Revoke` for each watched token account, ComputeBudget instructions. `internal/nonce.Validate` must reject anything else.
- The owner key never reaches the server. `rem setup` runs on the owner's machine and outputs a JSON file with the partially signed tx.
- Fee payer is Rem's own keypair holding only SOL. Rem adds its signature at broadcast time.
- Policy evaluation is in-memory and synchronous on the receive path. Do not add network calls inside `policy`.
- After every reconnect, resubscribe with `from_slot` = last processed slot. Deduplicate by signature.
- Check the nonce value every 60 s. If it changed, mark the agent `stale` and alert.
- Broadcast via Beam and RPC in parallel; record which lands first.

## Do NOT
- Do not add any instruction type to the panic tx besides advance nonce, revoke, compute budget.
- Do not store or log owner or agent private keys.
- Do not call `policy` rules with data fetched after the decision (no lookahead in latency numbers).
- Do not report best-run latency as typical. Report p50 and p95 with sample size.
- Do not introduce cgo dependencies.

## Current Focus
Phase 0: durable nonce panic tx lands on devnet after being signed earlier.
