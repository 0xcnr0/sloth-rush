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
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    let frame = 0
    let key = 0
    let breathe = 0

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

      key += 5
      breathe += 0.03
      drawRacer(ctx, rigFor(archetype ?? 'tank'), {
        x: w / 2,
        y: h * 0.94,
        height: Math.min(height, h * 0.88),
        // A still pose, not a walk: the limbs stay put and only the key turns.
        phase: Math.sin(breathe) * 0.12,
        keyAngle: -key,
        rarity,
      })
      if (!still) frame = requestAnimationFrame(tick)
    }

    if (still) {
      // The art may not have arrived yet, and a still portrait has no later
      // frame to correct itself on — so retry until the rig reports ready.
      const draw = () => {
        tick()
        if (!rigFor(archetype ?? 'tank').ready) frame = requestAnimationFrame(draw)
      }
      frame = requestAnimationFrame(draw)
    } else {
      frame = requestAnimationFrame(tick)
    }
    return () => cancelAnimationFrame(frame)
  }, [archetype, rarity, height, still])

  return <canvas ref={ref} className={className} style={{ width: '100%', height }} />
}
