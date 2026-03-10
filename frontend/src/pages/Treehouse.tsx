import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import WalletConnect from '../components/WalletConnect'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { useUpgrade } from '../hooks/useContracts'
import { CONTRACTS_DEPLOYED } from '../config/contracts'
import QuestPanel from '../components/QuestPanel'
import EvolutionModal from '../components/EvolutionModal'
import MiniGameModal from '../components/MiniGameModal'
import Spinner from '../components/Spinner'
import { FEATURES } from '../config/features'

const EVOLUTION_PATH_ICONS: Record<string, string> = {
  caffeine: '\u26A1',
  hibernate: '\u{1F6E1}\uFE0F',
  dreamwalk: '\u{1F52E}',
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

const SLOTH_EMOJI: Record<string, string> = {
  caffeine_junkie: '\u{1F9A5}',
  pillow_knight: '\u{1F6E1}\uFE0F',
  dream_weaver: '\u{2728}',
  thunder_nap: '\u{26A1}',
}

type UpgradeState = 'idle' | 'paying' | 'burning' | 'revealing' | 'done'

export default function Treehouse() {
  const { address, isConnected } = useAccount()
  const navigate = useNavigate()
  const [sloths, setSloths] = useState<any[]>([])
  const [coinBalance, setCoinBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [upgradeState, setUpgradeState] = useState<UpgradeState>('idle')
  const [newSloth, setNewSloth] = useState<any>(null)
  const onchainUpgrade = useUpgrade()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [streaks, setStreaks] = useState<Record<number, { current_wins: number; max_wins: number; current_losses: number; total_races: number; total_wins: number }>>({})
  const [upgradeProgress, setUpgradeProgress] = useState<{ xp: number; races: number; wins: number; loginDays: number; requirements: { xp: number; races: number; wins: number; loginDays: number }; eligible: boolean } | null>(null)
  const [trainings, setTrainings] = useState<{ slothId: number; slothName: string; stat: string; startedAt: string; completedAt: string; isReady: boolean }[]>([])
  const [trainingStat, setTrainingStat] = useState<Record<number, string>>({})
  const [trainingLoading, setTrainingLoading] = useState<number | null>(null)
  const [weeklyTrainingCounts, setWeeklyTrainingCounts] = useState<Record<number, number>>({})
  const [evolveSlothId, setEvolveSlothId] = useState<number | null>(null)
  const [evolveSlothName, setEvolveSlothName] = useState<string>('')
  const [ownedCosmetics, setOwnedCosmetics] = useState<any[]>([])
  const [ownedAccessories, setOwnedAccessories] = useState<any[]>([])
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [questsOpen, setQuestsOpen] = useState(true)
  const [activeMiniGame, setActiveMiniGame] = useState<{ slothId: number; slothName: string } | null>(null)
  const [demoLoading, setDemoLoading] = useState<number | null>(null)

  async function handleQuickDemoRace(slothId: number) {
    if (!address || demoLoading) return
    setDemoLoading(slothId)
    try {
      const race = await api.createRace(address, slothId, 'exhibition')
      await api.joinRace(race.raceId, slothId, address)
      await api.startBidding(race.raceId)
      const result = await api.simulateRace(race.raceId)
      navigate(`/race/${race.raceId}`, {
        state: { raceResult: result, format: 'exhibition', slothId, demo: true }
      })
    } catch (err: any) {
      toast.error(err.message)
    }
    setDemoLoading(null)
  }

  async function loadTreehouse() {
    if (!address) return
    setLoading(true)
    try {
      const data = await api.getTreehouse(address)
      setSloths(data.sloths)
      setCoinBalance(data.coinBalance)
    } catch (err) { console.error('Failed to load treehouse:', err); toast.error('Failed to load data. Please refresh.') }
    setLoading(false)
  }

  useEffect(() => { loadTreehouse() }, [address])

  // Trigger treehouse_visit quest progress
  useEffect(() => {
    if (!address) return
    api.trackQuestProgress(address, 'treehouse_visit').catch((err) => { console.error('Failed to track quest:', err) })
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
      for (const s of data.streaks) map[s.sloth_id] = s
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

  const freeSloth = sloths.find(s => s.type === 'free_sloth')
  const slothList = sloths.filter(s => s.type === 'sloth')

  // On-chain upgrade success: register in backend
  useEffect(() => {
    if (onchainUpgrade.isSuccess && address) {
      api.upgradeSloth(address).then((data: any) => {
        setNewSloth(data.sloth)
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

    if (CONTRACTS_DEPLOYED && freeSloth) {
      // On-chain: burn Free Sloth + mint Sloth
      const stats = { spd: 12, acc: 11, sta: 10, agi: 11, ref: 10, lck: 12 }
      onchainUpgrade.upgrade(BigInt(freeSloth.id), 0, stats)
      setUpgradeState('revealing')
    } else {
      // Mock fallback
      await new Promise(r => setTimeout(r, 1500))
      setUpgradeState('revealing')

      try {
        const data = await api.upgradeSloth(address)
        setNewSloth(data.sloth)
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
      setNewSloth(data.sloth)
      await new Promise(r => setTimeout(r, 2000))
      setUpgradeState('done')
      setCoinBalance(prev => prev + data.coinBonus)
    } catch (err: any) {
      toast.error(err.message)
      setUpgradeState('idle')
    }
  }

  async function handleRename(slothId: number) {
    if (!address || editName.trim().length < 3) return
    try {
      await api.renameSloth(address, slothId, editName.trim())
      setSloths(prev => prev.map(s => s.id === slothId ? { ...s, name: editName.trim() } : s))
      setEditingId(null)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  async function handleStartTraining(slothId: number) {
    if (!address) return
    const stat = trainingStat[slothId]
    if (!stat) return
    setTrainingLoading(slothId)
    try {
      await api.startTraining(address, slothId, stat)
      loadTrainings()
      loadTreehouse()
    } catch (err: any) {
      toast.error(err.message)
    }
    setTrainingLoading(null)
  }

  async function handleClaimTraining(slothId: number) {
    if (!address) return
    setTrainingLoading(slothId)
    try {
      await api.claimTraining(address, slothId)
      loadTrainings()
      loadTreehouse()
    } catch (err: any) {
      toast.error(err.message)
    }
    setTrainingLoading(null)
  }

  async function handleUnequipAccessory(slothId: number) {
    if (!address) return
    try {
      await api.unequipAccessory(address, slothId)
      loadTreehouse()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  function toggleSection(key: string) {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function closeReveal() {
    setUpgradeState('idle')
    setNewSloth(null)
    loadTreehouse()
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-400">Connect your wallet to view your treehouse</p>
        <WalletConnect />
      </div>
    )
  }

  if (loading) {
    return <Spinner fullPage text="Loading treehouse..." />
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Your Treehouse</h1>
          <p className="text-gray-400 mt-1">
            {sloths.length === 0 ? 'No sloths yet' : `${sloths.length} creature${sloths.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-sloth-card border border-sloth-border rounded-xl px-4 py-2">
          <span className="text-sloth-green font-bold text-lg">{coinBalance}</span>
          <span className="text-sloth-green/70 text-sm">ZZZ</span>
        </div>
      </div>

      {/* Empty state */}
      {sloths.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">&#x1f3da;&#xfe0f;</div>
          <p className="text-gray-400 mb-4">Your treehouse is empty</p>
          <button
            onClick={() => navigate('/mint')}
            className="px-6 py-2.5 bg-sloth-green text-sloth-dark font-bold rounded-xl hover:bg-sloth-green/90 transition-colors cursor-pointer"
          >
            Mint Your First Sloth
          </button>
        </div>
      )}

      {/* Free Sloth Card — Full Featured */}
      {freeSloth && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-300 mb-3">Free Sloth</h2>
          <div className="bg-sloth-card border border-sloth-border rounded-xl p-5">
            {/* Header */}
            <div className="flex items-center gap-4 mb-4">
              <div className="text-5xl">{'\u{1F9A5}'}</div>
              <div className="flex-1">
                <p className="text-white font-semibold text-lg">{freeSloth.name}</p>
                <p className="text-gray-500 text-sm">Free Sloth #{freeSloth.id}</p>
              </div>
              <button
                onClick={handleUpgrade}
                disabled={upgradeState !== 'idle'}
                className="px-4 py-2 bg-sloth-purple text-white font-bold rounded-xl text-sm hover:bg-sloth-purple/90 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                Upgrade — $3
              </button>
            </div>

            {/* Stat Grid (cap: 15) */}
            <div className="grid grid-cols-3 gap-1 text-center text-xs mb-3">
              {[
                { label: 'SPD', val: freeSloth.spd },
                { label: 'ACC', val: freeSloth.acc },
                { label: 'STA', val: freeSloth.sta },
                { label: 'AGI', val: freeSloth.agi },
                { label: 'REF', val: freeSloth.ref },
                { label: 'LCK', val: freeSloth.lck },
              ].map(s => (
                <div key={s.label} className="bg-sloth-dark rounded px-1 py-1">
                  <span className="text-gray-500">{s.label} </span>
                  <span className="text-white font-bold">{Number(s.val || 0) % 1 === 0 ? (s.val || 0) : Number(s.val || 0).toFixed(1)}</span>
                  <span className="text-gray-600 text-[10px]">/15</span>
                </div>
              ))}
            </div>

            {/* Training UI — Accordion */}
            {FEATURES.training && (<div className="mt-3">
              <button
                onClick={() => toggleSection(`training-${freeSloth.id}`)}
                className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-2 cursor-pointer hover:text-white transition-colors"
              >
                <span className={`text-xs transition-transform ${expandedSections[`training-${freeSloth.id}`] || trainings.find(t => t.slothId === freeSloth.id) ? 'rotate-90' : ''}`}>{'\u25B6'}</span>
                Training
                {trainings.find(t => t.slothId === freeSloth.id) && (
                  <span className="text-sloth-purple text-xs font-normal ml-1">(Active)</span>
                )}
              </button>
              {(expandedSections[`training-${freeSloth.id}`] || trainings.find(t => t.slothId === freeSloth.id)) && (() => {
                const active = trainings.find(t => t.slothId === freeSloth.id)
                if (active) {
                  return (
                    <div className="p-3 bg-sloth-dark rounded-lg border border-sloth-border">
                      <p className="text-xs text-gray-400 mb-1">Training {active.stat.toUpperCase()}</p>
                      {active.isReady ? (
                        <button
                          onClick={() => handleClaimTraining(freeSloth.id)}
                          disabled={trainingLoading === freeSloth.id}
                          className="w-full py-1.5 bg-sloth-green text-sloth-dark font-bold rounded-lg text-xs cursor-pointer disabled:opacity-50"
                        >
                          {trainingLoading === freeSloth.id ? 'Claiming...' : 'Claim +0.3 ' + active.stat.toUpperCase()}
                        </button>
                      ) : (
                        <p className="text-xs text-sloth-purple">
                          Ready at {new Date(active.completedAt).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  )
                }
                const weeklyCount = weeklyTrainingCounts[freeSloth.id] || 0
                const weeklyLimit = 1
                const limitReached = weeklyCount >= weeklyLimit
                return (
                  <div className="p-3 bg-sloth-dark rounded-lg border border-sloth-border">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-400">Train a stat (6h, 10 ZZZ)</p>
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
                              onClick={() => setTrainingStat(prev => ({ ...prev, [freeSloth.id]: stat }))}
                              className={`py-2 rounded text-xs font-bold cursor-pointer min-h-[36px] flex items-center justify-center ${
                                trainingStat[freeSloth.id] === stat
                                  ? 'bg-sloth-purple text-white'
                                  : 'bg-sloth-card text-gray-400 hover:text-white'
                              }`}
                            >
                              {stat.toUpperCase()}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => handleStartTraining(freeSloth.id)}
                          disabled={!trainingStat[freeSloth.id] || trainingLoading === freeSloth.id}
                          className="w-full py-1.5 bg-sloth-purple/20 text-sloth-purple font-semibold rounded-lg text-xs cursor-pointer disabled:opacity-50"
                        >
                          {trainingLoading === freeSloth.id ? 'Starting...' : 'Start Training'}
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
                  onClick={() => toggleSection(`equip-${freeSloth.id}`)}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-2 cursor-pointer hover:text-white transition-colors"
                >
                  <span className={`text-xs transition-transform ${expandedSections[`equip-${freeSloth.id}`] ? 'rotate-90' : ''}`}>{'\u25B6'}</span>
                  Equipment
                </button>
                {expandedSections[`equip-${freeSloth.id}`] && (
                  <div className="p-3 bg-sloth-dark rounded-lg border border-sloth-border space-y-2">
                    {ownedCosmetics.length > 0 && (
                      <select
                        value=""
                        onChange={async e => {
                          const cosId = Number(e.target.value)
                          if (!cosId || !address) return
                          try {
                            await api.equipCosmetic(address, freeSloth.id, cosId)
                            loadTreehouse()
                          } catch (err: any) { toast.error(err.message) }
                        }}
                        className="w-full bg-sloth-card border border-sloth-border rounded px-2 py-2 text-white text-xs outline-none min-h-[44px] cursor-pointer"
                      >
                        <option value="">{freeSloth.cosmetic ? `Cosmetic: ${typeof freeSloth.cosmetic === 'string' ? freeSloth.cosmetic : freeSloth.cosmetic.name}` : 'Equip Cosmetic...'}</option>
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
                            await api.equipAccessory(address, freeSloth.id, accId)
                            loadTreehouse()
                          } catch (err: any) { toast.error(err.message) }
                        }}
                        className="w-full bg-sloth-card border border-sloth-border rounded px-2 py-2 text-white text-xs outline-none min-h-[44px] cursor-pointer"
                      >
                        <option value="">{(freeSloth.equipped_accessory || freeSloth.accessory) ? `Accessory: ${freeSloth.equipped_accessory || (typeof freeSloth.accessory === 'string' ? freeSloth.accessory : freeSloth.accessory?.name)}` : 'Equip Accessory...'}</option>
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
              onClick={() => setActiveMiniGame({ slothId: freeSloth.id, slothName: freeSloth.name })}
              className="w-full mt-3 py-2 bg-purple-500/20 text-purple-400 font-semibold rounded-lg hover:bg-purple-500/30 transition-colors cursor-pointer text-sm"
            >
              Play Mini Games
            </button>
            )}

            {/* Enter Race — Exhibition only */}
            <div className="mt-3 pt-3 border-t border-sloth-border space-y-2">
              <button
                onClick={() => navigate('/race')}
                className="w-full py-3 bg-sloth-green text-sloth-dark text-lg font-bold rounded-lg hover:bg-sloth-green/90 transition-colors cursor-pointer shadow-lg shadow-sloth-green/20"
              >
                Enter Exhibition Race
              </button>
              {FEATURES.demoRace && (
                <button
                  onClick={() => handleQuickDemoRace(freeSloth.id)}
                  disabled={demoLoading === freeSloth.id}
                  className="w-full py-2 bg-yellow-500/20 text-yellow-400 font-bold rounded-lg hover:bg-yellow-500/30 transition-colors cursor-pointer text-sm border border-yellow-500/30 disabled:opacity-50"
                >
                  {demoLoading === freeSloth.id ? 'Creating Demo Race...' : 'Quick Demo Race (20s)'}
                </button>
              )}
            </div>

            {/* Upgrade Section */}
            <div className="mt-4 pt-4 border-t border-sloth-border">
              <p className="text-gray-400 text-xs text-center mb-3">Upgrade to unlock all race formats</p>
            </div>
          </div>

          {/* Free Upgrade Path */}
          {upgradeProgress && (
            <div className="mt-4 bg-sloth-dark border border-sloth-border rounded-xl p-5">
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
                      <p className={`text-xs font-semibold mb-1 ${done ? 'text-sloth-green' : 'text-gray-400'}`}>
                        {done ? '\u2705 ' : ''}{item.label}
                      </p>
                      <div className="w-full bg-sloth-border rounded-full h-1.5 mb-1">
                        <div
                          className={`h-1.5 rounded-full transition-all ${done ? 'bg-sloth-green' : 'bg-sloth-purple'}`}
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
                  className="w-full mt-4 py-2.5 bg-sloth-green text-sloth-dark font-bold rounded-xl hover:bg-sloth-green/90 transition-colors disabled:opacity-50 cursor-pointer"
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

      {/* Sloth Cards */}
      {slothList.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-300 mb-3">Sloths</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {slothList.map((sloth) => (
              <div
                key={sloth.id}
                className={`bg-sloth-card border-2 ${RARITY_BORDER[sloth.rarity] || 'border-sloth-border'} rounded-xl p-5`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    {editingId === sloth.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRename(sloth.id); if (e.key === 'Escape') setEditingId(null) }}
                          maxLength={20}
                          className="bg-sloth-dark border border-sloth-green rounded px-2 py-0.5 text-white text-sm w-32 outline-none"
                          autoFocus
                        />
                        <button onClick={() => handleRename(sloth.id)} className="text-sloth-green text-xs cursor-pointer">&#x2714;</button>
                        <button onClick={() => setEditingId(null)} className="text-gray-500 text-xs cursor-pointer">&#x2716;</button>
                      </div>
                    ) : (
                      <p className="text-white font-bold text-lg flex items-center gap-1.5">
                        {sloth.name}
                        <button
                          onClick={() => { setEditingId(sloth.id); setEditName(sloth.name) }}
                          className="text-gray-500 hover:text-sloth-green transition-colors cursor-pointer"
                          title="Rename"
                        >
                          &#x270F;&#xFE0F;
                        </button>
                      </p>
                    )}
                    <p className="text-gray-500 text-xs">
                      Sloth #{sloth.id}
                      {sloth.tier && sloth.tier > 1 && (
                        <span className="ml-1 text-yellow-400" title={`Tier ${sloth.tier}`}>
                          {'\u2B50'.repeat(sloth.tier)}
                        </span>
                      )}
                      {sloth.evolution_path && EVOLUTION_PATH_ICONS[sloth.evolution_path] && (
                        <span className="ml-1" title={sloth.evolution_path}>
                          {EVOLUTION_PATH_ICONS[sloth.evolution_path]}
                        </span>
                      )}
                    </p>
                    {sloth.passive && (
                      <p className="text-sloth-purple text-[10px] mt-0.5">{sloth.passive}</p>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${RARITY_COLORS[sloth.rarity] || ''}`}>
                    {sloth.rarity}
                  </span>
                </div>

                {/* Streak badge */}
                {streaks[sloth.id] && streaks[sloth.id].current_wins >= 3 && (
                  <div className="text-center mb-1">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                      streaks[sloth.id].current_wins >= 5
                        ? 'bg-red-500/20 text-red-400 border border-red-500'
                        : 'bg-orange-500/20 text-orange-400 border border-orange-500'
                    }`}>
                      {streaks[sloth.id].current_wins >= 5 ? 'UNSTOPPABLE!' : `${streaks[sloth.id].current_wins} Win Streak`} &#x1F525;
                    </span>
                  </div>
                )}
                {streaks[sloth.id] && streaks[sloth.id].current_losses >= 3 && (
                  <div className="text-center mb-1">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-gray-700/50 text-gray-400">
                      &#x1F622; Needs some motivation!
                    </span>
                  </div>
                )}

                <div className="text-4xl text-center mb-3">
                  {SLOTH_EMOJI[sloth.race] || '\u{1F9A5}'}
                </div>

                <p className="text-gray-400 text-xs text-center mb-3 capitalize">
                  {sloth.race?.replace('_', ' ')}
                </p>

                <div className="grid grid-cols-3 gap-1 mt-3 text-center text-xs">
                  {[
                    { label: 'SPD', val: sloth.spd },
                    { label: 'ACC', val: sloth.acc },
                    { label: 'STA', val: sloth.sta },
                    { label: 'AGI', val: sloth.agi },
                    { label: 'REF', val: sloth.ref },
                    { label: 'LCK', val: sloth.lck },
                  ].map(s => (
                    <div key={s.label} className="bg-sloth-dark rounded px-1 py-1">
                      <span className="text-gray-500">{s.label} </span>
                      <span className="text-white font-bold">{Number(s.val) % 1 === 0 ? s.val : Number(s.val).toFixed(1)}</span>
                    </div>
                  ))}
                </div>

                {/* Achievement Badges */}
                {streaks[sloth.id] && (() => {
                  const s = streaks[sloth.id]
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

                {streaks[sloth.id] && streaks[sloth.id].total_races > 0 && (
                  <div className="flex items-center justify-center gap-3 mt-2 text-xs text-gray-500">
                    <span>{streaks[sloth.id].total_races} races</span>
                    <span>{streaks[sloth.id].total_wins} wins</span>
                    <span>Best: {streaks[sloth.id].max_wins}&#x1F525;</span>
                  </div>
                )}

                {/* Training UI — Accordion */}
                {FEATURES.training && (<div className="mt-3">
                  <button
                    onClick={() => toggleSection(`training-${sloth.id}`)}
                    className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-2 cursor-pointer hover:text-white transition-colors"
                  >
                    <span className={`text-xs transition-transform ${expandedSections[`training-${sloth.id}`] || trainings.find(t => t.slothId === sloth.id) ? 'rotate-90' : ''}`}>{'\u25B6'}</span>
                    Training
                    {trainings.find(t => t.slothId === sloth.id) && (
                      <span className="text-sloth-purple text-xs font-normal ml-1">(Active)</span>
                    )}
                  </button>
                  {(expandedSections[`training-${sloth.id}`] || trainings.find(t => t.slothId === sloth.id)) && (() => {
                    const active = trainings.find(t => t.slothId === sloth.id)
                    if (active) {
                      return (
                        <div className="p-3 bg-sloth-dark rounded-lg border border-sloth-border">
                          <p className="text-xs text-gray-400 mb-1">Training {active.stat.toUpperCase()}</p>
                          {active.isReady ? (
                            <button
                              onClick={() => handleClaimTraining(sloth.id)}
                              disabled={trainingLoading === sloth.id}
                              className="w-full py-1.5 bg-sloth-green text-sloth-dark font-bold rounded-lg text-xs cursor-pointer disabled:opacity-50"
                            >
                              {trainingLoading === sloth.id ? 'Claiming...' : 'Claim +0.3 ' + active.stat.toUpperCase()}
                            </button>
                          ) : (
                            <p className="text-xs text-sloth-purple">
                              Ready at {new Date(active.completedAt).toLocaleTimeString()}
                            </p>
                          )}
                        </div>
                      )
                    }
                    const weeklyCount = weeklyTrainingCounts[sloth.id] || 0
                    const weeklyLimit = sloth.type === 'free_sloth' ? 1 : 2
                    const limitReached = weeklyCount >= weeklyLimit
                    return (
                      <div className="p-3 bg-sloth-dark rounded-lg border border-sloth-border">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-gray-400">Train a stat (6h, 10 ZZZ)</p>
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
                                  onClick={() => setTrainingStat(prev => ({ ...prev, [sloth.id]: stat }))}
                                  className={`py-2 rounded text-xs font-bold cursor-pointer min-h-[36px] flex items-center justify-center ${
                                    trainingStat[sloth.id] === stat
                                      ? 'bg-sloth-purple text-white'
                                      : 'bg-sloth-card text-gray-400 hover:text-white'
                                  }`}
                                >
                                  {stat.toUpperCase()}
                                </button>
                              ))}
                            </div>
                            <button
                              onClick={() => handleStartTraining(sloth.id)}
                              disabled={!trainingStat[sloth.id] || trainingLoading === sloth.id}
                              className="w-full py-1.5 bg-sloth-purple/20 text-sloth-purple font-semibold rounded-lg text-xs cursor-pointer disabled:opacity-50"
                            >
                              {trainingLoading === sloth.id ? 'Starting...' : 'Start Training'}
                            </button>
                          </>
                        )}
                      </div>
                    )
                  })()}
                </div>)}

                {/* Cosmetic / Accessory badges */}
                {FEATURES.cosmetics && (sloth.cosmetic || sloth.equipped_accessory || sloth.accessory) && (
                  <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
                    {sloth.cosmetic && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-pink-500/10 text-pink-400 border-pink-500/30">
                        {'\u{1F3A8}'} {typeof sloth.cosmetic === 'string' ? sloth.cosmetic : sloth.cosmetic.name || 'Cosmetic'}
                      </span>
                    )}
                    {(sloth.equipped_accessory || sloth.accessory) && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                        {'\u{2699}\uFE0F'} {sloth.equipped_accessory || (typeof sloth.accessory === 'string' ? sloth.accessory : sloth.accessory?.name) || 'Accessory'}
                      </span>
                    )}
                  </div>
                )}

                {/* Equipment — Accordion */}
                {FEATURES.cosmetics && (ownedCosmetics.length > 0 || ownedAccessories.length > 0) && (
                  <div className="mt-3">
                    <button
                      onClick={() => toggleSection(`equip-${sloth.id}`)}
                      className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-2 cursor-pointer hover:text-white transition-colors"
                    >
                      <span className={`text-xs transition-transform ${expandedSections[`equip-${sloth.id}`] ? 'rotate-90' : ''}`}>{'\u25B6'}</span>
                      Equipment
                    </button>
                    {expandedSections[`equip-${sloth.id}`] && (
                      <div className="p-3 bg-sloth-dark rounded-lg border border-sloth-border space-y-2">
                        {ownedCosmetics.length > 0 && (
                          <select
                            value=""
                            onChange={async e => {
                              const cosId = Number(e.target.value)
                              if (!cosId || !address) return
                              try {
                                await api.equipCosmetic(address, sloth.id, cosId)
                                loadTreehouse()
                              } catch (err: any) { toast.error(err.message) }
                            }}
                            className="w-full bg-sloth-card border border-sloth-border rounded px-2 py-2 text-white text-xs outline-none min-h-[44px] cursor-pointer"
                          >
                            <option value="">{sloth.cosmetic ? `Cosmetic: ${typeof sloth.cosmetic === 'string' ? sloth.cosmetic : sloth.cosmetic.name}` : 'Equip Cosmetic...'}</option>
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
                                  await api.equipAccessory(address, sloth.id, accId)
                                  loadTreehouse()
                                } catch (err: any) { toast.error(err.message) }
                              }}
                              className="flex-1 bg-sloth-card border border-sloth-border rounded px-2 py-2 text-white text-xs outline-none min-h-[44px] cursor-pointer"
                            >
                              <option value="">{(sloth.equipped_accessory || sloth.accessory) ? `Accessory: ${sloth.equipped_accessory || (typeof sloth.accessory === 'string' ? sloth.accessory : sloth.accessory?.name)}` : 'Equip Accessory...'}</option>
                              {ownedAccessories.map((a: any) => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                              ))}
                            </select>
                            {(sloth.equipped_accessory || sloth.accessory) && (
                              <button
                                onClick={() => handleUnequipAccessory(sloth.id)}
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
                  onClick={() => { setEvolveSlothId(sloth.id); setEvolveSlothName(sloth.name) }}
                  className="w-full mt-3 py-2 bg-sloth-purple/20 text-sloth-purple font-semibold rounded-lg hover:bg-sloth-purple/30 transition-colors cursor-pointer text-sm"
                >
                  Evolve
                </button>
                )}

                {/* Mini Games button */}
                {FEATURES.miniGames && (
                <button
                  onClick={() => setActiveMiniGame({ slothId: sloth.id, slothName: sloth.name })}
                  className="w-full mt-2 py-2 bg-purple-500/20 text-purple-400 font-semibold rounded-lg hover:bg-purple-500/30 transition-colors cursor-pointer text-sm"
                >
                  Play Mini Games
                </button>
                )}

                {/* Enter Race — prominent */}
                <div className="mt-3 pt-3 border-t border-sloth-border space-y-2">
                  <button
                    onClick={() => navigate('/race')}
                    className="w-full py-3 bg-sloth-green text-sloth-dark text-lg font-bold rounded-lg hover:bg-sloth-green/90 transition-colors cursor-pointer shadow-lg shadow-sloth-green/20"
                  >
                    Enter Race
                  </button>
                  {FEATURES.demoRace && (
                    <button
                      onClick={() => handleQuickDemoRace(sloth.id)}
                      disabled={demoLoading === sloth.id}
                      className="w-full py-2 bg-yellow-500/20 text-yellow-400 font-bold rounded-lg hover:bg-yellow-500/30 transition-colors cursor-pointer text-sm border border-yellow-500/30 disabled:opacity-50"
                    >
                      {demoLoading === sloth.id ? 'Creating Demo Race...' : 'Quick Demo Race (20s)'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MiniGameModal */}
      {FEATURES.miniGames && activeMiniGame && address && (
        <MiniGameModal
          slothId={activeMiniGame.slothId}
          slothName={activeMiniGame.slothName}
          wallet={address}
          playsLeft={5}
          onClose={() => setActiveMiniGame(null)}
          onGameComplete={() => loadTreehouse()}
        />
      )}

      {/* Evolution Modal */}
      {FEATURES.evolution && evolveSlothId !== null && address && (
        <EvolutionModal
          slothId={evolveSlothId}
          slothName={evolveSlothName}
          wallet={address}
          onClose={() => setEvolveSlothId(null)}
          onEvolved={() => loadTreehouse()}
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
              className="bg-sloth-card border border-sloth-border rounded-2xl p-8 max-w-md w-full mx-4 text-center"
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
                  >&#x1f9a5;</motion.div>
                  <motion.div
                    animate={{ scale: [0, 1.5, 1] }}
                    transition={{ delay: 0.5, duration: 1 }}
                    className="text-4xl mb-4"
                  >&#x1f525;</motion.div>
                  <p className="text-xl font-bold mb-2 text-orange-400">Burning Free Sloth...</p>
                  <p className="text-gray-400">Your sloth is evolving!</p>
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
                  <p className="text-xl font-bold mb-2 text-sloth-purple">Revealing Rarity...</p>
                  <p className="text-gray-400">Chainlink VRF determining your sloth...</p>
                </>
              )}

              {upgradeState === 'done' && newSloth && (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                    className="text-7xl mb-4"
                  >&#x1f389;</motion.div>
                  <h2 className="text-2xl font-bold text-white mb-2">{newSloth.name}</h2>
                  <span className={`inline-block px-3 py-1 rounded-lg text-sm font-bold uppercase mb-4 ${RARITY_COLORS[newSloth.rarity] || ''}`}>
                    {newSloth.rarity}
                  </span>
                  <p className="text-gray-400 text-sm mb-2 capitalize">
                    Race: {newSloth.race?.replace('_', ' ')}
                  </p>
                  <p className="text-sloth-green font-semibold mb-4">+500 ZZZ Coins</p>
                  {onchainUpgrade.hash && (
                    <div className="mb-4">
                      <a
                        href={`https://sepolia.basescan.org/tx/${onchainUpgrade.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sloth-green/70 text-xs hover:text-sloth-green transition-colors underline"
                      >
                        View on BaseScan
                      </a>
                    </div>
                  )}
                  <button
                    onClick={closeReveal}
                    className="px-6 py-2.5 bg-sloth-green text-sloth-dark font-bold rounded-xl hover:bg-sloth-green/90 transition-colors cursor-pointer"
                  >
                    View in Treehouse
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
