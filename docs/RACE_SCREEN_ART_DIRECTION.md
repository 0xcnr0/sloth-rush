# RACE SCREEN ART DIRECTION — Diagnosis, Direction, Asset Plan

**Status:** proposal, awaiting approval to generate
**Scope:** `RaceBroadcast.tsx` — the live race canvas and the pre-race "RACERS TO
THE STAGE!" panel. Does not touch the four racer archetypes, which are approved
and out of scope ("robotlarımız iyi, onlara lafım yok").
**Reads with:** [ART_DIRECTION.md](ART_DIRECTION.md) §5 (palette), §7 (render
technique), §8 (diorama environment), §10 (readability)

---

## 1. Diagnosis

I went looking for a taste problem and found a measurement bug. The core
complaint — "size, look, proportions, absurd disproportion" — is one specific,
fixable thing, plus a rendering-technique gap that no amount of proportion
tuning will close on its own.

### 1.1 The floor is not the floor. The sky is.

Read `RaceBroadcast.tsx` lines 221–239. Per lane, two rectangles are drawn:

```
fillRect(SIDE_MARGIN, top,    TRACK_WIDTH, LANE_HEIGHT)              // wall — FULL lane height
fillRect(SIDE_MARGIN, ground, TRACK_WIDTH, LANE_HEIGHT * 0.17)       // floor — bottom 17% only
```

`ground` sits at 83% down the lane (`GROUND_AT = 1 - SHELF_SHARE`, `SHELF_SHARE
= 0.17`). The racer's feet are drawn exactly on `ground`. That means: the
racer's entire body, from feet to head, stands in front of `wall` — the pale
sky-blue #C9DFF5. The warm floor colour, `#E8C99B`, only exists in a thin strip
*below* the racer's own feet, mostly hidden under the sprite and the shelf-edge
line. In the four screenshots, every toy is functionally standing in open air.
The "floor" is there in the code, but it never appears next to a toy — it
appears *under* one, where you can't see it.

This is not a taste call, it's an inverted ratio. ART_DIRECTION §8.1 names the
zemin (floor) as the surface the racer runs on and the wall as what's *behind*
it — the code has that backwards in proportion: 100% wall, 17% floor, instead
of a short wall band behind a dominant floor deck.

### 1.2 Fixing proportions didn't fix the complaint, which tells us something

`track-fix.png` is the file where lane sizing was already corrected — the code
comments confirm it (`RACER_HEIGHT` is now derived from `LANE_HEIGHT`, not
clamped against a fixed 60px ceiling). The owner rejected it anyway, "in
spirit." That's the tell: the toy-to-lane size ratio is not the thing that's
broken. What's broken is what's *around* the correctly-sized toy — 83% of
empty flat colour above its head, a colour that is the same hex as the page
background outside the track, so the track doesn't even read as a distinct
object. It's a paler rectangle sitting in a paler page.

### 1.3 A drawn object standing on a diagram

Every racer part is hand-illustrated: thick `#241A38` ink outline, flat
saturated toon fill, a soft gloss ellipse, rounded silhouette (ART_DIRECTION
§7). Every lane surface is `ctx.fillRect` — flat, unshaded, no outline, no
grain, no depth, no light. Pairing the two isn't a clash between two styles;
it's a clash between a style and the *absence* of one. A richly painted
toy standing on a spreadsheet row will look pasted-in at any size, because
there is nothing else in the frame operating at the same level of drawn
detail for the eye to relate it to. This is exactly the "boxes in the
background don't solve anything" verdict on `room4.png` — that asset added
illustration *behind the page chrome*, nowhere near the lane surface the toy
actually stands on, so it didn't touch the thing that reads wrong.

### 1.4 No contact, no weight

Nothing is drawn under the racer's feet. No shadow, no highlight, no
compression of the floor colour at the contact point. Every reference the art
bible cites for this render style — Stumble Guys, Turbo FAST, Fall Guys —
grounds its characters with a soft shadow ellipse. Its absence here is a small
thing that reads as a big thing: the toy looks like a sticker, not an object
with weight standing on a shelf.

### 1.5 "Four stacked shelves" isn't visible anywhere

