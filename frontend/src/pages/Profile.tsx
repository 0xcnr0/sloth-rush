import { useWallet } from '../hooks/useWallet'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import WalletConnect from '../components/WalletConnect'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { rarityLabel, formatLabel } from '../config/theme'
import Spinner from '../components/Spinner'

interface ProfileData {
  wallet: string
  balance: number
  xp: number
  totalRaces: number
  totalWins: number
  totalEarnings: number
  freeRacerCount: number
  racerCount: number
}


export default function Profile() {
  const { address, isConnected } = useWallet()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'inventory'>('overview')

  useEffect(() => {
    if (!address) { setLoading(false); return }
    setLoading(true)
    api.getProfile(address)
      .then(setProfile)
      .catch((err) => { console.error('Failed to load profile:', err); toast.error('Failed to load data. Please refresh.') })
      .finally(() => setLoading(false))
  }, [address])

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-brand-dust">Connect your wallet to view your profile</p>
        <WalletConnect />
      </div>
    )
  }

  if (loading) return <Spinner fullPage text="Loading profile..." />

  if (!profile) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-brand-dust">Could not load profile data</p>
    </div>
  )

  const winRate = profile.totalRaces > 0 ? Math.round((profile.totalWins / profile.totalRaces) * 100) : 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-brand-dust text-sm mt-1 font-mono">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'XP', value: String(profile.xp), color: 'text-purple-400' },
          { label: 'Total Races', value: String(profile.totalRaces), color: 'text-brand-ink' },
          { label: 'Win Rate', value: `${winRate}%`, color: 'text-yellow-400' },
          { label: 'Total Wins', value: String(profile.totalWins), color: 'text-brand-primary' },
          { label: 'Creatures', value: `${profile.freeRacerCount + profile.racerCount}`, color: 'text-brand-ink' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-brand-surface border border-brand-border rounded-xl p-4 text-center"
          >
            <p className="text-brand-dust text-xs mb-1">{stat.label}</p>
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {([
          { id: 'overview' as const, label: 'Race History' },
          { id: 'inventory' as const, label: 'Inventory' },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              tab === t.id ? 'bg-brand-primary/20 text-brand-primary' : 'text-brand-dust hover:text-brand-ink hover:bg-brand-ink/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <RaceHistorySection wallet={address!} />}
      {tab === 'inventory' && <InventorySection wallet={address!} />}

      {/* Referral */}
      <ReferralSection wallet={address!} />

      {/* Settings */}
      <SettingsSection />
    </div>
  )
}

function ReferralSection({ wallet }: { wallet: string }) {
  const [code, setCode] = useState<string | null>(null)
  const [stats, setStats] = useState<{ totalReferrals: number; totalEarned: number } | null>(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    api.getReferralStats(wallet)
      .then(d => {
        setCode(d.code)
        setStats({ totalReferrals: d.totalReferrals, totalEarned: d.totalEarned })
      })
      .catch(() => {})
  }, [wallet])

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await api.generateReferralCode(wallet)
      setCode(res.code)
      toast.success('Referral code generated!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate code')
    } finally {
      setGenerating(false)
    }
  }

  const link = code ? `${window.location.origin}/invite/${code}` : null

  return (
    <div className="mt-8 bg-brand-surface border border-brand-border rounded-xl p-6">
      <h3 className="text-brand-ink font-bold text-lg mb-4">Referrals</h3>
      {code ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-brand-ink/5 rounded-lg px-3 py-2 font-mono text-sm text-brand-ink">{link}</div>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(link!)
                toast.success('Link copied!')
              }}
              className="px-4 py-2 bg-brand-primary/20 text-brand-primary rounded-lg text-sm font-medium hover:bg-brand-primary/30 transition-colors cursor-pointer"
            >
              Copy
            </button>
          </div>
          {stats && (
            <div className="flex gap-4 text-sm">
              <span className="text-brand-dust">Referrals: <span className="text-brand-ink font-bold">{stats.totalReferrals}</span></span>
            </div>
          )}
          <p className="text-brand-dust text-xs">Share your link and bring a friend to the track.</p>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-brand-dust text-sm mb-3">Generate your referral link to invite friends</p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-6 py-2 bg-brand-primary text-brand-surface font-bold rounded-lg hover:bg-brand-primary/90 transition-colors cursor-pointer disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate Referral Link'}
          </button>
        </div>
      )}
    </div>
  )
}

