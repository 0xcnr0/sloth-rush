# Sloth Rush

> Wake up. Race hard. Nap later.

Free-to-play sloth racing game built natively on **Base L2**. Mint a Free Sloth, race in deterministic simulations, earn ZZZ Coins, and upgrade your racer.

## Features

- **Free Sloth Minting** — Gasless, one per wallet
- **Deterministic Racing** — Seeded PRNG engine, provably fair results recorded on-chain
- **4 Race Formats** — Exhibition (free), Standard, Tactic, Grand Prix
- **Training & Evolution** — 7 tiers, 3 evolution paths (Caffeine, Hibernate, Dreamwalk)
- **Economy** — ZZZ Coins, daily bonuses, quests, seasonal rewards
- **Leaderboards** — Career stats, ranked leagues, Hall of Fame

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS 4 |
| Backend | Express + PostgreSQL |
| Blockchain | Base L2 (Sepolia), Solidity, Hardhat |
| Wallet | RainbowKit + Wagmi + Viem |
| Race Engine | Deterministic simulation (mulberry32 PRNG) |

## Architecture

```
sloth-rush/
├── frontend/        # React SPA (Vercel)
├── backend/         # Express API + PostgreSQL (Railway)
├── contracts/       # Solidity smart contracts (Base L2)
├── simulation/      # Standalone race verifier (open source)
└── docs/            # Light paper, prompts
```

**Hybrid Model:** High-integrity operations (minting, upgrades, race hashes) live on-chain. High-frequency gameplay (racing, training, economy) runs off-chain for speed and zero gas costs.

## Smart Contracts

- **FreeSloth.sol** — ERC-721 NFT, one per wallet, burnable
- **Sloth.sol** — ERC-721 with on-chain stats (SPD, ACC, STA, AGI, REF, LCK)
- **SlothRush.sol** — Upgrade (burn FreeSloth + mint Sloth), race result recording

## Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL
- npm

### Setup

```bash
npm install
createdb wind_up_rush     # once

npm run dev               # frontend + backend, one terminal
```

Frontend runs on http://localhost:5173, backend on http://localhost:3001, and
Vite proxies `/api` to the backend so there is nothing to configure between them.

`npm run dev` runs both under one process. Running the two start commands in a
single terminal does not work: the first is a server and holds the shell, so the
second only runs once you stop it.

Other commands worth knowing:

```bash
npm run verify      # typecheck + vocabulary lint + unit tests — the release gate
npm run typecheck   # frontend uses `tsc -b`; `-p` checks nothing here
npm run lint:vocab  # theme words, retired symbols, raw codes, wagering language
npm run qa          # end-to-end suite; needs a running backend
```

In dev builds only, `/dev` renders components against stub props so UI work can be
looked at without connecting a wallet.

### Environment Variables

**Backend (.env):**
```
DATABASE_URL=postgresql://localhost:5432/sloth_rush
NODE_ENV=development
PORT=3001
```

## Provably Fair Racing

Every race in Sloth Rush is **deterministic and independently verifiable**. The simulation engine uses a seeded PRNG (Mulberry32) — given the same seed and participant stats, anyone can reproduce the exact race result.

### Verify a Race

```bash
cd simulation
npm install
npx tsx verify.ts \
  --seed "race-seed-from-api" \
  --participants '[{"name":"Sloth1","spd":15,"acc":12,"sta":10,"agi":8,"ref":7,"lck":6},{"name":"Sloth2","spd":10,"acc":14,"sta":12,"agi":10,"ref":9,"lck":5}]'
```

The verifier outputs the **finish order** and a **SHA-256 result hash**. Compare this hash against the on-chain record in the SlothRush contract on Base L2 to confirm the race was fair.

```bash
# Quick hash check
npx tsx verify.ts --seed "abc123" --participants '[...]' --hash-only
```

See [`simulation/README.md`](simulation/README.md) for full documentation on the engine internals: PRNG, stats, weather, events, and trust model.

## QA

57 end-to-end tests covering happy path, edge cases, security, rate limits,
economy, and race logic. Needs a running backend.

```bash
QA_BYPASS_TOKEN=local-dev npm run backend    # terminal 1
QA_BYPASS_TOKEN=local-dev npm run qa         # terminal 2
```

**Set the token on both, or the run is noise.** The suite makes far more requests
per minute than a player ever would, so without the shared secret it trips the
rate limiter partway through and every later test fails with a 429 — the failures
land on whichever tests happen to run after the limit, so the report looks like a
different regression each time. The bypass has been in `backend/src/index.ts`
since it was written but was never actually set when running the suite; wiring it
up took the pass rate from 78% to 97% without changing a line of product code.

The server only honours the token outside production and only when the variable is
explicitly set, so a deployed backend can never be talked out of rate limiting.
The suite's own rate-limit tests deliberately omit the header.

## License

MIT