ART_DIRECTION §8 calls the track "a model train diorama" — four physical
shelves stacked vertically. Nothing in the current render shows shelf
*thickness*. The divider between lanes is a 1.5px ink line and a 4px darker
strip. There's no board depth, no cast shadow from the shelf above onto the
shelf below. It reads as four rows in a table, not four compartments in a
display case.

### 1.6 Three-quarters of the frame is already grey, and it's landing on a
colourless floor

ART_DIRECTION §10 desaturates bots to `saturate(0.15)` so they "read as
scenery." In a solo race that's 3 of 4 lanes. Combined with §1.1 — a lane
whose visible surface is pale, low-saturation blue — the frame ends up with
almost no colour in it at all except one racer's accent stripe. The portraits
in `light3.png` work because each toy owns a saturated primary colour against
a neutral paper card. The race screen suppresses exactly the thing that made
the portraits work, on three-quarters of the cast, on a surface that was
already colourless before the desaturation was even applied.

### 1.7 The finish line is a sidebar, not a finish line

The chequered column (lines 274–285) is an 8px-square flat pattern with the
word "FINISH" in 10px sans-serif above it. It carries no depth, no relation to
the lanes' left-to-right run, no sense of a line the racers cross — it reads
as a decorative stripe of wallpaper at the edge of the canvas, not a finish
gate.

### 1.8 The pre-race screen and the race screen don't agree on what game
this is

`see2.png` ("RACERS TO THE STAGE!") is a plain white card: portrait grid,
name, `P1`–`P4`, a speech-bubble chip. It's closer to the toybox language
(`toy-panel`, clean paper card) than the race screen is. Then the race starts
and the visual language changes completely — flat coloured bands, a different
typographic voice, a different sense of "place." There's no shared shelf, no
carried-over lane colour coding (the pre-race grid doesn't show the
red/blue/yellow/green stripes the live track and standings cards use one
screen later). It reads as two different apps stitched at the transition.

### 1.9 Left-over Taktik Mode chrome is adding noise the eye has to filter out

`RaceBroadcast.tsx` still renders a "Events" kill-feed panel, floating speech
bubbles, and canvas colour flashes keyed to `tactic_boost` / `tactic_projectile`
events, and a post-race MVP award ("Tank") built from hit counts. CLAUDE.md
hard-locks Taktik Mode out of V1 — the server rejects these formats with a
400. None of this can fire in a real V1 race, but the UI still carries the
plumbing and, worse, the *visual weight*: a mustard toast, a near-black toast,
a right-side feed panel, floating emoji, all competing with the track for
attention on a screen that's already fighting a contrast problem. This is
covered in §5 (What to cut) but I'm noting it here because it is measurably
part of why the screen feels busy and ungoverned, not just visually
mismatched.

---

## 2. Direction

**Keep the drawing style. Keep the palette. Apply the style to the track for
the first time — it currently isn't applied there at all.**

The toys are illustrated in a specific, proven technique (§7: thick ink
outline, flat saturated toon, soft single highlight). The track is not
illustrated in any technique — it's unstyled `fillRect`. That is the actual
gap, and it's not closed by changing what the toys look like, or by picking a
new palette. `wall` / `floor` / `shelf` / `ink` / `paper` already read
correctly on the toybox screen (`light3.png`) — the palette isn't the
problem, its *application ratio* on the race screen is (§1.1).

**The concept: each lane is one compartment of a toy display case, painted in
the same hand-drawn technique as the racers, and it becomes the actual canvas
background — not page wallpaper behind the UI, not a decorative image near
the track. It IS the lane.**

Concretely: the `fillRect` calls that currently paint `wall` then a sliver of
`floor` are replaced by a single illustrated image, drawn under the racer with
`drawImage`, stretched into each lane's rectangle. The image itself carries
what code currently can't cheaply fake: a short back-wall band, a floor deck
that dominates the frame, plank grain, a lit front lip with a cast shadow, and
— because the four lanes stack with zero gap — a dark undershelf edge at its
own bottom pixel row that meets the next copy's wall band directly above it,
so four copies stacked read as four physical shelves without any extra
divider being drawn.

