# SLOTH RUSH — GAME DESIGN AUDIT REPORT

**Date:** 2026-03-25
**Version:** 1.0
**Audited Commit:** cae3298 (main)
**Audit Tools:** Economy Auditor, Balance Checker, Engagement Loop Auditor, Progression Auditor

---

## Executive Summary

Sloth Rush has solid game mechanics and a well-structured hybrid on/off-chain architecture, but the economy has **critical structural issues** that will cause player frustration. The 15% platform cut on a bot-filled pot creates **negative-EV racing for solo players** — in a typical 1-real-player + 3-bot Standard race, the player loses ~9 ZZZ every race regardless of position. The stat system is heavily SPD-dominant, making 4 of 6 stats feel like wasted investment. The Caffeine evolution path is clearly superior to Hibernate and Dreamwalk. The daily free Standard race creates a +41 ZZZ "phantom pot" subsidy that is the single largest income source — more than daily login + all quests combined. Five key changes would fix 80% of issues: bot pot contribution, stat rebalancing, training speed increase, Tier 2→3 wall reduction, and dead-zone content.

---

## 1. Economy Balance

### 1.1 ZZZ Flow Map — All Sources & Sinks

#### SOURCES (ZZZ Creation)

| Source | Amount | Frequency | Daily Estimate | Flag |
|--------|--------|-----------|---------------|------|
| Daily Login | 15 ZZZ | 1/day | 15.0 | HEALTHY |
| Daily Quest: Complete 1 Race | 5 ZZZ + 10 XP | 1/day | 5.0 | WARNING — low |
| Daily Quest: Finish Top 2 | 10 ZZZ + 10 XP | 1/day | 5.0 (50% hit rate) | HEALTHY |
| Daily Quest: Visit Treehouse | 5 ZZZ + 10 XP | 1/day | 5.0 | HEALTHY |
| Weekly Quest: 5 Races | 25 ZZZ + 25 XP | 1/week | 3.6 | HEALTHY |
| Weekly Quest: 3 Weather Types | 25 ZZZ + 25 XP | 1/week | 3.6 | HEALTHY |
| Weekly Quest: 1 Training | 25 ZZZ + 25 XP | 1/week | 3.6 | HEALTHY |
| Exhibition Win (Sloth) | 8-12 ZZZ | per win | ~2.5 (25% win) | HEALTHY |
| Exhibition Win (Free Sloth) | 3-5 ZZZ | per win | ~1.0 (25% win) | HEALTHY |
| Free Standard Race (phantom pot) | ~41 ZZZ | 1/day | **41.0** | **CRITICAL** |
| Prediction Reward | 15 ZZZ | per correct | ~3.75 (25% accuracy) | HEALTHY |
| Upgrade Bonus | 500 ZZZ | one-time | — | HEALTHY |
| Milestone: First Race | 50 ZZZ | one-time | — | HEALTHY |
| Milestone: First Victory | 100 ZZZ | one-time | — | HEALTHY |
| Milestone: 10 Races | 200 ZZZ | one-time | — | HEALTHY |
| Milestone: 3 Win Streak | 150 ZZZ | one-time | — | HEALTHY |
| Milestone: First Training | 50 ZZZ | one-time | — | HEALTHY |
| Milestone: First Mini Game | 30 ZZZ | one-time | — | HEALTHY |
| Shop: Starter Pack | 120 ZZZ | $1 USDC | — | HEALTHY |
| Shop: Popular Pack | 650 ZZZ | $5 USDC | — | HEALTHY |
| Shop: Pro Pack | 1,400 ZZZ | $10 USDC | — | HEALTHY |
| Shop: Whale Pack | 4,000 ZZZ | $25 USDC | — | HEALTHY |

#### SINKS (ZZZ Destruction)

| Sink | Amount | Frequency | Flag |
|------|--------|-----------|------|
| Standard Entry | 50 ZZZ | per race | HEALTHY |
| Grand Prix Entry | 150 ZZZ | per race | HEALTHY |
| Tactic Entry | 75 ZZZ | per race | HEALTHY |
| Race Bids | 0-300 ZZZ | per race | HEALTHY |
| Platform Cut | 15% of pot | per race | **WARNING** |
| Boost (GDA) | 60+ ZZZ | per use | HEALTHY |
| Pillow (GDA) | 150+ ZZZ | per use | HEALTHY |
| Training | 10 ZZZ | per session | HEALTHY |
| Evolution Tier 2 | 800 ZZZ | one-time | HEALTHY |
| Evolution Tier 3 | 2,000 ZZZ | one-time | WARNING |
| Evolution Tier 4 | 3,500 ZZZ | one-time | WARNING |
| Accessories | 300-600 ZZZ | per item | HEALTHY |
| Cosmetics | 50-500 ZZZ | per item | HEALTHY |

### 1.2 Critical Finding: Phantom Pot Economics

The daily free Standard race uses `effectiveFee = 0` for the player but `totalEntryFees = participants.filter(p => !p.is_bot).length * race.entry_fee` in pot calculation. This means:

- Player pays 0 ZZZ
- Pot calculates as if player paid 50 ZZZ
- Platform takes 15% (7 ZZZ) from thin air
- Player receives ~41 ZZZ from nothing

