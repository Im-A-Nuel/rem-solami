# Rem

A non-custodial emergency brake for AI agent wallets on Solana. Rem watches agent activity in real time through Solami and lands a pre-signed `revoke` the moment a policy is broken. It never holds your keys.

> Built for the Solami sidetrack, Colosseum Crypto World's Fair (Oct 13, 2026).

## Overview

Agents that trade or pay for APIs need spending power. When an agent is compromised or stuck in a loop, it can drain that power in seconds, far faster than a human reading a notification. Existing kill switches (Phalnx, WAIaaS, Delego, Metaplex agent delegation) all wait for a human to press the button.

Rem removes the human from the critical path. The agent spends through an SPL delegate (`approve`). The owner signs one panic transaction offline, using a durable nonce: `AdvanceNonceAccount` followed by SPL `Revoke`. Rem stores only that signed transaction. When a policy breaks, Rem adds its fee-payer signature and broadcasts it through Solami Beam.

If the panic transaction leaks, the worst an attacker can do is stop your agent. If the Rem server is compromised, the attacker can only stop your agent and spend the small SOL balance in Rem's own fee-payer wallet.

## How it works

1. `rem setup` creates a nonce account, approves the agent as delegate with an allowance, and has the owner sign the panic transaction.
2. `rem watch` streams the agent's transactions over Solami Yellowstone gRPC.
3. The policy engine checks every transaction: destination allowlist, spend rate, burst, unknown program.
4. On a violation, the broadcaster sends the panic transaction through Solami Beam.
5. RPC confirms the delegate is cleared. The agent's next transaction fails on-chain.
6. A Telegram alert reports the leaked tx, the revoke tx, and the measured latencies.

## Solami products used

| Product | Job in Rem |
| --- | --- |
| Yellowstone gRPC | Stream agent transactions with server-side account filters and slot replay after reconnect |
| Beam | Land the panic transaction as fast as possible; measure landing latency |
| RPC | Bootstrap state, check nonce value, confirm revoke |
| Mirage (P1) | WebSocket fallback stream if gRPC drops |
| Webhooks (P1) | Push incidents to the operator's endpoint |
| Data API (P1) | Baseline normal spending per agent |
| Blur (P1) | Slippage rule from decoded swaps |

## Mainnet proof

| Item | Link |
| --- | --- |
| Demo agent wallet | TODO |
| Leaked tx (first and only) | TODO |
| Revoke tx (panic tx) | TODO |
| Agent tx that failed after revoke | TODO |
| Landing latency p50 / p95 (n = TODO) | TODO |

## Tech stack

| Layer | Choice |
| --- | --- |
| Watcher, policy, broadcaster, API | TypeScript on Node 22+, `@solana/web3.js`, Yellowstone gRPC client |
| Storage | SQLite (`node:sqlite`) |
| Dashboard | Next.js on Vercel, reads the worker API |
| Alerts | Telegram bot |
| Deploy | Worker on one small always-on host, dashboard on Vercel |

## Quick start

Prerequisites: Node 22+ and pnpm, a Solami API key with gRPC streaming enabled (Pro trial works), a Telegram bot token.

```bash
git clone https://github.com/<you>/rem && cd rem
cp .env.example .env && cp rem.example.yaml rem.yaml   # fill in keys and addresses
cd worker && pnpm install

# on the owner's machine: sign once, offline
pnpm rem setup --owner ./keys/owner.json --agent <AGENT_PUBKEY> --mint <USDC_MINT> --allowance 5 --out ./panic/demo-agent.json

# on the server
pnpm rem watch --config rem.yaml
pnpm rem serve --config rem.yaml          # API on :8080
cd ../web && pnpm install && pnpm dev       # dashboard on :3000
```

Reproduce the demo with your own key:

```bash
pnpm tsx scripts/rogue-agent.ts --agent ./keys/agent.json --source <OWNER_USDC_ATA> --to <UNKNOWN_ADDRESS> --amount 0.5 --repeat 10
```

## Project structure

```
rem/
  worker/
    src/
      cli/              CLI entrypoint: setup, watch, serve, canary
      config/           rem.yaml loader
      nonce/            nonce account + panic tx builder and validator
      watch/            Yellowstone gRPC subscriber (+ Mirage fallback)
      policy/           rules engine
      broadcast/        Beam sender + RPC confirmation
      store/            SQLite
      alert/            Telegram
      api/              HTTP API for the dashboard
    scripts/            phase0 devnet check, rogue-agent demo attacker
  web/                  Next.js landing + console (Vercel)
  docs/                 requirements, architecture, schema, roadmap, submission
```

## Security model

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#threat-model). Short version: Rem's only on-chain capability is to revoke a delegate the owner already chose to revoke in advance.

## Docs

- [Requirements](docs/REQUIREMENTS.md)
- [Architecture and threat model](docs/ARCHITECTURE.md)
- [Schema, config, and API](docs/SCHEMA.md)
- [Roadmap](docs/ROADMAP.md)
- [Submission kit](docs/SUBMISSION.md)

## License

MIT
