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
const RIG: Record<PartName, { scale: number; pivot: [number, number]; anchor?: [number, number] }> = {
  torso: { scale: 1.0, pivot: [0, 0] },
  head: { scale: 1.0, pivot: [153, 200], anchor: [140, -4] },
  arm: { scale: 0.78, pivot: [52, 30] },
  leg: { scale: 0.62, pivot: [100, 40] },
  // One piece, drawn behind the torso so the shaft reads as entering the body
  // while the wings stay clear of the silhouette.
  key: { scale: 1.5, pivot: [90, 60], anchor: [437, 101] },
}

const CENTER = 163
const ARM_SPREAD = 27
const LEG_SPREAD = 10
const SHOULDER_Y = 56
const HIP_Y = 316
const TORSO_W = 325
const FEET_Y = 630
const RIG_H = 800

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

/** Sheet metal is thin but not invisible; letting the scale reach zero reads as a flicker. */
const KEY_MIN_EDGE = 0.09

/** Walk cycle, from WIND_UP_PHASE §3's stance/swing split. */
const SWING_MAX = 24
const LEG_LEN = 501 * RIG.leg.scale
const STEP = 2 * LEG_LEN * Math.sin((SWING_MAX * Math.PI) / 180)

export interface RacerRig {
  ready: boolean
  images: Partial<Record<PartName, HTMLImageElement>>
}

export function loadRacerRig(archetype = 'tank'): RacerRig {
  const rig: RacerRig = { ready: false, images: {} }
  let pending = PART_NAMES.length
  for (const name of PART_NAMES) {
    const img = new Image()
    img.onload = () => {
      rig.images[name] = img
      if (--pending === 0) rig.ready = true
    }
    // Only Tinbot exists so far; the other three archetypes fall back to it
    // rather than rendering nothing.
    img.src = `${THEME.art.basePath}tinbot/${name}.png`
    void archetype
  }
  return rig
}

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
  const stepPx = STEP * (heightPx / RIG_H)
  return stepPx > 0 ? (Math.PI * Math.abs(speedPx)) / stepPx : 0
}

function part(
  ctx: CanvasRenderingContext2D,
  rig: RacerRig,
  name: PartName,
  ax: number,
  ay: number,
  deg: number,
): void {
  const p = RIG[name]
  const im = rig.images[name]
  if (!im) return
  ctx.save()
  ctx.translate(ax, ay)
  if (COUNTER_FLIP.has(name)) ctx.scale(-1, 1)
  ctx.rotate((deg * Math.PI) / 180)
  ctx.drawImage(im, -p.pivot[0] * p.scale, -p.pivot[1] * p.scale, im.width * 2 * p.scale, im.height * 2 * p.scale)
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
  const p = RIG.key
  const c = Math.cos((angleDeg * Math.PI) / 180)
  const squash = Math.sign(c || 1) * Math.max(KEY_MIN_EDGE, Math.abs(c))
  ctx.save()
  ctx.translate(p.anchor![0], p.anchor![1])
  ctx.scale(1, squash)
  ctx.drawImage(im, -p.pivot[0] * p.scale, -p.pivot[1] * p.scale, im.width * 2 * p.scale, im.height * 2 * p.scale)
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
}

export function drawRacer(ctx: CanvasRenderingContext2D, rig: RacerRig, o: DrawOptions): void {
  if (!rig.ready) return
  const facing = o.facing ?? 1
  const k = o.height / RIG_H
  const swing = Math.sin(o.phase)

  ctx.save()
  if (o.dimmed) ctx.filter = 'saturate(0.15) brightness(1.1)'
  ctx.translate(o.x, o.y)
  // Lean into the direction of travel, applied OUTSIDE the mirror so the body
  // always tips forwards rather than back.
  ctx.rotate((facing * 4 * Math.PI) / 180)
  ctx.scale(k * facing * ART_FACING, k)
  ctx.translate(-TORSO_W / 2, -FEET_Y)
  ctx.translate(0, -Math.abs(swing) * 10)

  part(ctx, rig, 'leg', CENTER - LEG_SPREAD, HIP_Y, legAngle(o.phase + Math.PI))
  part(ctx, rig, 'arm', CENTER - ARM_SPREAD, SHOULDER_Y, -swing * 22)

  drawKey(ctx, rig, o.keyAngle)

  const torso = rig.images.torso
  if (torso) ctx.drawImage(torso, 0, 0, torso.width * 2, torso.height * 2)

  part(ctx, rig, 'head', RIG.head.anchor![0], RIG.head.anchor![1], swing * 3)
  part(ctx, rig, 'leg', CENTER + LEG_SPREAD, HIP_Y, legAngle(o.phase))
  part(ctx, rig, 'arm', CENTER + ARM_SPREAD, SHOULDER_Y, swing * 22)
  ctx.restore()
}
