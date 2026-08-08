import { useWallet } from '../hooks/useWallet'
import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import WalletConnect from '../components/WalletConnect'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { formatLabel } from '../config/theme'
import Spinner from '../components/Spinner'

/**
 * Your record: every race you have run, and the settings.
 *
 * This page was a candidate for deletion in the page pass, on the grounds that
 * it repeats the Toybox. Most of it did — a tile counting racers next to a
 * screen that draws them — but two things live only here, and both would have
 * gone with it:
 *
 *   - The race log. Nowhere else in the game can you see what you have played.
 *   - The sound toggle, which is the only setting there is.
 *
 * And the totals are not the Toybox's totals, which is the part that is easy to
 * miss. The Toybox counts races per racer, and upgrading BURNS the racer and
 * mints a new one — so the day a player pays $3 their per-racer count returns
 * to zero. These are per wallet, so they survive it. That is the whole reason
 * for a record separate from the shelf, and it is stated on the page rather
 * than left for someone to rediscover.
 */
interface ProfileData {
  wallet: string
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
        <p className="text-brand-dust">Connect your wallet to view your record</p>
        <WalletConnect />
      </div>
    )
  }

  if (loading) return <Spinner fullPage text="Loading your record..." />

  if (!profile) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-brand-dust">Could not load your record</p>
    </div>
  )

  const winRate = profile.totalRaces > 0 ? Math.round((profile.totalWins / profile.totalRaces) * 100) : 0

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="toy-title text-3xl font-bold">Your Record</h1>
          <p className="text-brand-dust text-sm mt-1 font-mono">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
        </div>
        <Link
          to={`/shelf/${address}`}
          className="toy-chip px-3 py-1.5 text-xs shrink-0 mt-1"
        >
          Public shelf
        </Link>
      </div>

      {/* Kept per wallet, not per racer — see the note at the top of this file. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
        {[
          { label: 'Races', value: String(profile.totalRaces) },
          { label: 'Wins', value: String(profile.totalWins) },
          { label: 'Win Rate', value: `${winRate}%` },
          { label: 'XP', value: String(profile.xp) },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="toy-panel p-4 text-center"
          >
            <p className="text-2xl font-black text-brand-ink tabular-nums">{stat.value}</p>
            <p className="text-brand-dust text-xs mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </div>
      <p className="text-brand-dust text-xs mb-8">
        Counted per wallet, so upgrading a racer does not reset them.
      </p>

      <h2 className="text-lg font-bold mb-3">Every race you have run</h2>
      <RaceHistorySection wallet={address!} />

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
    <div className="toy-panel p-10 text-center">
      <p className="text-brand-ink font-bold mb-1">No races yet</p>
      <p className="text-brand-dust text-sm">Your first finish will show up here.</p>
    </div>
  )

  return (
    <div className="toy-panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-[3px] border-brand-ink/10 text-brand-dust">
              <th className="text-center px-3 py-3 font-semibold w-16">Pos</th>
              <th className="text-left px-3 py-3 font-semibold">Racer</th>
              <th className="text-left px-3 py-3 font-semibold">Distance</th>
              <th className="text-right px-3 py-3 font-semibold">When</th>
            </tr>
          </thead>
          <tbody>
            {races.map((race: any, i: number) => (
              <tr
                key={race.raceId + i}
                className={`border-b border-brand-ink/10 hover:bg-brand-ink/5 transition-colors ${i === races.length - 1 ? 'border-b-0' : ''}`}
              >
                {/* Position first and set in gold when it is a win. A log you
                    scan for your wins should not make you read four columns to
                    find them. */}
                <td className="px-3 py-3 text-center">
                  <span
                    className={`inline-flex items-center justify-center min-w-8 px-2 py-0.5 rounded-full text-xs font-black ${
                      race.position === 1
                        ? 'bg-brand-gold text-brand-ink border-2 border-brand-ink'
                        : 'text-brand-dust'
                    }`}
                  >
                    {ordinal(race.position)}
                  </span>
                </td>
                <td className="px-3 py-3 text-brand-ink font-semibold">{race.racerName}</td>
                <td className="px-3 py-3 text-brand-dust">{formatLabel(race.format)}</td>
                <td className="px-3 py-3 text-brand-dust text-right whitespace-nowrap">
                  {new Date(race.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ordinal(position: number): string {
  if (position === 1) return '1st'
  if (position === 2) return '2nd'
  if (position === 3) return '3rd'
  return `${position}th`
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
    <div className="mt-8 toy-panel p-5">
      <h2 className="text-brand-ink font-bold text-lg mb-4">Settings</h2>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-brand-ink font-semibold text-sm">Sound Effects</p>
          <p className="text-brand-dust text-xs">Race sounds and interface audio</p>
        </div>
        <button
          onClick={toggleSound}
          aria-pressed={soundEnabled}
          className={`w-12 h-7 rounded-full border-[3px] border-brand-ink transition-colors cursor-pointer flex items-center px-0.5 ${
            soundEnabled ? 'bg-brand-gold' : 'bg-brand-ink/15'
          }`}
        >
          <div className={`w-4 h-4 rounded-full bg-brand-surface border-2 border-brand-ink transition-transform ${soundEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>
    </div>
  )
}
