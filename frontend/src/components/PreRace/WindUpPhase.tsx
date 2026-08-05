import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '../../lib/api'
import { THEME } from '../../config/theme'

/**
 * Wind-Up phase — the skill-based pre-race window (docs/WIND_UP_PHASE.md).
 *
 * Hold to wind the spring, release to lock in. Winding past Safe Wind buys a
 * better grid slot and costs stamina for the whole race; winding past the snap
 * point lets the spring go and drops you to the back.
 *
 * Two things here are deliberate and load-bearing:
 *
 *   - The player is shown an APPROXIMATE band, never the exact Safe Wind line.
 *     The threshold is jittered per race from the seed, and that vagueness is
 *     the actual defence against a scripted client — not the timing (§9).
 *   - The hold is measured with performance.now() and sent as a DURATION, not
 *     a timestamp. Monotonic, no clock sync, unaffected by the system clock.
 *     The server caps it at the window it observed, so invented time is
 *     impossible while an honest slow connection keeps the tension it earned.
 */

interface Props {
  raceId: string
  wallet: string
  /** Called once the tension is locked in, so the lobby can start the race. */
  onLocked: () => void
}

type Stage = 'ready' | 'winding' | 'locked'

interface Outcome {
  tension: number
  /**
   * These are the server's own strings, not ours. It answers `under` / `over` /
   * `snapped`; an earlier version of this file assumed `clean` / `overwound` and
   * would have rendered a blank result panel, because the lookup below misses
   * silently. Typechecking cannot catch that — only calling the endpoint does.
   */
  band: 'under' | 'over' | 'snapped'
  snapped: boolean
}

const BAND_COPY: Record<Outcome['band'], { label: string; tone: string; note: string }> = {
  under: {
    label: 'Clean wind',
    tone: 'text-brand-primary',
    note: 'Full stamina. A safe grid slot.',
  },
  over: {
    label: 'Overwound',
    tone: 'text-brand-gold',
    note: 'Better grid — but stamina burns faster all race.',
  },
  snapped: {
    label: 'Spring let go',
    tone: 'text-brand-danger',
    note: 'Back of the grid, and you start on reduced stamina.',
  },
}

