import { useWallet } from '../hooks/useWallet'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import WalletConnect from '../components/WalletConnect'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { THEME, rarityLabel, archetypeLabel } from '../config/theme'
import RacerPortrait from '../components/RacerPortrait'
import { useUpgrade } from '../hooks/useContracts'
import { CONTRACTS_DEPLOYED } from '../config/contracts'
import Spinner from '../components/Spinner'

const EVOLUTION_PATH_ICONS: Record<string, string> = {
  speed: '\u26A1',
  endurance: '\u{1F6E1}\uFE0F',
  luck: '\u{1F52E}',
}

const RARITY_COLORS: Record<string, string> = {
  common: 'bg-gray-600 text-brand-ink',
  uncommon: 'bg-green-600 text-green-100',
  rare: 'bg-blue-600 text-blue-100',
  epic: 'bg-purple-600 text-purple-100',
  legendary: 'bg-brand-gold text-brand-ink',
}

const RARITY_BORDER: Record<string, string> = {
  common: 'border-gray-600',
  uncommon: 'border-brand-primary',
  rare: 'border-brand-ink',
  epic: 'border-brand-accent',
  legendary: 'border-brand-gold',
}

type UpgradeState = 'idle' | 'paying' | 'burning' | 'revealing' | 'done'

export default function Collection() {
  const { address, isConnected } = useWallet()
  const navigate = useNavigate()
  const [racers, setRacers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [upgradeState, setUpgradeState] = useState<UpgradeState>('idle')
  const [newRacer, setNewRacer] = useState<any>(null)
  const onchainUpgrade = useUpgrade()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [streaks, setStreaks] = useState<Record<number, { current_wins: number; max_wins: number; current_losses: number; total_races: number; total_wins: number }>>({})
  const [upgradeProgress, setUpgradeProgress] = useState<{ xp: number; races: number; wins: number; requirements: { xp: number; races: number; wins: number }; eligible: boolean } | null>(null)
  const [demoLoading, setDemoLoading] = useState<number | null>(null)

  async function handleQuickDemoRace(racerId: number) {
    if (!address || demoLoading) return
    setDemoLoading(racerId)
    try {
      const race = await api.createRace(address, racerId, 'sprint')
      await api.joinRace(race.raceId, racerId, address)
      await api.startRace(race.raceId)
      const result = await api.simulateRace(race.raceId)
      navigate(`/race/${race.raceId}`, {
        state: { raceResult: result, format: 'sprint', racerId, demo: true }
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
    } catch (err) { console.error('Failed to load collection:', err); toast.error('Failed to load data. Please refresh.') }
    setLoading(false)
  }

  useEffect(() => { loadCollection() }, [address])

  // Load free upgrade progress
  useEffect(() => {
    if (!address) return
    api.getUpgradeProgress(address).then(setUpgradeProgress).catch((err) => { console.error('Failed to load upgrade progress:', err) })
  }, [address])

  useEffect(() => {
    if (!address) return
    api.getStreaks(address).then(data => {
      const map: Record<number, any> = {}
      for (const s of data.streaks) map[s.racer_id] = s
      setStreaks(map)
    }).catch((err) => { console.error('Failed to load streaks:', err) })
  }, [address])

  const freeRacer = racers.find(s => s.type === 'free')
  const racerList = racers.filter(s => s.type === 'pro')

  // On-chain upgrade success: register in backend
  useEffect(() => {
    if (onchainUpgrade.isSuccess && address) {
      api.upgradeRacer(address).then((data: any) => {
        setNewRacer(data.racer)
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

  function closeReveal() {
    setUpgradeState('idle')
    setNewRacer(null)
    loadCollection()
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-brand-dust">Connect your wallet to view your collection</p>
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
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold">{THEME.locations.home}</h1>
        </div>
      </div>

      {/* Empty state */}
      {racers.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">&#x1f3da;&#xfe0f;</div>
          <p className="text-brand-dust mb-4">Your collection is empty</p>
          <button
            onClick={() => navigate('/mint')}
            className="px-6 py-2.5 bg-brand-primary text-brand-surface font-bold rounded-xl hover:bg-brand-primary/90 transition-colors cursor-pointer"
          >
            Mint Your First Racer
          </button>
        </div>
      )}

      {/* Free Racer Card — Full Featured */}
      {freeRacer && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-brand-ink/80 mb-3">{THEME.tiers.free}</h2>
          <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
            {/* Header */}
            <div className="flex items-center gap-4 mb-4">
              <div className="text-5xl">{THEME.brand.mark}</div>
              <div className="flex-1">
                <p className="text-brand-ink font-semibold text-lg">{freeRacer.name}</p>
                <p className="text-brand-dust text-sm">{THEME.tiers.free} #{freeRacer.id}</p>
              </div>
              <button
                onClick={handleUpgrade}
                disabled={upgradeState !== 'idle'}
                className="px-4 py-2 bg-brand-accent text-brand-ink font-bold rounded-xl text-sm hover:bg-brand-accent/90 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                Upgrade — $3
              </button>
            </div>

            {/* The ceiling is whatever the server says it is. It was written
                here as the literal "/15", so the day the cap moved the card
                showed one number while the server enforced another — and the
                player would have believed the card. */}
            <div className="grid grid-cols-3 gap-1 text-center text-xs mb-3">
              {[
                { label: 'SPD', val: freeRacer.spd },
                { label: 'ACC', val: freeRacer.acc },
                { label: 'STA', val: freeRacer.sta },
                { label: 'AGI', val: freeRacer.agi },
                { label: 'REF', val: freeRacer.ref },
                { label: 'LCK', val: freeRacer.lck },
              ].map(s => (
                <div key={s.label} className="rounded px-1 py-1">
                  <span className="text-brand-dust">{s.label} </span>
                  <span className="text-brand-ink font-bold">{Number(s.val || 0) % 1 === 0 ? (s.val || 0) : Number(s.val || 0).toFixed(1)}</span>
                  {freeRacer.statCap && (
                    <span className="text-brand-dust/70 text-[10px]">/{freeRacer.statCap}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Training UI — Accordion */}
            
            {/* Equipment — Accordion */}
            
            {/* Mini Games button */}
            
            {/* Enter Race — Exhibition only */}
            <div className="mt-3 pt-3 border-t border-brand-border space-y-2">
              {/* The Wind-Up had neither bar. It is the racer every new player
                  owns and the only one most of them will ever own, so "when do I
                  get better?" was unanswered for exactly the person asking it —
                  the bars went onto the Showcase cards, which you only see after
                  paying $3. */}
              <TierProgress racer={freeRacer} />
              <DailyBudget racer={freeRacer} />
              <ItemStock racer={freeRacer} />
              <button
                onClick={() => handleQuickDemoRace(freeRacer.id)}
                disabled={demoLoading === freeRacer.id}
                className="toy-btn w-full py-4 bg-brand-primary text-brand-surface text-xl font-black"
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

            {/* "Upgrade to unlock all race formats" used to sit here, and it was
                not true: the gate that barred free racers from every paid format
                was removed when racing stopped costing anything. It was selling
                the $3 upgrade on a lock that no longer exists, which is the one
                thing a payment prompt must never do. */}
          </div>

          {/* Free Upgrade Path */}
          {upgradeProgress && (
            <div className="mt-4 border border-brand-border rounded-xl p-5">
              <p className="text-brand-dust text-sm mb-3 text-center">...or upgrade for free by completing milestones</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'XP', current: upgradeProgress.xp, target: upgradeProgress.requirements.xp },
                  { label: 'Races', current: upgradeProgress.races, target: upgradeProgress.requirements.races },
                  { label: 'Wins', current: upgradeProgress.wins, target: upgradeProgress.requirements.wins },
                ].map(item => {
                  const pct = Math.min(100, (item.current / item.target) * 100)
                  const done = item.current >= item.target
                  return (
                    <div key={item.label} className="text-center">
                      <p className={`text-xs font-semibold mb-1 ${done ? 'text-brand-primary' : 'text-brand-dust'}`}>
                        {done ? '\u2705 ' : ''}{item.label}
                      </p>
                      <div className="w-full bg-brand-border rounded-full h-1.5 mb-1">
                        <div
                          className={`h-1.5 rounded-full transition-all ${done ? 'bg-brand-primary' : 'bg-brand-accent'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-brand-dust">{item.current}/{item.target}</p>
                    </div>
                  )
                })}
              </div>
              {upgradeProgress.eligible && (
                <button
                  onClick={handleFreeUpgrade}
                  disabled={upgradeState !== 'idle'}
                  className="w-full mt-4 py-2.5 bg-brand-primary text-brand-surface font-bold rounded-xl hover:bg-brand-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Free Upgrade!
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quest Panel */}
      
      {/* Racer Cards */}
      {racerList.length > 0 && (
        <div>
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
                          className="border border-brand-primary rounded px-2 py-0.5 text-brand-ink text-sm w-32 outline-none"
                          autoFocus
                        />
                        <button onClick={() => handleRename(racer.id)} className="text-brand-primary text-xs cursor-pointer">&#x2714;</button>
                        <button onClick={() => setEditingId(null)} className="text-brand-dust text-xs cursor-pointer">&#x2716;</button>
                      </div>
                    ) : (
                      <p className="text-brand-ink font-bold text-lg flex items-center gap-1.5">
                        {racer.name}
                        <button
                          onClick={() => { setEditingId(racer.id); setEditName(racer.name) }}
                          className="text-brand-dust hover:text-brand-primary transition-colors cursor-pointer"
                          title="Rename"
                        >
                          &#x270F;&#xFE0F;
                        </button>
                      </p>
                    )}
                    <p className="text-brand-dust text-xs">
                      Racer #{racer.id}
                      {racer.tier && racer.tier > 1 && (
                        <span className="ml-1 text-brand-gold" title={`Tier ${racer.tier}`}>
                          {'\u2B50'.repeat(racer.tier)}
                        </span>
                      )}
                      {racer.evolution_path && EVOLUTION_PATH_ICONS[racer.evolution_path] && (
                        <span className="ml-1" title={racer.evolution_path}>
                          {EVOLUTION_PATH_ICONS[racer.evolution_path]}
                        </span>
                      )}
                    </p>

                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${RARITY_COLORS[racer.rarity] || ''}`}>
                    {rarityLabel(racer.rarity)}
                  </span>
                </div>

                {/* Streak badge */}
                {streaks[racer.id] && streaks[racer.id].current_wins >= 3 && (
                  <div className="text-center mb-1">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                      streaks[racer.id].current_wins >= 5
                        ? 'bg-red-500/20 text-red-400 border border-red-500'
                        : 'bg-brand-accent/20 text-brand-accent border border-brand-accent'
                    }`}>
                      {streaks[racer.id].current_wins >= 5 ? 'UNSTOPPABLE!' : `${streaks[racer.id].current_wins} Win Streak`} &#x1F525;
                    </span>
                  </div>
                )}
                {streaks[racer.id] && streaks[racer.id].current_losses >= 3 && (
                  <div className="text-center mb-1">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-gray-700/50 text-brand-dust">
                      &#x1F622; Needs some motivation!
                    </span>
                  </div>
                )}

                <RacerPortrait
                  archetype={racer.race}
                  rarity={rarityLabel(racer.rarity)}
                  height={110}
                  still
                  className="mb-2"
                />

                {/* archetypeLabel, not the raw code: the card says "Jetster",
                    never "speedster" (CLAUDE.md §0). */}
                <p className="text-brand-dust text-xs text-center mb-3">
                  {archetypeLabel(racer.race)}
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
                    <div key={s.label} className="rounded px-1 py-1">
                      <span className="text-brand-dust">{s.label} </span>
                      <span className="text-brand-ink font-bold">{Number(s.val) % 1 === 0 ? s.val : Number(s.val).toFixed(1)}</span>
                    </div>
                  ))}
                </div>

                {/* Achievement Badges */}
                {streaks[racer.id] && (() => {
                  const s = streaks[racer.id]
                  const badges: { icon: string; label: string; color: string }[] = []
                  if (s.total_wins >= 1) badges.push({ icon: '\u2B50', label: 'First Win', color: 'bg-brand-gold/20 text-brand-gold border-brand-gold/50' })
                  if (s.max_wins >= 3) badges.push({ icon: '\uD83D\uDD25', label: 'On Fire', color: 'bg-brand-accent/20 text-brand-accent border-brand-accent/50' })
                  if (s.total_races >= 10) badges.push({ icon: '\uD83D\uDEE1\uFE0F', label: 'Veteran', color: 'bg-brand-ink/10 text-brand-ink border-brand-ink/40' })
                  if (s.total_wins >= 10) badges.push({ icon: '\uD83C\uDFC6', label: 'Champion', color: 'bg-brand-accent/20 text-brand-accent border-brand-accent/50' })
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
                  <div className="flex items-center justify-center gap-3 mt-2 text-xs text-brand-dust">
                    <span>{streaks[racer.id].total_races} races</span>
                    <span>{streaks[racer.id].total_wins} wins</span>
                    <span>Best: {streaks[racer.id].max_wins}&#x1F525;</span>
                  </div>
                )}

                {/* Training UI — Accordion */}
                
                {/* Cosmetic / Accessory badges */}
                
                {/* Equipment — Accordion */}
                
                {/* Evolve button */}
                
                {/* Mini Games button */}
                
                {/* Enter Race — prominent */}
                <div className="mt-3 pt-3 border-t border-brand-border space-y-2">
                  <TierProgress racer={racer} />
                  <DailyBudget racer={racer} />
                  <ItemStock racer={racer} />
                  <button
                    onClick={() => handleQuickDemoRace(racer.id)}
                    disabled={demoLoading === racer.id}
                    className="toy-btn w-full py-4 bg-brand-gold text-brand-ink text-xl font-black"
                  >
                    {demoLoading === racer.id ? 'Starting Race\u2026' : 'RACE'}
                  </button>
                  <button
                    onClick={() => navigate('/race')}
                    className="w-full py-2 text-brand-dust text-sm font-semibold hover:text-brand-ink transition-colors cursor-pointer"
                  >
                    Choose a distance instead
                  </button>
                </div>

              </div>
            ))}
          </div>
        </div>
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
                  <p className="text-brand-dust">Simulating $3 USDC payment...</p>
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
                  <p className="text-xl font-bold mb-2 text-brand-accent">Burning {THEME.tiers.free}...</p>
                  <p className="text-brand-dust">Your racer is evolving!</p>
                </>
              )}

              {upgradeState === 'revealing' && (
                <>
                  {/* The toy is already there, still turning over — what is
                      being revealed is its surface, not its existence. */}
                  <motion.div
                    initial={{ rotateY: 0 }}
                    animate={{ rotateY: 360 }}
                    transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity }}
                    className="mb-4"
                    style={{ perspective: '600px' }}
                  >
                    <RacerPortrait height={150} />
                  </motion.div>
                  <p className="text-xl font-bold mb-2 text-brand-accent">Revealing Rarity...</p>
                  <p className="text-brand-dust">Chainlink VRF determining your racer...</p>
                </>
              )}

              {upgradeState === 'done' && newRacer && (
                <>
                  <motion.div
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                    className="mb-3"
                  >
                    <RacerPortrait archetype={newRacer.race} rarity={newRacer.rarity} height={190} />
                  </motion.div>
                  <h2 className="text-2xl font-bold text-brand-ink mb-2">{newRacer.name}</h2>
                  {/* rarityLabel, not the raw code: the player is told "Mint",
                      never "legendary" (CLAUDE.md §0). */}
                  <span className={`inline-block px-3 py-1 rounded-lg text-sm font-bold uppercase mb-4 ${RARITY_COLORS[newRacer.rarity] || ''}`}>
                    {rarityLabel(newRacer.rarity)}
                  </span>
                  <p className="text-brand-dust text-sm mb-2">
                    {archetypeLabel(newRacer.race)}
                  </p>
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
                    className="px-6 py-2.5 bg-brand-primary text-brand-surface font-bold rounded-xl hover:bg-brand-primary/90 transition-colors cursor-pointer"
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

/**
 * What today's racing can still do for this racer.
 *
 * A racer may gain +4.0 a day, about ten races' worth, and until now the only
 * place that number appeared was the results screen — one race too late. A
 * racer that has spent its day looks exactly like one that has not, right up to
 * the moment it finishes and the game says "no gain". A playtest with database
 * access read that silence as stat growth being broken; a player has less to go
 * on than that playtest did.
 *
 * So it sits next to the button that starts the race, which is where the person
 * deciding whether to race is looking.
 */
function ItemStock({ racer }: { racer: any }) {
  const cap = Number(racer.itemStockCap ?? 0)
  if (!cap) return null
  const held = Math.max(0, Math.min(cap, Number(racer.itemStock ?? 0)))

  return (
    <div className="flex items-center justify-between mb-1">
      <span className="text-brand-dust text-[11px] font-semibold">Items</span>
      <span className="flex items-center gap-1" title={`${held} of ${cap}`}>
        {Array.from({ length: cap }, (_, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full border-2 border-brand-ink ${
              i < held ? 'bg-brand-gold' : 'bg-transparent'
            }`}
          />
        ))}
      </span>
    </div>
  )
}

function DailyBudget({ racer }: { racer: any }) {
  const cap = Number(racer.dayCap ?? 0)
  if (!cap) return null
  const used = Math.min(cap, Number(racer.dayGain ?? 0))
  const left = Math.max(0, cap - used)
  const spent = left <= 0.001

  return (
    <div className="mb-1">
      <div className="flex items-baseline justify-between mb-1">
        <span className={`text-[11px] font-semibold ${spent ? 'text-brand-ink' : 'text-brand-dust'}`}>
          {spent ? 'Done growing today' : 'Today’s growth'}
        </span>
        <span className="text-brand-dust text-[11px] tabular-nums">
          {used.toFixed(1)} / {cap.toFixed(1)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-brand-ink/10 border-2 border-brand-ink overflow-hidden">
        <div
          className={`h-full ${spent ? 'bg-brand-dust' : 'bg-brand-accent'}`}
          style={{ width: `${(used / cap) * 100}%` }}
        />
      </div>
      {spent && (
        <p className="text-brand-dust text-[10px] mt-1">
          Racing still counts for wins and rank &mdash; stats resume at midnight.
        </p>
      )}
    </div>
  )
}

/**
 * How far this racer is from its next form.
 *
 * "When do I get better?" had no answer anywhere in the game. A playtest had to
 * add up six stats by hand to work out it was 17.5 away from the first tier —
 * and the tiers are the one thing racing visibly produces, since crossing the
 * first is what decides which toy you become.
 */
function TierProgress({ racer }: { racer: any }) {
  const total =
    (racer.spd || 0) + (racer.acc || 0) + (racer.sta || 0) +
    (racer.agi || 0) + (racer.ref || 0) + (racer.lck || 0)
  const thresholds = [90, 130, 170]
  const next = thresholds.find(t => total < t)
  const prev = next ? (thresholds[thresholds.indexOf(next) - 1] ?? 0) : 0
  const pct = next ? Math.max(0, Math.min(100, ((total - prev) / (next - prev)) * 100)) : 100

  return (
    <div className="mb-1">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-brand-dust text-[11px] font-semibold">
          {next ? `Next form at ${next}` : 'Final form reached'}
        </span>
        <span className="text-brand-dust text-[11px] tabular-nums">
          {total.toFixed(1)}{next ? ` / ${next}` : ''}
        </span>
      </div>
      <div className="h-2 rounded-full bg-brand-ink/10 border-2 border-brand-ink overflow-hidden">
        <div className="h-full bg-brand-gold" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
