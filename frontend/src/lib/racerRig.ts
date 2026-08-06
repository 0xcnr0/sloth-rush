/**
 * Code-native racer rig — seven parts, driven entirely from game state.
 *
 * No animation editor, no runtime dependency. The whole thing is drawImage plus
 * rotate, which is why it costs 112KB of art and nothing else. This replaced the
 * plan to buy into Rive: that decision compared Rive against Lottie and never
 * against plain canvas, and for eight rigid parts turning on their pivots there
 * is nothing for a skeletal animation system to do.
 *
 * Every constant here was chosen by eye on live sliders and then written down,
 * not guessed. The mirror of this file is scripts/rig-preview.py, which renders
 * the same numbers to a strip so pivots can be checked without a browser.
 */

import { THEME } from '../config/theme'

const PART_NAMES = ['torso', 'head', 'arm', 'leg', 'key'] as const
type PartName = (typeof PART_NAMES)[number]

/**
 * Geometry is in the ORIGINAL part-sprite pixel space; the shipped PNGs are at
 * 50%, hence the ×2 when drawing. Keeping the numbers in source space means the
 * art can be re-exported at another resolution without touching the rig.
 */
/**
 * Rig geometry, per archetype.
 *
 * The first version hardcoded Tinbot's numbers and every archetype drew with
 * them, which left Jetster's cone head floating over a torso twice as tall as
 * the anchors expected. ART_DIRECTION §12 wants one rig and four skins, but that
 * only holds if the art is drawn to a shared part architecture — these sheets
 * are not, so the geometry is derived from each sheet's own part sizes instead.
 *
 * Sizes are in SHIPPED pixels (the PNGs are exported at 50% of the source
 * sheet), so everything below is measured from the files rather than guessed.
 */
interface Geometry {
  /** Torso size, which everything else is positioned against. */
  torso: [number, number]
  /** Per-part scale, to keep limbs in proportion to the torso. */
  scale: Record<Exclude<PartName, 'torso'>, number>
  /** Neck attachment as a fraction of torso width/height. */
  neck: [number, number]
  /** Shoulder and hip height as a fraction of torso height. */
  shoulderY: number
  hipY: number
  /** How far shoulders and hips sit from the torso centre, as a fraction of width. */
  armSpread: number
  legSpread: number
  /** Winding key attachment, as a fraction of torso width/height. */
  key: [number, number]
  keyScale: number
  /** Total rig height in the same pixel space, used to scale to the lane. */
  height: number
}

const GEOMETRY: Record<string, Geometry> = {
  // Boxy robot: wide flat torso, square head sitting straight on top.
  tinbot: {
    torso: [162, 172],
    scale: { head: 0.95, arm: 0.42, leg: 0.46, key: 0.75 },
    neck: [0.46, 0.0], shoulderY: 0.2, hipY: 0.95,
    armSpread: 0.2, legSpread: 0.14,
    key: [1.3, 0.35], keyScale: 0.75, height: 330,
  },
  // Rocket: tall narrow capsule, wide cone head, blade limbs.
  jetster: {
    torso: [138, 284],
    scale: { head: 0.8, arm: 0.5, leg: 0.4, key: 0.7 },
    neck: [0.55, 0.06], shoulderY: 0.2, hipY: 0.95,
    armSpread: 0.46, legSpread: 0.18,
    key: [1.2, 0.4], keyScale: 0.7, height: 420,
  },
  // Duck: round head and fat egg body, short webbed legs.
  waddler: {
    torso: [198, 176],
    scale: { head: 0.9, arm: 0.55, leg: 0.8, key: 0.75 },
    neck: [0.46, 0.0], shoulderY: 0.22, hipY: 0.94,
    armSpread: 0.42, legSpread: 0.16,
    key: [1.2, 0.34], keyScale: 0.75, height: 380,
  },
  // Dinosaur: long snout, spined body, thick legs.
  chomper: {
    torso: [214, 172],
    scale: { head: 0.9, arm: 0.52, leg: 0.85, key: 0.75 },
    neck: [0.44, 0.02], shoulderY: 0.2, hipY: 0.94,
    armSpread: 0.4, legSpread: 0.16,
    key: [1.18, 0.32], keyScale: 0.75, height: 380,
  },
}

export interface RacerRig {
  ready: boolean
  images: Partial<Record<PartName, HTMLImageElement>>
  geo: Geometry
}

/**
 * Art folders are keyed by archetype CODE, not by display name — `tank`, not
 * "Tinbot" — so a rebrand renames labels in theme.ts and leaves this alone.
 */
const ART_FOLDER: Record<string, string> = {
  speedster: 'jetster',
  tank: 'tinbot',
  trickster: 'waddler',
  burst: 'chomper',
}

