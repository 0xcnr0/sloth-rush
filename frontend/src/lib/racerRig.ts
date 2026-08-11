/**
 * Code-native racer rig — seven parts, driven entirely from game state.
 *
 * No animation editor, no runtime dependency. The whole thing is drawImage plus
 * rotate, which is why it costs 112KB of art and nothing else. This replaced the
 * plan to buy into Rive: that decision compared Rive against Lottie and never
 * against plain canvas, and for eight rigid parts turning on their pivots there
 * is nothing for a skeletal animation system to do.
 *
 * The proportions were chosen by eye on live sliders and then written down, not
 * guessed. Everything that varies between archetypes is measured off the part
 * PNGs instead — see `measure` — because the per-archetype table that used to
 * live here is the thing docs/PART_TEMPLATE.md was written to end.
 */

import { THEME } from '../config/theme'

const PART_NAMES = ['torso', 'head', 'arm', 'leg', 'key'] as const
type PartName = (typeof PART_NAMES)[number]

/**
 * Proportions shared by every archetype — ART_DIRECTION §12's one rig, four
 * skins, finally spelled as one set of numbers.
 *
 * There used to be a table here instead: eleven constants per archetype, five
 * archetypes, every one of them picked by eye. docs/PART_TEMPLATE.md exists
 * because that table was the symptom. The four sheets had been drawn to four
 * different part architectures — the leg-to-torso ratio ranged from 0.56 to
 * 1.46 across toys meant to share a skeleton — so the rig was patching over the
 * art, and each new sheet earned itself a new column. Three sheets have now
 * been redrawn to the template, so the rig can carry ratios and read the rest
 * off the files.
 *
 * The numbers are Tinbot's, because Tinbot is the sheet the rig was built from
 * and the one the owner says looks right.
 */
const SCALE: Record<Exclude<PartName, 'torso'>, number> = {
  head: 0.95,
  arm: 0.42,
  leg: 0.46,
  key: 0.75,
}
/** Neck attachment as a fraction of torso width/height. */
const NECK: [number, number] = [0.46, 0.0]
/** Shoulder and hip height as a fraction of torso height. */
const SHOULDER_Y = 0.2
const HIP_Y = 0.95
/**
 * Winding key attachment, as a fraction of torso width/height.
 *
 * The x fraction is 1.0, and that is not laziness — the key is literally the
 * same 59px sprite in all five folders at nearly the same scale, so "tuck the
 * shaft into the side of the body" resolves to the same number every time. It
 * was 1.18-1.3, which put the key's left edge 17 to 37 pixels PAST the torso's
 * right edge: the key hung in mid-air beside every toy, on every screen, and
 * the shaft it is drawn before the torso to hide never touched anything. At
 * race scale it read as a speck; at the 128-220px the landing and mint pages
 * now draw, it read as broken. 1.0 sinks the left ~11px of the key behind the
 * body, which is the join the art was drawn for.
 */
const KEY: [number, number] = [1.0, 0.35]

/**
 * The part of the geometry that is measured rather than chosen, taken off the
 * shipped PNGs once the images land.
 */
interface Geometry {
  /** Torso size, which everything else is positioned against. */
  torso: [number, number]
  /** How far shoulders and hips sit from the torso centre, as a fraction of width. */
  armSpread: number
  legSpread: number
  /** Feet to crown in the same pixel space, used to scale to the lane. */
  height: number
}

/**
 * Both spreads follow from the limb's own width, so a wider wing or a thinner
 * fin lands correctly without anyone touching this file.
 *
 * Hips are one leg-width apart, which puts the two legs' inner edges on the
 * centre line — the narrow stance that was chosen on live sliders in the first
 * place. The rule reproduces all four hand-picked values to within 0.005,
 * except Jetster's 0.18 where it says 0.162.
 *
 * Shoulders sit so the arm hangs flush with the flank. That rule agrees with
 * the values picked by eye for the rocket, the duck and the dinosaur; the one
 * it disagrees with is Tinbot's 0.2, which tucked the arm so far in that the
 * hand landed in the middle of the chest, over the gauge panel. At 48-64px an
 * arm that never reaches the silhouette contributes nothing to §10's "which one
 * is mine", and at portrait size it reads as a smear across the paintwork.
 */