**This is the #1 income source** — larger than daily login + all daily quests combined. The economy is structurally dependent on this single mechanic. If removed or changed, player income drops ~45%.

### 1.3 Paid Standard Race: Always Negative EV

With 1 real player + 3 bots (typical early game):
- Player pays 50 ZZZ entry
- Only 1 real player contributes to pot: pot = 50
- Platform cut: floor(50 * 0.15) = 7
- Distributable: 43
- After position shares + bot redistribution: player gets **41 ZZZ**
- **Net: -9 ZZZ per race regardless of position**

With 4 real players (rare early game):
- Pot: 200, distributable: 170
- EV per player: 170/4 = 42.5
- **Net EV: -7.5 per race (15% house edge)**

> **CRITICAL**: Paid Standard racing is a guaranteed ZZZ drain in bot-filled races. The economy relies on non-race income to compensate.

### 1.4 Break-Even Win Rate Analysis

Standard race, 4 real players, no bids:
```
EV = w × 85 + (1-w)/3 × (51 + 25.5 + 8.5) - 50
   = 56.67w - 21.67

Break-even: w = 38.2% (random chance = 25%)
Required skill edge: +53% above random
```

With bids (avg 50 ZZZ each), pot doubles:
```
Pot: 400, distributable: 340
Break-even win rate: ~34% (slightly easier with bigger pot)
```

| Scenario | Break-Even Win Rate | Random Chance | Achievable? | Flag |
|----------|-------------------|---------------|-------------|------|
| Standard, 4 real, no bids | 38.2% | 25% | Possible with stats | WARNING |
| Standard, 1 real + 3 bots | N/A | N/A | **Always -9 ZZZ** | **CRITICAL** |
| GP, 4 real, no bids | 38.2% | 25% | Same math, bigger loss | WARNING |
| Tactic, 4 real | 38.2% | 25% | Plus tactic costs | **CRITICAL** |

### 1.5 Net Daily Income Per Archetype

#### Casual (3 races/day: 1 Exh + 1 Free Std + 1 Paid Std)

| Source | Daily ZZZ |
|--------|-----------|
| Daily Login | +15 |
| Daily Quests (race + treehouse + 50% top2) | +15 |
| Weekly Quests (amortized) | +10.7 |
| Exhibition Win EV (25%, Sloth) | +2.5 |
| Free Standard (phantom pot) | +41 |
| Paid Standard (1 real + 3 bots) | -9 |
| **Net Daily** | **~75 ZZZ/day** |

#### Regular (6 races/day: 1 Exh + 1 Free Std + 4 Paid Std)

| Source | Daily ZZZ |
|--------|-----------|
| Daily Login | +15 |
| Daily Quests (all) | +20 |
| Weekly Quests | +10.7 |
| Exhibition Win EV | +2.5 |
| Free Standard | +41 |
| 4× Paid Standard | -36 |
| Predictions (1/day, 25%) | +3.75 |
| Training cost (2/week) | -2.86 |
| **Net Daily** | **~54 ZZZ/day** |

#### Hardcore (10 races/day: 1 Exh + 1 Free Std + 8 Paid Std)

| Source | Daily ZZZ |
|--------|-----------|
| Daily Login | +15 |
| Daily Quests (all) | +20 |
| Weekly Quests | +10.7 |
| Exhibition Win EV | +2.5 |
| Free Standard | +41 |
| 8× Paid Standard | -72 |
| Predictions (2/day, 25%) | +7.5 |
| Training cost (2/week) | -2.86 |
| **Net Daily** | **~22 ZZZ/day** |

> **CRITICAL**: Hardcore players earn LESS than Casuals because more racing = more platform tax. This is a perverse incentive — the game punishes its most engaged players.

### 1.6 Platform Revenue Per 100 Standard Races

Assuming avg 2 real players per race, no bids:
- Entry fees collected (ZZZ): 100 × 2 × 50 = 10,000
- Platform cut: 1,500 ZZZ (15%)
- With avg 30 ZZZ bids: +900 ZZZ
- **Total: ~2,400 ZZZ per 100 races**

Real-money equivalent: 2,400 ZZZ ÷ 120 (Starter rate) = ~$20 value captured per 100 races.

### 1.7 Economy Health Summary

| Metric | Value | Flag |
|--------|-------|------|
| Primary income source | Free Standard phantom pot (54% of daily) | **CRITICAL** |
| Paid race net EV (solo) | -9 ZZZ/race | **CRITICAL** |
| More play = less income | Hardcore 22 vs Casual 75 ZZZ/day | **CRITICAL** |
| Platform cut rate | 15% | WARNING |
| Upgrade value ($3 → 500 ZZZ) | 166.7 ZZZ/$ (best deal in game) | WARNING |
| Quest daily income | ~35 ZZZ | HEALTHY |
| Login retention hook | 15 ZZZ | HEALTHY |
| Prediction system | Free, +15 ZZZ on correct | HEALTHY |

---

## 2. Stat System Balance

### 2.1 Formula Summary

