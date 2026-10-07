# CLAUDE.md

## Project
Rem: non-custodial emergency brake for AI agent wallets. Streams agent tx via Solami gRPC, broadcasts a pre-signed durable-nonce `revoke` via Solami Beam on policy violation.

## Stack
- Worker: TypeScript on Node 22+ in `worker/`, one always-on process (watch, policy, broadcast). ESM, strict TS.
- `@solana/web3.js` (v1) for tx build/sign/decode, `@solana/spl-token` for approve/revoke, `@triton-one/yellowstone-grpc` for the Yellowstone stream.
- Database: Postgres on Neon, via `pg` (pure JS). Tests run the same SQL on PGlite (Postgres compiled to WASM), so they need no server and no native addon.
- Tests: Vitest. Runner: `tsx`.
- Dashboard: Next.js in `web/`, deployed on Vercel. Its route handlers read Neon directly with a SELECT-only database role. There is no worker HTTP API.
- Alerts: Telegram Bot API over plain HTTP.

The watcher cannot run on Vercel: it needs a long-lived gRPC stream and in-memory rolling state. The worker runs on an always-on host (VPS, Fly.io or Railway). Vercel only serves `web/`.

## Commands
```bash
cd worker
pnpm test
pnpm typecheck
pnpm rem setup --owner ./keys/owner.json --agent <PUBKEY> --mint <MINT> --allowance 5 --fee-payer <PUBKEY> --out ./panic/x.json
pnpm rem agent add --config rem.yaml --panic ./panic/x.json
pnpm rem watch --config rem.yaml
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
worker/src/store/      Postgres migrations + queries (the only module that talks to the database)
worker/src/alert/      Telegram
worker/scripts/        phase0 devnet check, rogue-agent demo attacker
web/                   Next.js landing + console (Vercel); web/app/api reads Neon
```

## Key Conventions
- Modules: short, lowercase directory names. One concern per module.
- Errors: `throw new Error("context", { cause })`. Never swallow. `process.exit` only in `cli/`. Long-running loops (watch, nonce check) catch, log and continue.
- Time: wall-clock at gRPC receive, decision and send, stored as Unix nanoseconds (`bigint`). Measure durations with `process.hrtime.bigint()`.
- Amounts: `bigint` base units. Never `number` for money. Stored as NUMERIC(20,0), read as strings, sent to the dashboard as strings. Times are BIGINT Unix nanoseconds.
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
- Database writes are queued and never awaited between receiving an event and sending the panic tx. A slow or suspended Neon must not delay a revoke.
- The dashboard role is SELECT-only. The worker re-validates the panic tx before every send, so a tampered database row cannot get Rem's signature.

## Do NOT
- Do not add any instruction type to the panic tx besides advance nonce, revoke, compute budget.
- Do not store or log owner or agent private keys.
- Do not call `policy` rules with data fetched after the decision (no lookahead in latency numbers).
- Do not report best-run latency as typical. Report p50 and p95 with sample size.
- Do not add native addons or anything that needs a compiler toolchain to install.
- Do not put the watcher or any long-lived connection in `web/`.
- Do not await a database write on the path from receiving an event to broadcasting.
- Do not print or log `DATABASE_URL`. Use `redactConfig`.

## Current Focus
Phase 0 is done (durable nonce panic tx lands on devnet after being signed earlier). Now: store on Neon, `rem agent add`, then the gRPC watcher and the Beam broadcaster once the Solami trial is live.