export function loadRacerRig(archetype = 'tank'): RacerRig {
  const folder = ART_FOLDER[archetype] ?? ART_FOLDER.tank
  const rig: RacerRig = { ready: false, images: {}, geo: GEOMETRY[folder] ?? GEOMETRY.tinbot }
  let pending = PART_NAMES.length
  for (const name of PART_NAMES) {
    const img = new Image()
    img.onload = () => {
      rig.images[name] = img
      if (--pending === 0) rig.ready = true
    }
    img.src = `${THEME.art.basePath}${folder}/${name}.png`
  }
  return rig
}

/** One rig per archetype, loaded once and shared across every racer using it. */
const cache = new Map<string, RacerRig>()
export function rigFor(archetype: string): RacerRig {
  let rig = cache.get(archetype)
  if (!rig) {
    rig = loadRacerRig(archetype)
    cache.set(archetype, rig)
  }
  return rig
}

/**
 * The source art faces left; the track runs left to right. Declared once so a
 * future archetype drawn facing right only changes this line.
 *
 * The head is exempt: it is drawn three-quarters turned, and mirroring the whole
 * character reversed that turn so it looked backwards down the track. Counter-
 * flipping it about its own pivot keeps the neck attachment in place.
 */
const ART_FACING = -1
const COUNTER_FLIP = new Set<PartName>(['head'])

/**
 * Rarity as a material layer, per ART_DIRECTION §6.
 *
 * Rarity changes the SURFACE, never the form — that separation is the whole
 * point: evolution is how big you grew, rarity is how well kept you are, and a
 * player who confuses them has lost both. It is also the only thing rarity does,
 * since it grants no stats (CLAUDE.md), so if it is invisible it does not exist.
 *
 * §6 assumes Rive material layers over sixteen assets. Drawing in canvas instead,
 * the equivalent is a filter over the same seven parts — same economy, no extra
 * art. These are TINT approximations of the material ladder, not real PBR: at
 * 48-64px what survives is the shift in saturation and warmth, which is exactly
 * what separates dull tin from chrome from gold leaf at that size. A card view
 * showing one racer large deserves the real treatment.
 *
 * Codes stay theme-neutral (common…legendary); Fair→Mint are labels in theme.ts.
 */
/** Bots: the lowest rarity's surface. Never below ~0.4 saturation. */
const BOT_FILTER = 'saturate(0.55) brightness(0.94) sepia(0.16)'

const RARITY_FILTER: Record<string, string> = {
  // Dull scratched tin: desaturated, slightly darker, a touch of age.
  common: 'saturate(0.55) brightness(0.94) sepia(0.16)',
  // Flat matte paint — the baseline the art was drawn at.
  uncommon: '',
  // Glossy lacquer: richer colour, brighter, crisper.
  rare: 'saturate(1.28) brightness(1.07) contrast(1.06)',
  // Chrome plating: colour drains toward metal, contrast climbs.
  epic: 'saturate(0.28) brightness(1.2) contrast(1.18)',
  // Gold leaf: warm, rich and the brightest of the ladder.
  legendary: 'sepia(0.42) saturate(1.7) brightness(1.14) hue-rotate(-12deg)',
}

/** Sheet metal is thin but not invisible; letting the scale reach zero reads as a flicker. */
const KEY_MIN_EDGE = 0.09

/** Walk cycle, from WIND_UP_PHASE §3's stance/swing split. */
const SWING_MAX = 24
const LEG_LEN = 155
const STEP = 2 * LEG_LEN * Math.sin((SWING_MAX * Math.PI) / 180)
/** Height the stride was measured against; cadence scales from it. */
const REF_HEIGHT = 400

/**
 * Stance sweeps the leg linearly so the planted foot tracks the ground, then
 * swings it back quickly. A plain sine here makes the character moonwalk: the
 * feet slide because nothing ties their speed to the body's.
 */