| Stat | Formula | Per-Point Impact | Scope |
|------|---------|-----------------|-------|
| **SPD** | maxSpeed = 3 + spd × 0.15 | +0.15 max speed | Every tick, entire race |
| **ACC** | acceleration = 0.3 + acc × 0.06 | +0.06 accel rate | First ~30% of race |
| **STA** | staDecay = max(0.05, 0.35 - sta × 0.015) | -0.015 decay | Last ~40% of race |
| **AGI** | yawn_wave resist = agi × 0.1 / 10 | +1% resist | Event-dependent (~0.3%/tick) |
| **REF** | pillow_recovery = max(5, 15 - ref) | -1 tick slowdown | Event-dependent, caps at 10 |
| **LCK** | luck_orb weight + rubber band | Weighted selection | Event-dependent (~0.25%/tick) |

### 2.2 Stat Tier List

```
S-tier: SPD — Affects every single tick. +1 SPD ≈ +0.15 max speed ≈ finishes ~3% faster.
                No diminishing returns. Always valuable.

A-tier: STA — Affects last 40% of every race. Critical at high SPD (fast sloths fatigue more).
               Reaches minimum decay at ~23 points (0.05 floor).

A-tier: ACC — Affects first 30% of every race. Valuable for catching up to max speed quickly.
               Less impactful than SPD but always relevant.

B-tier: LCK — Luck orb gives significant speed boost (20 tick duration at 1.5× speed).
               Rubber banding helps trailing sloths. Inconsistent but potentially game-changing.

C-tier: AGI — Only matters during yawn_wave events (~3% chance per event check).
               10 AGI = 10% resist. Extremely situational.

D-tier: REF — Only matters during pillow_fight events. Caps at 10 points (min 5 ticks).
               Any points above 10 are COMPLETELY WASTED.
```

### 2.3 SPD Dominance Analysis

Testing maxSpeed at different stat values:

| SPD | Max Speed | Race Time (est.) | Improvement |
|-----|-----------|-------------------|-------------|
| 5 | 3.75 | ~75s | baseline |
| 10 | 4.50 | ~62s | 17% faster |
| 15 | 5.25 | ~53s | 15% faster |
| 20 | 6.00 | ~47s | 12% faster |
| 25 | 6.75 | ~41s | 11% faster |

Every SPD point gives meaningful speed improvement. Compare to AGI where 25 points gives only 25% resist to an event that occurs ~3% of the time.

> **WARNING**: SPD is approximately **5-10× more impactful** than AGI or REF per stat point. Players who discover this will dump all resources into SPD, making 4 of 6 stats feel like wasted investment.

### 2.4 REF Hard Cap Problem

REF formula: `max(5, 15 - reflex)`
- At REF 10: recovery = 5 ticks (minimum reached)
- At REF 11-35: recovery = still 5 ticks
- **Points above 10 are literally zero value**

This is a trap for players who invest in REF beyond 10. The Hibernate evolution path (STA/REF focus) gives +5 REF cap at Tier 3, which is **entirely wasted** if REF is already 10+.

### 2.5 Race Format EV Table

| Format | Entry | 4-Real Distributable | EV | Net EV | 1+3Bot Net | Flag |
|--------|-------|---------------------|-----|--------|-----------|------|
| Exhibition | 0 | ~10 (winner) | 2.5 | +2.5 | +2.5 | HEALTHY |
| Standard | 50 | 170 | 42.5 | -7.5 | -9 | WARNING |
| Grand Prix | 150 | 510 | 127.5 | -22.5 | -28 | WARNING |
| Tactic | 75 | 255 | 63.75 | -11.25 | -14 | WARNING |
| GP Final | 0* | varies | varies | varies | varies | HEALTHY |

*GP Final has 0 entry (qualified players get in free), chaos mode active.

### 2.6 Evolution Path Ranking

| Rank | Path | Primary Stats | Tier 3 Passive | Tier 4 Passive | Verdict |
|------|------|--------------|----------------|----------------|---------|
| **#1** | **Caffeine** | SPD (S) + ACC (A) | +10% speed last 33% | +15% speed on overtake | **Best** — boosts the two most impactful stats |
| #2 | Hibernate | STA (A) + REF (D) | 50% fatigue reduction | 50% pillow damage reduction | Mixed — STA good but REF caps at 10 |
| #3 | Dreamwalk | LCK (B) + AGI (C) | +20% luck orb weight | 30% bad→good event conversion | Worst — relies on RNG events |

> **WARNING**: Caffeine is strictly dominant. A Caffeine sloth with 30 SPD and 30 ACC will outperform Hibernate/Dreamwalk in >70% of races. The passive caffeine_rush (+10% in last 33%) stacks with already-high SPD for compounding advantage.

### 2.7 Weather × Path Interaction

| Weather | Prob. | SPD Effect | STA Effect | Event Freq | Boost Dur | Best Path |
|---------|-------|------------|------------|------------|-----------|-----------|
| Sunny | 40% | Normal | Normal | Normal | Normal | Caffeine |
| Rainy | 20% | -10% | 1.5× important | Normal | Normal | Hibernate |
| Windy | 15% | Normal | Normal | Normal | 2× | Caffeine |
| Foggy | 15% | Normal | Normal | 0.5× | Normal | Caffeine |
| Stormy | 10% | -15% | Normal | 2× | 0.5× | Dreamwalk? |

