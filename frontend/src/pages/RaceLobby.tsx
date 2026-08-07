import { useWallet } from '../hooks/useWallet'
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import WalletConnect from '../components/WalletConnect'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { THEME, rarityLabel, archetypeLabel, formatLabel } from '../config/theme'
import Spinner from '../components/Spinner'
import RacerPortrait from '../components/RacerPortrait'
import { FEATURES } from '../config/features'

type Phase = 'select' | 'starting'

// Sprint and Endurance cost the same and differ only in distance — the choice
// is which racer you own, not how much you are willing to spend. Entry fees and
// distances are the backend's (backend/src/simulation/formats.ts); the labels
// are the theme's. This list only says which of them the lobby offers.
const fmt = (id: string) => ({
  id,
  name: THEME.raceFormats[id].name,
  desc: THEME.raceFormats[id].blurb,
})

const FORMATS = [
  fmt('exhibition'),
  { id: 'demo_standard', name: 'Demo Race', desc: 'Quick 20s demo race' },
  fmt('sprint'),
  fmt('endurance'),
]

export const visibleFormats = FORMATS.filter(f => {
  if (f.id === 'demo_standard' && !FEATURES.demoRace) return false
  return true
})

export default function RaceLobby() {
  const { address, isConnected } = useWallet()
  const navigate = useNavigate()
  const location = useLocation()

  const [mainTab, setMainTab] = useState<'create' | 'live'>('create')
  const [liveRaces, setLiveRaces] = useState<any[]>([])
  const [liveLoading, setLiveLoading] = useState(false)

  const [phase] = useState<Phase>('select')
  const [racers, setRacers] = useState<any[]>([])
  const [selectedRacer, setSelectedRacer] = useState<any>(null)
  // The pre-race decision: two items, chosen from two types. Replaces the
  // Wind-Up phase, and sits on the same screen as the racer and the distance so
  // choosing a race is one screen rather than three.
  const [loadout, setLoadout] = useState<('boost' | 'hinder')[]>(['boost', 'hinder'])
  // "Race Again" comes back here with the format it just ran, so repeating a
  // race is one tap on the racer plus one on Enter — not a re-pick of both.
  const preselected = visibleFormats.find(f => f.id === (location.state as any)?.format)
  const [selectedFormat, setSelectedFormat] = useState(preselected ?? visibleFormats[0])
  const [loading, setLoading] = useState(false)
  const [dailyRace, setDailyRace] = useState<{ raceId: string; weather: string; date: string } | null>(null)

  // Load creatures (racers + free racers)
  const [allCreatures, setAllCreatures] = useState<any[]>([])
  useEffect(() => {
    if (!address) return
    api.getCollection(address).then(data => {
      setAllCreatures(data.racers)
    }).catch((err) => { console.error('Failed to load collection:', err); toast.error('Failed to load data. Please refresh.') })
  }, [address])

  // Load daily race info
  useEffect(() => {
    api.getDailyRace().then(setDailyRace).catch((err) => { console.error('Failed to load daily race:', err) })
  }, [])

  // Free formats take any racer; paid formats are for upgraded racers only.
  useEffect(() => {
    if (selectedFormat.id === 'exhibition' || selectedFormat.id === 'demo_standard') {
      setRacers(allCreatures)
    } else {
      setRacers(allCreatures.filter((s: any) => s.type === 'pro'))
    }
    setSelectedRacer(null)
  }, [selectedFormat, allCreatures])

  // Poll live races when on the Live Races tab
  useEffect(() => {
    if (mainTab !== 'live') return
    setLiveLoading(true)
    function loadLive() {
      api.getActiveRaces()
        .then(d => setLiveRaces(d.races))
        .catch(() => setLiveRaces([]))
        .finally(() => setLiveLoading(false))
    }
    loadLive()
    const interval = setInterval(loadLive, 5000)
    return () => clearInterval(interval)
  }, [mainTab])

  async function handleCreateAndJoin() {
    if (!address || !selectedRacer) return
    setLoading(true)
    try {
      const apiFormat = selectedFormat.id === 'demo_standard' ? 'exhibition' : selectedFormat.id
      const race = await api.createRace(address, selectedRacer.id, apiFormat)

      // The loadout goes with the join — it is the pre-race decision now, and
      // it is made on the same screen as the racer and the distance rather than
      // in a phase of its own.
      await api.joinRaceWithLoadout(race.raceId, selectedRacer.id, address, loadout)
      await api.startRace(race.raceId)

      const result = await api.simulateRace(race.raceId)
      navigate(`/race/${race.raceId}`, {
        state: { raceResult: result, format: selectedFormat.id, racerId: selectedRacer.id },
      })
    } catch (err: any) {
      toast.error(err.message)
    }
    setLoading(false)
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-brand-dust">Connect your wallet to enter a race</p>
        <WalletConnect />
      </div>
    )
  }

  return (
    <div>
      {/* Tab selector - only show when in select phase */}
      {phase === 'select' && (
        <div className="max-w-5xl mx-auto px-4 pt-6">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setMainTab('create')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                mainTab === 'create' ? 'bg-brand-primary/20 text-brand-primary' : 'text-brand-dust hover:text-brand-ink hover:bg-brand-ink/5'
              }`}
            >
              Create Race
            </button>
            <button
              onClick={() => setMainTab('live')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                mainTab === 'live' ? 'bg-brand-primary/20 text-brand-primary' : 'text-brand-dust hover:text-brand-ink hover:bg-brand-ink/5'
              }`}
            >
              Live Races
            </button>
          </div>
        </div>
      )}

      {/* Live Races view */}
      {mainTab === 'live' && phase === 'select' && (
        <div className="max-w-3xl mx-auto px-4 pb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">Live Races</h2>
            <p className="text-brand-dust text-sm mt-1">Watch races in progress</p>
          </div>

          {liveLoading && <Spinner text="Loading active races..." />}

          {!liveLoading && liveRaces.length === 0 && (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">{'\u{1F3C1}'}</div>
              <p className="text-brand-dust mb-2">No active races right now</p>
              <p className="text-brand-dust text-sm">Races appear here when in progress. Check back soon!</p>
            </div>
          )}

          {!liveLoading && liveRaces.length > 0 && (
            <div className="space-y-3">
              {liveRaces.map((race: any, i: number) => (
                <motion.div
                  key={race.raceId || race.id || i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="toy-panel p-4 flex items-center justify-between hover:border-brand-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center">
                      <span className="text-xl">{THEME.brand.mark}</span>
                    </div>
                    <div>
                      <p className="text-brand-ink font-semibold">
                        {formatLabel(race.format) || 'Race'}
                      </p>
                      <p className="text-brand-dust text-xs">
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
                      className="px-4 py-2 bg-brand-primary/20 text-brand-primary font-semibold rounded-lg hover:bg-brand-primary/30 transition-colors cursor-pointer text-sm"
                    >
                      Watch
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Race flow (existing content) */}
      {(mainTab === 'create' || phase !== 'select') && (
      <div className="max-w-3xl mx-auto px-4 py-8">
      <AnimatePresence mode="wait">
        {/* Phase 1: Racer & Format Selection */}
        {phase === 'select' && (
          <motion.div
            key="select"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <h1 className="text-3xl font-bold mb-6">Race Lobby</h1>

            {/* Daily Race Banner */}
            {dailyRace && (
              <div className="mb-6 p-4 bg-gradient-to-r from-brand-accent/20 to-brand-primary/20 border border-brand-accent/30 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-brand-ink font-bold text-sm">Daily Race</p>
                    <p className="text-brand-dust text-xs">
                      Weather: <span className="text-brand-primary font-semibold capitalize">{dailyRace.weather}</span>
                      {' \u2022 '}Daily Exhibition Race
                    </p>
                    <p className="text-brand-dust text-[10px] mt-0.5">Free exhibition race with today's weather. Play as many times as you want.</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFormat(FORMATS[0]) // Practice Run
                    }}
                    className="px-4 py-1.5 bg-brand-accent text-brand-ink font-bold rounded-lg text-sm cursor-pointer hover:bg-brand-accent/80"
                  >
                    Join Daily
                  </button>
                </div>
              </div>
            )}

            {racers.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">{THEME.brand.mark}</div>
                <p className="text-brand-dust mb-4">You need a Racer to race</p>
                <button
                  onClick={() => navigate('/collection')}
                  className="px-6 py-2.5 toy-btn bg-brand-primary text-brand-surface cursor-pointer"
                >
                  Go to {THEME.locations.home}
                </button>
              </div>
            ) : (
              <>
                {/* Balance */}

                {/* Format selection */}
                <h2 className="text-lg font-semibold text-brand-ink/80 mb-3">Select Race Format</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                  {visibleFormats.map(fmt => (
                    <button
                      key={fmt.id}
                      onClick={() => setSelectedFormat(fmt)}
                      className={`toy-panel toy-pop p-4 text-left cursor-pointer transition-transform ${
                        selectedFormat.id === fmt.id
                          ? 'translate-y-[4px] shadow-none bg-brand-gold/25'
                          : 'hover:-translate-y-[2px]'
                      }`}
                    >
                      <p className="text-brand-ink font-semibold">
                        {fmt.name}
                        {fmt.id === 'demo_standard' && (
                          <span className="ml-2 px-1.5 py-0.5 bg-brand-gold text-brand-ink text-[10px] font-bold rounded-full px-2 border-2 border-brand-ink">DEMO</span>
                        )}
                      </p>
                      <p className="text-brand-dust text-sm mt-1">{fmt.desc}</p>
                    </button>
                  ))}
                </div>

                {/* Racer selection */}
                <h2 className="text-lg font-semibold text-brand-ink/80 mb-3">Select Your Racer</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                  {racers.map(racer => (
                    <button
                      key={racer.id}
                      onClick={() => setSelectedRacer(racer)}
                      className={`toy-panel toy-pop p-4 flex items-center gap-4 cursor-pointer transition-transform ${
                        selectedRacer?.id === racer.id
                          ? 'translate-y-[4px] shadow-none bg-brand-gold/25'
                          : 'hover:-translate-y-[2px]'
                      }`}
                    >
                      <div className="w-14 shrink-0">
                        <RacerPortrait archetype={racer.race} rarity={racer.rarity} height={56} still />
                      </div>
                      <div className="text-left">
                        <p className="text-brand-ink font-semibold flex items-center gap-2">
                          {racer.name}
                          {racer.type === 'free' && (
                            <span className="px-1.5 py-0.5 bg-brand-info text-brand-surface text-[10px] font-bold rounded-full px-2 border-2 border-brand-ink">{THEME.tiers.free.toUpperCase()}</span>
                          )}
                        </p>
                        <p className="text-brand-dust text-xs capitalize">
                          {racer.type === 'free' ? THEME.tiers.free : `${rarityLabel(racer.rarity)} ${archetypeLabel(racer.race)}`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Loadout — the pre-race decision */}
                <h2 className="text-lg font-semibold text-brand-ink/80 mb-3">Pack Two Items</h2>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {([0, 1] as const).map(slot => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() =>
                        setLoadout(prev => {
                          const next = [...prev]
                          next[slot] = next[slot] === 'boost' ? 'hinder' : 'boost'
                          return next
                        })
                      }
                      className="toy-panel p-4 text-left cursor-pointer transition-transform hover:-translate-y-[2px]"
                    >
                      <p className="text-brand-ink font-semibold">
                        {THEME.items[loadout[slot]].name}
                      </p>
                      <p className="text-brand-dust text-sm mt-1">
                        {THEME.items[loadout[slot]].blurb}
                      </p>
                      <p className="text-brand-dust text-[11px] mt-2">Tap to swap</p>
                    </button>
                  ))}
                </div>

                {/* Start button */}
                <button
                  onClick={handleCreateAndJoin}
                  disabled={!selectedRacer || loading}
                  className="w-full py-4 toy-btn bg-brand-gold text-brand-ink text-xl tracking-wide"
                >
                  {loading ? 'Starting…' : 'Race'}
                </button>
              </>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
      )}
    </div>
  )
}
