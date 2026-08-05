import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import WalletConnect from '../components/WalletConnect'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { THEME, CUR } from '../config/theme'
import { useUpgrade } from '../hooks/useContracts'
import { CONTRACTS_DEPLOYED } from '../config/contracts'
import QuestPanel from '../components/QuestPanel'
import EvolutionModal from '../components/EvolutionModal'
import MiniGameModal from '../components/MiniGameModal'
import Spinner from '../components/Spinner'
import { FEATURES } from '../config/features'

const EVOLUTION_PATH_ICONS: Record<string, string> = {
  speed: '\u26A1',
  endurance: '\u{1F6E1}\uFE0F',
  luck: '\u{1F52E}',
}

const RARITY_COLORS: Record<string, string> = {
  common: 'bg-gray-600 text-gray-200',
  uncommon: 'bg-green-600 text-green-100',
  rare: 'bg-blue-600 text-blue-100',
  epic: 'bg-purple-600 text-purple-100',
  legendary: 'bg-yellow-500 text-yellow-900',
}

const RARITY_BORDER: Record<string, string> = {
  common: 'border-gray-600',
  uncommon: 'border-green-500',
  rare: 'border-blue-500',
  epic: 'border-purple-500',
  legendary: 'border-yellow-400',
}

// Arketip simgeleri tema içeriğidir, kodda sabitlenmez (CLAUDE.md §0).
const RACER_EMOJI: Record<string, string> = Object.fromEntries(
  Object.entries(THEME.archetypes).map(([code, a]) => [code, a.emoji]),
)

type UpgradeState = 'idle' | 'paying' | 'burning' | 'revealing' | 'done'