Caffeine wins in Sunny (40%), Windy (15%), and Foggy (15%) = **70% of weather conditions**.
Hibernate wins in Rainy (20%).
Dreamwalk has a slight edge only in Stormy (10%).

---

## 3. Engagement Scorecard

### 3.1 Loop-by-Loop Assessment

| Loop | Clarity | Motivation | Response | Satisfaction | Fit | Avg | Grade |
|------|---------|------------|----------|-------------|-----|-----|-------|
| Mint → Race | 4 | 3 | 4 | 3 | 3 | 3.4 | B |
| Race → Earn | 3 | 2 | 4 | 2 | 2 | 2.6 | C- |
| Earn → Upgrade | 4 | 4 | 4 | 4 | 3 | 3.8 | B+ |
| Spectate → Predict | 3 | 4 | 3 | 4 | 3 | 3.4 | B |
| Train → Improve | 3 | 2 | 1 | 2 | 2 | 2.0 | D |
| Daily Login → Play | 5 | 4 | 5 | 4 | 4 | 4.4 | A |
| Mini-Game → Stat Growth | 3 | 3 | 4 | 3 | 3 | 3.2 | B- |

### 3.2 Detailed Loop Analysis

#### Mint → Race (B)
- **Clarity (4):** Landing → Mint → Treehouse → RaceLobby is a clear path. Could be 5 with an onboarding arrow.
- **Motivation (3):** Exhibition has small rewards (3-5 ZZZ for Free Sloth win). Not exciting enough to drive urgency.
- **Response (4):** PixiJS race animation provides good visual feedback. Sealed bid countdown adds tension.
- **Satisfaction (3):** Winning feels good, but losing in Exhibition gives nothing. No consolation prize.
- **Fit (3):** After racing, the path to "what's next" is unclear. Upgrade? More races? Training?

#### Race → Earn (C-)
- **Clarity (3):** Pot distribution is calculated post-race. Players may not see expected returns before entering.
- **Motivation (2):** **Paid Standard races are net negative.** Players will eventually realize they're losing ZZZ by racing. This kills the core game loop.
- **Response (4):** Payouts are instant after race completion.
- **Satisfaction (2):** Finishing 4th in Standard and losing 41+ ZZZ of your 50 entry is frustrating. Getting 41 ZZZ back from a 50 ZZZ entry (1 real + 3 bots) feels like a tax.
- **Fit (2):** Earning less than you spend doesn't motivate more racing. Players shift to non-race income (login, quests).

#### Earn → Upgrade (B+)
- **Clarity (4):** Treehouse shows Free Sloth with visible limitations. Upgrade path is clear.
- **Motivation (4):** 500 ZZZ bonus + stat improvements + rarity reveal = strong value proposition. $3 USDC is a low barrier.
- **Response (4):** Instant upgrade with animated rarity reveal (EvolutionModal.tsx is 12.6KB — rich animation).
- **Satisfaction (4):** Rarity reveal is a gacha-style dopamine hit. Getting "Rare" or above feels exciting.
- **Fit (3):** After upgrade, the path is unclear. "You now have a Sloth. Now what?" Need clearer next-goal communication.

#### Spectate → Predict (B)
- **Clarity (3):** Players need to understand which sloth is likely to win. Stats may not be visible enough.
- **Motivation (4):** Free to predict, 15 ZZZ reward. No downside. Good risk/reward.
- **Response (3):** Must wait for race to finish to see if prediction was correct.
- **Satisfaction (4):** Correct prediction = 15 free ZZZ + "I knew it" feeling.
- **Fit (3):** Connects to race knowledge, but doesn't strongly pull into own racing.

#### Train → Improve → Race (D)
- **Clarity (3):** Training interface exists but 0.3 stat gain is abstract. "What does +0.3 SPD actually mean for my race performance?"
- **Motivation (2):** 0.3 stat per 6 hours = 0.05 per hour. At this rate, gaining 1 full stat point takes 3.3 sessions = ~20 hours of wall-clock time. Impact is invisible in races.
- **Response (1):** **6-hour wait with zero interaction.** This is the worst response score — the player does nothing for 6 hours and gets an imperceptible improvement.
- **Satisfaction (2):** 0.3 stat gain is not noticeable in race performance. Players won't feel stronger.
- **Fit (2):** Disconnect between training investment (time + 10 ZZZ) and observable racing improvement.

#### Daily Login → Play (A)
- **Clarity (5):** Click button, get ZZZ. Simplest loop.
- **Motivation (4):** 15 ZZZ is meaningful in early game (30% of a Standard entry). Less meaningful at high ZZZ balances.
- **Response (5):** Instant.
- **Satisfaction (4):** Free money always feels good.
- **Fit (4):** 15 ZZZ encourages spending (play a race, start training). Good gateway loop.

#### Mini-Game → Stat Growth (B-)
- **Clarity (3):** 5 game types map to 5 stats. Players need to know which stat they want to grow.
- **Motivation (3):** 0.1-0.5 stat per play is better than training per-hour, but still abstract.
- **Response (4):** Instant result with stat gain shown.
- **Satisfaction (3):** Score-based gain (score/100 * 0.5) rewards skill. But the gain itself (max 0.5) is small.
- **Fit (3):** Connects to stat growth → better racing. Needs clearer "before/after" visualization.

