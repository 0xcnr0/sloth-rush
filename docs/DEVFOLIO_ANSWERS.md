# Devfolio Application: Base Batches Season 3 Startup Track

Kopyala-yapıştır hazır cevaplar. `[SEN DOLDUR]` yazan kısımları kendin tamamla.

---

## Company Name*

Lume Labs

---

## Website / Product URL

https://winduprush.xyz

---

## If you have a demo, what is the URL?

https://winduprush.xyz

---

## Describe what your company does.* (In ~50 characters or less)

Onchain and AI venture builder

---

## What is your product's unique value proposition?*

Most blockchain games are built around token speculation, not gameplay. Players come to earn, not to play. When the token price drops, everyone leaves. The game itself was never fun enough to stand on its own.

Wind-Up Rush is built the opposite way: fun first, blockchain second. It's a free-to-play racing game on Base where every race uses a deterministic simulation engine. Same seed, same stats, identical results every time. Race hashes are stored on-chain and the engine will be open-sourced so anyone can verify any race. No hidden randomness, no house edge.

Entry is truly free: gasless minting via Base Paymaster, zero-cost Exhibition races, and the core loop (mint, race, earn, upgrade) takes under 60 seconds. An optional $3 USDC upgrade unlocks premium formats with stat caps that prevent pay-to-win. Monetization only enters after the player is already having fun.

It is a Base App Mini App first, not a website with a wallet button. The race is composed for a phone held upright — four horizontal lanes stacked vertically, a photo-finish frame that reads at a glance on a small screen. Onboarding is a passkey through Coinbase Smart Wallet: no seed phrase, no extension, no bridge. A shared result renders as a rich embed that launches the game inline, so every share is a playable entry point inside the app people are already in.

Skill decides the grid, not the wallet. Before every race there is a Wind-Up phase: hold to wind your spring, release to lock it in. More tension means a better grid slot, but the spring drains stamina faster past its safe point and snaps if you overwind. The safe point derives from your racer's stamina, so the right answer differs per racer, and it shifts slightly each race so it cannot be memorised. The phase costs nothing: there is no entry fee, no stake and no spend of any kind attached to it.

---

## What part of your product is onchain?*

Onchain now (deployed to Base Sepolia):
- NFT Minting (ERC-721): FreeRacer (gasless via Base Paymaster, one per wallet) and Showcase (upgraded NFT with on-chain stats: SPD, ACC, STA, AGI, REF, LCK)
- Upgrade Mechanism: Burn the Wind-Up + pay $3 USDC → mint a Showcase. Rarity assigned via VRF (random but publicly verifiable, separate from deterministic race outcomes)
- Race Result Integrity: Race result hashes recorded on-chain. The deterministic engine will be open-sourced as a public verifier so anyone can replay a race from seed + stats
- Winner Recording: Winning wallet address stored on-chain per race (sub-cent cost on Base L2)
- USDC Payments: Upgrade fees and coin packages flow through Base USDC

Onchain next (building during program):
- Grid Verification: the Wind-Up phase's Safe Wind thresholds derive from the same on-chain race seed as the result, so the starting grid becomes replayable and checkable alongside the finish
- Seasonal Settlement: end-of-season standings recorded on-chain

High-frequency gameplay (race simulation, the Wind-Up phase, training, quests, leaderboards, SPRING balances) runs off-chain on Express + PostgreSQL for speed and zero gas costs. This hybrid model keeps integrity on-chain while making gameplay instant and free.

---

## What is your ideal customer profile?*

Our primary target is crypto-curious casual gamers: people who have a wallet (or are willing to set one up) but haven't found an onchain game worth playing. They're turned off by $50+ minting costs and pay-to-win tokenomics. They want something fun they can try in 60 seconds.

Secondary audience: existing crypto/NFT users looking for a game with actual gameplay depth rather than just speculation. The Wind-Up phase, 6-stat system, tactical actions, and seasonal ranked leagues give competitive depth that keeps engaged players coming back.

