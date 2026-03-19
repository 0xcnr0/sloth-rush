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
# Install dependencies
npm install

# Start backend (terminal 1)
cd backend && npm run dev

# Start frontend (terminal 2)
cd frontend && npm run dev
```

Frontend runs on http://localhost:5173, backend on http://localhost:3001.

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

92 automated tests covering happy path, edge cases, security, rate limits, economy, and race logic.

```bash
cd ~/slug-rush && npx tsx qa-agent.ts
```

## License

MIT
