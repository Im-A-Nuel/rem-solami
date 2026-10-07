# CLAUDE.md

## Project
Rem: non-custodial emergency brake for AI agent wallets. Streams agent tx via Solami gRPC, broadcasts a pre-signed durable-nonce `revoke` via Solami Beam on policy violation.

## Stack
- Worker: TypeScript on Node 22+ in `worker/`, one always-on process (watch, policy, broadcast, API). ESM, strict TS.
- `@solana/web3.js` (v1) for tx build/sign/decode, `@solana/spl-token` for approve/revoke, `@triton-one/yellowstone-grpc` for the Yellowstone stream.
- SQLite via built-in `node:sqlite` (no native addons).
- Tests: Vitest. Runner: `tsx`.
- Dashboard: Next.js in `web/`, deployed on Vercel, read-only consumer of the worker API.
- Alerts: Telegram Bot API over plain HTTP.

The watcher cannot run on Vercel: it needs a long-lived gRPC stream and in-memory rolling state. The worker runs on an always-on host (VPS, Fly.io or Railway). Vercel only serves `web/`.

## Commands
```bash
cd worker
pnpm test
pnpm typecheck
pnpm rem setup --owner ./keys/owner.json --agent <PUBKEY> --mint <MINT> --allowance 5 --fee-payer <PUBKEY> --out ./panic/x.json
pnpm rem watch --config rem.yaml
pnpm rem serve --config rem.yaml
pnpm phase0            # devnet: durable-nonce panic tx signed earlier still lands
cd ../web && pnpm dev
```

## Project Structure
```
worker/src/cli/        subcommands only, no logic
worker/src/nonce/      panic tx build + validate (security critical)
worker/src/watch/      gRPC subscribe, reconnect, replay
worker/src/policy/     pure functions: (event, state) -> verdict
worker/src/broadcast/  Beam send, RPC confirm, timing
worker/src/store/      SQLite schema + queries
worker/src/alert/      Telegram
worker/src/api/        HTTP handlers for the dashboard
worker/scripts/        phase0 devnet check, rogue-agent demo attacker
web/                   Next.js landing + console (Vercel)
```

## Key Conventions
- Modules: short, lowercase directory names. One concern per module.
- Errors: `throw new Error("context", { cause })`. Never swallow. `process.exit` only in `cli/`. Long-running loops (watch, nonce check) catch, log and continue.
- Time: wall-clock at gRPC receive, decision and send, stored as Unix nanoseconds (`bigint`). Measure durations with `process.hrtime.bigint()`.
- Amounts: `bigint` base units. Never `number` for money. API sends them as strings.
- Config: everything comes from `rem.yaml` with `${ENV}` expansion. No hardcoded addresses.
- Commits: conventional commits.

## Architecture Notes
- The panic tx contains exactly: `AdvanceNonceAccount` (first), SPL `Revoke` for each watched token account, ComputeBudget instructions. `validatePanicTx` in `nonce/` must reject anything else.
- The owner key never reaches the server. `rem setup` runs on the owner's machine and outputs a JSON file with the partially signed tx.
- Fee payer is Rem's own keypair holding only SOL. Rem adds its signature at broadcast time.
- Policy evaluation is in-memory and synchronous on the receive path. Do not add network calls inside `policy`.
- After every reconnect, resubscribe with `from_slot` = last processed slot. Deduplicate by signature.
- Check the nonce value every 60 s. If it changed, mark the agent `stale` and alert.
- Broadcast via Beam and RPC in parallel; record which lands first.
- The worker API is read-only and must set CORS for the dashboard origin only.

## Do NOT
- Do not add any instruction type to the panic tx besides advance nonce, revoke, compute budget.
- Do not store or log owner or agent private keys.
- Do not call `policy` rules with data fetched after the decision (no lookahead in latency numbers).
- Do not report best-run latency as typical. Report p50 and p95 with sample size.
- Do not add native addons or anything that needs a compiler toolchain to install.
- Do not put the watcher or any long-lived connection in `web/`.

## Current Focus
Phase 0: durable nonce panic tx lands on devnet after being signed earlier.