function legAngle(phase: number): number {
  const t = ((phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
  if (t < Math.PI) return SWING_MAX * (1 - 2 * (t / Math.PI))
  return -SWING_MAX * Math.cos(t - Math.PI)
}

/** Cadence derived from ground speed, so stride length and distance agree. */
export function cadence(speedPx: number, heightPx: number): number {
  const stepPx = STEP * (heightPx / REF_HEIGHT)
  return stepPx > 0 ? (Math.PI * Math.abs(speedPx)) / stepPx : 0
}

function part(
  ctx: CanvasRenderingContext2D,
  rig: RacerRig,
  name: Exclude<PartName, 'torso'>,
  ax: number,
  ay: number,
  deg: number,
): void {
  const im = rig.images[name]
  if (!im) return
  const k = rig.geo.scale[name]
  // Pivots are expressed against the part's own size, so a wider head or a
  // longer leg lands on the same joint without a new constant.
  const px = name === 'head' ? im.width * k * 0.5 : im.width * k * 0.5
  const py = name === 'head' ? im.height * k * 0.94 : im.height * k * 0.12
  ctx.save()
  ctx.translate(ax, ay)
  if (COUNTER_FLIP.has(name)) ctx.scale(-1, 1)
  ctx.rotate((deg * Math.PI) / 180)
  ctx.drawImage(im, -px, -py, im.width * k, im.height * k)
  ctx.restore()
}

/**
 * The key turns on a horizontal shaft, so the wings sweep over the top and under
 * the bottom — the motion your hand makes winding a toy. On screen that is a
 * VERTICAL squash. Rotating the sprite in the screen plane instead sends it
 * orbiting the torso like a clock hand, and squashing horizontally gives a
 * wobble about a vertical axis. Both were built and rejected against the real
 * thing. Negative scale handles the back face on its own.
 */
function drawKey(ctx: CanvasRenderingContext2D, rig: RacerRig, angleDeg: number): void {
  const im = rig.images.key
  if (!im) return
  const g = rig.geo
  const k = g.keyScale
  const c = Math.cos((angleDeg * Math.PI) / 180)
  const squash = Math.sign(c || 1) * Math.max(KEY_MIN_EDGE, Math.abs(c))
  ctx.save()
  ctx.translate(g.torso[0] * g.key[0], g.torso[1] * g.key[1])
  ctx.scale(1, squash)
  ctx.drawImage(im, -im.width * k * 0.25, -im.height * k * 0.5, im.width * k, im.height * k)
  ctx.restore()
}

export interface DrawOptions {
  /** Feet position on the canvas. */
  x: number
  y: number
  /** Full height in canvas pixels — 48-64 at race scale. */
  height: number
  /** Walk-cycle phase in radians. */
  phase: number
  /** Winding-key angle in degrees; drive it from stamina. */
  keyAngle: number
  /** +1 travelling right, -1 travelling left. */
  facing?: number
  /** Desaturate and skip the accent — bots read grey (ART_DIRECTION §10). */
  dimmed?: boolean
  /** Rarity CODE (common…legendary). Drives the surface treatment only. */
  rarity?: string
}

export function drawRacer(ctx: CanvasRenderingContext2D, rig: RacerRig, o: DrawOptions): void {
  if (!rig.ready) return
  const g = rig.geo
  const facing = o.facing ?? 1
  const k = o.height / g.height
  const swing = Math.sin(o.phase)
  const [tw, th] = g.torso

  ctx.save()
  // Bots read as LESS PAINTED than a player's racer, not as greyscale. This was
  // saturate(0.15), written for a field that is mostly real players. Bots fill
  // every empty slot, so a solo race is three quarters bots — and at 0.15 that
  // meant three quarters of the screen had no colour in it at all. The portraits
  // work because each toy owns a saturated colour; the race screen was
  // suppressing exactly that, on most of the cast, every time.
  const filter = o.dimmed ? BOT_FILTER : RARITY_FILTER[o.rarity ?? ''] ?? ''
  if (filter) ctx.filter = filter
  ctx.translate(o.x, o.y)
  // Lean into the direction of travel, applied OUTSIDE the mirror so the body
  // always tips forwards rather than back.
  ctx.rotate((facing * 4 * Math.PI) / 180)
  ctx.scale(k * facing * ART_FACING, k)
  // Origin at the torso's top-left, with the feet landing on y = 0.
  ctx.translate(-tw / 2, -th * g.hipY - g.scale.leg * (rig.images.leg?.height ?? 0))
  ctx.translate(0, -Math.abs(swing) * th * 0.05)

  const shoulderY = th * g.shoulderY
  const hipY = th * g.hipY
  const armX = tw * g.armSpread
  const legX = tw * g.legSpread

  part(ctx, rig, 'leg', tw / 2 - legX, hipY, legAngle(o.phase + Math.PI))
  part(ctx, rig, 'arm', tw / 2 - armX, shoulderY, -swing * 22)

  drawKey(ctx, rig, o.keyAngle)

  const torso = rig.images.torso
  if (torso) ctx.drawImage(torso, 0, 0, tw, th)

  part(ctx, rig, 'head', tw * g.neck[0], th * g.neck[1], swing * 3)
  part(ctx, rig, 'leg', tw / 2 + legX, hipY, legAngle(o.phase))
  part(ctx, rig, 'arm', tw / 2 + armX, shoulderY, swing * 22)
  ctx.restore()
}
