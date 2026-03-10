import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../lib/api'
import Spinner from '../components/Spinner'
import { MVP_MODE } from '../config/features'

// Mock sloths for the demo prediction fallback
const DEMO_SLOTHS = [
  { id: 1, name: 'Sleepy Joe', emoji: '\u{1F9A5}', color: '#22c55e' },
  { id: 2, name: 'Turbo Nap', emoji: '\u{1F9A5}', color: '#3b82f6' },
  { id: 3, name: 'Dream King', emoji: '\u{1F9A5}', color: '#f59e0b' },
  { id: 4, name: 'Pillow Lord', emoji: '\u{1F9A5}', color: '#a855f7' },
]

type DemoPhase = 'pick' | 'countdown' | 'racing' | 'result'

function DemoPrediction() {
  const [phase, setPhase] = useState<DemoPhase>('pick')
  const [selected, setSelected] = useState<number | null>(null)
  const [countdown, setCountdown] = useState(3)
  const [progress, setProgress] = useState<number[]>([0, 0, 0, 0])
  const [winner, setWinner] = useState<number>(0)
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startRace() {
    if (selected === null) return
    setPhase('countdown')
    setCountdown(3)

    const w = Math.floor(Math.random() * 4)
    setWinner(w)

    let c = 3
    const countdownInterval = setInterval(() => {
      c--
      setCountdown(c)
      if (c <= 0) {
        clearInterval(countdownInterval)
        setPhase('racing')
        runRaceAnimation(w)
      }
    }, 1000)
  }

  function runRaceAnimation(winnerIdx: number) {
    const targets = DEMO_SLOTHS.map((_, i) =>
      i === winnerIdx ? 100 : 60 + Math.random() * 35
    )
    const speeds = DEMO_SLOTHS.map((_, i) =>
      i === winnerIdx ? 1.5 + Math.random() * 0.8 : 0.8 + Math.random() * 1.0
    )
    const current = [0, 0, 0, 0]

    animRef.current = setInterval(() => {
      let allDone = true
      for (let i = 0; i < 4; i++) {
        if (current[i] < targets[i]) {
          current[i] = Math.min(targets[i], current[i] + speeds[i] + Math.random() * 0.5)
          allDone = false
        }
      }
      setProgress([...current])

      if (allDone || current[winnerIdx] >= 100) {
        if (animRef.current) clearInterval(animRef.current)
        current[winnerIdx] = 100
        setProgress([...current])
        setTimeout(() => setPhase('result'), 500)
      }
    }, 80)
  }

  function reset() {
    if (animRef.current) clearInterval(animRef.current)
    setPhase('pick')
    setSelected(null)
    setProgress([0, 0, 0, 0])
    setCountdown(3)
  }

  useEffect(() => {
    return () => { if (animRef.current) clearInterval(animRef.current) }
  }, [])

  const isCorrect = selected === winner

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-center">
        <span className="text-yellow-400 font-bold text-sm">DEMO MODE</span>
        <span className="text-gray-400 text-xs ml-2">Try a mock prediction while waiting for a live race</span>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'pick' && (
          <motion.div key="pick" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <h2 className="text-2xl font-bold text-center mb-2">Predict the Winner!</h2>
            <p className="text-gray-400 text-center mb-6 text-sm">Pick which sloth will win the race. Correct prediction = 15 ZZZ!</p>
            <div className="grid grid-cols-2 gap-4 mb-8">
              {DEMO_SLOTHS.map(sloth => (
                <button
                  key={sloth.id}
                  onClick={() => setSelected(sloth.id - 1)}
                  className={`p-5 rounded-xl border-2 text-center transition-all cursor-pointer ${
                    selected === sloth.id - 1
                      ? 'border-sloth-green bg-sloth-green/10 scale-105'
                      : 'border-sloth-border bg-sloth-card hover:border-gray-500'
                  }`}
                >
                  <div className="text-4xl mb-2">{sloth.emoji}</div>
                  <p className="text-white font-bold">{sloth.name}</p>
                  <div className="w-3 h-3 rounded-full mx-auto mt-2" style={{ backgroundColor: sloth.color }} />
                </button>
              ))}
            </div>
            <button
              onClick={startRace}
              disabled={selected === null}
              className="w-full py-3 bg-sloth-green text-sloth-dark font-bold rounded-xl text-lg hover:bg-sloth-green/90 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {selected !== null ? `Lock Prediction: ${DEMO_SLOTHS[selected].name}` : 'Select a Sloth'}
            </button>
          </motion.div>
        )}

        {phase === 'countdown' && (
          <motion.div key="countdown" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="text-center py-12">
            <p className="text-gray-400 mb-4">Race Starting...</p>
            <motion.div key={countdown} initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-8xl font-extrabold text-sloth-gold">
              {countdown}
            </motion.div>
            <p className="text-gray-500 text-sm mt-4">
              Your prediction: <span className="text-sloth-green font-bold">{selected !== null ? DEMO_SLOTHS[selected].name : ''}</span>
            </p>
          </motion.div>
        )}

        {phase === 'racing' && (
          <motion.div key="racing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold"><span className="text-sloth-green">LIVE</span> — Race in Progress</h2>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-green-400 text-xs font-semibold">LIVE</span>
              </div>
            </div>
            <div className="space-y-3">
              {DEMO_SLOTHS.map((sloth, i) => (
                <div key={sloth.id} className="bg-sloth-card border border-sloth-border rounded-xl p-3">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{sloth.emoji}</span>
                    <span className="text-white font-semibold text-sm flex-1">{sloth.name}</span>
                    {selected === i && (
                      <span className="px-2 py-0.5 bg-sloth-green/20 text-sloth-green text-[10px] font-bold rounded">YOUR PICK</span>
                    )}
                    <span className="text-gray-400 text-xs">{Math.round(progress[i])}%</span>
                  </div>
                  <div className="w-full h-3 bg-sloth-dark rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ backgroundColor: sloth.color, width: `${progress[i]}%` }} transition={{ duration: 0.1 }} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {phase === 'result' && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center">
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }} className="mb-6">
              <div className="text-6xl mb-3">{'\u{1F3C6}'}</div>
              <h2 className="text-3xl font-extrabold text-sloth-gold mb-1">{DEMO_SLOTHS[winner].name} WINS!</h2>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={`p-6 rounded-xl border-2 mb-6 ${isCorrect ? 'bg-sloth-green/10 border-sloth-green' : 'bg-red-500/10 border-red-500/50'}`}
            >
              {isCorrect ? (
                <>
                  <div className="text-4xl mb-2">{'\u{1F389}'}</div>
                  <p className="text-sloth-green font-bold text-xl">Correct Prediction!</p>
                  <p className="text-gray-400 text-sm mt-1">You would earn +15 ZZZ Coins!</p>
                </>
              ) : (
                <>
                  <div className="text-4xl mb-2">{'\u{1F614}'}</div>
                  <p className="text-red-400 font-bold text-xl">Wrong Prediction</p>
                  <p className="text-gray-400 text-sm mt-1">
                    You picked {selected !== null ? DEMO_SLOTHS[selected].name : '?'} — better luck next time!
                  </p>
                </>
              )}
            </motion.div>
            <div className="bg-sloth-card border border-sloth-border rounded-xl p-4 mb-6">
              <h3 className="text-gray-400 text-xs font-bold uppercase mb-3">Final Standings</h3>
              <div className="space-y-2">
                {[...DEMO_SLOTHS]
                  .map((s, i) => ({ ...s, progress: progress[i], idx: i }))
                  .sort((a, b) => b.progress - a.progress)
                  .map((s, rank) => (
                    <div key={s.id} className={`flex items-center gap-3 p-3 rounded-lg ${rank === 0 ? 'bg-sloth-gold/10 border border-sloth-gold' : 'bg-sloth-dark/50 border border-sloth-border'}`}>
                      <span className={`text-xl font-extrabold w-8 ${rank === 0 ? 'text-sloth-gold' : rank === 1 ? 'text-gray-300' : 'text-gray-500'}`}>{rank + 1}.</span>
                      <span className="text-xl">{s.emoji}</span>
                      <span className="text-white font-semibold text-sm flex-1">{s.name}</span>
                      {selected === s.idx && (
                        <span className="px-2 py-0.5 bg-sloth-green/20 text-sloth-green text-[10px] font-bold rounded">YOUR PICK</span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button onClick={reset} className="px-8 py-3 bg-sloth-green text-sloth-dark font-bold rounded-xl text-lg hover:bg-sloth-green/90 transition-colors cursor-pointer">
                Try Again
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Live spectate with real race data + prediction stats
function LiveSpectate() {
  const navigate = useNavigate()
  const { address } = useAccount()
  const [races, setRaces] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<{ total: number; correct: number; percentage: number } | null>(null)

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

  useEffect(() => {
    if (!address) return
    api.getPredictionStats(address)
      .then(d => setStats(d))
      .catch(() => {})
  }, [address])

  const formatLabel = (f: string) => {
    if (f === 'exhibition') return 'Exhibition'
    if (f === 'standard') return 'Standard'
    if (f === 'grand_prix') return 'Grand Prix'
    if (f === 'tactic') return 'Tactic'
    return f.charAt(0).toUpperCase() + f.slice(1)
  }

  const statusColor = (s: string) => {
    if (s === 'racing' || s === 'simulated') return 'text-green-400'
    if (s === 'bidding') return 'text-yellow-400'
    if (s === 'lobby') return 'text-blue-400'
    return 'text-gray-400'
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Spectate & Predict</h1>
        <p className="text-gray-400 mt-1">Watch live races and predict winners to earn ZZZ Coins</p>
      </div>

      {/* Prediction Stats */}
      {address && stats && stats.total > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-sloth-card border border-sloth-border rounded-xl p-4 mb-6"
        >
          <h3 className="text-gray-400 text-xs font-bold uppercase mb-3">Your Prediction Stats</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-gray-500 text-xs">Total</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-sloth-green">{stats.correct}</p>
              <p className="text-gray-500 text-xs">Correct</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-sloth-gold">{stats.percentage}%</p>
              <p className="text-gray-500 text-xs">Win Rate</p>
            </div>
          </div>
        </motion.div>
      )}

      {loading && (
        <div className="text-center py-12">
          <Spinner text="Loading active races..." />
        </div>
      )}

      {!loading && races.length === 0 && (
        <div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12 mb-8"
          >
            <div className="text-6xl mb-4">{'\u{1F3C1}'}</div>
            <p className="text-gray-400 text-lg mb-2">No active races right now</p>
            <p className="text-gray-500 text-sm mb-4">Start one from the Race Lobby or try a demo prediction below!</p>
            <button
              onClick={() => navigate('/race')}
              className="px-6 py-2.5 bg-sloth-green/20 text-sloth-green font-semibold rounded-lg hover:bg-sloth-green/30 transition-colors cursor-pointer text-sm"
            >
              Go to Race Lobby
            </button>
          </motion.div>

          {/* Demo fallback when no active races */}
          {MVP_MODE && (
            <div className="border-t border-sloth-border pt-8">
              <DemoPrediction />
            </div>
          )}
        </div>
      )}

      {!loading && races.length > 0 && (
        <div className="space-y-3">
          {races.map((race: any, i: number) => (
            <motion.div
              key={race.raceId || race.id || i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-sloth-card border border-sloth-border rounded-xl p-4 flex items-center justify-between hover:border-sloth-green/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-sloth-green/10 rounded-lg flex items-center justify-center">
                  <span className="text-xl">{'\u{1F9A5}'}</span>
                </div>
                <div>
                  <p className="text-white font-semibold">
                    {formatLabel(race.format || 'standard')} Race
                  </p>
                  <p className="text-gray-500 text-xs">
                    {race.participantCount || race.participants?.length || '?'} participants
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
                  className="px-4 py-2 bg-sloth-green/20 text-sloth-green font-semibold rounded-lg hover:bg-sloth-green/30 transition-colors cursor-pointer text-sm"
                >
                  Watch & Predict
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="mt-8 bg-sloth-card border border-sloth-border rounded-xl p-5">
        <h3 className="text-white font-semibold mb-2">How Spectating Works</h3>
        <div className="text-gray-400 text-sm space-y-1">
          <p>Active races refresh every 5 seconds.</p>
          <p>Click "Watch & Predict" to predict a winner before tick 20.</p>
          <p>Correct prediction earns you <span className="text-sloth-green font-bold">+15 ZZZ Coins</span>!</p>
        </div>
      </div>
    </div>
  )
}

export default function Spectate() {
  // In MVP mode and non-MVP mode, always show LiveSpectate with real data.
  // Demo fallback is embedded inside LiveSpectate when no active races.
  return <LiveSpectate />
}
