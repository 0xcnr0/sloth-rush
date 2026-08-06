import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import WalletConnect from '../components/WalletConnect'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { THEME, CUR, rarityLabel, archetypeLabel } from '../config/theme'
import WindUpPhase from '../components/PreRace/WindUpPhase'
import GridReveal from '../components/PreRace/GridReveal'
import Spinner from '../components/Spinner'
import { FEATURES } from '../config/features'

type Phase = 'select' | 'lobby' | 'winding' | 'reveal' | 'starting' | 'gp_break'

const FORMATS = [
  { id: 'exhibition', name: 'Exhibition', fee: 0, maxTune: 0, desc: 'Free practice race' },
  { id: 'demo_standard', name: 'Demo Standard', fee: 0, maxTune: 100, desc: 'Quick 20s demo race' },
  { id: 'standard', name: 'Standard Race', fee: 50, maxTune: 100, desc: `50 ${CUR} entry, win big` },
  { id: 'grand_prix', name: 'Grand Prix', fee: 150, maxTune: 300, desc: 'Multi-round championship' },
  { id: 'tactic', name: 'Tactic Challenge', fee: 75, maxTune: 150, desc: `Use ${THEME.tactics.boost} & ${THEME.tactics.projectile} mid-race!` },
]

const visibleFormats = FORMATS.filter(f => {
  if (f.id === 'grand_prix' && !FEATURES.grandPrix) return false
  if (f.id === 'tactic' && !FEATURES.tacticRace) return false
  if (f.id === 'demo_standard' && !FEATURES.demoRace) return false
  return true
})