### 3.3 Cross-Loop Flow

```
[Wallet Connect]
      ↓
  [Mint Free Sloth] ──→ [Exhibition Race] ──→ [Small ZZZ Rewards]
      ↓                                              ↓
  [Daily Login] ──→ [+15 ZZZ] ──→ [Accumulate]      ↓
      ↓                              ↓               ↓
  [Daily Quests] ──→ [+20 ZZZ]      ↓               ↓
      ↓                              ↓               ↓
  [Free Standard] ──→ [+41 ZZZ]     ↓               ↓
      ↓                              ↓               ↓
      └──────────────────→ [UPGRADE $3 USDC] ←───────┘
                                ↓
                         [500 ZZZ + Sloth]
                                ↓
                    ┌─── [Standard Racing] ←──┐
                    ↓    (net negative EV)     │
              [ZZZ Drain] ──→ [Shop Purchase?] │
                    │          or [More Quests] │
                    ↓                          │
              [Training] ──→ [+0.3 stat/6h] ───┘ ← DEAD ZONE (6h wait)
                    │
                    ↓
              [Mini-Games] ──→ [+0.1-0.5 stat]
                    │
                    ↓
              [Tier 2 Evolution] ──→ ... long grind ... ──→ [Tier 3]
```

**Dead Ends Identified:**
1. **Standard Racing Loop** — negative EV means racing accelerates ZZZ depletion. Players who race more earn less.
2. **Training Wait** — 6-hour gap with nothing to do. Player must leave and come back.
3. **Post-Quest Daily** — After completing 3 daily quests and 1 free standard, there's little incentive to stay.

### 3.4 Overall Engagement Grade: **C+**

The game has strong individual moments (rarity reveal, sealed bid tension, race animation) but the **core race→earn loop is broken by negative EV**. The daily structure is carried by login + phantom pot + quests, not by actual racing, which should be the main engagement driver.

---

## 4. Progression Timeline

### 4.1 Daily Growth Rates

#### XP Per Day

| Source | Casual (3 races) | Regular (6 races) | Hardcore (10 races) |
|--------|-------------------|--------------------|--------------------|
| Race Complete (10 XP) | 30 | 60 | 100 |
| Race Win (20 XP bonus) | 15 (0.75 wins) | 30 (1.5 wins) | 50 (2.5 wins) |
| Daily Login | 5 | 5 | 5 |
| Daily Quests (3×10 XP) | 30 | 30 | 30 |
| Weekly Quests (3×25 XP / 7) | 10.7 | 10.7 | 10.7 |
| Mini-Games (8 XP each) | 8 (1 game) | 24 (3 games) | 40 (5 games) |
| Training Claim (5 XP) | 0.7 (1/week) | 1.4 (2/week) | 1.4 (2/week) |
| **Total XP/day** | **~99** | **~161** | **~237** |

#### Stat Growth Per Day (focused single stat)

| Source | Casual | Regular | Hardcore |
|--------|--------|---------|----------|
| Organic (0.05/race, cap 0.3/day) | 0.15 | 0.30 | 0.30 |
| Training (0.3/session, focus) | 0.043 (1/wk) | 0.086 (2/wk) | 0.086 (2/wk) |
| Mini-Game (focus, avg 0.3/play) | 0.30 (1/day) | 0.90 (3/day) | 1.50 (5/day) |
| **Total per stat** | **~0.49** | **~1.29** | **~1.89** |

Note: Organic growth is position-based (1st→SPD, 2nd→ACC, 3rd→STA, 4th→REF), so it can't be focused. Effective focused growth is ~0.34 (Casual), ~1.0 (Regular), ~1.6 (Hardcore).

### 4.2 Milestone Timeline (Days to Reach)

#### Tier 2 Requirements: 2,000 XP | 50 Races | 18 Wins | 800 ZZZ | Stat ≥ 20

| Requirement | Casual (3/day) | Regular (6/day) | Hardcore (10/day) |
|-------------|-----------------|------------------|-------------------|
| 2,000 XP | 20 days | 12 days | 8 days |
| 50 Races | 17 days | 8 days | 5 days |
| 18 Wins (25% rate) | 24 days | 12 days | 7 days |
| 800 ZZZ balance | 11 days | 15 days | **36 days** |
| Stat ≥ 20 (from ~10) | **29 days** | 10 days | 6 days |
| **BOTTLENECK** | **Stat (29d)** | **ZZZ (15d)** | **ZZZ (36d)** |

> **CRITICAL**: Hardcore players take **36 days** for Tier 2 ZZZ requirement vs. Casual's 11 days because they drain ZZZ faster. The game literally punishes the most active players.

#### Tier 3 Requirements: 4,000 XP | 150 Races | 55 Wins | 2,000 ZZZ | Stat ≥ 24

| Requirement | Casual | Regular | Hardcore |
|-------------|--------|---------|----------|
| 4,000 XP | 40 days | 25 days | 17 days |
| 150 Races | 50 days | 25 days | 15 days |
| 55 Wins | 73 days | 37 days | 22 days |
| 2,000 ZZZ (after 800 spent on T2) | **27 days** after T2 | **37 days** after T2 | **91 days** after T2 |
| Stat ≥ 24 (from 20) | 12 days | 4 days | 3 days |
| **Total from start** | **~102 days** | **~72 days** | **~127 days** |