This also directly answers §1.8: once the lane art exists, the pre-race
"stage" doesn't need its own screen design. Put the four racers at position 0
on the same illustrated lanes, idle-animating (key still turning, per
ART_DIRECTION §7.2), with their trash-talk bubbles anchored above them. The
first frame the player sees *is* the first frame of the race. One visual
language, one component, no seam to cross when the flag drops. This is a
bigger ask of engineering than a pure art delivery — flag it to
`ui-programmer` — but it is the direction, not a nice-to-have, because it's
the only fix for §1.8 that doesn't mean designing and maintaining a second
environment.

**On bot desaturation (§1.6):** don't invent a separate "bot grey." The art
bible already has a material for "not painted up" — `common`/Fair, "donuk
tin, çizik" (§6), currently `saturate(0.55) brightness(0.94) sepia(0.16)` in
`RARITY_FILTER`. The bot filter today is harsher than even the lowest rarity
tier — `saturate(0.15) brightness(1.1)`, which drains almost all colour. My
recommendation: bots render at the `common` material, not a bespoke dimmer.
Narratively this is free — a bot is showroom stock nobody's painted up yet,
which is exactly what Fair already means. It keeps three-quarters of the cast
visibly toy-coloured instead of ghost-grey, and it's one constant change in
`racerRig.ts`, not new art.

**On the missing "which one is mine" cue (§1.5/§10 rule 1):** this is written
in ART_DIRECTION §10 already and was never built. Add it as part of this
pass — it's a code change, not an asset, and it's cheap: a soft accent-colour
glow behind the player's own sprite, and a small solid marker above their
rank badge. Numbers in §4.

I'm not proposing new hex values, a new outline weight, or a new rarity
system. The direction is: build the one illustrated layer the track has never
had, using the technique and palette that are already locked and already
proven on every other screen.

---

## 3. Asset list

Ordered by impact. Generate and check #1 in isolation before touching
anything else — it's the one that fixes §1.1, §1.3, §1.4 and §1.5 by itself.

All prompts follow the pattern that has actually worked on this project
(CLAUDE.md "Sanat hattı", and `scripts/prompts/room-bg.txt`, which shipped):
plain descriptive prose, explicit positive framing ("the top 20% is—"), no
bracketed `[NEGATIVE]` block, constraints stated as flat declarative sentences
either inline or as a closing "no X, no Y" sentence — that pattern is what
produced a background with zero stray characters on the first try. All prompts
below are under the 800-character limit `scripts/meshy.ts` enforces.

### 3.1 P0 — `env_lanedeck_wood_wide.png`

**Aspect:** `16:9` (nearest standard ratio to the target; the actual usage is
much wider and shorter than that — see §4 — so the developer stretches this
asset to fill each lane's rectangle exactly as the current `fillRect` calls
do. It's a single wide illustration, not a seamless tile: the content is
abstract enough — grain lines, a flat wall band — that a horizontal/vertical
stretch to an arbitrary lane size will not read as distortion the way it
would on a character.)

**Used as:** canvas background layer. Replaces `RaceBroadcast.tsx` lines
231–239 (the `wall`/`wallAlt`/`floor`/`floorEdge`/grain-stroke block). Drawn
with `ctx.drawImage(img, SIDE_MARGIN, top, TRACK_WIDTH, LANE_HEIGHT)`, once
per lane, 4× per frame — same image reused for all four lanes. For cheap
variety without a second asset: mirror odd lanes horizontally
(`ctx.scale(-1,1)`) or drop lane brightness by ~5% on alternating lanes,
reusing the existing `i % 2` idea that currently picks between `wall` and
`wallAlt`.

