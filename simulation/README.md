# Provably Fair Racing

Wind-Up Rush resolves every race with a **deterministic simulation**. Given the
same inputs, the engine produces identical results on any machine — you do not
have to trust the server, you can run the race yourself.

## The inputs are the whole story

A race is a pure function of four things:

| Input | Where it comes from |
|---|---|
| **Seed** | Generated when the race starts and written to the race row. The grid order is derived from it too. |
| **Participants** | The six stats and grid slot of each racer. |
| **Track length** | The format's distance — Sprint 800, Endurance 1400. |
| **Items** | Every item deployed during the race, each with the tick it landed on. |

Nothing else enters. No wall-clock time, no server state, no hidden roll.

## Why live items do not break this

Players deploy items while the race is running, which sounds incompatible with
a result that was fixed in advance. It is not, because of one rule:

> An item may only be scheduled onto a tick that has not been revealed yet, and
> applying an item never consumes randomness.

The server picks the tick — the client asks for an item and is told when it
landed. Because the tick is always ahead of what the player has watched, and
because item effects are plain multipliers that draw nothing from the PRNG,
re-running the simulation with the new item list reproduces every frame already
shown, exactly. The race stays one function of `(seed, participants, length,
items)` from start to finish.

`backend/src/simulation/itemsPreserveHistory.test.ts` asserts this directly
rather than leaving it as an argument.

## Verify a race

```bash
npx tsx verify.ts \
  --seed "<the race seed>" \
  --length 800 \
  --participants '[
    {"name":"Racer1","spd":15,"acc":12,"sta":10,"agi":8,"ref":7,"lck":6,"gridPosition":1},
    {"name":"Racer2","spd":10,"acc":14,"sta":12,"agi":10,"ref":9,"lck":5,"gridPosition":2},
    {"name":"Racer3","spd":12,"acc":10,"sta":14,"agi":6,"ref":11,"lck":8,"gridPosition":3},
    {"name":"Racer4","spd":11,"acc":11,"sta":11,"agi":11,"ref":11,"lck":11,"gridPosition":4}
  ]' \
  --items '[{"racerId":1,"code":"boost","tick":120}]'
```

The finishing order it prints is the finishing order the server recorded, and
the result hash it produces is the one written on-chain.

## Stats

Six stats, 0–100 in principle, capped in practice at 15 for a Wind-Up and 22–35
for a Showcase by rarity.

| Stat | What it does |
|---|---|
| **SPD** | Top speed. The base currency of a race. |
| **ACC** | How fast top speed is reached, and the size of the grid bonus. |
| **STA** | How well speed survives distance. Decides long races. |
| **AGI** | Resistance to events that slow the field. |
| **REF** | Recovery time after a collision. |
| **LCK** | Weighting in the Luck Orb event. |

## Distance is the lever

Fatigue is measured in absolute distance, not as a fraction of the track: every
racer runs fresh for a short opening stretch and then fades per span travelled
beyond it, at a rate STA genuinely spans. A short race is decided by top speed;
a long one is decided by balance. Two formats, one variable.

## Random events

| Event | Chance / tick | Effect |
|---|---|---|
| **Wind-Down** | 0.30% | The leader's slowdown spreads; AGI resists |
| **Sudden Rain** | 0.20% | Everyone slows; STA resists |
| **Luck Orb** | 0.25% | One racer gets a boost, weighted toward those behind |
| **Collision** | 0.15% | Two racers tangle; REF decides recovery |

All four draw from the same seeded PRNG, in a fixed order, so they land in the
same places on every machine.

## Keeping this honest

This directory holds a copy of the engine so it can run without the server.
Copies drift — this one had fallen 123 lines behind before anyone noticed, which
would have made every verification here disagree with the real race.
`tools/check-verifier.sh` now compares them byte for byte and runs as part of
`npm run verify`, so the copy cannot go stale quietly again.
