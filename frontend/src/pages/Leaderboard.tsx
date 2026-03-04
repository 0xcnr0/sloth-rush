import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { motion } from 'framer-motion'
import { api } from '../lib/api'

type LeaderboardEntry = {
  rank: number
  wallet: string
  snail_name: string
  rarity: string
  total_rp: number
}

const RARITY_COLORS: Record<string, string> = {
  common: 'text-gray-400',
  uncommon: 'text-green-400',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-yellow-400',
}

export default function Leaderboard() {
  const { address } = useAccount()
  const [league, setLeague] = useState<'bronze' | 'silver'>('silver')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [myRank, setMyRank] = useState<{ rank: number; wallet: string; total_rp: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.getLeaderboard(league)
      .then(d => setEntries(d.leaderboard))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [league])

  useEffect(() => {
    if (!address) return
    api.getMyRanking(address).then(setMyRank).catch(() => setMyRank(null))
  }, [address])

  function truncateWallet(w: string) {
    if (!w || w.length < 10) return w
    return `${w.slice(0, 6)}...${w.slice(-4)}`
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
      <p className="text-gray-400 mb-6">Season 1 Rankings</p>

      {/* My Rank Card */}
      {myRank && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slug-card border border-slug-green/30 rounded-xl p-4 mb-6 flex items-center justify-between"
        >
          <div>
            <p className="text-gray-400 text-xs">Your Ranking</p>
            <p className="text-white font-bold text-xl">#{myRank.rank}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-xs">Race Points</p>
            <p className="text-slug-green font-bold text-xl">{myRank.total_rp} RP</p>
          </div>
        </motion.div>
      )}

      {/* League Tabs */}
      <div className="flex gap-2 mb-6">
        {(['bronze', 'silver'] as const).map(l => (
          <button
            key={l}
            onClick={() => setLeague(l)}
            className={`px-5 py-2 rounded-lg font-semibold text-sm transition-colors cursor-pointer capitalize ${
              league === l
                ? l === 'bronze'
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500'
                  : 'bg-gray-400/20 text-gray-300 border border-gray-400'
                : 'bg-slug-card border border-slug-border text-gray-500 hover:text-white'
            }`}
          >
            {l === 'bronze' ? 'Bronze (Free Slugs)' : 'Silver (Snails)'}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">{league === 'bronze' ? '\u{1F949}' : '\u{1F948}'}</div>
          <p className="text-gray-400">No racers yet. Be the first!</p>
        </div>
      ) : (
        <div className="bg-slug-card border border-slug-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-[3rem_1fr_1fr_5rem] gap-2 px-4 py-2 border-b border-slug-border text-xs text-gray-500 font-semibold">
            <span>#</span>
            <span>Racer</span>
            <span>Snail</span>
            <span className="text-right">RP</span>
          </div>
          {entries.map((entry, i) => (
            <motion.div
              key={entry.wallet}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`grid grid-cols-[3rem_1fr_1fr_5rem] gap-2 px-4 py-3 items-center ${
                i < entries.length - 1 ? 'border-b border-slug-border/50' : ''
              } ${entry.wallet === address ? 'bg-slug-green/5' : ''}`}
            >
              <span className={`font-bold ${
                entry.rank === 1 ? 'text-slug-gold' :
                entry.rank === 2 ? 'text-gray-300' :
                entry.rank === 3 ? 'text-orange-400' : 'text-gray-500'
              }`}>
                {entry.rank <= 3 ? ['', '\u{1F947}', '\u{1F948}', '\u{1F949}'][entry.rank] : entry.rank}
              </span>
              <span className={`text-sm truncate ${entry.wallet === address ? 'text-slug-green font-bold' : 'text-white'}`}>
                {truncateWallet(entry.wallet)}
              </span>
              <span className={`text-sm truncate ${RARITY_COLORS[entry.rarity] || 'text-gray-400'}`}>
                {entry.snail_name}
              </span>
              <span className="text-right text-slug-green font-bold text-sm">{entry.total_rp}</span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
