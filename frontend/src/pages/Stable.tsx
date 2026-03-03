import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { api } from '../lib/api'
import { useUpgrade } from '../hooks/useContracts'
import { CONTRACTS_DEPLOYED } from '../config/contracts'

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

const SNAIL_EMOJI: Record<string, string> = {
  turbo_slug: '\u{1F40C}',
  shell_knight: '\u{1F6E1}\uFE0F',
  goo_mage: '\u{2728}',
  storm_racer: '\u{26A1}',
}

type UpgradeState = 'idle' | 'paying' | 'burning' | 'revealing' | 'done'

function RadarChart({ stats }: { stats: { spd: number; acc: number; sta: number; agi: number; ref: number; lck: number } }) {
  const labels = ['SPD', 'ACC', 'STA', 'AGI', 'REF', 'LCK']
  const values = [stats.spd, stats.acc, stats.sta, stats.agi, stats.ref, stats.lck]
  const max = 30
  const cx = 60, cy = 60, r = 45

  const points = values.map((v, i) => {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2
    const ratio = Math.min(v / max, 1)
    return {
      x: cx + r * ratio * Math.cos(angle),
      y: cy + r * ratio * Math.sin(angle),
    }
  })

  const gridLevels = [0.33, 0.66, 1]

  return (
    <svg viewBox="0 0 120 120" className="w-full max-w-[160px]">
      {gridLevels.map((level, li) => (
        <polygon
          key={li}
          points={Array.from({ length: 6 }, (_, i) => {
            const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2
            return `${cx + r * level * Math.cos(angle)},${cy + r * level * Math.sin(angle)}`
          }).join(' ')}
          fill="none"
          stroke="#374151"
          strokeWidth="0.5"
        />
      ))}
      <polygon
        points={points.map(p => `${p.x},${p.y}`).join(' ')}
        fill="rgba(34, 197, 94, 0.2)"
        stroke="#22c55e"
        strokeWidth="1.5"
      />
      {labels.map((label, i) => {
        const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2
        const lx = cx + (r + 12) * Math.cos(angle)
        const ly = cy + (r + 12) * Math.sin(angle)
        return (
          <text
            key={label}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-gray-400"
            fontSize="6"
          >
            {label}
          </text>
        )
      })}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2" fill="#22c55e" />
      ))}
    </svg>
  )
}