export default function WindUpPhase({ raceId, wallet, onLocked }: Props) {
  const [stage, setStage] = useState<Stage>('ready')
  const [tension, setTension] = useState(0)
  const [band, setBand] = useState<{ low: number; high: number } | null>(null)
  const [fullWindMs, setFullWindMs] = useState(3500)
  const [remainingMs, setRemainingMs] = useState<number | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pressedAt = useRef(0)
  const deadline = useRef(0)
  const frame = useRef(0)
  const releasing = useRef(false)

  const release = useCallback(
    async (auto: boolean) => {
      // The countdown and the pointer can both fire; whichever lands first wins.
      if (releasing.current || stage !== 'winding') return
      releasing.current = true
      cancelAnimationFrame(frame.current)

      const heldMs = performance.now() - pressedAt.current
      setStage('locked')
      try {
        const res = await api.releaseWind(raceId, wallet, heldMs)
        setTension(res.tension)
        setOutcome({ tension: res.tension, band: res.band, snapped: res.snapped })
        // Let the result read before handing back to the lobby.
        setTimeout(onLocked, auto ? 1200 : 1800)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not lock in your wind')
        setTimeout(onLocked, 1500)
      }
    },
    [raceId, wallet, stage, onLocked],
  )

  const press = useCallback(async () => {
    if (stage !== 'ready') return
    setStage('winding')
    setError(null)
    try {
      const res = await api.startWind(raceId, wallet)
      if (res.safeWindBand) setBand(res.safeWindBand)
      if (res.fullWindMs) setFullWindMs(res.fullWindMs)
      // The press round trip is already spent, so the local clock starts only
      // once the server has actually opened the hold.
      pressedAt.current = performance.now()
      deadline.current = pressedAt.current + (res.windowRemainingMs ?? 10000)

      const tick = () => {
        const held = performance.now() - pressedAt.current
        const next = Math.min(100, (held / (res.fullWindMs ?? 3500)) * 100)
        setTension(next)
        setRemainingMs(Math.max(0, deadline.current - performance.now()))
        if (next >= 100 || performance.now() >= deadline.current) {
          void release(true)
          return
        }
        frame.current = requestAnimationFrame(tick)
      }
      frame.current = requestAnimationFrame(tick)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start winding')
      setStage('ready')
    }
  }, [raceId, wallet, stage, release])

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const copy = outcome ? BAND_COPY[outcome.band] : null
  const overSafe = band !== null && tension > band.low

  return (
    <motion.div
      key="winding"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="text-center max-w-md mx-auto"
    >
      <h1 className="text-3xl font-bold mb-1">{THEME.race.windUp}</h1>
      <p className="text-gray-400 mb-6 text-sm">
        Hold to wind the spring. Let go inside the band for a clean start.
      </p>

      {/* Hold target — full width, one thumb, 44px+ (ART_DIRECTION §9). */}
      <button
        type="button"
        onPointerDown={e => {
          e.preventDefault()
          void press()
        }}
        onPointerUp={e => {
          e.preventDefault()
          void release(false)
        }}
        onPointerCancel={() => void release(false)}
        disabled={stage === 'locked'}
        aria-label="Hold to wind the spring"
        className="w-full rounded-2xl border-2 border-brand-border bg-brand-surface
                   px-6 py-10 select-none touch-none transition-colors
                   disabled:opacity-70 enabled:active:border-brand-primary"
      >
        <motion.div
          className="text-6xl mb-3"
          animate={{ rotate: stage === 'winding' ? 360 : 0 }}
          transition={
            stage === 'winding'
              ? { repeat: Infinity, ease: 'linear', duration: Math.max(0.12, 1.1 - tension / 110) }
              : { duration: 0.4 }
          }
        >
          {THEME.brand.mark}
        </motion.div>
        <p className="text-white font-semibold">
          {stage === 'ready' && 'Hold to wind'}
          {stage === 'winding' && 'Let go to lock in'}
          {stage === 'locked' && (copy ? copy.label : 'Locked in')}
        </p>
      </button>

      {/* Tension gauge. The band is approximate on purpose — see §9. */}
      <div className="relative mt-5 h-7 rounded-full border-2 border-brand-border bg-brand-bg overflow-hidden">
        {band && (
          <div
            className="absolute inset-y-0 bg-brand-primary/25 border-x-2 border-dashed border-brand-primary/50"
            style={{ left: `${band.low}%`, width: `${Math.max(0, band.high - band.low)}%` }}
          />
        )}
        <div
          className={`absolute inset-y-0 left-0 transition-colors ${
            outcome?.snapped ? 'bg-brand-danger' : overSafe ? 'bg-brand-gold' : 'bg-brand-primary'
          }`}
          style={{ width: `${Math.min(100, tension)}%` }}
        />
      </div>

      <div className="mt-2 flex justify-between text-xs font-mono tabular-nums text-gray-400">
        <span>{Math.round(tension)}% tension</span>
        <span>{remainingMs === null ? '' : `${(remainingMs / 1000).toFixed(1)}s`}</span>
      </div>

      <div className="mt-4 min-h-[3rem]">
        {error && <p className="text-brand-danger text-sm">{error}</p>}
        {copy && !error && (
          <>
            <p className={`font-semibold ${copy.tone}`}>
              {copy.label} — {outcome!.tension.toFixed(0)}%
            </p>
            <p className="text-gray-400 text-sm">{copy.note}</p>
          </>
        )}
      </div>

      <p className="text-gray-600 text-xs mt-2">
        Full wind takes about {(fullWindMs / 1000).toFixed(1)}s. Everyone winds at the same time.
      </p>
    </motion.div>
  )
}
