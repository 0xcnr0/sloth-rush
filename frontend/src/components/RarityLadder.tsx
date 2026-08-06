import { useEffect, useRef } from 'react'
import { rigFor, drawRacer } from '../lib/racerRig'
import { THEME, rarityLabel } from '../config/theme'

/**
 * The five rarity treatments side by side, at race scale and at inspection scale.
 *
 * Rarity grants no stats, so the surface is the entire feature — if the ladder
 * does not read as a ladder, rarity does nothing at all. Two sizes because both
 * matter and they fail differently: at 56px the question is whether a Mint racer
 * is distinguishable mid-race, and large it is whether the treatments look like
 * materials rather than colour filters.
 */
const CODES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const

export default function RarityLadder() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    let frame = 0
    let phase = 0
    let key = 0

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

      phase += 0.09
      key += 7
      const step = w / CODES.length

      CODES.forEach((code, i) => {
        const cx = step * (i + 0.5)
        // Large, for judging the treatment as a material.
        drawRacer(ctx, rigFor('tank'), {
          x: cx, y: h * 0.62, height: Math.min(step * 1.5, h * 0.5),
          phase, keyAngle: -key, rarity: code,
        })
        // Race scale, for judging whether it survives at 56px.
        drawRacer(ctx, rigFor('tank'), {
          x: cx, y: h * 0.93, height: 56, phase, keyAngle: -key, rarity: code,
        })
        ctx.fillStyle = '#9ca3af'
        ctx.font = '600 11px ui-sans-serif, system-ui'
        ctx.textAlign = 'center'
        ctx.fillText(rarityLabel(code), cx, 16)
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div>
      <p className="text-brand-dust text-sm mb-3">
        {THEME.brand.name} — Fair to Mint. Top row large, bottom row at race scale.
      </p>
      <canvas ref={ref} className="w-full rounded-xl bg-[#101a2e]" style={{ aspectRatio: '3 / 2' }} />
    </div>
  )
}
