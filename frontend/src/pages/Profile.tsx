import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { motion } from 'framer-motion'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import Spinner from '../components/Spinner'

interface ProfileData {
  wallet: string
  balance: number
  xp: number
  totalRaces: number
  totalWins: number
  totalEarnings: number
  loginDays: number
  slugCount: number
  snailCount: number
}

interface Transaction {
  type: string
  amount: number
  description: string
  created_at: string
}

export default function Profile() {
  const { address, isConnected } = useAccount()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'transactions' | 'inventory'>('overview')

  useEffect(() => {
    if (!address) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      api.getProfile(address),
      api.getProfileTransactions(address),
    ])
      .then(([p, t]) => {
        setProfile(p)
        setTransactions(t.transactions)
      })
      .catch((err) => { console.error('Failed to load profile:', err); toast.error('Failed to load data. Please refresh.') })
      .finally(() => setLoading(false))
  }, [address])

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-400">Connect your wallet to view your profile</p>
        <ConnectButton />
      </div>
    )
  }

  if (loading) return <Spinner fullPage text="Loading profile..." />

  if (!profile) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-gray-400">Could not load profile data</p>
    </div>
  )

  const winRate = profile.totalRaces > 0 ? Math.round((profile.totalWins / profile.totalRaces) * 100) : 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-gray-500 text-sm mt-1 font-mono">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'SLUG Balance', value: String(profile.balance), color: 'text-slug-green' },
          { label: 'XP', value: String(profile.xp), color: 'text-purple-400' },
          { label: 'Total Races', value: String(profile.totalRaces), color: 'text-white' },
          { label: 'Win Rate', value: `${winRate}%`, color: 'text-yellow-400' },
          { label: 'Total Wins', value: String(profile.totalWins), color: 'text-slug-green' },
          { label: 'Total Earnings', value: `${profile.totalEarnings} SLUG`, color: 'text-slug-green' },
          { label: 'Login Days', value: String(profile.loginDays), color: 'text-blue-400' },
          { label: 'Creatures', value: `${profile.slugCount + profile.snailCount}`, color: 'text-white' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-slug-card border border-slug-border rounded-xl p-4 text-center"
          >
            <p className="text-gray-500 text-xs mb-1">{stat.label}</p>
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {([
          { id: 'overview' as const, label: 'Race History' },
          { id: 'transactions' as const, label: 'Transactions' },
          { id: 'inventory' as const, label: 'Inventory' },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              tab === t.id ? 'bg-slug-green/20 text-slug-green' : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <RaceHistorySection wallet={address!} />}
      {tab === 'transactions' && <TransactionSection transactions={transactions} />}
      {tab === 'inventory' && <InventorySection wallet={address!} />}

      {/* Settings */}
      <SettingsSection />
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
    <div className="bg-slug-card border border-slug-border rounded-xl p-12 text-center">
      <p className="text-gray-400 text-lg mb-2">No races yet</p>
      <p className="text-gray-500 text-sm">Enter a race from the Race lobby to get started</p>
    </div>
  )

  const FORMAT_LABELS: Record<string, string> = {
    exhibition: 'Exhibition',
    standard: 'Standard',
    tactic: 'Tactic',
    gp_qualify: 'GP Qualify',
    gp_final: 'GP Final',
  }

  return (
    <div className="bg-slug-card border border-slug-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slug-border text-gray-400">
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Format</th>
              <th className="text-left px-4 py-3 font-medium">Snail</th>
              <th className="text-center px-4 py-3 font-medium">Position</th>
              <th className="text-right px-4 py-3 font-medium">Earnings</th>
            </tr>
          </thead>
          <tbody>
            {races.map((race: any, i: number) => (
              <tr
                key={race.raceId + i}
                className={`border-b border-slug-border/50 hover:bg-white/5 transition-colors ${i === races.length - 1 ? 'border-b-0' : ''}`}
              >
                <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                  {new Date(race.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-4 py-3 text-gray-300">{FORMAT_LABELS[race.format] || race.format}</td>
                <td className="px-4 py-3 text-white font-medium">{race.snailName}</td>
                <td className="px-4 py-3 text-center">
                  <span className={race.position === 1 ? 'text-yellow-400 font-bold' : race.position === 2 ? 'text-gray-300 font-bold' : race.position === 3 ? 'text-orange-400 font-bold' : 'text-gray-500'}>
                    {race.position === 1 ? '1st' : race.position === 2 ? '2nd' : race.position === 3 ? '3rd' : `${race.position}th`}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {race.payout > 0 ? (
                    <span className="text-slug-green font-bold">+{race.payout} SLUG</span>
                  ) : (
                    <span className="text-gray-500">0</span>
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

function TransactionSection({ transactions }: { transactions: { type: string; amount: number; description: string; created_at: string }[] }) {
  const TYPE_LABELS: Record<string, string> = {
    race_entry: 'Race Entry',
    race_payout: 'Race Payout',
    daily_login: 'Daily Login',
    quest_reward: 'Quest Reward',
    training: 'Training',
    mini_game: 'Mini Game',
    shop_purchase: 'Shop Purchase',
    upgrade: 'Upgrade',
    cosmetic_purchase: 'Cosmetic',
    accessory_purchase: 'Accessory',
  }

  if (transactions.length === 0) return (
    <div className="bg-slug-card border border-slug-border rounded-xl p-12 text-center">
      <p className="text-gray-400">No transactions yet</p>
    </div>
  )

  return (
    <div className="bg-slug-card border border-slug-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slug-border text-gray-400">
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Type</th>
              <th className="text-left px-4 py-3 font-medium">Description</th>
              <th className="text-right px-4 py-3 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, i) => (
              <tr
                key={i}
                className={`border-b border-slug-border/50 hover:bg-white/5 transition-colors ${i === transactions.length - 1 ? 'border-b-0' : ''}`}
              >
                <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                  {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-4 py-3 text-gray-300">{TYPE_LABELS[tx.type] || tx.type}</td>
                <td className="px-4 py-3 text-gray-400">{tx.description}</td>
                <td className="px-4 py-3 text-right">
                  <span className={tx.amount >= 0 ? 'text-slug-green font-bold' : 'text-red-400 font-bold'}>
                    {tx.amount >= 0 ? '+' : ''}{tx.amount} SLUG
                  </span>
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
    <div className="bg-slug-card border border-slug-border rounded-xl p-12 text-center">
      <p className="text-gray-400 text-lg mb-2">No items yet</p>
      <p className="text-gray-500 text-sm">Buy cosmetics and accessories from the Shop</p>
    </div>
  )

  const RARITY_BADGE: Record<string, string> = {
    legendary: 'bg-yellow-500/20 text-yellow-400',
    epic: 'bg-purple-500/20 text-purple-400',
    rare: 'bg-blue-500/20 text-blue-400',
    uncommon: 'bg-green-500/20 text-green-400',
    common: 'bg-gray-500/20 text-gray-400',
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {allItems.map((item: any) => (
        <motion.div
          key={`${item.itemType}-${item.id}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slug-card border border-slug-border rounded-xl p-4"
        >
          <div className="text-3xl text-center mb-2">{item.icon || (item.itemType === 'cosmetic' ? '\u{1F3A8}' : '\u{2699}\uFE0F')}</div>
          <h3 className="text-white font-bold text-sm text-center">{item.name}</h3>
          {item.rarity && (
            <p className="text-center mt-1">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${RARITY_BADGE[item.rarity] || RARITY_BADGE.common}`}>
                {item.rarity}
              </span>
            </p>
          )}
          <p className="text-gray-500 text-xs text-center mt-2">
            {item.equippedOn ? `Equipped on ${item.equippedOn}` : 'Not equipped'}
          </p>
          {item.purchasedAt && (
            <p className="text-gray-600 text-[10px] text-center mt-1">
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
    return localStorage.getItem('slug-rush-sound') !== 'off'
  })

  function toggleSound() {
    const newVal = !soundEnabled
    setSoundEnabled(newVal)
    localStorage.setItem('slug-rush-sound', newVal ? 'on' : 'off')
  }

  return (
    <div className="mt-8 bg-slug-card border border-slug-border rounded-xl p-6">
      <h3 className="text-white font-bold text-lg mb-4">Settings</h3>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-300 font-medium text-sm">Sound Effects</p>
          <p className="text-gray-500 text-xs">Toggle race sounds and UI audio</p>
        </div>
        <button
          onClick={toggleSound}
          className={`w-12 h-7 rounded-full transition-colors cursor-pointer flex items-center px-0.5 ${
            soundEnabled ? 'bg-slug-green' : 'bg-gray-600'
          }`}
        >
          <div className={`w-6 h-6 rounded-full bg-white transition-transform ${soundEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>
    </div>
  )
}
