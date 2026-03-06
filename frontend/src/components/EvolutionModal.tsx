import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../lib/api'

interface EvolutionModalProps {
  snailId: number
  snailName: string
  wallet: string
  onClose: () => void
  onEvolved: () => void
}

const EVOLUTION_PATHS = [
  {
    id: 'caffeine',
    name: 'Caffeine',
    icon: '\u{26A1}',
    color: 'text-yellow-400 border-yellow-400 bg-yellow-400/10',
    statBonus: 'SPD/ACC +5 cap',
    passive: 'Last 100m caffeine kicks in, +10% speed',
    description: 'The path of raw speed. Your sloth runs on pure espresso, excelling in final sprints.',
  },
  {
    id: 'hibernate',
    name: 'Hibernate',
    icon: '\u{1F6E1}\uFE0F',
    color: 'text-blue-400 border-blue-400 bg-blue-400/10',
    statBonus: 'STA/REF +5 cap',
    passive: 'Deep hibernation, fatigue builds 50% slower',
    description: 'The path of resilience. Deep hibernation makes your sloth an unstoppable tank, shrugging off fatigue.',
  },
  {
    id: 'dreamwalk',
    name: 'Dreamwalk',
    icon: '\u{2728}',
    color: 'text-purple-400 border-purple-400 bg-purple-400/10',
    statBonus: 'LCK/AGI +5 cap',
    passive: 'Dream Catcher attracts Luck Orbs 20% more',
    description: 'The path of fortune. Your sloth bends reality through lucid dreams, attracting beneficial events.',
  },
]

export default function EvolutionModal({ snailId, snailName, wallet, onClose, onEvolved }: EvolutionModalProps) {
  const [progress, setProgress] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [evolving, setEvolving] = useState(false)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [evolved, setEvolved] = useState(false)
  const [evolveResult, setEvolveResult] = useState<any>(null)

  useEffect(() => {
    api.getEvolutionProgress(snailId)
      .then(setProgress)
      .catch((err) => { console.error('Failed to load evolution progress:', err); toast.error('Failed to load data. Please refresh.') })
      .finally(() => setLoading(false))
  }, [snailId])

  async function handleEvolve() {
    if (evolving) return
    // For tier 2->3 a path must be chosen
    if (progress?.tier === 2 && !selectedPath) return
    // Confirmation dialog
    const zzzCost = requirements?.zzz || 0
    const pathLabel = selectedPath ? ` via ${selectedPath.charAt(0).toUpperCase() + selectedPath.slice(1)} path` : ''
    const confirmed = window.confirm(
      `Evolve ${snailName} to Tier ${tier + 1}${pathLabel}?\n\nThis will cost ${zzzCost} ZZZ Coins. This action cannot be undone.`
    )
    if (!confirmed) return
    setEvolving(true)
    try {
      const result = await api.evolve(wallet, snailId, selectedPath || undefined)
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
  if (requirements.zzz !== undefined) reqItems.push({ label: 'ZZZ', current: prog.zzz || 0, target: requirements.zzz })
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
          className="bg-sloth-card border border-sloth-border rounded-2xl max-w-lg w-full overflow-hidden max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-sloth-border">
            <div>
              <h2 className="text-white font-bold text-lg">Evolution</h2>
              <p className="text-gray-400 text-sm">{snailName}</p>
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
                <h3 className="text-2xl font-bold text-sloth-green mb-2">Evolution Complete!</h3>
                <p className="text-white font-semibold mb-1">Tier {evolveResult.tier}</p>
                {evolveResult.evolutionPath && (
                  <p className="text-sloth-purple font-semibold mb-1">
                    Path: {evolveResult.evolutionPath}
                  </p>
                )}
                {evolveResult.passive && (
                  <p className="text-gray-400 text-sm mb-4">Passive: {evolveResult.passive}</p>
                )}
                <button
                  onClick={() => { onEvolved(); onClose() }}
                  className="px-8 py-2.5 bg-sloth-green text-sloth-dark font-bold rounded-xl hover:bg-sloth-green/90 transition-colors cursor-pointer"
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
                      <div className="w-16 h-16 rounded-full bg-sloth-green/20 border-2 border-sloth-green flex items-center justify-center text-2xl font-extrabold text-sloth-green">
                        T{tier}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Current</p>
                    </div>
                    <div className="text-gray-500 text-2xl">{'\u{2192}'}</div>
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-sloth-purple/20 border-2 border-sloth-purple flex items-center justify-center text-2xl font-extrabold text-sloth-purple">
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
                              <span className={`text-sm font-semibold ${done ? 'text-sloth-green' : 'text-gray-300'}`}>
                                {done ? '\u{2705} ' : ''}{item.label}
                              </span>
                              <span className="text-xs text-gray-500">{item.current}/{item.target}</span>
                            </div>
                            <div className="w-full bg-sloth-dark rounded-full h-2">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.5 }}
                                className={`h-2 rounded-full ${done ? 'bg-sloth-green' : 'bg-sloth-purple'}`}
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
                              : 'border-sloth-border bg-sloth-dark hover:border-gray-500'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">{path.icon}</span>
                            <div className="flex-1">
                              <p className="text-white font-bold">{path.name}</p>
                              <p className="text-gray-400 text-xs mt-0.5">{path.statBonus}</p>
                              <p className="text-gray-500 text-xs mt-1">{path.description}</p>
                              <p className="text-sloth-green text-xs font-semibold mt-1">Passive: {path.passive}</p>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Current passive/path info */}
                {progress.evolutionPath && (
                  <div className="mb-4 p-3 bg-sloth-dark rounded-xl border border-sloth-border">
                    <p className="text-gray-400 text-xs">Current Path</p>
                    <p className="text-white font-semibold">{progress.evolutionPath}</p>
                    {progress.passive && (
                      <p className="text-sloth-green text-xs mt-1">Passive: {progress.passive}</p>
                    )}
                  </div>
                )}

                {/* Evolve button */}
                <button
                  onClick={handleEvolve}
                  disabled={!eligible || evolving || (needsPath && !selectedPath)}
                  className="w-full py-3 bg-sloth-green text-sloth-dark font-bold rounded-xl hover:bg-sloth-green/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-lg"
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
