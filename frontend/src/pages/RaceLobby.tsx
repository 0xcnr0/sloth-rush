import { useState, useEffect, useRef, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { api } from '../lib/api'

type Phase = 'select' | 'lobby' | 'bidding' | 'reveal' | 'starting' | 'gp_break' | 'gp_final_bid'

const FORMATS = [
  { id: 'exhibition', name: 'Exhibition', fee: 0, maxRaise: 0, desc: 'Free practice race' },
  { id: 'standard', name: 'Standard Race', fee: 50, maxRaise: 100, desc: '50 SLUG entry, win big' },
  { id: 'grand_prix', name: 'Grand Prix', fee: 150, maxRaise: 300, desc: 'High stakes racing' },
  { id: 'tactic', name: 'Tactic Challenge', fee: 75, maxRaise: 150, desc: 'Use Boost & Shell during race!' },
]

export default function RaceLobby() {
  const { address, isConnected } = useAccount()
  const navigate = useNavigate()

  const [phase, setPhase] = useState<Phase>('select')
  const [snails, setSnails] = useState<any[]>([])
  const [coinBalance, setCoinBalance] = useState(0)
  const [selectedSnail, setSelectedSnail] = useState<any>(null)
  const [selectedFormat, setSelectedFormat] = useState(FORMATS[1])
  const [raceId, setRaceId] = useState('')
  const [participants, setParticipants] = useState<any[]>([])
  const [bidAmount, setBidAmount] = useState(0)
  const [bidSubmitted, setBidSubmitted] = useState(false)
  const [countdown, setCountdown] = useState(10)
  const [gridPositions, setGridPositions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [gpQualifyId, setGpQualifyId] = useState('')
  const [gpFinalId, setGpFinalId] = useState('')
  const [gpQualifiers, setGpQualifiers] = useState<any[]>([])
  const [gpBreakCountdown, setGpBreakCountdown] = useState(30)

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load creatures (snails + free slugs)
  const [allCreatures, setAllCreatures] = useState<any[]>([])
  useEffect(() => {
    if (!address) return
    api.getStable(address).then(data => {
      setAllCreatures(data.slugs)
      setCoinBalance(data.coinBalance)
    }).catch(() => {})
  }, [address])

  // Filter creatures based on format: exhibition → all, others → snails only
  useEffect(() => {
    if (selectedFormat.id === 'exhibition') {
      setSnails(allCreatures)
    } else {
      setSnails(allCreatures.filter((s: any) => s.type === 'snail'))
    }
    setSelectedSnail(null)
  }, [selectedFormat, allCreatures])

  // Countdown timer for bidding
  const startCountdown = useCallback(() => {
    setCountdown(10)
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  // Auto-submit bid when countdown reaches 0
  useEffect(() => {
    if (countdown === 0 && (phase === 'bidding' || phase === 'gp_final_bid') && !bidSubmitted) {
      handleBidSubmit()
    }
  }, [countdown, phase, bidSubmitted])

  async function handleCreateAndJoin() {
    if (!address || !selectedSnail) return
    setLoading(true)
    try {
      if (selectedFormat.id === 'grand_prix') {
        // GP flow: create GP, join qualifying
        const gp = await api.createGP()
        setGpQualifyId(gp.qualifyRaceId)
        setGpFinalId(gp.finalRaceId)
        setRaceId(gp.qualifyRaceId)

        const joined = await api.joinRace(gp.qualifyRaceId, selectedSnail.id, address)
        setCoinBalance(joined.newBalance)
        setPhase('lobby')
      } else {
        const race = await api.createRace(address, selectedSnail.id, selectedFormat.id)
        setRaceId(race.raceId)

        const joined = await api.joinRace(race.raceId, selectedSnail.id, address)
        setCoinBalance(joined.newBalance)
        setPhase('lobby')
      }
    } catch (err: any) {
      alert(err.message)
    }
    setLoading(false)
  }

  async function handleStartBidding() {
    if (!raceId) return
    setLoading(true)
    try {
      await api.startBidding(raceId)
      // Load participants
      const raceData = await api.getRace(raceId)
      setParticipants(raceData.participants || [])
      setPhase('bidding')
      startCountdown()
    } catch (err: any) {
      alert(err.message)
    }
    setLoading(false)
  }

  async function handleBidSubmit() {
    if (!raceId || !address || bidSubmitted) return
    setBidSubmitted(true)
    if (countdownRef.current) clearInterval(countdownRef.current)
    try {
      await api.submitBid(raceId, address, bidAmount)
      // Wait a moment then simulate
      await new Promise(r => setTimeout(r, 1500))
      const result = await api.simulateRace(raceId)
      setGridPositions(result.gridPositions)
      setPhase('reveal')

      if (gpQualifyId && raceId === gpQualifyId) {
        // GP qualifying done — go to break phase
        setTimeout(async () => {
          try {
            const advanced = await api.advanceGP(gpQualifyId)
            setGpQualifiers(advanced.qualifiers)
            setGpFinalId(advanced.finalRaceId)
            setPhase('gp_break')
            // 30s break countdown
            let t = 30
            const interval = setInterval(() => {
              t--
              setGpBreakCountdown(t)
              if (t <= 0) {
                clearInterval(interval)
                // Move to final bidding
                setRaceId(advanced.finalRaceId)
                setBidSubmitted(false)
                setBidAmount(0)
                setCountdown(10)
                setPhase('gp_final_bid')
                startCountdown()
              }
            }, 1000)
          } catch (err: any) {
            alert(err.message)
          }
        }, 4000)
      } else {
        // Regular race — navigate to broadcast
        setTimeout(() => {
          navigate(`/race/${raceId}`, { state: { raceResult: result, format: selectedFormat.id, snailId: selectedSnail?.id } })
        }, 4000)
      }
    } catch (err: any) {
      alert(err.message)
      setBidSubmitted(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-400">Connect your wallet to enter a race</p>
        <ConnectButton />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <AnimatePresence mode="wait">
        {/* Phase 1: Snail & Format Selection */}
        {phase === 'select' && (
          <motion.div
            key="select"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <h1 className="text-3xl font-bold mb-6">Race Lobby</h1>

            {snails.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">&#x1f40c;</div>
                <p className="text-gray-400 mb-4">You need a Snail to race</p>
                <button
                  onClick={() => navigate('/stable')}
                  className="px-6 py-2.5 bg-slug-green text-slug-dark font-bold rounded-xl cursor-pointer"
                >
                  Go to Stable
                </button>
              </div>
            ) : (
              <>
                {/* Balance */}
                <div className="flex items-center gap-2 mb-6">
                  <span className="text-gray-400">Balance:</span>
                  <span className="text-slug-green font-bold text-xl">{coinBalance}</span>
                  <span className="text-slug-green/70 text-sm">SLUG</span>
                </div>

                {/* Format selection */}
                <h2 className="text-lg font-semibold text-gray-300 mb-3">Select Race Format</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                  {FORMATS.map(fmt => (
                    <button
                      key={fmt.id}
                      onClick={() => setSelectedFormat(fmt)}
                      className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                        selectedFormat.id === fmt.id
                          ? 'border-slug-green bg-slug-green/10'
                          : 'border-slug-border bg-slug-card hover:border-gray-500'
                      }`}
                    >
                      <p className="text-white font-semibold">{fmt.name}</p>
                      <p className="text-gray-500 text-sm mt-1">{fmt.desc}</p>
                      {fmt.fee > 0 && (
                        <p className="text-slug-green text-sm font-bold mt-2">{fmt.fee} SLUG Entry</p>
                      )}
                    </button>
                  ))}
                </div>

                {/* Snail selection */}
                <h2 className="text-lg font-semibold text-gray-300 mb-3">Select Your Snail</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                  {snails.map(snail => (
                    <button
                      key={snail.id}
                      onClick={() => setSelectedSnail(snail)}
                      className={`p-4 rounded-xl border flex items-center gap-4 transition-colors cursor-pointer ${
                        selectedSnail?.id === snail.id
                          ? 'border-slug-green bg-slug-green/10'
                          : 'border-slug-border bg-slug-card hover:border-gray-500'
                      }`}
                    >
                      <span className="text-3xl">&#x1f40c;</span>
                      <div className="text-left">
                        <p className="text-white font-semibold flex items-center gap-2">
                          {snail.name}
                          {snail.type === 'free_slug' && (
                            <span className="px-1.5 py-0.5 bg-slug-blue/20 text-slug-blue text-[10px] font-bold rounded">FREE SLUG</span>
                          )}
                        </p>
                        <p className="text-gray-500 text-xs capitalize">
                          {snail.type === 'free_slug' ? 'Free Slug' : `${snail.rarity} ${snail.race?.replace('_', ' ')}`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Start button */}
                <button
                  onClick={handleCreateAndJoin}
                  disabled={!selectedSnail || loading || (selectedFormat.fee > coinBalance)}
                  className="w-full py-3 bg-slug-green text-slug-dark font-bold rounded-xl text-lg hover:bg-slug-green/90 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Creating Race...' :
                    selectedFormat.fee > coinBalance ? `Need ${selectedFormat.fee} SLUG` :
                    `Enter Race (${selectedFormat.fee > 0 ? selectedFormat.fee + ' SLUG' : 'Free'})`
                  }
                </button>
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
              <div className="bg-slug-card border-2 border-slug-green rounded-xl p-4 text-center">
                <div className="text-3xl mb-2">&#x1f40c;</div>
                <p className="text-white font-semibold text-sm">{selectedSnail?.name}</p>
                <p className="text-slug-green text-xs">YOU</p>
              </div>
              {/* Bot slots */}
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-slug-card border border-slug-border rounded-xl p-4 text-center">
                  <div className="text-3xl mb-2 opacity-30">&#x1f916;</div>
                  <p className="text-gray-500 text-sm">Waiting...</p>
                  <p className="text-gray-600 text-xs">BOT</p>
                </div>
              ))}
            </div>

            <button
              onClick={handleStartBidding}
              disabled={loading}
              className="px-8 py-3 bg-slug-green text-slug-dark font-bold rounded-xl text-lg hover:bg-slug-green/90 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Filling with Bots...' : 'Start Race!'}
            </button>
          </motion.div>
        )}

        {/* Phase 3: Sealed Bid */}
        {phase === 'bidding' && (
          <motion.div
            key="bidding"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="text-center"
          >
            <h1 className="text-2xl font-bold mb-2">SEALED BID</h1>
            <p className="text-gray-400 mb-6">Place your raise to fight for Pole Position!</p>

            {/* Big countdown */}
            <motion.div
              key={countdown}
              initial={{ scale: 1.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`text-8xl font-extrabold mb-8 ${
                countdown <= 3 ? 'text-slug-red' : countdown <= 5 ? 'text-slug-gold' : 'text-white'
              }`}
            >
              {countdown}
            </motion.div>

            {/* Participants */}
            <div className="flex justify-center gap-3 mb-8">
              {participants.map((p: any, i: number) => (
                <div
                  key={i}
                  className={`bg-slug-card border rounded-lg p-3 text-center w-20 ${
                    p.wallet === address ? 'border-slug-green' : 'border-slug-border'
                  }`}
                >
                  <div className="text-2xl mb-1">{p.is_bot ? '\u{1F916}' : '\u{1F40C}'}</div>
                  <p className="text-xs text-gray-400 truncate">{p.name}</p>
                </div>
              ))}
            </div>

            {/* Bid slider */}
            {!bidSubmitted ? (
              <div className="max-w-sm mx-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Raise Amount</span>
                  <span className="text-slug-green font-bold text-lg">{bidAmount} SLUG</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.min(selectedFormat.maxRaise, coinBalance)}
                  value={bidAmount}
                  onChange={e => setBidAmount(Number(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slug-border accent-slug-green"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0</span>
                  <span>Max: {Math.min(selectedFormat.maxRaise, coinBalance)}</span>
                </div>

                <button
                  onClick={handleBidSubmit}
                  className="w-full mt-6 py-3 bg-slug-gold text-slug-dark font-bold rounded-xl text-lg hover:bg-slug-gold/90 transition-colors cursor-pointer"
                >
                  CONFIRM BID
                </button>
              </div>
            ) : (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-slug-green/10 border border-slug-green rounded-xl p-6 max-w-sm mx-auto"
              >
                <div className="text-3xl mb-2">&#x1f512;</div>
                <p className="text-slug-green font-bold">Bid Locked: {bidAmount} SLUG</p>
                <p className="text-gray-400 text-sm mt-1">Revealing bids...</p>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Phase 4: Bid Reveal */}
        {phase === 'reveal' && (
          <motion.div
            key="reveal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center"
          >
            <motion.h1
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 150 }}
              className="text-3xl font-extrabold text-slug-gold mb-8"
            >
              WHO GOT POLE POSITION?
            </motion.h1>

            <div className="max-w-md mx-auto space-y-3">
              {gridPositions.map((gp, i) => (
                <motion.div
                  key={gp.id}
                  initial={{ x: -100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.6, type: 'spring' }}
                  className={`flex items-center gap-4 p-4 rounded-xl border ${
                    i === 0 ? 'bg-slug-gold/10 border-slug-gold' :
                    'bg-slug-card border-slug-border'
                  }`}
                >
                  <span className={`text-2xl font-extrabold w-8 ${i === 0 ? 'text-slug-gold' : 'text-gray-500'}`}>
                    P{gp.position}
                  </span>
                  <span className="text-2xl">&#x1f40c;</span>
                  <div className="flex-1 text-left">
                    <p className="text-white font-semibold">{gp.name}</p>
                    <p className="text-gray-500 text-xs">Bid: {gp.bid} SLUG</p>
                  </div>
                  {i === 0 && (
                    <span className="text-slug-gold text-sm font-bold">POLE</span>
                  )}
                </motion.div>
              ))}
            </div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 3 }}
              className="text-gray-400 mt-8"
            >
              Starting race...
            </motion.p>
          </motion.div>
        )}
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
              className="text-3xl font-extrabold text-slug-gold mb-4"
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
                    i === 0 ? 'bg-slug-gold/10 border border-slug-gold' : 'bg-slug-card border border-slug-border'
                  }`}
                >
                  <span className={`font-bold w-8 ${i === 0 ? 'text-slug-gold' : 'text-gray-500'}`}>{i + 1}.</span>
                  <span className="text-white font-semibold">{q.name}</span>
                  {q.isBot && <span className="text-gray-600 text-xs">BOT</span>}
                </motion.div>
              ))}
            </div>

            <p className="text-slug-purple text-sm font-bold">FINAL = TACTIC MODE + GDA PRICING + CHAOS MODE!</p>
          </motion.div>
        )}

        {/* GP Final Bid Phase */}
        {phase === 'gp_final_bid' && (
          <motion.div
            key="gp_final_bid"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="text-center"
          >
            <h1 className="text-2xl font-bold mb-2 text-slug-gold">GRAND PRIX FINAL</h1>
            <p className="text-gray-400 mb-4">Final bid! Race in Tactic Mode!</p>

            <motion.div
              key={countdown}
              initial={{ scale: 1.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`text-7xl font-extrabold mb-6 ${countdown <= 3 ? 'text-slug-red' : 'text-white'}`}
            >
              {countdown}
            </motion.div>

            {!bidSubmitted ? (
              <div className="max-w-sm mx-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Final Raise</span>
                  <span className="text-slug-green font-bold text-lg">{bidAmount} SLUG</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.min(300, coinBalance)}
                  value={bidAmount}
                  onChange={e => setBidAmount(Number(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slug-border accent-slug-green"
                />
                <button
                  onClick={async () => {
                    if (!address || !gpFinalId || bidSubmitted) return
                    setBidSubmitted(true)
                    if (countdownRef.current) clearInterval(countdownRef.current)
                    try {
                      await api.submitBid(gpFinalId, address, bidAmount)
                      await new Promise(r => setTimeout(r, 1500))
                      const result = await api.simulateRace(gpFinalId)
                      navigate(`/race/${gpFinalId}`, { state: { raceResult: result, format: 'gp_final', snailId: selectedSnail?.id } })
                    } catch (err: any) {
                      alert(err.message)
                      setBidSubmitted(false)
                    }
                  }}
                  className="w-full mt-4 py-3 bg-slug-gold text-slug-dark font-bold rounded-xl text-lg cursor-pointer"
                >
                  CONFIRM FINAL BID
                </button>
              </div>
            ) : (
              <div className="bg-slug-green/10 border border-slug-green rounded-xl p-6 max-w-sm mx-auto">
                <div className="text-3xl mb-2">&#x1f512;</div>
                <p className="text-slug-green font-bold">Final Bid Locked: {bidAmount} SLUG</p>
                <p className="text-gray-400 text-sm mt-1">Starting Grand Prix Final...</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
