# Sloth Rush — Light Paper

## The Problem

Blockchain gaming remains inaccessible to casual players. Most on-chain games demand steep upfront costs before anyone can play. Pay-to-win tokenomics alienate newcomers, and when speculation overshadows gameplay, economies collapse alongside token prices.

## The Solution

Sloth Rush is a free-to-play racing game built natively on Base L2. Players mint a Free Sloth NFT (gasless via Base Paymaster, one per wallet), race in deterministic simulations, and earn ZZZ Coins through victories and daily engagement.

The core loop — **mint, race, earn, upgrade** — is fun first, financialized second. Start racing in under 60 seconds. Free players compete in Exhibition races at zero cost. An optional $3 USDC upgrade unlocks premium formats — with stat caps ensuring competitive balance across all tiers.

## Key Differentiators

**Provably Fair Racing.** Every race uses a deterministic simulation engine with seeded PRNG (mulberry32). Same seed + same stats = identical results every time. Race hashes are recorded on-chain and anyone can reproduce results using the open-source engine.

**Genuinely Free-to-Play.** Free Sloth minting is gasless via Base Paymaster. Exhibition races cost nothing. Daily bonuses and quests provide steady progression without spending. Upgrading costs only $3 — not $50 or $500.

**Built-in Prediction Market.** Every race doubles as a micro-prediction event. Spectators predict winners before the race starts with onchain stakes. Correct predictions earn a share of the prediction pool — creating dual engagement where racers compete for race pots and spectators compete for prediction pools, generating recurring onchain transactions from both sides.

**Untapped Theme with Meme Potential.** No blockchain sloth racing games exist on any chain. "Pillow Throw" tactics, "Caffeine Rush" passives, and evolution paths like Hibernate and Dreamwalk create shareable moments driving organic growth.

## Technical Architecture

- **On-chain (Base L2):** ERC-721 NFTs with on-chain stats, upgrade mechanism (burn + mint), race result hashes, prediction settlements
- **Off-chain (Express + PostgreSQL):** ZZZ Coin balances, race simulation, training, quests, leaderboards
- **Base-Native Stack:** OnchainKit (wallet + identity + checkout), Coinbase Smart Wallet (passkey onboarding), Base Paymaster (gasless minting), Basenames (human-readable leaderboards)
- **Base App Mini App:** Runs natively inside the Base App. Vertical race format designed for mobile-first and in-app play. Social sharing creates rich embeds that launch the game inline

High-integrity operations live on-chain; high-frequency gameplay stays off-chain for speed and zero gas costs.

## Economy

ZZZ Coins are off-chain gameplay points — not a tradeable token. Revenue flows from upgrades ($3 USDC each) and optional coin packages ($1-$25). The platform takes 15% of race entry pots. No presale, no governance token, no speculative tokenomics. A future on-chain ZZZ Token is planned only if it meaningfully improves the player experience.

## Traction

Working product: 49 API endpoints, 92 passing tests, 14 frontend pages, 3 smart contracts. Four race formats, weather systems, tactical actions, sealed bids, and spectator predictions.

## Roadmap

- **Phase 1 (Now):** Base Sepolia testnet — free mint, racing, leaderboard, spectator predictions, Base App Mini App (playable directly in the Base App)
- **Phase 2:** Training, 3 evolution paths, accessories, Grand Prix tournaments, AI-powered player feedback system
- **Phase 3:** Ranked leagues (Bronze to Diamond), expanded prediction markets, cosmetics marketplace
- **Phase 4:** Open-source simulation engine, community tournaments, on-chain economy exploration

Sloth Rush drives recurring on-chain transactions through daily racing, spectator predictions, weekly tournaments, and seasonal resets — building sustainable engagement on Base L2.

---

*Wake up. Race hard. Nap later.*
