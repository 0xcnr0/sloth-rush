import { motion } from 'framer-motion'
import { THEME } from '../../config/theme'

/**
 * Grid Reveal — the payoff of the Wind-Up phase.
 *
 * All four wound in secret and simultaneously; this is the moment it becomes
 * public (WIND_UP_PHASE.md §4). Showing only the finishing order would throw
 * that away, so each row carries the tension that produced it and a snapped
 * spring is called out by name — it is the phase's most dramatic outcome and
 * the one the player most needs to understand.
 */
export interface GridEntry {
  id: number
  name: string
  position: number
  /** Archetype code — the art and the emoji are picked from it. */
  race?: string
  tension?: number
  snapped?: boolean
}

export default function GridReveal({ entries }: { entries: GridEntry[] }) {
  return (
    <motion.div
      key="reveal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="text-center"
    >
            <motion.h1
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 150 }}
              className="text-3xl font-extrabold text-brand-gold mb-8"
            >
              WHO GOT POLE POSITION?
            </motion.h1>

            <div className="max-w-md mx-auto space-y-3">
              {entries.map((gp, i) => (
                <motion.div
                  key={gp.id}
                  initial={{ x: -100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.6, type: 'spring' }}
                  className={`flex items-center gap-4 p-4 rounded-xl border ${
                    i === 0 ? 'bg-brand-gold/10 border-brand-gold' :
                    'bg-brand-surface border-brand-border'
                  }`}
                >
                  <span className={`text-2xl font-extrabold w-8 ${i === 0 ? 'text-brand-gold' : 'text-brand-dust'}`}>
                    P{gp.position}
                  </span>
                  <span className="text-2xl">
                    {(gp.race ? THEME.archetypes[gp.race]?.emoji : undefined) ?? THEME.brand.mark}
                  </span>
                  <div className="flex-1 text-left">
                    <p className="text-brand-ink font-semibold">{gp.name}</p>
                    {/* The tension IS the reveal. Everyone wound in secret; this
                        is the moment it becomes public, so showing only the
                        finishing order throws away the drama the phase built. */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="relative h-1.5 flex-1 rounded-full overflow-hidden">
                        <div
                          className={`absolute inset-y-0 left-0 ${
                            gp.snapped ? 'bg-brand-danger' : 'bg-brand-primary'
                          }`}
                          style={{ width: `${Math.min(100, gp.tension ?? 0)}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs tabular-nums text-brand-dust w-8 text-right">
                        {Math.round(gp.tension ?? 0)}%
                      </span>
                    </div>
                  </div>
                  {gp.snapped ? (
                    <span className="text-brand-danger text-xs font-bold whitespace-nowrap">
                      SPRING WENT
                    </span>
                  ) : i === 0 ? (
                    <span className="text-brand-gold text-sm font-bold">POLE</span>
                  ) : null}
                </motion.div>
              ))}
            </div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 3 }}
              className="text-brand-dust mt-8"
            >
              Starting race...
            </motion.p>
    </motion.div>
  )
}
