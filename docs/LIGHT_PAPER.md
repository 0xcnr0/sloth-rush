# Sloth Rush — Light Paper

## The Problem

Blockchain gaming remains inaccessible to casual players. Most on-chain games demand steep upfront costs — minting fees, gas, token purchases — before anyone can start. Pay-to-win tokenomics alienate newcomers, and when speculation overshadows gameplay, economies collapse alongside token prices, leaving mainstream gamers behind.

## The Solution

Sloth Rush is a free-to-play racing game built natively on Base L2. Players mint a Free Sloth NFT (gasless, one per wallet), race in deterministic simulations, and earn ZZZ Coins through victories and daily engagement.

The core loop — **mint, race, earn, upgrade** — is fun first, financialized second. Start racing in under 60 seconds. Free players compete in Exhibition races at zero cost. An optional $3 USDC upgrade unlocks premium formats and higher earnings — with stat caps ensuring competitive balance across all tiers.

## Key Differentiators

**Provably Fair Racing.** Every race is powered by a deterministic simulation engine using seeded PRNG (mulberry32). Given the same seed and stats, a race produces identical results every time. Race result hashes are recorded on-chain, making outcomes publicly verifiable. Players can independently reproduce any race result using the open-source engine and the on-chain seed.

**Genuinely Free-to-Play.** Free Sloth minting is gasless on Base L2. Exhibition races cost nothing. Daily bonuses, quests, and mini-games provide steady progression without spending. Upgrading costs only $3 — not $50 or $500.

**Untapped Theme with Meme Potential.** No active blockchain sloth racing games exist on any major chain. The playful theme — "Pillow Throw" tactics, "Caffeine Rush" passives, evolution paths like Hibernate and Dreamwalk — creates memorable, shareable moments driving organic growth.

## Technical Architecture

- **On-chain (Base L2):** ERC-721 NFTs (FreeSloth + Sloth) with on-chain stats, upgrade mechanism (burn + mint), race result hash recording
- **Off-chain (Express + PostgreSQL):** ZZZ Coin balances, race simulation engine, training, quests, seasons, leaderboards
- **Frontend:** React 19, Vite, RainbowKit wallet connection, Canvas-based race visualization

High-integrity operations live on-chain; high-frequency gameplay stays off-chain for speed and zero gas costs.

## Economy

ZZZ Coins are off-chain gameplay points — not a tradeable token. Revenue flows from upgrades ($3 USDC each) and optional coin packages ($1-$25). The platform takes 15% of race entry pots. There is no presale, no governance token, and no speculative tokenomics. A future on-chain ZZZ Token is planned only if it meaningfully improves the player experience.

## Traction

Working product with 49 API endpoints, 92 passing automated tests, 14 frontend pages, and 3 smart contracts ready for deployment. Four race formats including Grand Prix tournaments, weather systems, tactical actions, and sealed bid mechanics.

## Roadmap

- **Phase 1 (Now):** Base Sepolia testnet launch — free mint, exhibition racing, leaderboard
- **Phase 2:** Training system, 3 evolution paths (7 tiers), gameplay-earned accessories, Grand Prix tournaments
- **Phase 3:** Season system with ranked leagues (Bronze to Diamond), spectator predictions, weekly quests, cosmetics marketplace
- **Phase 4:** Open-source simulation engine, community tournament tools, on-chain economy exploration

Sloth Rush drives recurring on-chain transactions through daily racing, weekly tournaments, and seasonal resets — building sustainable engagement on Base L2.

---

*Wake up. Race hard. Nap later.*
