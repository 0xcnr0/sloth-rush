import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { THEME, CUR, pathLabel, passiveLabel } from '../config/theme'

interface EvolutionModalProps {
  racerId: number
  racerName: string
  wallet: string
  onClose: () => void
  onEvolved: () => void
}

// Path ids are the functional stat axis; every label, passive name and blurb
// comes from the theme config.
const EVOLUTION_PATHS = [
  { id: 'speed', icon: '\u{26A1}', color: 'text-yellow-400 border-yellow-400 bg-yellow-400/10', passive: 'late_surge' },
  { id: 'endurance', icon: '\u{1F6E1}\uFE0F', color: 'text-blue-400 border-blue-400 bg-blue-400/10', passive: 'fatigue_resist' },
  { id: 'luck', icon: '\u{2728}', color: 'text-purple-400 border-purple-400 bg-purple-400/10', passive: 'luck_magnet' },
]

export default function EvolutionModal({ racerId, racerName, wallet, onClose, onEvolved }: EvolutionModalProps) {
  const [progress, setProgress] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [evolving, setEvolving] = useState(false)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [evolved, setEvolved] = useState(false)
  const [evolveResult, setEvolveResult] = useState<any>(null)

  useEffect(() => {
    api.getEvolutionProgress(racerId)
      .then(setProgress)
      .catch((err) => { console.error('Failed to load evolution progress:', err); toast.error('Failed to load data. Please refresh.') })
      .finally(() => setLoading(false))
  }, [racerId])

  async function handleEvolve() {
    if (evolving) return
    // For tier 2->3 a path must be chosen
    if (progress?.tier === 2 && !selectedPath) return
    // Confirmation dialog
    const coinCost = requirements?.coins || 0
    const pathSuffix = selectedPath ? ` via the ${pathLabel(selectedPath)} path` : ''
    const confirmed = window.confirm(
      `Evolve ${racerName} to Tier ${tier + 1}${pathSuffix}?\n\nThis will cost ${coinCost} ${CUR}. This action cannot be undone.`
    )
    if (!confirmed) return
    setEvolving(true)
    try {
      const result = await api.evolve(wallet, racerId, selectedPath || undefined)
      setEvolveResult(result)
      setEvolved(true)
    } catch (err: any) {
      toast.error(err.message || 'Evolution failed')
    }
    setEvolving(false)
  }

  const tier = progress?.tier ?? 1
  const requirements = progress?.requirements || {}
  const prog = progress?.progress || {}
  const eligible = progress?.eligible ?? false
  const needsPath = tier === 2

  // Requirement labels
  const reqItems: { label: string; current: number; target: number }[] = []
  if (requirements.xp !== undefined) reqItems.push({ label: 'XP', current: prog.xp || 0, target: requirements.xp })
  if (requirements.races !== undefined) reqItems.push({ label: 'Races', current: prog.races || 0, target: requirements.races })
  if (requirements.wins !== undefined) reqItems.push({ label: 'Wins', current: prog.wins || 0, target: requirements.wins })
  if (requirements.coins !== undefined) reqItems.push({ label: CUR, current: prog.coins || 0, target: requirements.coins })
  if (requirements.stat !== undefined) reqItems.push({ label: 'Stat Total', current: prog.stat || 0, target: requirements.stat })

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="bg-brand-surface border border-brand-border rounded-2xl max-w-lg w-full overflow-hidden max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-brand-border">
            <div>
              <h2 className="text-white font-bold text-lg">Evolution</h2>
              <p className="text-gray-400 text-sm">{racerName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white cursor-pointer text-xl leading-none"
            >
              &#x2715;
            </button>
          </div>

          <div className="p-5">
            {loading && (
              <div className="py-12 text-center text-gray-400">Loading evolution data...</div>
            )}

            {/* Evolution complete screen */}
            {evolved && evolveResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ repeat: 2, duration: 0.5 }}
                  className="text-6xl mb-4"
                >
                  {'\u{2728}'}
                </motion.div>
                <h3 className="text-2xl font-bold text-brand-primary mb-2">Evolution Complete!</h3>
                <p className="text-white font-semibold mb-1">Tier {evolveResult.tier}</p>
                {evolveResult.evolutionPath && (
                  <p className="text-brand-accent font-semibold mb-1">
                    Path: {pathLabel(evolveResult.evolutionPath)}
                  </p>
                )}
                {evolveResult.passive && (
                  <p className="text-gray-400 text-sm mb-4">Passive: {passiveLabel(evolveResult.passive)}</p>
                )}
                <button
                  onClick={() => { onEvolved(); onClose() }}
                  className="px-8 py-2.5 bg-brand-primary text-brand-bg font-bold rounded-xl hover:bg-brand-primary/90 transition-colors cursor-pointer"
                >
                  Done
                </button>
              </motion.div>
            )}

            {/* Progress screen */}
            {!loading && !evolved && progress && (
              <>
                {/* Current tier */}
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-3">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-brand-primary/20 border-2 border-brand-primary flex items-center justify-center text-2xl font-extrabold text-brand-primary">
                        T{tier}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Current</p>
                    </div>
                    <div className="text-gray-500 text-2xl">{'\u{2192}'}</div>
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-brand-accent/20 border-2 border-brand-accent flex items-center justify-center text-2xl font-extrabold text-brand-accent">
                        T{tier + 1}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Next</p>
                    </div>
                  </div>
                </div>

                {/* Requirements */}
                {reqItems.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-gray-400 text-xs font-bold uppercase mb-3">Requirements</h3>
                    <div className="space-y-3">
                      {reqItems.map(item => {
                        const pct = Math.min(100, (item.current / item.target) * 100)
                        const done = item.current >= item.target
                        return (
                          <div key={item.label}>
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-sm font-semibold ${done ? 'text-brand-primary' : 'text-gray-300'}`}>
                                {done ? '\u{2705} ' : ''}{item.label}
                              </span>
                              <span className="text-xs text-gray-500">{item.current}/{item.target}</span>
                            </div>
                            <div className="w-full bg-brand-bg rounded-full h-2">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.5 }}
                                className={`h-2 rounded-full ${done ? 'bg-brand-primary' : 'bg-brand-accent'}`}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Evolution Path Choice (Tier 2 -> 3) */}
                {needsPath && eligible && (
                  <div className="mb-6">
                    <h3 className="text-gray-400 text-xs font-bold uppercase mb-3">Choose Evolution Path</h3>
                    <div className="space-y-2">
                      {EVOLUTION_PATHS.map(path => (
                        <motion.button
                          key={path.id}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => setSelectedPath(path.id)}
                          className={`w-full text-left p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                            selectedPath === path.id
                              ? path.color
                              : 'border-brand-border bg-brand-bg hover:border-gray-500'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">{path.icon}</span>
                            <div className="flex-1">
                              <p className="text-white font-bold">{pathLabel(path.id)}</p>
                              <p className="text-gray-400 text-xs mt-0.5">{THEME.paths[path.id]?.statBonus}</p>
                              <p className="text-gray-500 text-xs mt-1">{THEME.paths[path.id]?.description}</p>
                              <p className="text-brand-primary text-xs font-semibold mt-1">Passive: {passiveLabel(path.passive)}</p>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Current passive/path info */}
                {progress.evolutionPath && (
                  <div className="mb-4 p-3 bg-brand-bg rounded-xl border border-brand-border">
                    <p className="text-gray-400 text-xs">Current Path</p>
                    <p className="text-white font-semibold">{pathLabel(progress.evolutionPath)}</p>
                    {progress.passive && (
                      <p className="text-brand-primary text-xs mt-1">Passive: {passiveLabel(progress.passive)}</p>
                    )}
                  </div>
                )}

                {/* Evolve button */}
                <button
                  onClick={handleEvolve}
                  disabled={!eligible || evolving || (needsPath && !selectedPath)}
                  className="w-full py-3 bg-brand-primary text-brand-bg font-bold rounded-xl hover:bg-brand-primary/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-lg"
                >
                  {evolving
                    ? 'Evolving...'
                    : !eligible
                    ? 'Requirements Not Met'
                    : needsPath && !selectedPath
                    ? 'Select a Path First'
                    : 'Evolve!'
                  }
                </button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