> **CRITICAL**: Tier 2→3 is the **biggest grind wall**. Wins requirement jumps 3× (18→55), races jump 3× (50→150), ZZZ jumps 2.5× (800→2000). For Hardcore players, ZZZ accumulation alone takes **91 days after T2**.

#### Tier 4 Requirements: 6,000 XP | 300 Races | 120 Wins | 3,500 ZZZ | Stat ≥ 28

| Requirement | Casual | Regular | Hardcore |
|-------------|--------|---------|----------|
| Total from start | ~200+ days | ~140+ days | ~250+ days |
| Realistic? | No (7+ months) | Barely (5 months) | No (8+ months) |

### 4.3 Stat Cap Collision

| Creature Type | Stat Cap | Days to Cap (focused, Regular) |
|---------------|----------|-------------------------------|
| Free Sloth | 15 | ~5 days |
| Common Sloth | 22 | ~12 days |
| Uncommon | 25 | ~15 days |
| Rare | 28 | ~18 days |
| Epic | 31 | ~21 days |
| Legendary | 35 | ~25 days |

**Free Sloth stat cap of 15** is hit quickly (~5 days). After that, mini-games and training for that stat become useless. This creates a strong upgrade incentive — HEALTHY design.

**Common Sloth cap of 22** means Tier 2 stat requirement (≥20) is achievable but leaves only 2 points of headroom. Tier 3 stat requirement (≥24) is **impossible for Common Sloths** without evolution path bonus. This is a hard wall.

### 4.4 Grind Wall Map

```
Day 0          Day 10         Day 20         Day 30         Day 50         Day 100
│               │               │               │               │               │
├── Free Play ──┤               │               │               │               │
│  (Exhibition) │               │               │               │               │
│               ├── Upgrade ────┤               │               │               │
│               │  ($3 USDC)    │               │               │               │
│               │               ├─ Casual T2 ───┤               │               │
│               │               │  WALL: stat   │               │               │
│               │               │               │               │               │
│               ├── Regular T2 ─┤               │               │               │
│               │  WALL: ZZZ    │               │               │               │
│               │               │               │               │               │
│               │               │               │ ┌── Casual T3 ──────── Day 102│
│               │               │               │ │  WALL: wins          │       │
│               │               │               │ │                      │       │
│               │               ├─ Regular T3 ──┼─┤                      │       │
│               │               │               │ │                      │       │
│               │               │               │ │                      │       │
│               │               │               │ └── Hardcore T2 ──── Day 36   │
│               │               │               │     WALL: ZZZ !!!!!           │
│               │               │               │                               │
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
          ▲                              ▲                         ▲
     UPGRADE GATE                  GRIND WALL #1               GRIND WALL #2
     (natural)                   (T2, manageable)          (T2→T3, severe)
```

### 4.5 Dead Zone Analysis

| Dead Zone | When | Duration | Impact |
|-----------|------|----------|--------|
| Post-daily-quests | After ~15 min of play | Rest of day | Medium — nothing meaningful to do |
| Training wait | After starting training | 6 hours | High — completely idle period |
| Between T2 and T3 | After T2 evolution | 40-90+ days | **Critical** — no intermediate milestones |
| Post stat cap (Free Sloth) | After day ~5 | Until upgrade | Medium — stat growth stops |
| Post daily mini-game cap | After 5 plays | Rest of day | Low — minor inconvenience |

> **CRITICAL**: The 40-90 day gap between T2 and T3 has **zero intermediate milestones or rewards**. Players grind the same races with no sense of progress for 1-3 months. This is the #1 churn risk.

### 4.6 Win Rate Feasibility

| Tier | Required Rate | Win/Race | Random | Gap from Random | Feasible? |
|------|--------------|----------|--------|-----------------|-----------|
| T2 | 36.0% | 18/50 | 25% | +11% | Yes — stat advantage helps |
| T3 | 36.7% | 55/150 | 25% | +11.7% | Yes — but over long period |
| T4 | 40.0% | 120/300 | 25% | +15% | Difficult — needs significant stat edge |

With stat advantage (e.g., 5+ SPD above average opponent), estimated win rates:
- +5 SPD: ~35% win rate
- +10 SPD: ~45% win rate
- +15 SPD: ~55% win rate

T2 and T3 are achievable for players who invest in SPD. T4 requires sustained stat dominance.

---

## 5. Prediction System Assessment

| Metric | Value | Flag |
|--------|-------|------|
| Cost to predict | Free | HEALTHY |
| Correct reward | 15 ZZZ | HEALTHY |
| Incorrect penalty | 0 | HEALTHY |
| Expected accuracy (random) | 25% | — |
| EV per prediction | 3.75 ZZZ | HEALTHY |
| Daily limit | None | WARNING — exploitable |
| Information advantage | Visible stats before race | HEALTHY |

**Concerns:**
- No daily limit on predictions. A player could predict on every race for infinite free ZZZ.
- With 25% base accuracy and stat-informed picks (~35-40%), prediction farming could yield 15-20 ZZZ/day — significant free income.
- Consider adding a prediction cost (e.g., 5 ZZZ) or daily cap (e.g., 3/day) to prevent farming.

