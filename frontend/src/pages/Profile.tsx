import { useWallet } from '../hooks/useWallet'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import WalletConnect from '../components/WalletConnect'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { formatLabel } from '../config/theme'
import Spinner from '../components/Spinner'

interface ProfileData {
  wallet: string
  balance: number
  xp: number
  totalRaces: number
  totalWins: number
  freeRacerCount: number
  racerCount: number
}


export default function Profile() {
  const { address, isConnected } = useWallet()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

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
          { label: 'XP', value: String(profile.xp), color: 'text-brand-ink' },
          { label: 'Total Races', value: String(profile.totalRaces), color: 'text-brand-ink' },
          { label: 'Win Rate', value: `${winRate}%`, color: 'text-brand-primary' },
          { label: 'Total Wins', value: String(profile.totalWins), color: 'text-brand-primary' },
          { label: 'Racers', value: `${profile.freeRacerCount + profile.racerCount}`, color: 'text-brand-ink' },
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

      <h2 className="text-brand-ink font-bold text-lg mb-3">Race History</h2>
      <RaceHistorySection wallet={address!} />

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
                  <span className={race.position === 1 ? 'text-brand-gold font-bold' : race.position === 2 ? 'text-brand-ink/80 font-bold' : race.position === 3 ? 'text-brand-accent font-bold' : 'text-brand-dust'}>
                    {race.position === 1 ? '1st' : race.position === 2 ? '2nd' : race.position === 3 ? '3rd' : `${race.position}th`}
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
