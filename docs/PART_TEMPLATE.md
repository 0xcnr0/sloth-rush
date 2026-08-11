# Part template — one rig, four skins

ART_DIRECTION §12 assumes one rig and four skins. That only holds if all four
sheets are drawn to a shared part architecture, and they were not. This file is
the architecture. It did not exist, which is why three of the four toys look
wrong and why `racerRig.ts` carries a different set of geometry constants for
each of them.

## How we know it was missing

Measured from the part PNGs that shipped **before** the redraw:

| sheet | torso | head | arm | leg | head h / torso h | leg h / torso h |
|---|---|---|---|---|---|---|
| tinbot | 162×172 | 137×106 | 52×200 | 100×251 | 0.62 | 1.46 |
| jetster | 138×284 | **202**×103 | 34×256 | 100×233 | 0.36 | 0.82 |
| waddler | 198×176 | 153×132 | 76×150 | 100×**98** | 0.75 | 0.56 |
| chomper | 214×172 | 156×129 | 92×173 | 99×110 | 0.75 | 0.64 |

Jetster's head is **wider than its torso** (202 against 138). The leg-to-torso
ratio ranges from 0.56 to 1.46 — a factor of two and a half across four toys
that are supposed to share a skeleton.

Tinbot reads correctly for a reason that is not luck: the first version of
`racerRig.ts` was written from Tinbot's numbers, and the other three were fitted
to it afterwards with per-archetype fudge constants. The rig has been patching
over the art.

## The template

Every part is expressed as a fraction of the **torso**, which is the unit. The
numbers are Tinbot's, because Tinbot is the sheet the rig was built from and the
one the owner says looks right.

| part | width / torso width | height / torso height |
|---|---|---|
| torso | 1.00 | 1.00 |
| head | 0.85 | 0.62 |
| arm | 0.32 | 1.16 |
| leg | 0.62 | 1.46 |
| key | 0.36 | 0.35 |

Tolerance: **±15%** on each ratio. Outside that, the rig needs its own constants
again and the template has failed.

A silhouette must still be distinguishable at 48×48 as flat black fill
(ART_DIRECTION §4.1) — the template constrains proportion, not shape. A rocket
is still a cone on a capsule and a duck is still a sphere with a beak; what the
template fixes is how big each piece is relative to the body it hangs off.

## Where the sheets stand

Three sheets were redrawn against the template (`jetster-parts-v5`,
`waddler-parts-v3`, `chomper-parts-v3`) and the results are below, measured off
the shipped PNGs the same way. Deviation is from the template ratio; anything
past ±15% is marked.

| sheet | torso | part | w/torso | dev | h/torso | dev |
|---|---|---|---|---|---|---|
| tinbot | 162×172 | head | 0.85 | −0.5% | 0.62 | −0.6% |
| | | arm | 0.32 | +0.3% | 1.16 | +0.2% |
| | | leg | 0.62 | −0.4% | 1.46 | −0.0% |
| | | key | 0.36 | +1.2% | 0.35 | −0.3% |
| waddler | 162×180 | head | 0.86 | +0.9% | 0.68 | +10.2% |
| | | arm | 0.30 | −7.4% | 0.98 | **−15.7%** |
| | | leg | 0.70 | +12.5% | 1.43 | −1.8% |
| | | key | 0.36 | +1.2% | 0.34 | −3.2% |
| jetster | 111×234 | head | 0.90 | +6.0% | 0.52 | **−15.9%** |
| | | arm | 0.54 | **+68.9%** | 0.65 | **−44.0%** |
| | | leg | 0.70 | +13.3% | 1.15 | **−21.0%** |
| | | key | 0.53 | **+47.6%** | 0.26 | **−25.5%** |
| chomper | 148×174 | head | 1.19 | **+39.9%** | 0.71 | +14.9% |
| | | arm | 0.70 | **+119.6%** | 0.52 | **−55.4%** |
| | | leg | 0.72 | **+15.5%** | 0.95 | **−34.7%** |
| | | key | 0.40 | +10.7% | 0.34 | −1.5% |

Tinbot is the control and lands on its own numbers, as it must. Waddler passes
everything but wing length, and misses that by 0.7 of a point.

Jetster and Chomper do not pass. Both failed the same way: the model drew the
limbs the character wants rather than the limbs the template asked for, so the
rocket has short fins on a very tall torso and the dinosaur has the stubby arms
and squat legs of a dinosaur. **Neither was patched in the rig.** They render
short, which is what art outside the template is supposed to look like.

Chomper's head is the one genuine shape problem rather than a size one: at 1.19
it is wider than the body it sits on, because the ratio counts a long snout that
points sideways. Jetster's key row is the same kind of artefact from the other
end — the key is the identical 59px sprite in every folder, so its ratio only
moved because the rocket's torso is the tallest and narrowest of the four. Both
need a decision about what the ratio should measure before either sheet is
regenerated to satisfy it.

## Producing a sheet

1. **Generate.** `scripts/meshy.ts image --ref scripts/generated/3d/tinbot-parts-3q-v2/img-view1.png --prompt-file scripts/prompts/<name>-parts-v5.txt --name <name>-parts-v5 --budget 9`

   Reference the locked Tinbot sheet, never text alone: describing the style
   from scratch failed three rounds running, and the reference lands it in one.
   State the part count explicitly ("exactly seven separate pieces") or you get
   three arms and one leg.

   The reference carries the silhouette as well as the proportions, which is
   fine for the duck and the dinosaur because their bodies are round anyway, and
   is not fine for the rocket: Jetster v3 came back as a red Tinbot, box torso
   and gauge panel included. The prompt has to name the body shape and reject
   the reference's out loud — v5 says "a smooth TALL ROUNDED CAPSULE — not a
   box, no panel, no gauges, no rivets" — while keeping the part count just as
   loud, because v4 fixed the character and lost a leg.

2. **Extract.** `scripts/extract-parts.py` — background is "the region connected
   to the edge", not "close to the background colour", or white paint in the art
   becomes a hole.

3. **Check the template.** Re-measure the ratios above. If a part is outside
   ±15%, regenerate that sheet rather than adding a constant to the rig — a
   constant is how this problem was created. There is nowhere to put one now:
   `racerRig.ts` carries one set of ratios for all five toys and measures the
   rest off the PNGs, so a sheet that misses the template simply renders as it
   was drawn.

4. **Check the silhouette and the pivots.** `scripts/silhouette-test.py`,
   `scripts/rig-preview.py`, then `tools/screenshot.mjs` for the real screen.

   Both scripts still name the pre-redraw sheets. `silhouette-test.py` maps
   archetypes to folders and part numbers that moved (Jetster's torso is
   `part-04` now, not `part-05`), and `rig-preview.py` only ever covered Tinbot
   and holds its own copy of the geometry in source pixel space, which is no
   longer the geometry the rig uses. Point them at the current sheets before
   trusting either.
