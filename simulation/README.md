# Provably Fair Racing

Sloth Rush uses a **deterministic race simulation engine** that guarantees fair, verifiable outcomes. Given the same seed and participant stats, the engine produces identical results on any machine — no server trust required.

## How It Works

### 1. Deterministic PRNG (Mulberry32)

Every race begins with a **cryptographically random seed** (64-character hex string generated server-side via `crypto.randomBytes(32)`). This seed initializes a Mulberry32 pseudo-random number generator:

```
seed → mulberry32(seed) → deterministic sequence of random numbers
```

Mulberry32 is a 32-bit PRNG that uses bitwise operations and integer multiplication to produce uniformly distributed values between 0 and 1. The same seed always produces the same sequence — no external state, no hidden variables.

### 2. Six-Stat System

Each sloth has 6 stats that directly influence race physics:

| Stat | Abbreviation | Effect |
|------|-------------|--------|
| **Speed** | SPD | Base maximum speed: `3 + SPD * 0.15` |
| **Acceleration** | ACC | Acceleration rate: `0.3 + ACC * 0.06` per frame |
| **Stamina** | STA | Fatigue resistance after 60% of the track |
| **Agility** | AGI | Yawn Wave resistance: `resist = AGI * 0.1` |
| **Reflex** | REF | Pillow Fight recovery: `slowdown = max(5, 15 - REF)` |
| **Luck** | LCK | Weighted selection for Luck Orb events |

Stats range from 0 to 35, determined by rarity and training.

### 3. Weather System

Weather is derived deterministically from the seed (using `seed + '_weather'`):

| Weather | Probability | Effect |
|---------|------------|--------|
| Sunny | 40% | No modifiers (baseline) |
| Rainy | 20% | -10% max speed, STA matters 1.5x more |
| Windy | 15% | Boost duration doubled |
| Foggy | 15% | Event frequency halved |
| Stormy | 10% | -15% max speed, events 2x frequent, boost duration halved |

### 4. Race Events

Random events fire every 10 ticks (every second), each with a small probability:

| Event | Base Chance | Description |
|-------|-----------|-------------|
| **Yawn Wave** | 0.3% | Leader spreads drowsiness; others slow down (AGI resists) |
| **Sudden Rain** | 0.2% | All speeds drop 30%; STA provides resistance |
| **Luck Orb** | 0.25% | Random sloth gets speed boost; trailing sloths weighted higher (rubber-banding) |
| **Pillow Fight** | 0.15% | Two closest sloths clash; REF determines recovery time |

#### Rubber-Banding

The Luck Orb uses weighted random selection where trailing sloths have higher probability: `weight = LCK * (1 + distanceBehind * 0.02)`. This keeps races competitive.

### 5. Passive Abilities

Evolved sloths may have passive abilities:

| Passive | Effect |
|---------|--------|
| `caffeine_rush` | +10% speed in the last 33% of the track |
| `adrenaline_wake` | +15% speed for 10 ticks after overtaking |
| `deep_sleep` | 50% reduced stamina decay (better endurance) |
| `dream_catcher` | +20% weight for Luck Orb selection |
| `lucid_dream` | 30% chance to convert bad events into speed boosts |
| `thick_fur` | Reduced pillow slowdown (10 → 5 ticks) |

### 6. Race Physics (Per Tick)

Each tick (100ms):

1. **Check events** — Roll for random events based on probability and weather
2. **Apply tactic actions** — Process boost/pillow actions for this tick
3. **Calculate stamina factor** — After 60% of track, speed decays based on STA
4. **Apply passive abilities** — Calculate passive speed multipliers
5. **Accelerate** — Move toward target speed (maxSpeed * staminaFactor * passiveMul)
6. **Random variance** — Small seeded perturbation: `speed *= 0.97 + rng() * 0.06`
7. **Apply modifiers** — Slowdown (0.3x) and boost (1.5x) affect movement only
8. **Move** — Update distance by moveSpeed
9. **Check finish** — If distance >= 2800, mark as finished

### 7. Result Hash

After simulation completes, the final order is hashed:

```
resultHash = SHA-256(JSON.stringify(finalOrder))
```

This hash is recorded on-chain (Base L2) alongside the winner's address, creating an immutable proof that the result was computed correctly.

## Verification

Anyone can independently verify a race result:

```bash
cd simulation
npm install
npx tsx verify.ts \
  --seed "the-race-seed" \
  --participants '[{"name":"Sloth1","spd":15,"acc":12,"sta":10,"agi":8,"ref":7,"lck":6},{"name":"Sloth2","spd":10,"acc":14,"sta":12,"agi":10,"ref":9,"lck":5},{"name":"Sloth3","spd":12,"acc":10,"sta":14,"agi":6,"ref":11,"lck":8},{"name":"Sloth4","spd":11,"acc":11,"sta":11,"agi":11,"ref":11,"lck":11}]'
```

The verifier outputs:
- **Final order** — Finish positions and times
- **Result hash** — SHA-256 hash matching the on-chain record
- **Weather** — Deterministic weather for the seed
- **Events** — All random events that occurred

### Verify Against On-Chain Record

1. Get the race seed and participant stats from the Sloth Rush API (`GET /api/race/:id`)
2. Run the verifier with those inputs
3. Compare the output hash against the on-chain `result_hash` stored in the SlothRush contract
4. If they match, the race was provably fair

### CLI Options

| Flag | Description |
|------|-------------|
| `--seed` | Race seed (required) |
| `--participants` | JSON array of participant stats (required) |
| `--actions` | JSON array of tactic actions (optional) |
| `--chaos` | Enable chaos mode (optional) |
| `--json` | Output raw JSON instead of formatted text |
| `--hash-only` | Output only the result hash |

## Constants

| Constant | Value |
|----------|-------|
| Track length | 2800 units |
| Max ticks | 1500 (150 seconds) |
| Ticks per second | 10 |
| Platform cut | 15% of pot |
| Pot distribution | 1st: 50%, 2nd: 30%, 3rd: 15%, 4th: 5% |

## Trust Model

1. **Seed** — Generated server-side with `crypto.randomBytes(32)` and published after the race
2. **Stats** — On-chain NFT metadata (verifiable via Base L2)
3. **Engine** — Open source (this repository), deterministic, no hidden state
4. **Hash** — SHA-256 of final order, recorded on-chain for permanent verification
5. **Winner** — Address recorded on-chain via SlothRush contract

The only trust assumption is that the seed was generated randomly (not chosen to favor a specific outcome). Future versions will use Chainlink VRF for fully trustless seed generation.

## License

MIT
