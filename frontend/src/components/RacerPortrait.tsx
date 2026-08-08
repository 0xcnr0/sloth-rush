import { useEffect, useRef } from 'react'
import { rigFor, drawRacer } from '../lib/racerRig'

/**
 * One racer, drawn still and large, with its archetype art and rarity surface.
 *
 * The same rig the race view uses, so a racer looks like itself everywhere —
 * the alternative is a portrait that flatters and a race sprite that disappoints.
 * The key keeps turning because a wind-up toy standing perfectly still reads as
 * broken, and the key is the one part that says it is wound.
 */
export default function RacerPortrait({
  archetype,
  rarity,
  height = 220,
  className,
  still = false,
  keySpeed = 5,
}: {
  archetype?: string
  rarity?: string
  height?: number
  className?: string
  /**
   * Draw one frame instead of animating. A collection grid can hold a dozen
   * racers, and a dozen independent rAF loops is a real cost for motion nobody
   * is looking at. The key still points somewhere sensible; it just stops.
   */
  still?: boolean
  /**
   * Degrees the key turns per frame. 5 is a wound toy; 0 is one that has not
   * been wound yet, which is a different thing from a broken one and the mint
   * screen needs to be able to say so.
   */
  keySpeed?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  /**
   * Wind and sway accumulate across renders, not inside the effect.
   *
   * They were locals, which was fine while nothing could change mid-animation.
   * A caller that ramps keySpeed re-runs the effect on every step, and locals
   * would reset the key to zero each time — so a key winding up to speed would
   * snap back to its starting angle three times on the way there.
   */
  const keyAngle = useRef(0)
  const breathe = useRef(0)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    let frame = 0

    const tick = () => {
      const dpr = Math.min(devicePixelRatio || 1, 3)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      keyAngle.current += keySpeed
      breathe.current += 0.03
      drawRacer(ctx, rigFor(archetype ?? 'windup'), {
        x: w / 2,
        y: h * 0.94,
        height: Math.min(height, h * 0.88),
        // A still pose, not a walk: the limbs stay put and only the key turns.
        // An unwound toy does not sway either — the sway is the spring.
        phase: keySpeed > 0 ? Math.sin(breathe.current) * 0.12 : 0,
        keyAngle: -keyAngle.current,
        rarity,
      })
      if (!still) frame = requestAnimationFrame(tick)
    }

    if (still) {
      // The art may not have arrived yet, and a still portrait has no later
      // frame to correct itself on — so retry until the rig reports ready.
      const draw = () => {
        tick()
        if (!rigFor(archetype ?? 'windup').ready) frame = requestAnimationFrame(draw)
      }
      frame = requestAnimationFrame(draw)
    } else {
      frame = requestAnimationFrame(tick)
    }
    return () => cancelAnimationFrame(frame)
  }, [archetype, rarity, height, still, keySpeed])

  return <canvas ref={ref} className={className} style={{ width: '100%', height }} />
}