**Prompt:**
```
A single horizontal compartment from a toy display shelf, seen side-on and
at eye level, empty, ready for one toy to stand in it. Very wide, short
letterbox composition, like one shallow drawer of a collector's cabinet,
no perspective distortion, straight-on.

The bottom 80% of the frame is a warm honey-coloured wood floor deck
running the full width, plank seams running horizontal left to right, a few
long faint grain lines, and one darker wood strip along the very front
bottom edge like a raised lip, casting a short soft shadow onto the deck
above it.

The top 20% of the frame is a plain flat light sky-blue back wall, no
window, no pattern, meeting the wood in a clean horizontal seam.

A thick dark navy-purple ink outline, about 4 pixels wide, runs along the
wall-to-floor seam and along the front lip edge, the way a printed toy
package is outlined. Flat saturated toon colour throughout, no photo
texture, no ambient gradient except the one soft shadow at the lip. One
soft directionless highlight brightens the upper wood area slightly.

The very bottom edge of the image, the last few pixels, is a solid dark
ink board-edge with no gap, as if this is the underside of the shelf.

No characters, no robots, no toys, no animals, no keys, no hands, no
faces, no text, no letters, no numbers, no logo, no other props.
```

**Iteration plan:** 2–3 rounds on `nano-banana` (3 credits each) to lock the
wall/floor ratio and lip readability, then one `nano-banana-pro` pass (9
credits) to lock the production asset. Budget ceiling: `--budget 30`.

### 3.2 P1 — `env_finishflag_check_tall.png`

**Aspect:** `9:16`

**Used as:** replaces the flat chequerboard loop and "FINISH" text label,
`RaceBroadcast.tsx` lines 274–285. Drawn once per frame at the right edge of
the track, stretched to `(checkerX, TOP_MARGIN - 6, ~30, TRACK_HEIGHT + 6)` —
wide enough to read as hanging fabric rather than a thin stripe (see §4 for
the exact width).

**Prompt:**
```
A single tall checkered finish-line flag banner for a toy race track, seen
straight-on, isolated for cutout use. A narrow strip of black-and-cream
checkerboard fabric bunting, hanging straight down the full height of the
frame like a pennant curtain. The checker squares are small and even. The
fabric is mostly flat with a gentle ripple only at the very left and right
edges.

At the very top, a short thick dark ink wood dowel rod the bunting hangs
from, spanning the full width, capped at each end by a small round wooden
toy finial painted cream.

Flat saturated toon colour, a thick dark navy-purple ink outline about 4
pixels wide around the dowel and the outer silhouette of the bunting, no
photo texture, no gradient shading except one soft highlight along the top
of the dowel.

Plain flat cream background behind the bunting, no shadow cast onto the
background, no ground, no floor, no wall.

No characters, no robots, no toys, no animals, no hands, no faces, no
text, no letters, no numbers, no logo.
```

**Iteration plan:** same as 3.1. Budget ceiling: `--budget 24`.

### 3.3 P2 — `ui_frame_showcase_9slice.png` (optional, do only after 3.1 and 3.2 are in-engine and approved)

**Aspect:** `1:1` (a single corner; a 9-slice needs corner + edge pieces, so
this is really a small family, not one file — scope it properly with
`technical-artist` before spending credits here)

**Used as:** CSS `border-image` / 9-slice frame around the whole track
container, replacing the plain `toy-panel`-style `border` + hard-offset
shadow currently wrapping the canvas. Purpose: make the *container* read as a
display case, not just its contents — reinforces §1.5 at the screen-furniture
level. This is polish, not a fix for the core complaint; cut it if time is
short. I'd rather ship 3.1 and 3.2 and re-look at whether the container still
needs help than spend credits on this speculatively.

I'm not writing this prompt yet — it depends on what the case actually needs
once 3.1 is sitting inside a plain `toy-panel` border and can be judged
in-engine.

### 3.4 Explicitly not proposing right now

- A second lane-deck variant for "visual variety" — the mirror/brightness
  trick in 3.1 covers this at zero cost; only revisit if it still looks
  copy-pasted once it's in-engine.
- A dashed rail-line texture — this is two `ctx.setLineDash` calls in code,
  not an asset. Cheap, optional, cut if it clutters the floor.
- A back-wall parallax layer — see §4, marked cuttable there.
- Any second background for the pre-race screen — the direction in §2 is to
  delete that screen's separate visual identity, not give it one.

---

## 4. Composition spec

Numbers, keyed to `RaceBroadcast.tsx`'s existing constants so this is a diff,
not a rewrite.