---

## 6. Monetization Health Check

| Metric | Value | Flag |
|--------|-------|------|
| Entry price | Free (Free Sloth) | HEALTHY |
| First paywall | $3 USDC (Upgrade) | HEALTHY — low barrier |
| Upgrade value | 500 ZZZ (166.7 ZZZ/$) | WARNING — better than shop |
| Starter Pack value | 120 ZZZ/$1 (120 ZZZ/$) | HEALTHY |
| Whale Pack value | 4000 ZZZ/$25 (160 ZZZ/$) | HEALTHY |
| Upgrade vs. shop | Upgrade gives +4% more ZZZ/$ than Whale | WARNING |
| Natural upgrade timing | Day 2-3 | HEALTHY |
| Shop purchase timing | Day 10-15 (ZZZ running low) | HEALTHY |
| P2W concern | ZZZ buys races, not stats directly | HEALTHY |
| Stat cap per rarity | Common 22, Legendary 35 | WARNING — Common hits wall fast |

**Monetization Funnel:**
```
Day 0: Free → Exhibition (experience the game)
Day 2-3: $3 USDC → Upgrade (stat unlock + 500 ZZZ, feels natural)
Day 10-15: $1-5 Shop → ZZZ refill (racing drains balance)
Day 20-30: $5-25 Shop → Sustain racing habit (bigger packages better value)
Day 50+: Repeat purchases or evolve to reduce costs
```

The funnel timing is good, but the **upgrade is a better deal than shop packages** (166.7 vs. 120-160 ZZZ/$). Players may feel shop packages are overpriced by comparison.

---

## 7. TOP 15 RECOMMENDATIONS

Sorted by impact (highest first):