function measure(images: Record<PartName, HTMLImageElement>): Geometry {
  const tw = images.torso.width
  const th = images.torso.height
  return {
    torso: [tw, th],
    // The arm's outer edge sits a little PAST the torso's, not flush with it.
    // Flush is what the derived rule first produced, and the arithmetic is
    // exact: on Jetster it put the fin's outer edge at 55.5 against a torso
    // edge of 55.5, so the near fin was a strip painted onto the capsule and
    // the far one was entirely behind it. Every portrait screen draws at rest,
    // so the rocket was finless everywhere except mid-stride — and CLAUDE.md's
    // locked table defines Jetster as a rocket with three fins. A third of an
    // arm-width of daylight is enough to read at 48px and still keeps Tinbot's
    // hand off the gauge panel, which is what flush was fixing.
    armSpread: 0.5 - (images.arm.width * SCALE.arm * 0.15) / tw,
    legSpread: (images.leg.width * SCALE.leg) / (2 * tw),
    // Where drawRacer actually puts the feet and the crown, rather than a
    // number typed next to them. The four constants this replaces were between
    // 6% short and 13% long, so a Tinbot came out a fifth taller than a Waddler
    // asked for at the same size — on the race track, side by side.
    height: th * (HIP_Y - NECK[1])
      + SCALE.leg * images.leg.height
      + 0.94 * SCALE.head * images.head.height,
  }
}

export interface RacerRig {
  ready: boolean
  images: Partial<Record<PartName, HTMLImageElement>>
  /** Measured once the parts are in; nothing draws before then. */
  geo: Geometry | null
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
  // A racer with no archetype yet. Every Wind-Up starts here and stays until
  // racing pushes it over the first tier, where the stat it built decides what
  // it becomes. It used to fall through to the Tinbot art, so every new
  // player's toy was a Tinbot — and in a race that already contained one, two
  // of the four toys on screen were identical.
  windup: 'windup',
}

export function loadRacerRig(archetype = 'windup'): RacerRig {
  const folder = ART_FOLDER[archetype] ?? ART_FOLDER.windup
  const rig: RacerRig = { ready: false, images: {}, geo: null }
  let pending = PART_NAMES.length
  for (const name of PART_NAMES) {
    const img = new Image()
    img.onload = () => {
      rig.images[name] = img
      if (--pending > 0) return
      rig.geo = measure(rig.images as Record<PartName, HTMLImageElement>)
      rig.ready = true
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

/** Walk cycle, stance and swing split. */
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
  const k = SCALE[name]
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
  if (!im || !rig.geo) return
  const [tw, th] = rig.geo.torso
  const k = SCALE.key
  const c = Math.cos((angleDeg * Math.PI) / 180)
  const squash = Math.sign(c || 1) * Math.max(KEY_MIN_EDGE, Math.abs(c))
  ctx.save()
  ctx.translate(tw * KEY[0], th * KEY[1])
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
  if (!rig.ready || !rig.geo) return
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
  ctx.translate(-tw / 2, -th * HIP_Y - SCALE.leg * (rig.images.leg?.height ?? 0))
  ctx.translate(0, -Math.abs(swing) * th * 0.05)

  const shoulderY = th * SHOULDER_Y
  const hipY = th * HIP_Y
  const armX = tw * g.armSpread
  const legX = tw * g.legSpread

  part(ctx, rig, 'leg', tw / 2 - legX, hipY, legAngle(o.phase + Math.PI))
  part(ctx, rig, 'arm', tw / 2 - armX, shoulderY, -swing * 22)

  drawKey(ctx, rig, o.keyAngle)

  const torso = rig.images.torso
  if (torso) ctx.drawImage(torso, 0, 0, tw, th)

  part(ctx, rig, 'head', tw * NECK[0], th * NECK[1], swing * 3)
  part(ctx, rig, 'leg', tw / 2 + legX, hipY, legAngle(o.phase))
  part(ctx, rig, 'arm', tw / 2 + armX, shoulderY, swing * 22)
  ctx.restore()
}
