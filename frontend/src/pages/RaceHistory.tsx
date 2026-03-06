import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { motion } from 'framer-motion'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import Spinner from '../components/Spinner'

interface RaceEntry {
  raceId: string
  format: string
  position: number
  payout: number
  slothName: string
  createdAt: string
}

const FORMAT_LABELS: Record<string, string> = {
  exhibition: 'Exhibition',
  standard: 'Standard',
  tactic: 'Tactic',
  gp_qualify: 'GP Qualify',
  gp_final: 'GP Final',
}

function positionBadge(pos: number): string {
  return pos === 1 ? '1st' : pos === 2 ? '2nd' : pos === 3 ? '3rd' : `${pos}th`
}

function positionColor(pos: number): string {
  return pos === 1 ? 'text-yellow-400 font-bold' : pos === 2 ? 'text-gray-300 font-bold' : pos === 3 ? 'text-orange-400 font-bold' : 'text-gray-500'
}

export default function RaceHistory() {
  const { address, isConnected } = useAccount()
  const [races, setRaces] = useState<RaceEntry[]>([])
  const [summary, setSummary] = useState({ totalRaces: 0, winRate: 0, totalEarnings: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address) { setLoading(false); return }
    setLoading(true)
    api.getRaceHistory(address)
      .then(d => { setRaces(d.races); setSummary(d.summary) })
      .catch((err) => { console.error('Failed to load race history:', err); toast.error('Failed to load data. Please refresh.') })
      .finally(() => setLoading(false))
  }, [address])

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-400">Connect your wallet to view race history</p>
        <ConnectButton />
      </div>
    )
  }

  if (loading) {
    return <Spinner fullPage text="Loading race history..." />
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Race History</h1>
        <p className="text-gray-400 mt-1">Your last 20 race results</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Races', value: String(summary.totalRaces), color: 'text-white' },
          { label: 'Win Rate', value: `${summary.winRate}%`, color: 'text-sloth-green' },
          { label: 'Total Earnings', value: `${summary.totalEarnings} ZZZ`, color: 'text-sloth-green' },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-sloth-card border border-sloth-border rounded-xl p-5 text-center"
          >
            <p className="text-gray-400 text-sm mb-1">{card.label}</p>
            <p className={`text-3xl font-extrabold ${card.color}`}>{card.value}</p>
          </motion.div>
        ))}
      </div>

      {races.length === 0 ? (
        <div className="bg-sloth-card border border-sloth-border rounded-xl p-12 text-center">
          <p className="text-gray-400 text-lg mb-2">No races yet</p>
          <p className="text-gray-500 text-sm">Enter a race from the Race lobby to get started</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-sloth-card border border-sloth-border rounded-xl overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sloth-border text-gray-400">
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Format</th>
                  <th className="text-left px-4 py-3 font-medium">Sloth</th>
                  <th className="text-center px-4 py-3 font-medium">Position</th>
                  <th className="text-right px-4 py-3 font-medium">Earnings</th>
                </tr>
              </thead>
              <tbody>
                {races.map((race, i) => (
                  <tr
                    key={race.raceId + i}
                    className={`border-b border-sloth-border/50 hover:bg-white/5 transition-colors ${i === races.length - 1 ? 'border-b-0' : ''}`}
                  >
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {new Date(race.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{FORMAT_LABELS[race.format] || race.format}</td>
                    <td className="px-4 py-3 text-white font-medium">{race.slothName}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={positionColor(race.position)}>{positionBadge(race.position)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {race.payout > 0 ? (
                        <span className="text-sloth-green font-bold">+{race.payout} ZZZ</span>
                      ) : (
                        <span className="text-gray-500">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  )
}