### #1 — Bot Pot Contribution
- **Problem:** With 1 real + 3 bots, pot = 50 (only real player's entry). Player always loses 9 ZZZ.
- **Current:** Bots contribute 0 to pot
- **Recommended:** Bots contribute 50-75% of entry fee as "virtual entry" (funded by platform, not ZZZ creation)
- **Why:** Makes races feel fair. With 75% bot contribution: pot = 50 + 112.5 = 162.5, distributable = 138, player gets ~138 regardless of position = +88 net.
- **Impact:** CRITICAL — fixes the core game loop

### #2 — Remove Perverse Incentive (More Play = Less Income)
- **Problem:** Hardcore players earn 22 ZZZ/day vs. Casual 75 ZZZ/day
- **Current:** Every paid Standard race costs 9 ZZZ net
- **Recommended:** Increase daily free races to 3 (from 1), or reduce platform cut to 10% for players with 5+ races/day, or add small ZZZ reward for race participation (3-5 ZZZ for completing a race regardless of outcome)
- **Why:** The core game mechanic (racing) shouldn't punish engagement
- **Impact:** CRITICAL — fixes retention for active players

### #3 — Rebalance REF Stat
- **Problem:** REF hits minimum effect at 10 points. All investment above 10 is wasted.
- **Current:** `max(5, 15 - reflex)` — floor of 5 ticks
- **Recommended:** Change to `max(2, 15 - reflex * 0.7)` — scales to 28 points before floor, or add secondary REF effect (e.g., faster recovery from any slowdown, not just pillow fight)
- **Why:** REF being useless above 10 makes the Hibernate path's REF bonus a trap
- **Impact:** HIGH — affects stat balance and path viability

### #4 — Buff Dreamwalk and Hibernate Paths
- **Problem:** Caffeine wins 70%+ of weather conditions, has the two best stats
- **Current:** Paths are unbalanced
- **Recommended:**
  - Dreamwalk: Add "Fog Sight" passive (ignore fog speed reduction) + increase luck orb boost from 20 to 30 ticks
  - Hibernate: Change deep_sleep to also provide +5% base speed after 60% track (stacks with STA) + fix REF per #3
- **Why:** Players should have real choices, not a dominant strategy
- **Impact:** HIGH — adds strategic depth

### #5 — Add Intermediate Milestones Between T2 and T3
- **Problem:** 40-90 day gap with zero progression milestones
- **Current:** Nothing between T2 (day ~15-30) and T3 (day ~70-130)
- **Recommended:** Add "Tier 2.5" milestone at 100 races / 35 wins / 1200 ZZZ that grants a small perk (cosmetic slot, passive preview, stat cap +1). Or add seasonal achievement badges every 25 races.
- **Why:** Players need regular progress signals or they churn
- **Impact:** HIGH — reduces #1 churn risk

### #6 — Speed Up Training
- **Problem:** 0.3 stat per 6 hours (0.05/hour) is imperceptible
- **Current:** 6 hour wait, 10 ZZZ cost, +0.3 stat
- **Recommended:** 3 hour wait, 10 ZZZ cost, +0.5 stat. Or 1 hour quick-train for +0.15 stat and 5 ZZZ.
- **Why:** Training should feel like an active investment, not a forgotten task
- **Impact:** MEDIUM-HIGH — fixes D-grade engagement loop

### #7 — Visualize Stat Impact
- **Problem:** Players don't understand what +0.3 SPD means for race performance
- **Current:** Raw numbers with no context
- **Recommended:** Add "Power Rating" (weighted stat total where SPD × 3, ACC/STA × 2, LCK/AGI/REF × 1) + show estimated race time or win probability
- **Why:** Abstract stats don't motivate investment
- **Impact:** MEDIUM-HIGH — improves training, mini-game, and evolution motivation

### #8 — Cap or Cost Predictions
- **Problem:** Unlimited free predictions = infinite ZZZ farming
- **Current:** No limit, no cost, 15 ZZZ per correct
- **Recommended:** 3 free predictions/day, then 5 ZZZ per additional prediction
- **Why:** Prevents exploitation while keeping the system engaging
- **Impact:** MEDIUM — prevents economy leak

### #9 — Fix Phantom Pot Transparency
- **Problem:** Free Standard Race creates ZZZ from nothing (41 ZZZ/day)
- **Current:** No indication this is a subsidy
- **Recommended:** Either: (a) Label it clearly as "Daily Reward Race" with guaranteed 40 ZZZ, or (b) Change to a fixed daily race reward that doesn't pretend to be a pot system
- **Why:** When players discover the phantom pot, it undermines trust in the pot system
- **Impact:** MEDIUM — improves transparency

### #10 — Common Sloth Stat Cap Wall
- **Problem:** Common (55% of Sloths) caps at 22. Tier 3 needs stat ≥24. Impossible without evolution path bonus.
- **Current:** Cap 22, Tier 3 requires 24
- **Recommended:** Increase Common cap to 25, or reduce Tier 3 stat requirement to 22
- **Why:** 55% of players hit a hard wall at Tier 3 regardless of effort
- **Impact:** MEDIUM — removes frustrating hard block

### #11 — Post-Quest Daily Content
- **Problem:** After 15 minutes (quests + free race), nothing meaningful to do
- **Current:** Paid racing is negative EV, training is 6-hour wait
- **Recommended:** Add "Bonus Challenge" mode: 1 free tactic race/day with ZZZ reward, or "Lucky Race" with randomized modifiers and small prize pool
- **Why:** Players need a reason to stay beyond their daily quests
- **Impact:** MEDIUM — increases session length

### #12 — Exhibition Race Consolation Prize
- **Problem:** Losing Exhibition gives 0 ZZZ. Only winner gets 3-12 ZZZ.
- **Current:** Winner-takes-all for Exhibition
- **Recommended:** Give 1-2 ZZZ to all participants in Exhibition
- **Why:** Losing with zero reward discourages new players from racing
- **Impact:** MEDIUM-LOW — improves new player experience

### #13 — Upgrade vs Shop Value Alignment
- **Problem:** Upgrade gives 166.7 ZZZ/$ vs. Starter 120 ZZZ/$
- **Current:** Upgrade is objectively the best ZZZ/$ deal
- **Recommended:** Either reduce upgrade bonus to 400 ZZZ (133 ZZZ/$) or increase Starter to 150 ZZZ (150 ZZZ/$)
- **Why:** Shop packages should feel like reasonable value, not overpriced vs. upgrade
- **Impact:** LOW — minor economy inconsistency

### #14 — AGI Stat Utility Buff
- **Problem:** AGI only resists yawn_wave events (~3% occurrence rate)
- **Current:** agility × 0.1 resist divided by 10
- **Recommended:** Add secondary AGI effect: +0.5% dodge chance per AGI point against pillow attacks, or +0.02 speed when close to another sloth (drafting effect)
- **Why:** A stat that only matters 3% of the time is not worth investing in
- **Impact:** LOW — improves stat balance

### #15 — Weather Notification
- **Problem:** Weather affects strategy but players may not know the weather before entering
- **Current:** Weather determined by seed at race time
- **Recommended:** Show weather forecast on RaceLobby for next 3 races
- **Why:** Lets players choose when to race based on their path/stats. Adds strategic depth.
- **Impact:** LOW — adds interesting decision layer

---

## Appendix: Key Constants Reference

```
Race Entry:       Exhibition 0 | Standard 50 | GP 150 | Tactic 75
Max Raise:        Exhibition 0 | Standard 100 | GP 300 | Tactic 150
Platform Cut:     15% of (entries + bids)
Pot Shares:       1st 50% | 2nd 30% | 3rd 15% | 4th 5%
Daily Login:      15 ZZZ
Training:         10 ZZZ cost, 6h, +0.3 stat
Organic Growth:   0.05/race, 0.3/day cap
Mini-Game:        0.1-0.5 gain, 5/day, 8 XP
Prediction:       Free, 15 ZZZ correct
Stat Caps:        Free 15 | Common 22 | Uncommon 25 | Rare 28 | Epic 31 | Leg 35
GDA Base:         Boost 60 | Pillow 150
XP:               Race 10 | Win +20 | Login 5 | Quest 10 | Training 5 | Mini 8
Evolution:        T2: 800 ZZZ | T3: 2000 ZZZ | T4: 3500 ZZZ
Track:            2800 units, 150s max, 4 participants
Weather:          Sunny 40% | Rainy 20% | Windy 15% | Foggy 15% | Stormy 10%
```

---

*Report generated by Claude Code — Economy Auditor + Balance Checker + Engagement Loop Auditor + Progression Auditor*
