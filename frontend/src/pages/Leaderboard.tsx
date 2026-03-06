import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { motion } from 'framer-motion'
import { api } from '../lib/api'
import Spinner from '../components/Spinner'

type LeaderboardEntry = {
  rank: number
  wallet: string
  sloth_name: string
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

type MainTab = 'season' | 'career'

export default function Leaderboard() {
  const { address } = useAccount()
  const [mainTab, setMainTab] = useState<MainTab>('season')
  const [league, setLeague] = useState<'bronze' | 'silver' | 'gold'>('silver')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [careerEntries, setCareerEntries] = useState<any[]>([])
  const [hofEntries, setHofEntries] = useState<any[]>([])
  const [myRank, setMyRank] = useState<{ rank: number; wallet: string; total_rp: number } | null>(null)
  const [loading, setLoading] = useState(true)

  // Load league leaderboard
  useEffect(() => {
    if (mainTab !== 'season') return
    setLoading(true)
    api.getLeaderboard(league)
      .then(d => setEntries(d.leaderboard))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [league, mainTab])

  // Load career leaderboard + hall of fame
  useEffect(() => {
    if (mainTab !== 'career') return
    setLoading(true)
    Promise.all([
      api.getCareerLeaderboard()
        .then(d => setCareerEntries(d.leaderboard))
        .catch(() => setCareerEntries([])),
      api.getHallOfFame()
        .then(d => setHofEntries(d.entries))
        .catch(() => setHofEntries([])),
    ]).finally(() => setLoading(false))
  }, [mainTab])

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
          className="bg-sloth-card border border-sloth-green/30 rounded-xl p-4 mb-6 flex items-center justify-between"
        >
          <div>
            <p className="text-gray-400 text-xs">Your Ranking</p>
            <p className="text-white font-bold text-xl">#{myRank.rank}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-xs">Race Points</p>
            <p className="text-sloth-green font-bold text-xl">{myRank.total_rp} RP</p>
          </div>
        </motion.div>
      )}

      {/* Main Tabs */}
      <div className="flex gap-2 mb-4">
        {([
          { id: 'season' as MainTab, label: 'Season' },
          { id: 'career' as MainTab, label: 'Career' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setMainTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors cursor-pointer ${
              mainTab === tab.id
                ? 'bg-sloth-green/20 text-sloth-green border border-sloth-green'
                : 'bg-sloth-card border border-sloth-border text-gray-500 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Season Tab */}
      {mainTab === 'season' && (
        <>
          <div className="flex gap-2 mb-6">
            {(['bronze', 'silver', 'gold'] as const).map(l => (
              <button
                key={l}
                onClick={() => setLeague(l)}
                className={`px-5 py-2 rounded-lg font-semibold text-sm transition-colors cursor-pointer capitalize ${
                  league === l
                    ? l === 'bronze'
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500'
                      : l === 'silver'
                      ? 'bg-gray-400/20 text-gray-300 border border-gray-400'
                      : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500'
                    : 'bg-sloth-card border border-sloth-border text-gray-500 hover:text-white'
                }`}
              >
                {l === 'bronze' ? 'Bronze (Free Sloths)' : l === 'silver' ? 'Silver (Sloths)' : 'Gold (Tier 2+)'}
              </button>
            ))}
          </div>

          {renderLeaderboardTable(entries, loading, address, league === 'bronze' ? '\u{1F949}' : league === 'silver' ? '\u{1F948}' : '\u{1F947}')}
        </>
      )}

      {/* Career Tab */}
      {mainTab === 'career' && (
        <>
          {loading ? (
            <div className="text-center py-12"><Spinner text="Loading career stats..." /></div>
          ) : (
            <>
              {/* Career Leaderboard */}
              {careerEntries.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">{'\u{1F4CA}'}</div>
                  <p className="text-gray-400">No career stats yet.</p>
                </div>
              ) : (
                <div className="bg-sloth-card border border-sloth-border rounded-xl overflow-hidden">
                  <div className="grid grid-cols-[3rem_1fr_5rem_5rem_5rem] gap-2 px-4 py-2 border-b border-sloth-border text-xs text-gray-500 font-semibold">
                    <span>#</span>
                    <span>Racer</span>
                    <span className="text-right">Races</span>
                    <span className="text-right">Wins</span>
                    <span className="text-right">Earnings</span>
                  </div>
                  {careerEntries.map((entry: any, i: number) => (
                    <motion.div
                      key={entry.wallet || i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`grid grid-cols-[3rem_1fr_5rem_5rem_5rem] gap-2 px-4 py-3 items-center ${
                        i < careerEntries.length - 1 ? 'border-b border-sloth-border/50' : ''
                      } ${entry.wallet === address ? 'bg-sloth-green/5' : ''}`}
                    >
                      <span className={`font-bold ${i === 0 ? 'text-sloth-green' : 'text-gray-500'}`}>
                        {i + 1}
                      </span>
                      <span className={`text-sm truncate ${entry.wallet === address ? 'text-sloth-green font-bold' : 'text-white'}`}>
                        {entry.sloth_name || truncateWallet(entry.wallet)}
                      </span>
                      <span className="text-right text-gray-300 text-sm">{entry.total_races || 0}</span>
                      <span className="text-right text-gray-300 text-sm">{entry.total_wins || 0}</span>
                      <span className="text-right text-sloth-green font-bold text-sm">{entry.total_earnings || 0}</span>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Hall of Fame Section */}
              <h2 className="text-xl font-bold mt-8 mb-4 text-white">Hall of Fame</h2>
              {hofEntries.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">{'\u{1F3C6}'}</div>
                  <p className="text-gray-400">The Hall of Fame is empty. Legends are yet to be made!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {hofEntries.map((entry: any, i: number) => (
                    <motion.div
                      key={entry.id || i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="bg-sloth-card border border-sloth-border rounded-xl p-4 flex items-center gap-4"
                    >
                      <div className="w-12 h-12 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-2xl font-bold text-yellow-400">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-bold">{entry.sloth_name || entry.name || 'Unknown'}</p>
                        <p className="text-gray-500 text-xs">
                          {entry.achievement || entry.season || 'Season Champion'}
                          {entry.wallet && <span> &middot; {truncateWallet(entry.wallet)}</span>}
                        </p>
                      </div>
                      {entry.total_rp && (
                        <span className="text-sloth-green font-bold">{entry.total_rp} RP</span>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )

  function renderLeaderboardTable(data: LeaderboardEntry[], isLoading: boolean, userAddress: string | undefined, emptyIcon: string) {
    if (isLoading) {
      return <div className="text-center py-12"><Spinner text="Loading leaderboard..." /></div>
    }

    if (data.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">{emptyIcon}</div>
          <p className="text-gray-400">No racers yet. Be the first!</p>
        </div>
      )
    }

    return (
      <div className="bg-sloth-card border border-sloth-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-[3rem_1fr_1fr_5rem] gap-2 px-4 py-2 border-b border-sloth-border text-xs text-gray-500 font-semibold">
          <span>#</span>
          <span>Racer</span>
          <span>Sloth</span>
          <span className="text-right">RP</span>
        </div>
        {data.map((entry, i) => (
          <motion.div
            key={entry.wallet}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className={`grid grid-cols-[3rem_1fr_1fr_5rem] gap-2 px-4 py-3 items-center ${
              i < data.length - 1 ? 'border-b border-sloth-border/50' : ''
            } ${entry.wallet === userAddress ? 'bg-sloth-green/5' : ''}`}
          >
            <span className={`font-bold ${
              entry.rank === 1 ? 'text-sloth-gold' :
              entry.rank === 2 ? 'text-gray-300' :
              entry.rank === 3 ? 'text-orange-400' : 'text-gray-500'
            }`}>
              {entry.rank <= 3 ? ['', '\u{1F947}', '\u{1F948}', '\u{1F949}'][entry.rank] : entry.rank}
            </span>
            <span className={`text-sm truncate ${entry.wallet === userAddress ? 'text-sloth-green font-bold' : 'text-white'}`}>
              {truncateWallet(entry.wallet)}
            </span>
            <span className={`text-sm truncate ${RARITY_COLORS[entry.rarity] || 'text-gray-400'}`}>
              {entry.sloth_name}
            </span>
            <span className="text-right text-sloth-green font-bold text-sm">{entry.total_rp}</span>
          </motion.div>
        ))}
      </div>
    )
  }
}
