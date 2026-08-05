# Wind-Up Rush — Light Paper

## The Problem

Blockchain gaming remains inaccessible to casual players. Most on-chain games demand steep upfront costs before anyone can play. Pay-to-win tokenomics alienate newcomers, and when speculation overshadows gameplay, economies collapse alongside token prices.

## The Solution

Wind-Up Rush is a free-to-play racing game built natively on Base L2. Players mint a Wind-Up NFT (gasless via Base Paymaster, one per wallet), race in deterministic simulations, and earn SPRING through victories and daily engagement.

The core loop — **mint, race, earn, upgrade** — is fun first, financialized second. Start racing in under 60 seconds. Free players compete in Exhibition races at zero cost. An optional $3 USDC upgrade to a Showcase unlocks premium formats — with stat caps ensuring competitive balance across all tiers.

## Key Differentiators

**Base App Native, Mobile-First.** Wind-Up Rush runs inside the Base App as a Mini App, not as a website someone has to leave the app to reach. The race is composed for a phone held upright — four horizontal lanes stacked vertically, a photo-finish frame that reads at a glance on a small screen. Onboarding is a passkey through Coinbase Smart Wallet: no seed phrase, no extension, no bridge. Sharing a result produces a rich embed that launches the game inline, so a shared race is a playable race.

**Skill Decides the Grid, Not the Wallet.** Before every race there is a Wind-Up phase: hold to wind your spring, release to lock it in. Wind further for a better grid slot, but the spring drains stamina faster past its safe point — and snaps outright if you overwind. The safe point derives from your racer's stamina, so the right answer differs per racer, and it shifts slightly each race so it cannot be memorised. Nothing in the phase costs money. All four racers wind blind and simultaneously, then the grid is revealed at once.

**Provably Fair Racing.** Every race uses a deterministic simulation engine with seeded PRNG (mulberry32). Same seed and same stats produce identical results every time. Race hashes are recorded on-chain and anyone can reproduce a result with the open-source engine. The grid is verifiable from the same seed as the race itself.

**Genuinely Free-to-Play.** Wind-Up minting is gasless via Base Paymaster. Exhibition races cost nothing. Daily bonuses and quests provide steady progression without spending. Upgrading costs $3 — not $50 or $500.

## Technical Architecture

- **On-chain (Base L2):** ERC-721 NFTs with on-chain stats, upgrade mechanism (burn + mint), race result hashes
- **Off-chain (Express + PostgreSQL):** SPRING balances, race simulation, the Wind-Up phase, training, quests, leaderboards
- **Base-Native Stack:** OnchainKit (wallet + identity + checkout), Coinbase Smart Wallet (passkey onboarding), Base Paymaster (gasless minting), Basenames (human-readable leaderboards)
- **Base App Mini App:** Runs natively inside the Base App. Vertical race format designed for mobile-first, in-app play. Social sharing creates rich embeds that launch the game inline

High-integrity operations live on-chain; high-frequency gameplay stays off-chain for speed and zero gas costs.

## Economy

SPRING is an off-chain gameplay point, not a tradeable token. Revenue flows from upgrades ($3 USDC each) and optional coin packages ($1–$25). The platform takes 15% of race entry fees, which are the sole source of the prize pool. No presale, no governance token, no speculative tokenomics. A future on-chain token is planned only if it meaningfully improves the player experience.

Race entry buys a race and nothing else; the pre-race phase costs nothing at all, and there is no mechanism anywhere in the game for putting money on an outcome.

## Traction

Working product: 73 API endpoints, 89 passing end-to-end tests plus 47 unit tests, 17 frontend pages, 3 smart contracts. Four race formats, weather systems, tactical actions, and the skill-based Wind-Up phase.

## Roadmap

- **Phase 1 (Now):** Base Sepolia testnet — free mint, racing, Wind-Up phase, leaderboard, Base App Mini App (playable directly in the Base App)
- **Phase 2:** Training, 3 evolution paths, accessories, Grand Prix tournaments, AI-powered player feedback system
- **Phase 3:** Ranked leagues (Bronze to Diamond), cosmetics marketplace, seasonal ladders
- **Phase 4:** Open-source simulation engine, community tournaments, on-chain economy exploration

Wind-Up Rush drives recurring on-chain transactions through daily racing, weekly tournaments, and seasonal resets — building sustainable engagement on Base L2.

---

*Wind up. Race hard. Rewind later.*
