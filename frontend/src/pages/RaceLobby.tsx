import { useWallet } from '../hooks/useWallet'
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import WalletConnect from '../components/WalletConnect'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { THEME, rarityLabel, archetypeLabel } from '../config/theme'
import RacerPortrait from '../components/RacerPortrait'

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

const FORMATS = [fmt('sprint'), fmt('endurance')]

export const visibleFormats = FORMATS

export default function RaceLobby() {
  const { address, isConnected } = useWallet()
  const navigate = useNavigate()
  const location = useLocation()


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
  }, [])

  // Both formats take any racer. The filter used to hide every free racer from
  // the paid formats, which meant the Wind-Up a new player mints could not
  // enter either real race — a gate left over from when they cost money.
  useEffect(() => {
    setRacers(allCreatures)
    // With one racer, tapping it is a step that decides nothing — the Race
    // button just sits disabled until the player taps the only card there is.
    setSelectedRacer((prev: any) =>
      allCreatures.length === 1 ? allCreatures[0]
      : prev && allCreatures.some((c: any) => c.id === prev.id) ? prev
      : null
    )
  }, [allCreatures])


  async function handleCreateAndJoin() {
    if (!address || !selectedRacer) return
    setLoading(true)
    try {
      const apiFormat = selectedFormat.id
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
                      <p className="text-brand-ink font-semibold">{fmt.name}</p>
                      <p className="text-brand-dust text-sm mt-1">{fmt.desc}</p>
                    </button>
                  ))}
                </div>

                {/* Racer selection.
                    A wallet holds at most one Wind-Up and one Showcase, and
                    upgrading burns the Wind-Up — so for almost every player
                    this list is exactly one card under a heading that promises
                    a choice. With one racer it states who is racing; the
                    heading and the picker only appear when there is something
                    to pick. */}
                <h2 className="text-lg font-semibold text-brand-ink/80 mb-3">
                  {racers.length > 1 ? 'Select Your Racer' : 'Racing As'}
                </h2>
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
    </div>
  )
}
