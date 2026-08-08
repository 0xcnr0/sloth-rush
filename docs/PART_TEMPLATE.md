# Part template — one rig, four skins

ART_DIRECTION §12 assumes one rig and four skins. That only holds if all four
sheets are drawn to a shared part architecture, and they were not. This file is
the architecture. It did not exist, which is why three of the four toys look
wrong and why `racerRig.ts` carries a different set of geometry constants for
each of them.

## How we know it was missing

Measured from the shipped part PNGs (`frontend/public/art/<archetype>/`):

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

## Producing a sheet

1. **Generate.** `scripts/meshy.ts image --ref scripts/generated/3d/tinbot-parts-3q-v2/img-view1.png --prompt-file scripts/prompts/<name>-parts-v3.txt --name <name>-parts-v3 --budget 9`

   Reference the locked Tinbot sheet, never text alone: describing the style
   from scratch failed three rounds running, and the reference lands it in one.
   State the part count explicitly ("exactly seven separate pieces") or you get
   three arms and one leg.

2. **Extract.** `scripts/extract-parts.py` — background is "the region connected
   to the edge", not "close to the background colour", or white paint in the art
   becomes a hole.

3. **Check the template.** Re-measure the ratios above. If a part is outside
   ±15%, regenerate that sheet rather than adding a constant to the rig — a
   constant is how this problem was created.

4. **Check the silhouette and the pivots.** `scripts/silhouette-test.py`,
   `scripts/rig-preview.py`, then `tools/screenshot.mjs` for the real screen.