export default function RaceLobby() {
  const { address, isConnected } = useAccount()
  const navigate = useNavigate()

  const [mainTab, setMainTab] = useState<'create' | 'live'>('create')
  const [liveRaces, setLiveRaces] = useState<any[]>([])
  const [liveLoading, setLiveLoading] = useState(false)

  const [phase, setPhase] = useState<Phase>('select')
  const [racers, setRacers] = useState<any[]>([])
  const [coinBalance, setCoinBalance] = useState(0)
  const [selectedRacer, setSelectedRacer] = useState<any>(null)
  const [selectedFormat, setSelectedFormat] = useState(FORMATS[1])
  const [raceId, setRaceId] = useState('')
  const [gridPositions, setGridPositions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [gpQualifyId, setGpQualifyId] = useState('')
  const [gpQualifiers, setGpQualifiers] = useState<any[]>([])
  const [gpBreakCountdown, setGpBreakCountdown] = useState(30)
  const [dailyRace, setDailyRace] = useState<{ raceId: string; weather: string; date: string } | null>(null)

  // Load creatures (racers + free racers)
  const [allCreatures, setAllCreatures] = useState<any[]>([])
  useEffect(() => {
    if (!address) return
    api.getCollection(address).then(data => {
      setAllCreatures(data.racers)
      setCoinBalance(data.coinBalance)
    }).catch((err) => { console.error('Failed to load collection:', err); toast.error('Failed to load data. Please refresh.') })
  }, [address])

  // Load daily race info
  useEffect(() => {
    api.getDailyRace().then(setDailyRace).catch((err) => { console.error('Failed to load daily race:', err) })
  }, [])

  // Filter creatures based on format: exhibition → all, others → racers only, GP → tier gate
  useEffect(() => {
    if (selectedFormat.id === 'exhibition' || selectedFormat.id === 'demo_standard') {
      setRacers(allCreatures)
    } else if (selectedFormat.id === 'grand_prix') {
      // GP: no free racers, Gold GP (fee > 150) requires tier >= 2
      setRacers(allCreatures.filter((s: any) => {
        if (s.type === 'free') return false
        if (selectedFormat.fee > 150 && (s.tier || 0) < 2) return false
        return true
      }))
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
      if (selectedFormat.id === 'grand_prix') {
        // GP flow: create GP, join qualifying
        const gp = await api.createGP()
        setGpQualifyId(gp.qualifyRaceId)
        setRaceId(gp.qualifyRaceId)

        const joined = await api.joinRace(gp.qualifyRaceId, selectedRacer.id, address)
        setCoinBalance(joined.newBalance)
        setPhase('lobby')
      } else {
        const apiFormat = selectedFormat.id === 'demo_standard' ? 'exhibition' : selectedFormat.id
        const race = await api.createRace(address, selectedRacer.id, apiFormat)
        setRaceId(race.raceId)

        const joined = await api.joinRace(race.raceId, selectedRacer.id, address)
        setCoinBalance(joined.newBalance)
        setPhase('lobby')
      }
    } catch (err: any) {
      toast.error(err.message)
    }
    setLoading(false)
  }

  async function handleStartRace() {
    if (!raceId) return
    setLoading(true)
    try {
      // Opens the tuning window server-side. The race does NOT simulate yet —
      // the Wind-Up phase owns the gap, and calls runRace() once the player has
      // locked their tension in (docs/WIND_UP_PHASE.md §4).
      await api.startTuning(raceId)
      setPhase('winding')
    } catch (err: any) {
      toast.error(err.message)
    }
    setLoading(false)
  }

  async function runRace() {
    if (!raceId) return
    setLoading(true)
    try {
      setPhase('starting')
      const result = await api.simulateRace(raceId)
      setGridPositions(result.gridPositions)
      setPhase('reveal')

      if (gpQualifyId && raceId === gpQualifyId) {
        // GP qualifying done — go to break phase, then straight into the final
        setTimeout(async () => {
          try {
            const advanced = await api.advanceGP(gpQualifyId)
            setGpQualifiers(advanced.qualifiers)
            setPhase('gp_break')
            let t = 30
            const interval = setInterval(() => {
              t--
              setGpBreakCountdown(t)
              if (t <= 0) {
                clearInterval(interval)
                void runGpFinal(advanced.finalRaceId)
              }
            }, 1000)
          } catch (err: any) {
            toast.error(err.message)
          }
        }, 4000)
      } else {
        const isDemoNav = selectedFormat.id === 'demo_standard'
        setTimeout(() => {
          navigate(`/race/${raceId}`, { state: { raceResult: result, format: isDemoNav ? 'exhibition' : selectedFormat.id, racerId: selectedRacer?.id, demo: isDemoNav } })
        }, 4000)
      }
    } catch (err: any) {
      toast.error(err.message)
    }
    setLoading(false)
  }

  async function runGpFinal(finalRaceId: string) {
    try {
      const result = await api.simulateRace(finalRaceId)
      navigate(`/race/${finalRaceId}`, { state: { raceResult: result, format: 'gp_final', racerId: selectedRacer?.id } })
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-400">Connect your wallet to enter a race</p>
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
                mainTab === 'create' ? 'bg-brand-primary/20 text-brand-primary' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Create Race
            </button>
            <button
              onClick={() => setMainTab('live')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                mainTab === 'live' ? 'bg-brand-primary/20 text-brand-primary' : 'text-gray-400 hover:text-white hover:bg-white/5'
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
            <p className="text-gray-400 text-sm mt-1">Watch races in progress</p>
          </div>

          {liveLoading && <Spinner text="Loading active races..." />}

          {!liveLoading && liveRaces.length === 0 && (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">{'\u{1F3C1}'}</div>
              <p className="text-gray-400 mb-2">No active races right now</p>
              <p className="text-gray-500 text-sm">Races appear here when in progress. Check back soon!</p>
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
                  className="bg-brand-surface border border-brand-border rounded-xl p-4 flex items-center justify-between hover:border-brand-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center">
                      <span className="text-xl">{THEME.brand.mark}</span>
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
                    <p className="text-white font-bold text-sm">Daily Race</p>
                    <p className="text-gray-400 text-xs">
                      Weather: <span className="text-brand-primary font-semibold capitalize">{dailyRace.weather}</span>
                      {' \u2022 '}Daily Exhibition Race
                    </p>
                    <p className="text-gray-500 text-[10px] mt-0.5">Free exhibition race with today's weather. Play as many times as you want.</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFormat(FORMATS[0]) // Exhibition
                      setRaceId(dailyRace.raceId)
                    }}
                    className="px-4 py-1.5 bg-brand-accent text-white font-bold rounded-lg text-sm cursor-pointer hover:bg-brand-accent/80"
                  >
                    Join Daily
                  </button>
                </div>
              </div>
            )}

            {/* Upcoming GP Banner */}
            {FEATURES.grandPrix && (
            <div className="mb-6 p-4 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-amber-500/30 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{'\u{1F3C6}'}</span>
                <div>
                  <p className="text-white font-bold text-sm">Upcoming Grand Prix</p>
                  <p className="text-gray-400 text-xs">Grand Prix races unlock as more players join. Stay tuned!</p>
                </div>
              </div>
            </div>
            )}

            {racers.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">{THEME.brand.mark}</div>
                <p className="text-gray-400 mb-4">You need a Racer to race</p>
                <button
                  onClick={() => navigate('/collection')}
                  className="px-6 py-2.5 bg-brand-primary text-brand-bg font-bold rounded-xl cursor-pointer"
                >
                  Go to {THEME.locations.home}
                </button>
              </div>
            ) : (
              <>
                {/* Balance */}
                <div className="flex items-center gap-2 mb-6">
                  <span className="text-gray-400">Balance:</span>
                  <span className="text-brand-primary font-bold text-xl">{coinBalance}</span>
                  <span className="text-brand-primary/70 text-sm">{CUR}</span>
                </div>

                {/* Format selection */}
                <h2 className="text-lg font-semibold text-gray-300 mb-3">Select Race Format</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                  {visibleFormats.map(fmt => (
                    <button
                      key={fmt.id}
                      onClick={() => setSelectedFormat(fmt)}
                      className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                        selectedFormat.id === fmt.id
                          ? 'border-brand-primary bg-brand-primary/10'
                          : 'border-brand-border bg-brand-surface hover:border-gray-500'
                      }`}
                    >
                      <p className="text-white font-semibold">
                        {fmt.name}
                        {fmt.id === 'demo_standard' && (
                          <span className="ml-2 px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] font-bold rounded">DEMO</span>
                        )}
                      </p>
                      <p className="text-gray-500 text-sm mt-1">{fmt.desc}</p>
                      {fmt.fee > 0 && (
                        <p className="text-brand-primary text-sm font-bold mt-2">{fmt.fee} {CUR} Entry</p>
                      )}
                    </button>
                  ))}
                </div>

                {/* Racer selection */}
                <h2 className="text-lg font-semibold text-gray-300 mb-3">Select Your Racer</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                  {racers.map(racer => (
                    <button
                      key={racer.id}
                      onClick={() => setSelectedRacer(racer)}
                      className={`p-4 rounded-xl border flex items-center gap-4 transition-colors cursor-pointer ${
                        selectedRacer?.id === racer.id
                          ? 'border-brand-primary bg-brand-primary/10'
                          : 'border-brand-border bg-brand-surface hover:border-gray-500'
                      }`}
                    >
                      <span className="text-3xl">{THEME.brand.mark}</span>
                      <div className="text-left">
                        <p className="text-white font-semibold flex items-center gap-2">
                          {racer.name}
                          {racer.type === 'free' && (
                            <span className="px-1.5 py-0.5 bg-brand-info/20 text-brand-info text-[10px] font-bold rounded">{THEME.tiers.free.toUpperCase()}</span>
                          )}
                        </p>
                        <p className="text-gray-500 text-xs capitalize">
                          {racer.type === 'free' ? THEME.tiers.free : `${rarityLabel(racer.rarity)} ${archetypeLabel(racer.race)}`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Start button */}
                <button
                  onClick={handleCreateAndJoin}
                  disabled={!selectedRacer || loading || (selectedFormat.fee > coinBalance)}
                  className="w-full py-3 bg-brand-primary text-brand-bg font-bold rounded-xl text-lg hover:bg-brand-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Creating Race...' : `Enter Race (${selectedFormat.fee > 0 ? `${selectedFormat.fee} ${CUR}` : 'Free'})`}
                </button>
                {selectedFormat.fee > 0 && coinBalance < selectedFormat.fee && (
                  <p className="text-red-400 text-sm text-center mt-2">
                    Need {selectedFormat.fee} {CUR} — you have {coinBalance}. Visit the Shop to buy more.
                  </p>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* Phase 2: Lobby (waiting) */}
        {phase === 'lobby' && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center"
          >
            <h1 className="text-3xl font-bold mb-2">Race Lobby</h1>
            <p className="text-gray-400 mb-8">{selectedFormat.name} — {raceId.slice(-8)}</p>

            {/* 4 slots */}
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mb-8">
              {/* Player slot */}
              <div className="bg-brand-surface border-2 border-brand-primary rounded-xl p-4 text-center">
                <div className="text-3xl mb-2">{THEME.brand.mark}</div>
                <p className="text-white font-semibold text-sm">{selectedRacer?.name}</p>
                <p className="text-brand-primary text-xs">YOU</p>
              </div>
              {/* Bot slots */}
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-brand-surface border border-brand-border rounded-xl p-4 text-center">
                  <div className="text-3xl mb-2 opacity-30">&#x1f916;</div>
                  <p className="text-gray-500 text-sm">Waiting...</p>
                  <p className="text-gray-600 text-xs">BOT</p>
                </div>
              ))}
            </div>

            <button
              onClick={handleStartRace}
              disabled={loading}
              className="px-8 py-3 bg-brand-primary text-brand-bg font-bold rounded-xl text-lg hover:bg-brand-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Filling with Bots...' : 'Start Race!'}
            </button>
          </motion.div>
        )}

        {/* Wind-Up phase — skill decides the grid, not spending. */}
        {phase === 'winding' && address && raceId && (
          <WindUpPhase raceId={raceId} wallet={address} onLocked={() => void runRace()} />
        )}

        {/* Grid Reveal */}
        {phase === 'reveal' && <GridReveal entries={gridPositions} />}

        {/* GP Break Phase */}
        {phase === 'gp_break' && (
          <motion.div
            key="gp_break"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center"
          >
            <motion.h1
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              className="text-3xl font-extrabold text-brand-gold mb-4"
            >
              ELIMINATION COMPLETE!
            </motion.h1>
            <p className="text-gray-400 mb-6">Finalists determined. Final starts in {gpBreakCountdown}s...</p>

            <div className="text-6xl font-extrabold text-white mb-8">{gpBreakCountdown}</div>

            <div className="max-w-md mx-auto space-y-2 mb-6">
              {gpQualifiers.map((q: any, i: number) => (
                <motion.div
                  key={q.id}
                  initial={{ x: -40, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.3 }}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    i === 0 ? 'bg-brand-gold/10 border border-brand-gold' : 'bg-brand-surface border border-brand-border'
                  }`}
                >
                  <span className={`font-bold w-8 ${i === 0 ? 'text-brand-gold' : 'text-gray-500'}`}>{i + 1}.</span>
                  <span className="text-white font-semibold">{q.name}</span>
                  {q.isBot && <span className="text-gray-600 text-xs">BOT</span>}
                </motion.div>
              ))}
            </div>

            <p className="text-brand-accent text-sm font-bold">FINAL = TACTIC MODE + GDA PRICING + CHAOS MODE!</p>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
      )}
    </div>
  )
}
