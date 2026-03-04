import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '../lib/api'

export default function Spectate() {
  const navigate = useNavigate()
  const [races, setRaces] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  function loadRaces() {
    api.getActiveRaces()
      .then(d => setRaces(d.races))
      .catch(() => setRaces([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadRaces()
    const interval = setInterval(loadRaces, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Spectate</h1>
        <p className="text-gray-400 mt-1">Watch live races in progress</p>
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-500">Loading active races...</div>
      )}

      {!loading && races.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20"
        >
          <div className="text-6xl mb-4">{'\u{1F3C1}'}</div>
          <p className="text-gray-400 text-lg mb-2">No active races right now</p>
          <p className="text-gray-500 text-sm">Races appear here when they are in progress. Check back soon!</p>
        </motion.div>
      )}

      {!loading && races.length > 0 && (
        <div className="space-y-3">
          {races.map((race: any, i: number) => (
            <motion.div
              key={race.raceId || race.id || i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-slug-card border border-slug-border rounded-xl p-4 flex items-center justify-between hover:border-slug-green/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slug-green/10 rounded-lg flex items-center justify-center">
                  <span className="text-xl">{'\u{1F40C}'}</span>
                </div>
                <div>
                  <p className="text-white font-semibold">
                    {race.format ? race.format.charAt(0).toUpperCase() + race.format.slice(1) : 'Standard'} Race
                  </p>
                  <p className="text-gray-500 text-xs">
                    {race.participantCount || race.participants?.length || '?'} participants
                    {race.status && <span> &middot; {race.status}</span>}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-green-400 text-xs font-semibold">LIVE</span>
                </div>
                <button
                  onClick={() => navigate(`/race/${race.raceId || race.id}`)}
                  className="px-4 py-2 bg-slug-green/20 text-slug-green font-semibold rounded-lg hover:bg-slug-green/30 transition-colors cursor-pointer text-sm"
                >
                  Watch
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="mt-8 bg-slug-card border border-slug-border rounded-xl p-5">
        <h3 className="text-white font-semibold mb-2">How Spectating Works</h3>
        <div className="text-gray-400 text-sm space-y-1">
          <p>Active races refresh every 5 seconds.</p>
          <p>Click "Watch" to view the live race broadcast.</p>
          <p>You can watch any race without needing to participate.</p>
        </div>
      </div>
    </div>
  )
}