| Constant | Current | Proposed | Why |
|---|---|---|---|
| `TOP_MARGIN` | `50` (fixed px) | `26` (fixed px) | Currently pure dead space — nothing is drawn in it except the "FINISH" label baseline at `TOP_MARGIN - 6`. The bunting's dowel cap can poke ~6px above the track box into this margin, replacing the text label. |
| `BOTTOM_MARGIN` | `50` (fixed px) | `14` (fixed px) | Nothing is drawn below the last lane at all today. This is 50px of literally empty canvas on every race. |
| `SIDE_MARGIN` | `20` | `20` (unchanged) | Holds the start line and the left edge of the lane art. Fine as-is. |
| Net effect on `TRACK_HEIGHT` | at 360px canvas: 260px | 320px (+23%) | at 520px canvas: 420px → 480px (+14%). This alone makes every lane, and therefore every toy, bigger — with zero change to `RACER_HEIGHT`'s formula. |

**Lane internal split (baked into the art, §3.1):**

| Region | Share of `LANE_HEIGHT` | Was |
|---|---|---|
| Back wall (sky) | ~20% | ~100% (the bug in §1.1) |
| Floor deck (wood) | ~80% | ~17% |
| `GROUND_AT` (foot line) | 0.84 | 0.83 (functionally unchanged) |
| `RACER_HEIGHT` | `LANE_HEIGHT * GROUND_AT * 0.82` (unchanged formula) | same |

The sizing formula for the toy itself was never wrong — leave it. Only the
wall/floor *ratio underneath it* changes. At `GROUND_AT = 0.84` and
`RACER_HEIGHT ≈ 0.69 * LANE_HEIGHT`, the top of a racer's head lands around
`0.15 * LANE_HEIGHT` — just inside the 20% wall band, meaning the head grazes
the back wall while the rest of the body stands against the floor. That's the
correct diorama read: standing in a shallow shelf, not floating in front of
one.

**Headroom for name/rank text:** currently drawn at `top + 5` and `top + 18`
inside the wall band. Enforce a floor on the wall band itself:
`WALL_BAND = max(LANE_HEIGHT * 0.20, 24px)` so the two lines of 10px/9px text
never crowd the seam on the smallest canvas (360px → 80px lanes → 16% would
give 16px, too tight; the 24px floor fixes it).

**Contact shadow (code, no asset):** ellipse centred at `(cx, ground + 3)`,
width `RACER_HEIGHT * 0.85`, height `RACER_HEIGHT * 0.14`, radial gradient
`ink` at 20% opacity in the centre fading to 0, drawn *before* the racer
sprite each frame so the feet sit on top of it.

**Divider between lanes:** none drawn separately. The art's own bottom-edge
dark board strip (§3.1 prompt, last paragraph) meets the next copy's wall
band directly — zero gap in the stacking loop, same as today.

**Finish bunting:** drawn at `x = checkerX`, `y = TOP_MARGIN - 6`,
`width = 30`, `height = TRACK_HEIGHT + 6` (up from the current 16px-wide flat
checker pattern — 30px reads as hanging fabric, 16px reads as a border).
Replaces the `ctx.fillText('FINISH', …)` call entirely; the bunting
communicates "finish" without a text label competing with it.

**Start line:** unchanged — a 2px `ink` stroke at `SIDE_MARGIN` is enough and
needs no art. Consider dropping it to 60% opacity so it doesn't compete with
the lane art's own ink linework.

**Player emphasis (code, no asset, implements ART_DIRECTION §10 rule 1,
currently unbuilt — `playerRacerId` is captured at line 80 and never used in
the draw loop):**
- Soft radial glow in the player's archetype accent colour, 22% opacity at
  centre fading to 0, radius `RACER_HEIGHT * 0.7`, centred on the player's
  sprite, drawn before the contact shadow.
- Small solid gold downward-pointing triangle, 8px wide × 7px tall, 6px above
  the player's rank badge, y-offset animated ±2px on a slow sine so it reads
  as "pointing," not static.