A third segment comes from where the game lives. Base App users discover Mini Apps inside the app they already have open; a game that is one tap from a shared post, with no install and no wallet setup, reaches people who would never seek out a crypto game.

---

## Which category best describes your company?*

Gaming / Consumer App

---

## Where are you located now, and where would the company be based after the program?*

[SEN DOLDUR - Örnek: "Istanbul, Turkey. The company would remain based in Istanbul after the program."]

---

## Do you already have a token?*

No. SPRING are off-chain gameplay points stored in our database, not a tradeable token. We intentionally avoid launching a token early. A future on-chain SPRING Token is considered for Phase 4 only if it meaningfully improves gameplay and regulatory conditions allow. No presale, no governance token, no speculative tokenomics.

---

## What part of your product uses Base?*

Wind-Up Rush is built exclusively on Base L2, not cross-chain, not multi-chain. We use the full Base-native stack:

Live:
- OnchainKit: Wallet connection, identity display (Basenames), and USDC checkout flows using Base's own React component library
- Coinbase Smart Wallet: Primary wallet for frictionless onboarding. Passkey-based, no seed phrase, no extension required
- Base Paymaster (ERC-4337): Sponsors gas for Wind-Up minting so users pay zero gas to start playing
- Basenames: Leaderboard and race results display player Basenames (e.g. racer.base.eth) instead of raw addresses
- NFT Contracts (ERC-721): FreeRacer.sol, Racer.sol, RaceCore.sol deployed on Base Sepolia, targeting Base mainnet
- Base USDC: Native USDC contract for $3 upgrades and coin packages
- Race Result Hashes: Stored on Base for provable fairness
- Base App Mini App: Runs natively inside the Base App as a Mini App. Players discover and play the game directly within the Base ecosystem. The host app's wallet auto-connects with zero manual setup needed

Building during program:
- AI-Powered Player Feedback: Quest-gated feedback system where experienced players shape game development. AI agent analyzes submissions weekly and flags actionable ideas for community-driven development without governance tokens

We chose Base for sub-cent gas costs (enabling gasless minting, micro-transactions, and frequent race transactions), fast finality, and the strongest consumer-app tooling. Nothing in our stack is cross-chain. Base is our home.

---

## Founder(s) Names and Contact Information.*

[SEN DOLDUR - Adın, e-posta, telefon numarası]

---

## Please describe each founder's background and add their LinkedIn profile(s).*

[SEN DOLDUR İSİM]. Solo founder with 13 years of entrepreneurship experience across mobile, web, and blockchain.

Since 2013, built and shipped 4+ ventures in mobile and web before transitioning to blockchain in 2021. Managed Planeth, Istanbul's Web3 Innovation Centre in Beyoğlu, a coworking space and incubator that hosted 500+ Web3 builders, organized hackathons, developer workshops (ETHKampus), and ecosystem events including Odos x Base Meetup and Istanbul Blockchain Week side events.

Participated in the Base Global Builder program, organizing multiple Base-focused events, hackathons, and educational programs across Turkey. This work built local community for the Base ecosystem before building on it.

Currently runs Lume Labs (lumelabs.xyz), a development studio focused on onchain and AI projects that supports builders and ships original products. Wind-Up Rush is the first game title from this studio, built using AI-assisted development (Claude Code, ChatGPT) with a vibecoding approach: AI accelerates implementation while the founder makes all design, architecture, and game economy decisions.

LinkedIn: [SEN DOLDUR - LinkedIn URL]

---

## Please enter the URL of a ~1-minute unlisted video introducing the founder(s) and what you're building.*

[SEN DOLDUR - YouTube/Loom unlisted video URL. İçerik önerisi aşağıda:]

### Video Senaryo Önerisi (60 saniye):

0-10s: "Hi, I'm [isim]. I'm building Wind-Up Rush, a free-to-play racing game on Base."

10-25s: "The problem with blockchain gaming is simple: most games cost $50+ just to start, and pay-to-win kills the fun. Wind-Up Rush flips this. Mint a racer NFT for free, start racing in 60 seconds, and every race result is provably fair with on-chain verification."