function RaceHistorySection({ wallet }: { wallet: string }) {
  const [races, setRaces] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getRaceHistory(wallet)
      .then(d => { setRaces(d.races) })
      .catch((err) => { console.error('Failed to load race history:', err) })
      .finally(() => setLoading(false))
  }, [wallet])

  if (loading) return <Spinner text="Loading race history..." />

  if (races.length === 0) return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-12 text-center">
      <p className="text-brand-dust text-lg mb-2">No races yet</p>
      <p className="text-brand-dust text-sm">Enter a race from the Race lobby to get started</p>
    </div>
  )

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-border text-brand-dust">
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Format</th>
              <th className="text-left px-4 py-3 font-medium">Racer</th>
              <th className="text-center px-4 py-3 font-medium">Position</th>
              <th className="text-right px-4 py-3 font-medium">Earnings</th>
            </tr>
          </thead>
          <tbody>
            {races.map((race: any, i: number) => (
              <tr
                key={race.raceId + i}
                className={`border-b border-brand-border/50 hover:bg-brand-ink/5 transition-colors ${i === races.length - 1 ? 'border-b-0' : ''}`}
              >
                <td className="px-4 py-3 text-brand-ink/80 whitespace-nowrap">
                  {new Date(race.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-4 py-3 text-brand-ink/80">{formatLabel(race.format)}</td>
                <td className="px-4 py-3 text-brand-ink font-medium">{race.racerName}</td>
                <td className="px-4 py-3 text-center">
                  <span className={race.position === 1 ? 'text-yellow-400 font-bold' : race.position === 2 ? 'text-brand-ink/80 font-bold' : race.position === 3 ? 'text-orange-400 font-bold' : 'text-brand-dust'}>
                    {race.position === 1 ? '1st' : race.position === 2 ? '2nd' : race.position === 3 ? '3rd' : `${race.position}th`}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {race.reward > 0 ? (
                    <span className="text-brand-dust">—</span>
                  ) : (
                    <span className="text-brand-dust">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function InventorySection({ wallet }: { wallet: string }) {
  const [cosmetics, setCosmetics] = useState<any[]>([])
  const [accessories, setAccessories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.getShopCosmetics(wallet).then(d => setCosmetics((d.cosmetics || []).filter((c: any) => c.owned))),
      api.getShopAccessories(wallet).then(d => setAccessories((d.accessories || []).filter((a: any) => a.owned))),
    ])
      .catch((err) => { console.error('Failed to load inventory:', err); toast.error('Failed to load data. Please refresh.') })
      .finally(() => setLoading(false))
  }, [wallet])

  if (loading) return <Spinner text="Loading inventory..." />

  const allItems = [
    ...cosmetics.map((c: any) => ({ ...c, itemType: 'cosmetic' })),
    ...accessories.map((a: any) => ({ ...a, itemType: 'accessory' })),
  ]

  if (allItems.length === 0) return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-12 text-center">
      <p className="text-brand-dust text-lg mb-2">No items yet</p>
      <p className="text-brand-dust text-sm">Buy cosmetics and accessories from the Shop</p>
    </div>
  )

  const RARITY_BADGE: Record<string, string> = {
    legendary: 'bg-yellow-500/20 text-yellow-400',
    epic: 'bg-purple-500/20 text-purple-400',
    rare: 'bg-blue-500/20 text-blue-400',
    uncommon: 'bg-green-500/20 text-green-400',
    common: 'bg-gray-500/20 text-brand-dust',
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {allItems.map((item: any) => (
        <motion.div
          key={`${item.itemType}-${item.id}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-brand-surface border border-brand-border rounded-xl p-4"
        >
          <div className="text-3xl text-center mb-2">{item.icon || (item.itemType === 'cosmetic' ? '\u{1F3A8}' : '\u{2699}\uFE0F')}</div>
          <h3 className="text-brand-ink font-bold text-sm text-center">{item.name}</h3>
          {item.rarity && (
            <p className="text-center mt-1">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${RARITY_BADGE[item.rarity] || RARITY_BADGE.common}`}>
                {rarityLabel(item.rarity)}
              </span>
            </p>
          )}
          <p className="text-brand-dust text-xs text-center mt-2">
            {item.equippedOn ? `Equipped on ${item.equippedOn}` : 'Not equipped'}
          </p>
          {item.purchasedAt && (
            <p className="text-brand-dust/70 text-[10px] text-center mt-1">
              Bought {new Date(item.purchasedAt).toLocaleDateString()}
            </p>
          )}
        </motion.div>
      ))}
    </div>
  )
}

function SettingsSection() {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('racer-rush-sound') !== 'off'
  })

  function toggleSound() {
    const newVal = !soundEnabled
    setSoundEnabled(newVal)
    localStorage.setItem('racer-rush-sound', newVal ? 'on' : 'off')
  }

  return (
    <div className="mt-8 bg-brand-surface border border-brand-border rounded-xl p-6">
      <h3 className="text-brand-ink font-bold text-lg mb-4">Settings</h3>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-brand-ink/80 font-medium text-sm">Sound Effects</p>
          <p className="text-brand-dust text-xs">Toggle race sounds and UI audio</p>
        </div>
        <button
          onClick={toggleSound}
          className={`w-12 h-7 rounded-full transition-colors cursor-pointer flex items-center px-0.5 ${
            soundEnabled ? 'bg-brand-primary' : 'bg-gray-600'
          }`}
        >
          <div className={`w-6 h-6 rounded-full bg-white transition-transform ${soundEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>
    </div>
  )
}