**Bot material (code, no asset — §2):** change the `dimmed` branch in
`racerRig.ts`'s `drawRacer` from `saturate(0.15) brightness(1.1)` to the
existing `RARITY_FILTER.common` value, `saturate(0.55) brightness(0.94)
sepia(0.16)`. Do not go below ~0.4 saturation for bots — the point is "less
painted than the player's racer," not "greyscale."

**Camera:** none. No pan, no zoom, no scroll, for the entire race. `cx` is
already `SIDE_MARGIN + (distance / trackLength) * TRACK_WIDTH` — a straight
0%-to-100% mapping across a fixed-width canvas, and that's correct for this
format: the whole race is visible at all times, which is what makes the
photo-finish framing work. Do not build a following camera. **Cuttable
polish, only if 3.1–3.2 ship clean and there's appetite for more:** draw the
back-wall band as a second, separate `drawImage` call (a 20%-height crop of
the same asset) offset horizontally by up to `leaderProgress * 8px`, for a
whisper of parallax as the leader pulls ahead. This is genuinely optional —
mark it cut by default, don't build it speculatively.

**Pre-race staging (§2):** four racers at `distance = 0` on the same lane
art, `phase` driven by a slow idle sine (already how `RacerPortrait` does its
"still" pose — reuse that, don't invent a second idle animation), key still
turning. Trash-talk bubble anchored at `(cx + racerWidth/2, ground -
RACER_HEIGHT - 30)`, i.e. just above where the rank badge will sit once the
race starts — same anchor point, so nothing jumps when `racePhase` flips from
`trash_talk` to `racing`.

---

## 5. What to cut

1. **The `wall`/`wallAlt`/`floor`/`floorEdge`/grain-stroke `fillRect` block**
   (`RaceBroadcast.tsx` lines 231–250). Replaced wholesale by 3.1. This is
   the fix, not an addition alongside it.
2. **The 50px top margin and 50px bottom margin.** Both are dead space today.
   See §4 for the replacement values.
3. **The flat chequerboard `fillRect` loop and the `'FINISH'` text label**
   (lines 274–285). Replaced by 3.2.
4. **Taktik Mode UI wiring** (§1.9): the "Events" kill-feed panel (lines
   846–863), speech bubbles for `boost`/`projectile_hit` moments, canvas
   colour flashes for `tactic_boost`/`tactic_projectile`, and the post-race
   "Tank" MVP award built from hit counts and its "Projectile Throw hit"
   stat line. CLAUDE.md hard-locks this mode out of V1 — the server 400s
   these formats — so none of this can fire in a real race, but it's still
   rendering, still competing visually with the track, and still costing an
   engineer's attention every time this file is touched. This isn't just an
   art call; flag it to whoever owns `RaceBroadcast.tsx` next as dead
   surface area that should come out with the same pass. Keep the
   *ambient* race events that are real in V1 — `mass_slow`, `rain`,
   `luck_orb`, `collision` — just restyle their toasts (next item).
5. **Mustard/near-black solid toast styling for event banners.** Whatever
   event toasts survive item 4, restyle them as a `toy-panel`-style pill —
   paper background, ink border, hard offset shadow — so they belong to the
   same UI system as the standings cards below the track instead of looking
   like a different app's notifications.
6. **The standalone "RACERS TO THE STAGE!" card screen**, once the merged
   staging in §2/§4 is built. Keep the trash-talk copy and the per-racer
   bubble — that's good personality — just anchor it to the in-lane racer
   instead of a portrait grid on a blank card.
7. **`room-bg.webp` as page-body wallpaper behind this screen specifically.**
   It doesn't touch the track surface (§1.3) and the owner has already
   rejected it once. I'm not recommending removing it site-wide — that's a
   call for whichever other screens use it — but the race and pre-race
   screens should not rely on it for atmosphere; the lane art in §3.1 is
   doing that job now, directly on the surface that needs it.

Not touching, and don't: the four racer archetypes, the rig/pivot system in
`racerRig.ts` beyond the two named constant changes above, the rarity
material filters (reused, not altered), the standings cards below the track
(already opaque `toy-panel`, already correct per their own code comment), the
post-race stats screen's structure (only its "Tank" award is cut, per item 4).