export default function Stable() {
  const { address, isConnected } = useAccount()
  const navigate = useNavigate()
  const [slugs, setSlugs] = useState<any[]>([])
  const [coinBalance, setCoinBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [upgradeState, setUpgradeState] = useState<UpgradeState>('idle')
  const [newSnail, setNewSnail] = useState<any>(null)
  const onchainUpgrade = useUpgrade()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [streaks, setStreaks] = useState<Record<number, { current_wins: number; max_wins: number; current_losses: number; total_races: number; total_wins: number }>>({})

  async function loadStable() {
    if (!address) return
    setLoading(true)
    try {
      const data = await api.getStable(address)
      setSlugs(data.slugs)
      setCoinBalance(data.coinBalance)
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { loadStable() }, [address])

  useEffect(() => {
    if (!address) return
    api.getStreaks(address).then(data => {
      const map: Record<number, any> = {}
      for (const s of data.streaks) map[s.snail_id] = s
      setStreaks(map)
    }).catch(() => {})
  }, [address])

  const freeSlug = slugs.find(s => s.type === 'free_slug')
  const snails = slugs.filter(s => s.type === 'snail')

  // On-chain upgrade success: register in backend
  useEffect(() => {
    if (onchainUpgrade.isSuccess && address) {
      api.upgradeSlug(address).then(data => {
        setNewSnail(data.snail)
        setCoinBalance(prev => prev + data.coinBonus)
        setUpgradeState('done')
      }).catch(() => setUpgradeState('done'))
    }
  }, [onchainUpgrade.isSuccess, address])

  useEffect(() => {
    if (onchainUpgrade.error) {
      alert(onchainUpgrade.error.message || 'On-chain upgrade failed')
      setUpgradeState('idle')
    }
  }, [onchainUpgrade.error])

  async function handleUpgrade() {
    if (!address) return
    setUpgradeState('paying')

    await new Promise(r => setTimeout(r, 1200))
    setUpgradeState('burning')

    if (CONTRACTS_DEPLOYED && freeSlug) {
      // On-chain: burn Free Slug + mint Snail
      const stats = { spd: 12, acc: 11, sta: 10, agi: 11, ref: 10, lck: 12 }
      onchainUpgrade.upgrade(BigInt(freeSlug.id), 0, stats)
      setUpgradeState('revealing')
    } else {
      // Mock fallback
      await new Promise(r => setTimeout(r, 1500))
      setUpgradeState('revealing')

      try {
        const data = await api.upgradeSlug(address)
        setNewSnail(data.snail)
        await new Promise(r => setTimeout(r, 2000))
        setUpgradeState('done')
        setCoinBalance(prev => prev + data.coinBonus)
      } catch (err: any) {
        alert(err.message)
        setUpgradeState('idle')
      }
    }
  }

  async function handleRename(snailId: number) {
    if (!address || editName.trim().length < 3) return
    try {
      await api.renameSnail(address, snailId, editName.trim())
      setSlugs(prev => prev.map(s => s.id === snailId ? { ...s, name: editName.trim() } : s))
      setEditingId(null)
    } catch (err: any) {
      alert(err.message)
    }
  }

  function closeReveal() {
    setUpgradeState('idle')
    setNewSnail(null)
    loadStable()
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-400">Connect your wallet to view your stable</p>
        <ConnectButton />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400">Loading stable...</div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Your Stable</h1>
          <p className="text-gray-400 mt-1">
            {slugs.length === 0 ? 'No slugs yet' : `${slugs.length} creature${slugs.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slug-card border border-slug-border rounded-xl px-4 py-2">
          <span className="text-slug-green font-bold text-lg">{coinBalance}</span>
          <span className="text-slug-green/70 text-sm">SLUG</span>
        </div>
      </div>

      {/* Empty state */}
      {slugs.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">&#x1f3da;&#xfe0f;</div>
          <p className="text-gray-400 mb-4">Your stable is empty</p>
          <button
            onClick={() => navigate('/mint')}
            className="px-6 py-2.5 bg-slug-green text-slug-dark font-bold rounded-xl hover:bg-slug-green/90 transition-colors cursor-pointer"
          >
            Mint Your First Slug
          </button>
        </div>
      )}

      {/* Free Slug Card with Upgrade */}
      {freeSlug && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-300 mb-3">Free Slug</h2>
          <div className="bg-slug-card border border-slug-border rounded-xl p-6 flex flex-col sm:flex-row items-center gap-6">
            <div className="text-6xl">&#x1f40c;</div>
            <div className="flex-1 text-center sm:text-left">
              <p className="text-white font-semibold text-lg">{freeSlug.name}</p>
              <p className="text-gray-500 text-sm">Free Slug #{freeSlug.id}</p>
              <p className="text-gray-400 text-sm mt-2">
                Upgrade to a Snail to unlock racing and earn SLUG Coins!
              </p>
            </div>
            <button
              onClick={handleUpgrade}
              disabled={upgradeState !== 'idle'}
              className="px-6 py-3 bg-slug-purple text-white font-bold rounded-xl hover:bg-slug-purple/90 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              Upgrade to Snail — $3 USDC
            </button>
          </div>
        </div>
      )}

      {/* Snail Cards */}
      {snails.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-300 mb-3">Snails</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {snails.map((snail) => (
              <div
                key={snail.id}
                className={`bg-slug-card border-2 ${RARITY_BORDER[snail.rarity] || 'border-slug-border'} rounded-xl p-5`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    {editingId === snail.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRename(snail.id); if (e.key === 'Escape') setEditingId(null) }}
                          maxLength={20}
                          className="bg-slug-dark border border-slug-green rounded px-2 py-0.5 text-white text-sm w-32 outline-none"
                          autoFocus
                        />
                        <button onClick={() => handleRename(snail.id)} className="text-slug-green text-xs cursor-pointer">&#x2714;</button>
                        <button onClick={() => setEditingId(null)} className="text-gray-500 text-xs cursor-pointer">&#x2716;</button>
                      </div>
                    ) : (
                      <p className="text-white font-bold text-lg flex items-center gap-1.5">
                        {snail.name}
                        <button
                          onClick={() => { setEditingId(snail.id); setEditName(snail.name) }}
                          className="text-gray-500 hover:text-slug-green transition-colors cursor-pointer"
                          title="Rename"
                        >
                          &#x270F;&#xFE0F;
                        </button>
                      </p>
                    )}
                    <p className="text-gray-500 text-xs">Snail #{snail.id}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${RARITY_COLORS[snail.rarity] || ''}`}>
                    {snail.rarity}
                  </span>
                </div>

                {/* Streak badge */}
                {streaks[snail.id] && streaks[snail.id].current_wins >= 3 && (
                  <div className="text-center mb-1">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                      streaks[snail.id].current_wins >= 5
                        ? 'bg-red-500/20 text-red-400 border border-red-500'
                        : 'bg-orange-500/20 text-orange-400 border border-orange-500'
                    }`}>
                      {streaks[snail.id].current_wins >= 5 ? 'DURDURULAMAZ!' : `${streaks[snail.id].current_wins} Win Streak`} &#x1F525;
                    </span>
                  </div>
                )}
                {streaks[snail.id] && streaks[snail.id].current_losses >= 3 && (
                  <div className="text-center mb-1">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-gray-700/50 text-gray-400">
                      &#x1F622; Motivasyona ihtiyacin var!
                    </span>
                  </div>
                )}

                <div className="text-4xl text-center mb-3">
                  {SNAIL_EMOJI[snail.race] || '\u{1F40C}'}
                </div>

                <p className="text-gray-400 text-xs text-center mb-3 capitalize">
                  {snail.race?.replace('_', ' ')}
                </p>

                <RadarChart stats={{
                  spd: snail.spd, acc: snail.acc, sta: snail.sta,
                  agi: snail.agi, ref: snail.ref, lck: snail.lck,
                }} />

                <div className="grid grid-cols-3 gap-1 mt-3 text-center text-xs">
                  {[
                    { label: 'SPD', val: snail.spd },
                    { label: 'ACC', val: snail.acc },
                    { label: 'STA', val: snail.sta },
                    { label: 'AGI', val: snail.agi },
                    { label: 'REF', val: snail.ref },
                    { label: 'LCK', val: snail.lck },
                  ].map(s => (
                    <div key={s.label} className="bg-slug-dark rounded px-1 py-1">
                      <span className="text-gray-500">{s.label} </span>
                      <span className="text-white font-bold">{s.val}</span>
                    </div>
                  ))}
                </div>

                {/* Achievement Badges */}
                {streaks[snail.id] && (() => {
                  const s = streaks[snail.id]
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

                {streaks[snail.id] && streaks[snail.id].total_races > 0 && (
                  <div className="flex items-center justify-center gap-3 mt-2 text-xs text-gray-500">
                    <span>{streaks[snail.id].total_races} races</span>
                    <span>{streaks[snail.id].total_wins} wins</span>
                    <span>Best: {streaks[snail.id].max_wins}&#x1F525;</span>
                  </div>
                )}

                <button
                  onClick={() => navigate('/race')}
                  className="w-full mt-4 py-2 bg-slug-green/20 text-slug-green font-semibold rounded-lg hover:bg-slug-green/30 transition-colors cursor-pointer text-sm"
                >
                  Enter Race
                </button>
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
              className="bg-slug-card border border-slug-border rounded-2xl p-8 max-w-md w-full mx-4 text-center"
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
                  >&#x1f40c;</motion.div>
                  <motion.div
                    animate={{ scale: [0, 1.5, 1] }}
                    transition={{ delay: 0.5, duration: 1 }}
                    className="text-4xl mb-4"
                  >&#x1f525;</motion.div>
                  <p className="text-xl font-bold mb-2 text-orange-400">Burning Free Slug...</p>
                  <p className="text-gray-400">Your slug is evolving!</p>
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
                  <p className="text-xl font-bold mb-2 text-slug-purple">Revealing Rarity...</p>
                  <p className="text-gray-400">Chainlink VRF determining your snail...</p>
                </>
              )}

              {upgradeState === 'done' && newSnail && (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                    className="text-7xl mb-4"
                  >&#x1f389;</motion.div>
                  <h2 className="text-2xl font-bold text-white mb-2">{newSnail.name}</h2>
                  <span className={`inline-block px-3 py-1 rounded-lg text-sm font-bold uppercase mb-4 ${RARITY_COLORS[newSnail.rarity] || ''}`}>
                    {newSnail.rarity}
                  </span>
                  <p className="text-gray-400 text-sm mb-2 capitalize">
                    Race: {newSnail.race?.replace('_', ' ')}
                  </p>
                  <p className="text-slug-green font-semibold mb-6">+500 SLUG Coins</p>
                  <button
                    onClick={closeReveal}
                    className="px-6 py-2.5 bg-slug-green text-slug-dark font-bold rounded-xl hover:bg-slug-green/90 transition-colors cursor-pointer"
                  >
                    View in Stable
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