export default function Collection() {
  const { address, isConnected } = useAccount()
  const navigate = useNavigate()
  const [racers, setRacers] = useState<any[]>([])
  const [coinBalance, setCoinBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [upgradeState, setUpgradeState] = useState<UpgradeState>('idle')
  const [newRacer, setNewRacer] = useState<any>(null)
  const onchainUpgrade = useUpgrade()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [streaks, setStreaks] = useState<Record<number, { current_wins: number; max_wins: number; current_losses: number; total_races: number; total_wins: number }>>({})
  const [upgradeProgress, setUpgradeProgress] = useState<{ xp: number; races: number; wins: number; loginDays: number; requirements: { xp: number; races: number; wins: number; loginDays: number }; eligible: boolean } | null>(null)
  const [trainings, setTrainings] = useState<{ racerId: number; racerName: string; stat: string; startedAt: string; completedAt: string; isReady: boolean }[]>([])
  const [trainingStat, setTrainingStat] = useState<Record<number, string>>({})
  const [trainingLoading, setTrainingLoading] = useState<number | null>(null)
  const [weeklyTrainingCounts, setWeeklyTrainingCounts] = useState<Record<number, number>>({})
  const [evolveRacerId, setEvolveRacerId] = useState<number | null>(null)
  const [evolveRacerName, setEvolveRacerName] = useState<string>('')
  const [ownedCosmetics, setOwnedCosmetics] = useState<any[]>([])
  const [ownedAccessories, setOwnedAccessories] = useState<any[]>([])
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [questsOpen, setQuestsOpen] = useState(true)
  const [activeMiniGame, setActiveMiniGame] = useState<{ racerId: number; racerName: string } | null>(null)
  const [demoLoading, setDemoLoading] = useState<number | null>(null)
  const [evoProgress, setEvoProgress] = useState<Record<number, any>>({})

  async function handleQuickDemoRace(racerId: number) {
    if (!address || demoLoading) return
    setDemoLoading(racerId)
    try {
      const race = await api.createRace(address, racerId, 'exhibition')
      await api.joinRace(race.raceId, racerId, address)
      await api.startTuning(race.raceId)
      const result = await api.simulateRace(race.raceId)
      navigate(`/race/${race.raceId}`, {
        state: { raceResult: result, format: 'exhibition', racerId, demo: true }
      })
    } catch (err: any) {
      toast.error(err.message)
    }
    setDemoLoading(null)
  }

  async function loadCollection() {
    if (!address) return
    setLoading(true)
    try {
      const data = await api.getCollection(address)
      setRacers(data.racers)
      setCoinBalance(data.coinBalance)
    } catch (err) { console.error('Failed to load collection:', err); toast.error('Failed to load data. Please refresh.') }
    setLoading(false)
  }

  useEffect(() => { loadCollection() }, [address])

  // Trigger collection_visit quest progress
  useEffect(() => {
    if (!address) return
    api.trackQuestProgress(address, 'collection_visit').catch((err) => { console.error('Failed to track quest:', err) })
  }, [address])

  // Load free upgrade progress
  useEffect(() => {
    if (!address) return
    api.getUpgradeProgress(address).then(setUpgradeProgress).catch((err) => { console.error('Failed to load upgrade progress:', err) })
  }, [address])

  // Load training status
  function loadTrainings() {
    if (!address) return
    api.getTrainingStatus(address).then(d => {
      setTrainings(d.trainings)
      if (d.weeklyCounts) setWeeklyTrainingCounts(d.weeklyCounts)
    }).catch((err) => { console.error('Failed to load trainings:', err) })
  }
  useEffect(() => { loadTrainings() }, [address])

  useEffect(() => {
    if (!address) return
    api.getStreaks(address).then(data => {
      const map: Record<number, any> = {}
      for (const s of data.streaks) map[s.racer_id] = s
      setStreaks(map)
    }).catch((err) => { console.error('Failed to load streaks:', err) })
  }, [address])

  // Load owned cosmetics and accessories for equip dropdowns
  useEffect(() => {
    if (!address) return
    api.getShopCosmetics(address)
      .then(d => setOwnedCosmetics((d.cosmetics || []).filter((c: any) => c.owned)))
      .catch((err) => { console.error('Failed to load cosmetics:', err) })
    api.getShopAccessories(address)
      .then(d => setOwnedAccessories((d.accessories || []).filter((a: any) => a.owned)))
      .catch((err) => { console.error('Failed to load accessories:', err) })
  }, [address])

  // Load evolution progress for all racers
  useEffect(() => {
    if (!racers.length) return
    const racerType = racers.filter(s => s.type === 'pro')
    racerType.forEach(s => {
      api.getEvolutionProgress(s.id).then(data => {
        setEvoProgress(prev => ({ ...prev, [s.id]: data }))
      }).catch(() => {})
    })
  }, [racers])

  const freeRacer = racers.find(s => s.type === 'free')
  const racerList = racers.filter(s => s.type === 'pro')

  // On-chain upgrade success: register in backend
  useEffect(() => {
    if (onchainUpgrade.isSuccess && address) {
      api.upgradeRacer(address).then((data: any) => {
        setNewRacer(data.racer)
        setCoinBalance(prev => prev + data.coinBonus)
        setUpgradeState('done')
      }).catch((err: any) => { console.error('Backend upgrade failed:', err); setUpgradeState('done') })
    }
  }, [onchainUpgrade.isSuccess, address])

  useEffect(() => {
    if (onchainUpgrade.error) {
      toast.error(onchainUpgrade.error.message || 'On-chain upgrade failed')
      setUpgradeState('idle')
    }
  }, [onchainUpgrade.error])

  async function handleUpgrade() {
    if (!address) return
    setUpgradeState('paying')

    await new Promise(r => setTimeout(r, 1200))
    setUpgradeState('burning')

    if (CONTRACTS_DEPLOYED && freeRacer) {
      // On-chain: burn Free Racer + mint Racer
      const stats = { spd: 12, acc: 11, sta: 10, agi: 11, ref: 10, lck: 12 }
      onchainUpgrade.upgrade(BigInt(freeRacer.id), 0, stats)
      setUpgradeState('revealing')
    } else {
      // Mock fallback
      await new Promise(r => setTimeout(r, 1500))
      setUpgradeState('revealing')

      try {
        const data = await api.upgradeRacer(address)
        setNewRacer(data.racer)
        await new Promise(r => setTimeout(r, 2000))
        setUpgradeState('done')
        setCoinBalance(prev => prev + data.coinBonus)
      } catch (err: any) {
        toast.error(err.message)
        setUpgradeState('idle')
      }
    }
  }

  async function handleFreeUpgrade() {
    if (!address) return
    setUpgradeState('burning')
    await new Promise(r => setTimeout(r, 1500))
    setUpgradeState('revealing')
    try {
      const data = await api.freeUpgrade(address)
      setNewRacer(data.racer)
      await new Promise(r => setTimeout(r, 2000))
      setUpgradeState('done')
      setCoinBalance(prev => prev + data.coinBonus)
    } catch (err: any) {
      toast.error(err.message)
      setUpgradeState('idle')
    }
  }

  async function handleRename(racerId: number) {
    if (!address || editName.trim().length < 3) return
    try {
      await api.renameRacer(address, racerId, editName.trim())
      setRacers(prev => prev.map(s => s.id === racerId ? { ...s, name: editName.trim() } : s))
      setEditingId(null)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  async function handleStartTraining(racerId: number) {
    if (!address) return
    const stat = trainingStat[racerId]
    if (!stat) return
    setTrainingLoading(racerId)
    try {
      await api.startTraining(address, racerId, stat)
      loadTrainings()
      loadCollection()
    } catch (err: any) {
      toast.error(err.message)
    }
    setTrainingLoading(null)
  }

  async function handleClaimTraining(racerId: number) {
    if (!address) return
    setTrainingLoading(racerId)
    try {
      await api.claimTraining(address, racerId)
      loadTrainings()
      loadCollection()
    } catch (err: any) {
      toast.error(err.message)
    }
    setTrainingLoading(null)
  }

  async function handleUnequipAccessory(racerId: number) {
    if (!address) return
    try {
      await api.unequipAccessory(address, racerId)
      loadCollection()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  function toggleSection(key: string) {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function closeReveal() {
    setUpgradeState('idle')
    setNewRacer(null)
    loadCollection()
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-400">Connect your wallet to view your collection</p>
        <WalletConnect />
      </div>
    )
  }

  if (loading) {
    return <Spinner fullPage text="Loading collection..." />
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Your {THEME.locations.home}</h1>
          <p className="text-gray-400 mt-1">
            {racers.length === 0 ? 'No racers yet' : `${racers.length} creature${racers.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-brand-surface border border-brand-border rounded-xl px-4 py-2">
          <span className="text-brand-primary font-bold text-lg">{coinBalance}</span>
          <span className="text-brand-primary/70 text-sm">{CUR}</span>
        </div>
      </div>

      {/* Empty state */}
      {racers.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">&#x1f3da;&#xfe0f;</div>
          <p className="text-gray-400 mb-4">Your collection is empty</p>
          <button
            onClick={() => navigate('/mint')}
            className="px-6 py-2.5 bg-brand-primary text-brand-bg font-bold rounded-xl hover:bg-brand-primary/90 transition-colors cursor-pointer"
          >
            Mint Your First Racer
          </button>
        </div>
      )}

      {/* Free Racer Card — Full Featured */}
      {freeRacer && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-300 mb-3">{THEME.tiers.free}</h2>
          <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
            {/* Header */}
            <div className="flex items-center gap-4 mb-4">
              <div className="text-5xl">{THEME.brand.mark}</div>
              <div className="flex-1">
                <p className="text-white font-semibold text-lg">{freeRacer.name}</p>
                <p className="text-gray-500 text-sm">{THEME.tiers.free} #{freeRacer.id}</p>
              </div>
              <button
                onClick={handleUpgrade}
                disabled={upgradeState !== 'idle'}
                className="px-4 py-2 bg-brand-accent text-white font-bold rounded-xl text-sm hover:bg-brand-accent/90 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                Upgrade — $3
              </button>
            </div>

            {/* Stat Grid (cap: 15) */}
            <div className="grid grid-cols-3 gap-1 text-center text-xs mb-3">
              {[
                { label: 'SPD', val: freeRacer.spd },
                { label: 'ACC', val: freeRacer.acc },
                { label: 'STA', val: freeRacer.sta },
                { label: 'AGI', val: freeRacer.agi },
                { label: 'REF', val: freeRacer.ref },
                { label: 'LCK', val: freeRacer.lck },
              ].map(s => (
                <div key={s.label} className="bg-brand-bg rounded px-1 py-1">
                  <span className="text-gray-500">{s.label} </span>
                  <span className="text-white font-bold">{Number(s.val || 0) % 1 === 0 ? (s.val || 0) : Number(s.val || 0).toFixed(1)}</span>
                  <span className="text-gray-600 text-[10px]">/15</span>
                </div>
              ))}
            </div>

            {/* Training UI — Accordion */}
            {FEATURES.training && (<div className="mt-3">
              <button
                onClick={() => toggleSection(`training-${freeRacer.id}`)}
                className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-2 cursor-pointer hover:text-white transition-colors"
              >
                <span className={`text-xs transition-transform ${expandedSections[`training-${freeRacer.id}`] || trainings.find(t => t.racerId === freeRacer.id) ? 'rotate-90' : ''}`}>{'\u25B6'}</span>
                Training
                {trainings.find(t => t.racerId === freeRacer.id) && (
                  <span className="text-brand-accent text-xs font-normal ml-1">(Active)</span>
                )}
              </button>
              {(expandedSections[`training-${freeRacer.id}`] || trainings.find(t => t.racerId === freeRacer.id)) && (() => {
                const active = trainings.find(t => t.racerId === freeRacer.id)
                if (active) {
                  return (
                    <div className="p-3 bg-brand-bg rounded-lg border border-brand-border">
                      <p className="text-xs text-gray-400 mb-1">Training {active.stat.toUpperCase()}</p>
                      {active.isReady ? (
                        <button
                          onClick={() => handleClaimTraining(freeRacer.id)}
                          disabled={trainingLoading === freeRacer.id}
                          className="w-full py-1.5 bg-brand-primary text-brand-bg font-bold rounded-lg text-xs cursor-pointer disabled:opacity-50"
                        >
                          {trainingLoading === freeRacer.id ? 'Claiming...' : 'Claim +0.3 ' + active.stat.toUpperCase()}
                        </button>
                      ) : (
                        <p className="text-xs text-brand-accent">
                          Ready at {new Date(active.completedAt).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  )
                }
                const weeklyCount = weeklyTrainingCounts[freeRacer.id] || 0
                const weeklyLimit = 1
                const limitReached = weeklyCount >= weeklyLimit
                return (
                  <div className="p-3 bg-brand-bg rounded-lg border border-brand-border">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-400">Train a stat (6h, 10 {CUR})</p>
                      <span className={`text-[10px] font-bold ${limitReached ? 'text-red-400' : 'text-gray-500'}`}>
                        {weeklyCount}/{weeklyLimit} this week
                      </span>
                    </div>
                    {limitReached ? (
                      <p className="text-xs text-red-400 text-center py-2">Weekly training limit reached</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-2">
                          {['spd', 'acc', 'sta', 'agi', 'ref', 'lck'].map(stat => (
                            <button
                              key={stat}
                              onClick={() => setTrainingStat(prev => ({ ...prev, [freeRacer.id]: stat }))}
                              className={`py-2 rounded text-xs font-bold cursor-pointer min-h-[36px] flex items-center justify-center ${
                                trainingStat[freeRacer.id] === stat
                                  ? 'bg-brand-accent text-white'
                                  : 'bg-brand-surface text-gray-400 hover:text-white'
                              }`}
                            >
                              {stat.toUpperCase()}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => handleStartTraining(freeRacer.id)}
                          disabled={!trainingStat[freeRacer.id] || trainingLoading === freeRacer.id}
                          className="w-full py-1.5 bg-brand-accent/20 text-brand-accent font-semibold rounded-lg text-xs cursor-pointer disabled:opacity-50"
                        >
                          {trainingLoading === freeRacer.id ? 'Starting...' : 'Start Training'}
                        </button>
                      </>
                    )}
                  </div>
                )
              })()}
            </div>)}

            {/* Equipment — Accordion */}
            {FEATURES.cosmetics && (ownedCosmetics.length > 0 || ownedAccessories.length > 0) && (
              <div className="mt-3">
                <button
                  onClick={() => toggleSection(`equip-${freeRacer.id}`)}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-2 cursor-pointer hover:text-white transition-colors"
                >
                  <span className={`text-xs transition-transform ${expandedSections[`equip-${freeRacer.id}`] ? 'rotate-90' : ''}`}>{'\u25B6'}</span>
                  Equipment
                </button>
                {expandedSections[`equip-${freeRacer.id}`] && (
                  <div className="p-3 bg-brand-bg rounded-lg border border-brand-border space-y-2">
                    {ownedCosmetics.length > 0 && (
                      <select
                        value=""
                        onChange={async e => {
                          const cosId = Number(e.target.value)
                          if (!cosId || !address) return
                          try {
                            await api.equipCosmetic(address, freeRacer.id, cosId)
                            loadCollection()
                          } catch (err: any) { toast.error(err.message) }
                        }}
                        className="w-full bg-brand-surface border border-brand-border rounded px-2 py-2 text-white text-xs outline-none min-h-[44px] cursor-pointer"
                      >
                        <option value="">{freeRacer.cosmetic ? `Cosmetic: ${typeof freeRacer.cosmetic === 'string' ? freeRacer.cosmetic : freeRacer.cosmetic.name}` : 'Equip Cosmetic...'}</option>
                        {ownedCosmetics.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    )}
                    {ownedAccessories.length > 0 && (
                      <select
                        value=""
                        onChange={async e => {
                          const accId = Number(e.target.value)
                          if (!accId || !address) return
                          try {
                            await api.equipAccessory(address, freeRacer.id, accId)
                            loadCollection()
                          } catch (err: any) { toast.error(err.message) }
                        }}
                        className="w-full bg-brand-surface border border-brand-border rounded px-2 py-2 text-white text-xs outline-none min-h-[44px] cursor-pointer"
                      >
                        <option value="">{(freeRacer.equipped_accessory || freeRacer.accessory) ? `Accessory: ${freeRacer.equipped_accessory || (typeof freeRacer.accessory === 'string' ? freeRacer.accessory : freeRacer.accessory?.name)}` : 'Equip Accessory...'}</option>
                        {ownedAccessories.map((a: any) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Mini Games button */}
            {FEATURES.miniGames && (
            <button
              onClick={() => setActiveMiniGame({ racerId: freeRacer.id, racerName: freeRacer.name })}
              className="w-full mt-3 py-2 bg-purple-500/20 text-purple-400 font-semibold rounded-lg hover:bg-purple-500/30 transition-colors cursor-pointer text-sm"
            >
              Play Mini Games
            </button>
            )}

            {/* Enter Race — Exhibition only */}
            <div className="mt-3 pt-3 border-t border-brand-border space-y-2">
              <button
                onClick={() => handleQuickDemoRace(freeRacer.id)}
                disabled={demoLoading === freeRacer.id}
                className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-brand-bg text-xl font-black rounded-xl hover:from-yellow-400 hover:to-orange-400 transition-all cursor-pointer shadow-lg shadow-yellow-500/30 disabled:opacity-50 animate-pulse hover:animate-none"
              >
                {demoLoading === freeRacer.id ? 'Starting Race...' : '\u26A1 Quick Race'}
              </button>
              <button
                onClick={() => navigate('/race')}
                className="w-full py-2.5 bg-brand-primary/20 text-brand-primary font-bold rounded-lg hover:bg-brand-primary/30 transition-colors cursor-pointer border border-brand-primary/30"
              >
                Browse Races
              </button>
            </div>

            {/* Upgrade Section */}
            <div className="mt-4 pt-4 border-t border-brand-border">
              <p className="text-gray-400 text-xs text-center mb-3">Upgrade to unlock all race formats</p>
            </div>
          </div>

          {/* Free Upgrade Path */}
          {upgradeProgress && (
            <div className="mt-4 bg-brand-bg border border-brand-border rounded-xl p-5">
              <p className="text-gray-400 text-sm mb-3 text-center">...or upgrade for free by completing milestones</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'XP', current: upgradeProgress.xp, target: upgradeProgress.requirements.xp },
                  { label: 'Races', current: upgradeProgress.races, target: upgradeProgress.requirements.races },
                  { label: 'Wins', current: upgradeProgress.wins, target: upgradeProgress.requirements.wins },
                  { label: 'Login Days', current: upgradeProgress.loginDays, target: upgradeProgress.requirements.loginDays },
                ].map(item => {
                  const pct = Math.min(100, (item.current / item.target) * 100)
                  const done = item.current >= item.target
                  return (
                    <div key={item.label} className="text-center">
                      <p className={`text-xs font-semibold mb-1 ${done ? 'text-brand-primary' : 'text-gray-400'}`}>
                        {done ? '\u2705 ' : ''}{item.label}
                      </p>
                      <div className="w-full bg-brand-border rounded-full h-1.5 mb-1">
                        <div
                          className={`h-1.5 rounded-full transition-all ${done ? 'bg-brand-primary' : 'bg-brand-accent'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-500">{item.current}/{item.target}</p>
                    </div>
                  )
                })}
              </div>
              {upgradeProgress.eligible && (
                <button
                  onClick={handleFreeUpgrade}
                  disabled={upgradeState !== 'idle'}
                  className="w-full mt-4 py-2.5 bg-brand-primary text-brand-bg font-bold rounded-xl hover:bg-brand-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Free Upgrade!
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quest Panel */}
      {FEATURES.quests && (
      <div className="mb-6">
        <button
          onClick={() => setQuestsOpen(!questsOpen)}
          className="flex items-center gap-2 text-lg font-semibold text-gray-300 mb-3 cursor-pointer hover:text-white transition-colors"
        >
          <span className={`text-sm transition-transform ${questsOpen ? 'rotate-90' : ''}`}>{'\u25B6'}</span>
          Daily Quests
        </button>
        {questsOpen && <QuestPanel />}
      </div>
      )}

      {/* Racer Cards */}
      {racerList.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-300 mb-3">Racers</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {racerList.map((racer) => (
              <div
                key={racer.id}
                className={`bg-brand-surface border-2 ${RARITY_BORDER[racer.rarity] || 'border-brand-border'} rounded-xl p-5`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    {editingId === racer.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRename(racer.id); if (e.key === 'Escape') setEditingId(null) }}
                          maxLength={20}
                          className="bg-brand-bg border border-brand-primary rounded px-2 py-0.5 text-white text-sm w-32 outline-none"
                          autoFocus
                        />
                        <button onClick={() => handleRename(racer.id)} className="text-brand-primary text-xs cursor-pointer">&#x2714;</button>
                        <button onClick={() => setEditingId(null)} className="text-gray-500 text-xs cursor-pointer">&#x2716;</button>
                      </div>
                    ) : (
                      <p className="text-white font-bold text-lg flex items-center gap-1.5">
                        {racer.name}
                        <button
                          onClick={() => { setEditingId(racer.id); setEditName(racer.name) }}
                          className="text-gray-500 hover:text-brand-primary transition-colors cursor-pointer"
                          title="Rename"
                        >
                          &#x270F;&#xFE0F;
                        </button>
                      </p>
                    )}
                    <p className="text-gray-500 text-xs">
                      Racer #{racer.id}
                      {racer.tier && racer.tier > 1 && (
                        <span className="ml-1 text-yellow-400" title={`Tier ${racer.tier}`}>
                          {'\u2B50'.repeat(racer.tier)}
                        </span>
                      )}
                      {racer.evolution_path && EVOLUTION_PATH_ICONS[racer.evolution_path] && (
                        <span className="ml-1" title={racer.evolution_path}>
                          {EVOLUTION_PATH_ICONS[racer.evolution_path]}
                        </span>
                      )}
                    </p>
                    {racer.passive && (
                      <p className="text-brand-accent text-[10px] mt-0.5">{racer.passive}</p>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${RARITY_COLORS[racer.rarity] || ''}`}>
                    {racer.rarity}
                  </span>
                </div>

                {/* Streak badge */}
                {streaks[racer.id] && streaks[racer.id].current_wins >= 3 && (
                  <div className="text-center mb-1">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                      streaks[racer.id].current_wins >= 5
                        ? 'bg-red-500/20 text-red-400 border border-red-500'
                        : 'bg-orange-500/20 text-orange-400 border border-orange-500'
                    }`}>
                      {streaks[racer.id].current_wins >= 5 ? 'UNSTOPPABLE!' : `${streaks[racer.id].current_wins} Win Streak`} &#x1F525;
                    </span>
                  </div>
                )}
                {streaks[racer.id] && streaks[racer.id].current_losses >= 3 && (
                  <div className="text-center mb-1">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-gray-700/50 text-gray-400">
                      &#x1F622; Needs some motivation!
                    </span>
                  </div>
                )}

                <div className="text-4xl text-center mb-3">
                  {RACER_EMOJI[racer.race] || THEME.brand.mark}
                </div>

                <p className="text-gray-400 text-xs text-center mb-3 capitalize">
                  {racer.race?.replace('_', ' ')}
                </p>

                <div className="grid grid-cols-3 gap-1 mt-3 text-center text-xs">
                  {[
                    { label: 'SPD', val: racer.spd },
                    { label: 'ACC', val: racer.acc },
                    { label: 'STA', val: racer.sta },
                    { label: 'AGI', val: racer.agi },
                    { label: 'REF', val: racer.ref },
                    { label: 'LCK', val: racer.lck },
                  ].map(s => (
                    <div key={s.label} className="bg-brand-bg rounded px-1 py-1">
                      <span className="text-gray-500">{s.label} </span>
                      <span className="text-white font-bold">{Number(s.val) % 1 === 0 ? s.val : Number(s.val).toFixed(1)}</span>
                    </div>
                  ))}
                </div>

                {/* Achievement Badges */}
                {streaks[racer.id] && (() => {
                  const s = streaks[racer.id]
                  const badges: { icon: string; label: string; color: string }[] = []
                  if (s.total_wins >= 1) badges.push({ icon: '\u2B50', label: 'First Win', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' })
                  if (s.max_wins >= 3) badges.push({ icon: '\uD83D\uDD25', label: 'On Fire', color: 'bg-orange-500/20 text-orange-400 border-orange-500/50' })
                  if (s.total_races >= 10) badges.push({ icon: '\uD83D\uDEE1\uFE0F', label: 'Veteran', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50' })
                  if (s.total_wins >= 10) badges.push({ icon: '\uD83C\uDFC6', label: 'Champion', color: 'bg-purple-500/20 text-purple-400 border-purple-500/50' })
                  if (s.current_wins >= 5) badges.push({ icon: '\uD83D\uDC51', label: 'Unbeatable', color: 'bg-red-500/20 text-red-400 border-red-500/50' })
                  if (badges.length === 0) return null
                  return (
                    <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
                      {badges.map(b => (
                        <span key={b.label} className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${b.color}`}>
                          {b.icon} {b.label}
                        </span>
                      ))}
                    </div>
                  )
                })()}

                {streaks[racer.id] && streaks[racer.id].total_races > 0 && (
                  <div className="flex items-center justify-center gap-3 mt-2 text-xs text-gray-500">
                    <span>{streaks[racer.id].total_races} races</span>
                    <span>{streaks[racer.id].total_wins} wins</span>
                    <span>Best: {streaks[racer.id].max_wins}&#x1F525;</span>
                  </div>
                )}

                {/* Training UI — Accordion */}
                {FEATURES.training && (<div className="mt-3">
                  <button
                    onClick={() => toggleSection(`training-${racer.id}`)}
                    className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-2 cursor-pointer hover:text-white transition-colors"
                  >
                    <span className={`text-xs transition-transform ${expandedSections[`training-${racer.id}`] || trainings.find(t => t.racerId === racer.id) ? 'rotate-90' : ''}`}>{'\u25B6'}</span>
                    Training
                    {trainings.find(t => t.racerId === racer.id) && (
                      <span className="text-brand-accent text-xs font-normal ml-1">(Active)</span>
                    )}
                  </button>
                  {(expandedSections[`training-${racer.id}`] || trainings.find(t => t.racerId === racer.id)) && (() => {
                    const active = trainings.find(t => t.racerId === racer.id)
                    if (active) {
                      return (
                        <div className="p-3 bg-brand-bg rounded-lg border border-brand-border">
                          <p className="text-xs text-gray-400 mb-1">Training {active.stat.toUpperCase()}</p>
                          {active.isReady ? (
                            <button
                              onClick={() => handleClaimTraining(racer.id)}
                              disabled={trainingLoading === racer.id}
                              className="w-full py-1.5 bg-brand-primary text-brand-bg font-bold rounded-lg text-xs cursor-pointer disabled:opacity-50"
                            >
                              {trainingLoading === racer.id ? 'Claiming...' : 'Claim +0.3 ' + active.stat.toUpperCase()}
                            </button>
                          ) : (
                            <p className="text-xs text-brand-accent">
                              Ready at {new Date(active.completedAt).toLocaleTimeString()}
                            </p>
                          )}
                        </div>
                      )
                    }
                    const weeklyCount = weeklyTrainingCounts[racer.id] || 0
                    const weeklyLimit = racer.type === 'free' ? 1 : 2
                    const limitReached = weeklyCount >= weeklyLimit
                    return (
                      <div className="p-3 bg-brand-bg rounded-lg border border-brand-border">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-gray-400">Train a stat (6h, 10 {CUR})</p>
                          <span className={`text-[10px] font-bold ${limitReached ? 'text-red-400' : 'text-gray-500'}`}>
                            {weeklyCount}/{weeklyLimit} this week
                          </span>
                        </div>
                        {limitReached ? (
                          <p className="text-xs text-red-400 text-center py-2">Weekly training limit reached</p>
                        ) : (
                          <>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-2">
                              {['spd', 'acc', 'sta', 'agi', 'ref', 'lck'].map(stat => (
                                <button
                                  key={stat}
                                  onClick={() => setTrainingStat(prev => ({ ...prev, [racer.id]: stat }))}
                                  className={`py-2 rounded text-xs font-bold cursor-pointer min-h-[36px] flex items-center justify-center ${
                                    trainingStat[racer.id] === stat
                                      ? 'bg-brand-accent text-white'
                                      : 'bg-brand-surface text-gray-400 hover:text-white'
                                  }`}
                                >
                                  {stat.toUpperCase()}
                                </button>
                              ))}
                            </div>
                            <button
                              onClick={() => handleStartTraining(racer.id)}
                              disabled={!trainingStat[racer.id] || trainingLoading === racer.id}
                              className="w-full py-1.5 bg-brand-accent/20 text-brand-accent font-semibold rounded-lg text-xs cursor-pointer disabled:opacity-50"
                            >
                              {trainingLoading === racer.id ? 'Starting...' : 'Start Training'}
                            </button>
                          </>
                        )}
                      </div>
                    )
                  })()}
                </div>)}

                {/* Cosmetic / Accessory badges */}
                {FEATURES.cosmetics && (racer.cosmetic || racer.equipped_accessory || racer.accessory) && (
                  <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
                    {racer.cosmetic && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-pink-500/10 text-pink-400 border-pink-500/30">
                        {'\u{1F3A8}'} {typeof racer.cosmetic === 'string' ? racer.cosmetic : racer.cosmetic.name || 'Cosmetic'}
                      </span>
                    )}
                    {(racer.equipped_accessory || racer.accessory) && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                        {'\u{2699}\uFE0F'} {racer.equipped_accessory || (typeof racer.accessory === 'string' ? racer.accessory : racer.accessory?.name) || 'Accessory'}
                      </span>
                    )}
                  </div>
                )}

                {/* Equipment — Accordion */}
                {FEATURES.cosmetics && (ownedCosmetics.length > 0 || ownedAccessories.length > 0) && (
                  <div className="mt-3">
                    <button
                      onClick={() => toggleSection(`equip-${racer.id}`)}
                      className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-2 cursor-pointer hover:text-white transition-colors"
                    >
                      <span className={`text-xs transition-transform ${expandedSections[`equip-${racer.id}`] ? 'rotate-90' : ''}`}>{'\u25B6'}</span>
                      Equipment
                    </button>
                    {expandedSections[`equip-${racer.id}`] && (
                      <div className="p-3 bg-brand-bg rounded-lg border border-brand-border space-y-2">
                        {ownedCosmetics.length > 0 && (
                          <select
                            value=""
                            onChange={async e => {
                              const cosId = Number(e.target.value)
                              if (!cosId || !address) return
                              try {
                                await api.equipCosmetic(address, racer.id, cosId)
                                loadCollection()
                              } catch (err: any) { toast.error(err.message) }
                            }}
                            className="w-full bg-brand-surface border border-brand-border rounded px-2 py-2 text-white text-xs outline-none min-h-[44px] cursor-pointer"
                          >
                            <option value="">{racer.cosmetic ? `Cosmetic: ${typeof racer.cosmetic === 'string' ? racer.cosmetic : racer.cosmetic.name}` : 'Equip Cosmetic...'}</option>
                            {ownedCosmetics.map((c: any) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        )}
                        {ownedAccessories.length > 0 && (
                          <div className="flex items-center gap-1">
                            <select
                              value=""
                              onChange={async e => {
                                const accId = Number(e.target.value)
                                if (!accId || !address) return
                                try {
                                  await api.equipAccessory(address, racer.id, accId)
                                  loadCollection()
                                } catch (err: any) { toast.error(err.message) }
                              }}
                              className="flex-1 bg-brand-surface border border-brand-border rounded px-2 py-2 text-white text-xs outline-none min-h-[44px] cursor-pointer"
                            >
                              <option value="">{(racer.equipped_accessory || racer.accessory) ? `Accessory: ${racer.equipped_accessory || (typeof racer.accessory === 'string' ? racer.accessory : racer.accessory?.name)}` : 'Equip Accessory...'}</option>
                              {ownedAccessories.map((a: any) => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                              ))}
                            </select>
                            {(racer.equipped_accessory || racer.accessory) && (
                              <button
                                onClick={() => handleUnequipAccessory(racer.id)}
                                className="px-3 py-2 bg-gray-500/20 text-gray-400 rounded text-xs font-bold cursor-pointer min-h-[44px]"
                              >
                                &#x2715;
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Evolve button */}
                {FEATURES.evolution && (
                <button
                  onClick={() => { setEvolveRacerId(racer.id); setEvolveRacerName(racer.name) }}
                  className="w-full mt-3 py-2 bg-brand-accent/20 text-brand-accent font-semibold rounded-lg hover:bg-brand-accent/30 transition-colors cursor-pointer text-sm"
                >
                  Evolve
                </button>
                )}

                {/* Mini Games button */}
                {FEATURES.miniGames && (
                <button
                  onClick={() => setActiveMiniGame({ racerId: racer.id, racerName: racer.name })}
                  className="w-full mt-2 py-2 bg-purple-500/20 text-purple-400 font-semibold rounded-lg hover:bg-purple-500/30 transition-colors cursor-pointer text-sm"
                >
                  Play Mini Games
                </button>
                )}

                {/* Enter Race — prominent */}
                <div className="mt-3 pt-3 border-t border-brand-border space-y-2">
                  <button
                    onClick={() => handleQuickDemoRace(racer.id)}
                    disabled={demoLoading === racer.id}
                    className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-brand-bg text-xl font-black rounded-xl hover:from-yellow-400 hover:to-orange-400 transition-all cursor-pointer shadow-lg shadow-yellow-500/30 disabled:opacity-50 animate-pulse hover:animate-none"
                  >
                    {demoLoading === racer.id ? 'Starting Race...' : '\u26A1 Quick Race'}
                  </button>
                  <button
                    onClick={() => navigate('/race')}
                    className="w-full py-2.5 bg-brand-primary/20 text-brand-primary font-bold rounded-lg hover:bg-brand-primary/30 transition-colors cursor-pointer border border-brand-primary/30"
                  >
                    Browse Races
                  </button>
                </div>

                {/* Evolution Progress */}
                {evoProgress[racer.id] && evoProgress[racer.id].requirements && (
                  <div className="mt-3 pt-3 border-t border-brand-border">
                    {(() => {
                      const evo = evoProgress[racer.id]
                      const reqs = evo.requirements
                      const prog = evo.progress
                      const items = [
                        { label: 'XP', current: prog.xp, target: reqs.xp },
                        { label: 'Races', current: prog.races, target: reqs.races },
                        { label: 'Wins', current: prog.wins, target: reqs.wins },
                        { label: CUR, current: prog.coins, target: reqs.coins },
                        { label: 'Max Stat', current: prog.stat || prog.maxStat, target: reqs.stat },
                      ]
                      const pcts = items.map(i => Math.min(100, Math.round((i.current / i.target) * 100)))
                      const avgPct = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
                      return (
                        <>
                          <div className="text-center mb-2">
                            <span className={`text-lg font-black ${evo.eligible ? 'text-brand-primary' : 'text-brand-gold'}`}>
                              {evo.eligible ? 'Ready to Evolve!' : `${avgPct}% to Tier ${(evo.tier || 0) + 1}`}
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {items.map((item, idx) => (
                              <div key={item.label} className="flex items-center gap-2 text-xs">
                                <span className="text-gray-400 w-14 text-right">{item.label}</span>
                                <div className="flex-1 bg-gray-800 rounded-full h-2.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${pcts[idx] >= 100 ? 'bg-brand-primary' : 'bg-brand-accent'}`}
                                    style={{ width: `${pcts[idx]}%` }}
                                  />
                                </div>
                                <span className="text-gray-500 w-20 text-right">{item.current}/{item.target}</span>
                              </div>
                            ))}
                          </div>
                          {evo.eligible && (
                            <button
                              onClick={() => { setEvolveRacerId(racer.id); setEvolveRacerName(racer.name) }}
                              className="w-full mt-2 py-2 bg-brand-primary text-brand-bg font-bold rounded-lg hover:bg-brand-primary/90 transition-colors cursor-pointer"
                            >
                              Evolve Now
                            </button>
                          )}
                        </>
                      )
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MiniGameModal */}
      {FEATURES.miniGames && activeMiniGame && address && (
        <MiniGameModal
          racerId={activeMiniGame.racerId}
          racerName={activeMiniGame.racerName}
          wallet={address}
          playsLeft={5}
          onClose={() => setActiveMiniGame(null)}
          onGameComplete={() => loadCollection()}
        />
      )}

      {/* Evolution Modal */}
      {FEATURES.evolution && evolveRacerId !== null && address && (
        <EvolutionModal
          racerId={evolveRacerId}
          racerName={evolveRacerName}
          wallet={address}
          onClose={() => setEvolveRacerId(null)}
          onEvolved={() => loadCollection()}
        />
      )}

      {/* Upgrade Overlay */}
      <AnimatePresence>
        {upgradeState !== 'idle' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-brand-surface border border-brand-border rounded-2xl p-8 max-w-md w-full mx-4 text-center"
            >
              {upgradeState === 'paying' && (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="text-6xl mb-4"
                  >&#x1f4b3;</motion.div>
                  <p className="text-xl font-bold mb-2">Processing Payment</p>
                  <p className="text-gray-400">Simulating $3 USDC payment...</p>
                </>
              )}

              {upgradeState === 'burning' && (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.3, 0], opacity: [1, 1, 0] }}
                    transition={{ duration: 1.5 }}
                    className="text-6xl mb-4 inline-block"
                  >{THEME.brand.mark}</motion.div>
                  <motion.div
                    animate={{ scale: [0, 1.5, 1] }}
                    transition={{ delay: 0.5, duration: 1 }}
                    className="text-4xl mb-4"
                  >&#x1f525;</motion.div>
                  <p className="text-xl font-bold mb-2 text-orange-400">Burning {THEME.tiers.free}...</p>
                  <p className="text-gray-400">Your racer is evolving!</p>
                </>
              )}

              {upgradeState === 'revealing' && (
                <>
                  <motion.div
                    initial={{ rotateY: 0 }}
                    animate={{ rotateY: 360 }}
                    transition={{ duration: 1.5, ease: 'easeInOut' }}
                    className="text-7xl mb-4 inline-block"
                    style={{ perspective: '500px' }}
                  >&#x2753;</motion.div>
                  <p className="text-xl font-bold mb-2 text-brand-accent">Revealing Rarity...</p>
                  <p className="text-gray-400">Chainlink VRF determining your racer...</p>
                </>
              )}

              {upgradeState === 'done' && newRacer && (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                    className="text-7xl mb-4"
                  >&#x1f389;</motion.div>
                  <h2 className="text-2xl font-bold text-white mb-2">{newRacer.name}</h2>
                  <span className={`inline-block px-3 py-1 rounded-lg text-sm font-bold uppercase mb-4 ${RARITY_COLORS[newRacer.rarity] || ''}`}>
                    {newRacer.rarity}
                  </span>
                  <p className="text-gray-400 text-sm mb-2 capitalize">
                    Race: {newRacer.race?.replace('_', ' ')}
                  </p>
                  <p className="text-brand-primary font-semibold mb-4">+500 {CUR}</p>
                  {onchainUpgrade.hash && (
                    <div className="mb-4">
                      <a
                        href={`https://sepolia.basescan.org/tx/${onchainUpgrade.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-primary/70 text-xs hover:text-brand-primary transition-colors underline"
                      >
                        View on BaseScan
                      </a>
                    </div>
                  )}
                  <button
                    onClick={closeReveal}
                    className="px-6 py-2.5 bg-brand-primary text-brand-bg font-bold rounded-xl hover:bg-brand-primary/90 transition-colors cursor-pointer"
                  >
                    View in {THEME.locations.home}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
