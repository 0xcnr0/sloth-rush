import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '../lib/api'
import Spinner from '../components/Spinner'
import { THEME } from '../config/theme'

/**
 * Watch-only broadcast view.
 *
 * Spectators observe only. They cannot interact with a race or influence its
 * outcome. There is deliberately nothing to click here beyond opening a race.
 */
export default function Spectate() {
  const navigate = useNavigate()
  const [races, setRaces] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    function loadRaces() {
      api.getActiveRaces()
        .then(d => setRaces(d.races))
        .catch(() => setRaces([]))
        .finally(() => setLoading(false))
    }
    loadRaces()
    const interval = setInterval(loadRaces, 5000)
    return () => clearInterval(interval)
  }, [])

  const formatLabel = (f: string) => {
    if (f === 'exhibition') return 'Exhibition'
    if (f === 'standard') return 'Standard'
    if (f === 'grand_prix') return 'Grand Prix'
    if (f === 'tactic') return 'Tactic'
    return f.charAt(0).toUpperCase() + f.slice(1)
  }

  const statusColor = (s: string) => {
    if (s === 'racing' || s === 'simulated') return 'text-green-400'
    if (s === 'tuning') return 'text-yellow-400'
    if (s === 'lobby') return 'text-blue-400'
    return 'text-gray-400'
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Spectate</h1>
        <p className="text-gray-400 mt-1">Watch live races at the {THEME.locations.track}</p>
      </div>

      {loading && (
        <div className="text-center py-12">
          <Spinner text="Loading active races..." />
        </div>
      )}

      {!loading && races.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12"
        >
          <div className="text-6xl mb-4">{'\u{1F3C1}'}</div>
          <p className="text-gray-400 text-lg mb-2">No active races right now</p>
          <p className="text-gray-500 text-sm mb-4">Start one from the Race Lobby and it will show up here.</p>
          <button
            onClick={() => navigate('/race')}
            className="px-6 py-2.5 bg-brand-primary/20 text-brand-primary font-semibold rounded-lg hover:bg-brand-primary/30 transition-colors cursor-pointer text-sm"
          >
            Go to Race Lobby
          </button>
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
              className="bg-brand-surface border border-brand-border rounded-xl p-4 flex items-center justify-between hover:border-brand-primary/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center">
                  <span className="text-xl">{'\u{1F3CE}'}</span>
                </div>
                <div>
                  <p className="text-white font-semibold">
                    {formatLabel(race.format || 'standard')} Race
                  </p>
                  <p className="text-gray-500 text-xs">
                    {race.participantCount || race.participants?.length || '?'} racers
                    {race.status && <span className={`ml-1 ${statusColor(race.status)}`}> &middot; {race.status}</span>}
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
                  className="px-4 py-2 bg-brand-primary/20 text-brand-primary font-semibold rounded-lg hover:bg-brand-primary/30 transition-colors cursor-pointer text-sm"
                >
                  Watch
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="mt-8 bg-brand-surface border border-brand-border rounded-xl p-5">
        <h3 className="text-white font-semibold mb-2">How Spectating Works</h3>
        <div className="text-gray-400 text-sm space-y-1">
          <p>Active races refresh every 5 seconds.</p>
          <p>Click "Watch" to follow the live standings and event log.</p>
          <p>Spectating is free and does not affect the race.</p>
        </div>
      </div>
    </div>
  )
}