25-40s: [Ekranı göster, winduprush.xyz'de mint → race akışı] "Here's the live demo. Free mint, pick a race, wind your spring for pole position, watch the deterministic simulation run, and see results on the leaderboard."

40-55s: "The $3 upgrade unlocks premium formats with real skin-in-the-game. Revenue comes from upgrades and coin packages, no token speculation. We're building on Base exclusively for the low gas costs and consumer-app ecosystem."

55-60s: "Wind-Up Rush. Wind up, race hard, rewind later."

---

## Who writes code or handles technical development?*

Solo founder using AI-assisted development (Claude Code, ChatGPT). Architecture, game economy, and UX decisions are made by the founder; AI accelerates implementation. Quality is maintained through TypeScript strict mode, parameterized SQL queries, and 89 end-to-end tests plus 47 unit tests covering security, edge cases, and race logic. No external developers or contractors.

---

## How long have the founders known each other and how did you meet?*

Solo founder. N/A.

---

## How far along are you?*

MVP

Working product live at https://winduprush.xyz with:
- Gasless Wind-Up minting via Base Paymaster + Coinbase Smart Wallet
- Deterministic race simulation with 4 formats (exhibition, standard, tactic, grand prix)
- 6-stat NFT system with the Wind-Up phase
- Full Base-native stack: OnchainKit, Basenames, Base USDC
- Leaderboard, weather system, daily races
- Base App Mini App integration
- 3 smart contracts deployed on Base Sepolia

Building next: Wind-Up phase client, AI-powered player feedback

---

## How long have you been working on this?*

~2 weeks (13 days from concept to working MVP).

---

## How much of that time is full-time vs part-time?

Full-time. Approximately 10-14 hours per day for the full 13-day sprint.

---

## What part of your product is magic or impressive?*

Provably fair racing, and anyone can verify it. Every race uses a deterministic simulation (seeded PRNG, mulberry32). Same seed + same stats = identical results. Race hashes go on-chain, and the engine will be open-sourced as a public verifier. No hidden randomness, no house advantage.

The Wind-Up phase makes the start line the most tense ten seconds of the race. Four players hold, wind and release blind and simultaneously, then all four tensions are revealed at once and the grid snaps into place. Wind further for pole, but overwind and your spring drains stamina — or breaks and drops you to last. It is a real decision, it costs nothing, and no amount of money can buy a better grid slot.

60-second onboarding, zero cost. Coinbase Smart Wallet (passkey-based) → gasless mint via Base Paymaster → race. Someone who has never touched crypto can start racing immediately.

Built in 13 days by one founder with AI tools. 73 API endpoints, 89 end-to-end tests plus 47 unit tests, 4 race formats, the Wind-Up phase, weather systems, and a live deployment, all with production-grade quality (TypeScript strict, parameterized queries, comprehensive test coverage).

---

## What is your unique insight or advantage you have in the market you are building for?*

Blockchain gaming fails because it optimizes for speculation, not fun. If the game isn't fun at $0, no tokenomics will save it. Wind-Up Rush inverts this. Exhibition races are free, daily rewards drive engagement, and the Wind-Up phase creates real strategic depth. Monetization ($3 upgrade, coin packs) only enters after the player is already having fun. This is mobile gaming's proven F2P model, transplanted to on-chain with provable fairness as the killer feature.

Distribution is the hard part, and being a Base App Mini App solves it structurally. Most onchain games have to drag players out of the app they are in, through a wallet install, onto a website. We start inside the Base App, onboard with a passkey, and turn every shared race into a one-tap playable embed. The game meets people where they already are.

Players will shape the game, and AI makes that possible. Quest-gated feedback → AI weekly analysis → actionable implementation. Community-driven development without governance tokens.

Theme drives adoption more than technology. Wind-up tin toys are warm, nostalgic and instantly readable at thumbnail size — a shelf of them racing is a screenshot people share without being asked.

---

## Do you plan on raising capital from VCs?*

Open to it, but not dependent on it. The business model generates revenue from Day 1 through $3 upgrades and coin packages. The 15% platform fee on race entry fees creates recurring revenue tied to engagement, not speculation. VC funding would accelerate growth (marketing, artist collaborations, mainnet launch) but isn't required to operate.

We do not plan to launch a speculative token. If an on-chain SPRING Token is introduced in Phase 4, it will be utility-focused and only if it genuinely improves the player experience.

---

## Do you have users or customers?

Pre-launch, no public users yet. Working demo live at https://winduprush.xyz. Automated tests have simulated hundreds of race scenarios across all 4 formats.

Applying to Base Batches for go-to-market support. Target for first 30 days post-launch: 1,000 wallets minted, 10,000 races completed.

---

## Revenue, if any

Pre-revenue. Revenue model is designed and implemented:
- $3 USDC per racer upgrade (on-chain)
- $1-$25 coin packages (4 tiers with volume bonuses)
- 15% platform fee on race entry pots

Smart contracts deployed to Base Sepolia testnet. Mainnet deployment planned after Base Batches program.

---

## Please include any Dune analytics dashboards and/or public smart contract addresses

Smart contracts deployed to Base Sepolia. Source code: https://github.com/0xcnr0/wind-up-rush/tree/main/contracts

Contracts on Base Sepolia:
- FreeRacer.sol (ERC-721, gasless mint): 0x7dF0e4711c2A08164ea9E40834930eb8820E61f4
- Racer.sol (ERC-721, on-chain stats): 0xF0CBAB2C3Ae1A0b6B1FB5dd1CF7692CaaA807c0D
- RaceCore.sol (upgrade mechanism, race result recording): 0xda1553aDffDEf8b5fc8C9E344dFf35CC26d60141

> NOTE BEFORE SUBMITTING: these three addresses are the pre-rename deployment.
> The contracts were renamed in the rebrand and recompiled, but not redeployed,
> so on-chain they still carry their previous names. Either redeploy and update
> these addresses, or cite the previous names here. Do not submit as-is.

BaseScan links:
- https://sepolia.basescan.org/address/0x7dF0e4711c2A08164ea9E40834930eb8820E61f4
- https://sepolia.basescan.org/address/0xF0CBAB2C3Ae1A0b6B1FB5dd1CF7692CaaA807c0D
- https://sepolia.basescan.org/address/0xda1553aDffDEf8b5fc8C9E344dFf35CC26d60141

---

## Why do you want to join Base Batches?*

Three reasons:

1. Base is our only chain. Wind-Up Rush is built exclusively on Base, not cross-chain, not multi-chain. We chose Base for gasless minting via Paymaster, sub-cent transaction costs that enable micro-economy gameplay, and the strongest consumer crypto ecosystem. Base Batches is the program for teams fully committed to Base.

2. Go-to-market support. We have a working product but no distribution yet. Base Batches provides access to the Base builder community, marketing channels, and Demo Day exposure that a solo founder cannot replicate alone. The 8-week program structure would help us go from "working MVP" to "launched product with real users."

3. Credibility for the model we're proving. Wind-Up Rush demonstrates that a solo founder using AI-assisted development can build a complete blockchain game in 2 weeks. This is the future of onchain building: fast iteration, small teams, AI-augmented. Base Batches validation would help prove this model to the broader ecosystem.

---

## Anything else you'd like us to know?

Wind-Up Rush runs as a Mini App inside the Base App. Players discover the game in the Base ecosystem and start racing with one tap. When a race result is shared, it renders as a rich card with a "Race Now" button, creating a viral loop where every share is a potential new player. The vertical race format was designed specifically for mobile-first and in-app experiences.

AI isn't just our build tool, it's part of the product. Players who complete quests unlock a feedback system where AI analyzes submissions weekly and flags actionable ideas. Community-driven development without governance tokens.

We believe the next wave of onchain apps will be built by small teams moving fast with AI, not large studios spending millions. Wind-Up Rush is proof: concept to working MVP in 13 days, solo founder, AI-augmented.

Live demo: https://winduprush.xyz
GitHub: https://github.com/0xcnr0/wind-up-rush

---

## Who referred you to this program?

N/A
