import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../lib/api'

type GameType = 'salt_dodge' | 'yawn_stretch' | 'pillow_lift' | 'lucky_leaf' | 'speed_tap'

interface GameInfo {
  id: GameType
  name: string
  icon: string
  stat: string
  duration: string
  description: string
}

const GAMES: GameInfo[] = [
  { id: 'salt_dodge', name: 'Salt Dodge', icon: '\u{1F9C2}', stat: 'AGI / REF', duration: '20s', description: 'Dodge falling salt crystals! Arrow keys or tap sides to move.' },
  { id: 'yawn_stretch', name: 'Yawn Stretch', icon: '\u{1F7E2}', stat: 'SPD', duration: '15s', description: 'Stop the slider in the green zone. Timing is everything!' },
  { id: 'pillow_lift', name: 'Pillow Lift', icon: '\u{1F4AA}', stat: 'STA', duration: '10s', description: 'Hold to fill the bar. Release before it explodes!' },
  { id: 'lucky_leaf', name: 'Lucky Leaf', icon: '\u{1F340}', stat: 'LCK', duration: '5s', description: 'Pick a card and test your luck. 1x, 2x, or 3x reward!' },
  { id: 'speed_tap', name: 'Speed Tap', icon: '\u{26A1}', stat: 'ACC', duration: '5s', description: 'Tap as fast as you can in 5 seconds!' },
]

interface MiniGameModalProps {
  slothId: number
  slothName: string
  wallet: string
  playsLeft: number
  onClose: () => void
  onGameComplete: () => void
}

// --- Salt Dodge Game ---
function SaltDodgeGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [timeLeft, setTimeLeft] = useState(20)
  const [slothX, setSlothX] = useState(50)
  const [salts, setSalts] = useState<{ id: number; x: number; y: number }[]>([])
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const nextId = useRef(0)
  const slothXRef = useRef(50)

  useEffect(() => { slothXRef.current = slothX }, [slothX])

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setSlothX(prev => Math.max(5, prev - 10))
    if (e.key === 'ArrowRight') setSlothX(prev => Math.min(95, prev + 10))
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  useEffect(() => {
    if (gameOver) return
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { setGameOver(true); clearInterval(t); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [gameOver])

  useEffect(() => {
    if (gameOver) return
    const t = setInterval(() => {
      const id = nextId.current++
      const x = Math.random() * 90 + 5
      setSalts(prev => [...prev, { id, x, y: 0 }])
    }, 600)
    return () => clearInterval(t)
  }, [gameOver])

  useEffect(() => {
    if (gameOver) return
    const t = setInterval(() => {
      setSalts(prev => {
        const next: typeof prev = []
        let dodged = 0
        for (const s of prev) {
          const ny = s.y + 5
          if (ny >= 90) {
            if (Math.abs(s.x - slothXRef.current) >= 10) dodged++
          } else {
            next.push({ ...s, y: ny })
          }
        }
        if (dodged > 0) setScore(prev => prev + dodged)
        return next
      })
    }, 100)
    return () => clearInterval(t)
  }, [gameOver])

  useEffect(() => { if (gameOver) onComplete(score) }, [gameOver, score, onComplete])

  return (
    <div className="relative w-full h-80 bg-sloth-dark rounded-xl overflow-hidden border border-sloth-border select-none"
      onTouchStart={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const touchX = e.touches[0].clientX - rect.left
        const pct = (touchX / rect.width) * 100
        setSlothX(Math.max(5, Math.min(95, pct)))
      }}
    >
      <div className="absolute top-2 left-2 bg-black/60 px-3 py-1 rounded-lg text-sloth-green font-bold text-sm z-10">{timeLeft}s</div>
      <div className="absolute top-2 right-2 bg-black/60 px-3 py-1 rounded-lg text-white font-bold text-sm z-10">Score: {score}</div>
      {salts.map(s => (
        <div key={s.id} className="absolute w-4 h-4 bg-white rounded-full opacity-80" style={{ left: `${s.x}%`, top: `${s.y}%`, transform: 'translate(-50%, -50%)' }} />
      ))}
      <div className="absolute bottom-4 text-3xl transition-all duration-75" style={{ left: `${slothX}%`, transform: 'translateX(-50%)' }}>{'\u{1F40C}'}</div>
      {gameOver && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <p className="text-2xl font-bold text-sloth-green">Dodged {score} salts!</p>
        </div>
      )}
    </div>
  )
}

// --- Yawn Stretch Game ---
function SlimeSlideGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [timeLeft, setTimeLeft] = useState(15)
  const [position, setPosition] = useState(0)
  const [direction, setDirection] = useState(1)
  const [greenStart, setGreenStart] = useState(35)
  const [score, setScore] = useState(0)
  const [round, setRound] = useState(0)
  const [maxRounds] = useState(8)
  const [frozen, setFrozen] = useState(false)
  const [gameOver, setGameOver] = useState(false)

  useEffect(() => {
    if (gameOver || frozen) return
    const speed = 2 + round * 0.5
    const t = setInterval(() => {
      setPosition(prev => {
        let next = prev + direction * speed
        if (next >= 100 || next <= 0) { setDirection(d => -d); next = Math.max(0, Math.min(100, next)) }
        return next
      })
    }, 30)
    return () => clearInterval(t)
  }, [direction, gameOver, frozen, round])

  useEffect(() => {
    if (gameOver) return
    const t = setInterval(() => {
      setTimeLeft(prev => { if (prev <= 1) { setGameOver(true); return 0 }; return prev - 1 })
    }, 1000)
    return () => clearInterval(t)
  }, [gameOver])

  function handleClick() {
    if (frozen || gameOver) return
    setFrozen(true)
    const greenEnd = greenStart + 20
    const hit = position >= greenStart && position <= greenEnd
    if (hit) setScore(prev => prev + 1)
    setTimeout(() => {
      const nextRound = round + 1
      if (nextRound >= maxRounds) { setGameOver(true); return }
      setRound(nextRound)
      setGreenStart(Math.random() * 70 + 5)
      setFrozen(false)
    }, 500)
  }

  useEffect(() => { if (gameOver) onComplete(score) }, [gameOver, score, onComplete])

  return (
    <div className="w-full p-6 select-none">
      <div className="flex justify-between mb-4">
        <span className="text-sloth-green font-bold">{timeLeft}s</span>
        <span className="text-white font-bold">Round {round + 1}/{maxRounds}</span>
        <span className="text-sloth-green font-bold">Hits: {score}</span>
      </div>
      <div className="relative w-full h-12 bg-sloth-dark rounded-xl border border-sloth-border cursor-pointer overflow-hidden" onClick={handleClick}>
        <div className="absolute top-0 h-full bg-green-500/30 border-x-2 border-green-500" style={{ left: `${greenStart}%`, width: '20%' }} />
        <div className="absolute top-0 h-full w-2 bg-white rounded transition-none" style={{ left: `${position}%` }} />
      </div>
      <p className="text-center text-gray-400 text-sm mt-4">{gameOver ? `Done! ${score} hits out of ${maxRounds}` : 'Click/tap when the slider is in the green zone!'}</p>
    </div>
  )
}

// --- Pillow Lift Game ---
function ShellLiftGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [timeLeft, setTimeLeft] = useState(10)
  const [power, setPower] = useState(0)
  const [holding, setHolding] = useState(false)
  const [exploded, setExploded] = useState(false)
  const [released, setReleased] = useState(false)
  const [gameOver, setGameOver] = useState(false)

  useEffect(() => {
    if (gameOver) return
    const t = setInterval(() => {
      setTimeLeft(prev => { if (prev <= 1) { setGameOver(true); return 0 }; return prev - 1 })
    }, 1000)
    return () => clearInterval(t)
  }, [gameOver])

  useEffect(() => {
    if (!holding || exploded || released || gameOver) return
    const t = setInterval(() => {
      setPower(prev => {
        const next = prev + 2
        if (next >= 100) { setExploded(true); setGameOver(true); return 100 }
        return next
      })
    }, 50)
    return () => clearInterval(t)
  }, [holding, exploded, released, gameOver])

  function handleRelease() {
    if (exploded || released || gameOver) return
    setHolding(false); setReleased(true); setGameOver(true)
  }

  const finalScore = exploded ? 0 : released ? Math.round(power) : 0
  useEffect(() => { if (gameOver) onComplete(finalScore) }, [gameOver, finalScore, onComplete])
  const barColor = power < 50 ? 'bg-green-500' : power < 80 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="w-full p-6 text-center select-none">
      <div className="flex justify-between mb-4">
        <span className="text-sloth-green font-bold">{timeLeft}s</span>
        <span className="text-white font-bold">{Math.round(power)}%</span>
      </div>
      <div className="relative w-full h-16 bg-sloth-dark rounded-xl border border-sloth-border overflow-hidden mb-6">
        <motion.div className={`h-full ${barColor} transition-colors`} style={{ width: `${power}%` }} />
        <div className="absolute top-0 right-0 h-full w-[5%] bg-red-500/30 border-l border-red-500" />
      </div>
      {!gameOver && (
        <button
          onMouseDown={() => setHolding(true)} onMouseUp={handleRelease}
          onTouchStart={() => setHolding(true)} onTouchEnd={handleRelease}
          className={`w-full py-6 rounded-xl font-bold text-lg cursor-pointer transition-colors ${holding ? 'bg-yellow-500 text-yellow-900' : 'bg-sloth-green text-sloth-dark hover:bg-sloth-green/90'}`}
        >{holding ? 'HOLDING... Release!' : 'HOLD to Lift'}</button>
      )}
      {gameOver && (
        <div className="text-center">
          {exploded ? <p className="text-red-400 font-bold text-xl">EXPLODED! Score: 0</p> : <p className="text-sloth-green font-bold text-xl">Released at {finalScore}%!</p>}
        </div>
      )}
    </div>
  )
}

// --- Lucky Leaf Game ---
function LuckyLeafGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [picked, setPicked] = useState<number | null>(null)
  const [multipliers] = useState(() => {
    const arr = [1, 2, 3]
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]] }
    return arr
  })
  const [revealed, setRevealed] = useState(false)

  function handlePick(index: number) {
    if (picked !== null) return
    setPicked(index)
    setTimeout(() => { setRevealed(true); setTimeout(() => onComplete(multipliers[index]), 1500) }, 800)
  }

  const cardIcons = ['\u{1F343}', '\u{1F340}', '\u{1F33F}']

  return (
    <div className="w-full p-6 text-center select-none">
      <p className="text-gray-400 mb-6">Pick a leaf card!</p>
      <div className="flex gap-4 justify-center">
        {[0, 1, 2].map(i => (
          <motion.button key={i} whileHover={picked === null ? { scale: 1.05 } : {}} whileTap={picked === null ? { scale: 0.95 } : {}} onClick={() => handlePick(i)}
            className={`w-24 h-36 rounded-xl border-2 flex flex-col items-center justify-center text-3xl font-bold cursor-pointer transition-colors ${picked === i ? 'border-sloth-green bg-sloth-green/20' : picked !== null ? 'border-sloth-border bg-sloth-dark opacity-60' : 'border-sloth-border bg-sloth-card hover:border-sloth-green/50'}`}
          >
            {revealed ? (<><span className="text-4xl mb-1">{cardIcons[i]}</span><span className={`text-lg font-extrabold ${multipliers[i] === 3 ? 'text-yellow-400' : multipliers[i] === 2 ? 'text-sloth-green' : 'text-gray-400'}`}>{multipliers[i]}x</span></>) : picked === i ? (<motion.span animate={{ rotateY: 360 }} transition={{ duration: 0.8 }} className="text-4xl">{cardIcons[i]}</motion.span>) : (<span className="text-4xl">?</span>)}
          </motion.button>
        ))}
      </div>
      {revealed && picked !== null && (
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-sloth-green font-bold text-xl mt-6">{multipliers[picked]}x Multiplier!</motion.p>
      )}
    </div>
  )
}

// --- Speed Tap Game ---
function SpeedTapGame({ onComplete }: { onComplete: (score: number) => void }) {
  const [timeLeft, setTimeLeft] = useState(5)
  const [taps, setTaps] = useState(0)
  const [started, setStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)

  useEffect(() => {
    if (!started || gameOver) return
    const t = setInterval(() => {
      setTimeLeft(prev => { if (prev <= 1) { setGameOver(true); clearInterval(t); return 0 }; return prev - 1 })
    }, 1000)
    return () => clearInterval(t)
  }, [started, gameOver])

  function handleTap() {
    if (gameOver) return
    if (!started) setStarted(true)
    setTaps(prev => prev + 1)
  }

  useEffect(() => { if (gameOver) onComplete(taps) }, [gameOver, taps, onComplete])

  return (
    <div className="w-full p-6 text-center select-none">
      <div className="flex justify-between mb-4">
        <span className="text-sloth-green font-bold">{timeLeft}s</span>
        <span className="text-white font-bold text-2xl">{taps} taps</span>
      </div>
      <motion.button whileTap={{ scale: 0.95 }} onClick={handleTap} disabled={gameOver}
        className={`w-full py-16 rounded-xl font-bold text-2xl cursor-pointer transition-colors ${gameOver ? 'bg-sloth-card border-2 border-sloth-border text-gray-400' : 'bg-sloth-green text-sloth-dark hover:bg-sloth-green/90 active:bg-sloth-green/80'}`}
      >{gameOver ? `${taps} Taps!` : started ? 'TAP! TAP! TAP!' : 'TAP TO START!'}</motion.button>
      {gameOver && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-gray-400 mt-4">
          {taps >= 40 ? 'Incredible speed!' : taps >= 25 ? 'Great tapping!' : 'Not bad!'}
        </motion.p>
      )}
    </div>
  )
}

// --- MiniGameModal ---
export default function MiniGameModal({ slothId, slothName, wallet, playsLeft, onClose, onGameComplete }: MiniGameModalProps) {
  const [activeGame, setActiveGame] = useState<GameType | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ gain: number; stat: string; newStatValue: number } | null>(null)
  const [remainingPlays, setRemainingPlays] = useState(playsLeft)

  async function handleGameComplete(gameType: GameType, score: number) {
    setSubmitting(true)
    try {
      const data = await api.playMiniGame(wallet, slothId, gameType, score)
      setResult({ gain: data.gain, stat: data.stat, newStatValue: data.newStatValue })
      setRemainingPlays(prev => Math.max(0, prev - 1))
    } catch (err: any) {
      setResult(null)
      toast.error(err.message || 'Failed to submit game result')
    }
    setSubmitting(false)
  }

  function closeGame() {
    setActiveGame(null)
    setResult(null)
  }

  function handleClose() {
    onGameComplete()
    onClose()
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="bg-sloth-card border border-sloth-border rounded-2xl max-w-lg w-full overflow-hidden max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-sloth-border">
            <div>
              <h2 className="text-white font-bold text-lg">
                {activeGame ? `${GAMES.find(g => g.id === activeGame)?.icon} ${GAMES.find(g => g.id === activeGame)?.name}` : 'Mini Games'}
              </h2>
              <p className="text-gray-400 text-sm">{slothName} — {remainingPlays} plays left</p>
            </div>
            <button onClick={activeGame ? closeGame : handleClose} className="text-gray-400 hover:text-white cursor-pointer text-xl leading-none">&#x2715;</button>
          </div>

          <div className="p-4">
            {/* Game selection */}
            {!activeGame && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {GAMES.map(game => (
                  <button
                    key={game.id}
                    onClick={() => setActiveGame(game.id)}
                    disabled={remainingPlays <= 0}
                    className="bg-sloth-dark border border-sloth-border rounded-xl p-4 text-left hover:border-sloth-green/50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div className="text-3xl mb-2">{game.icon}</div>
                    <p className="text-white font-bold text-sm">{game.name}</p>
                    <p className="text-sloth-purple text-xs font-semibold">{game.stat} | {game.duration}</p>
                    <p className="text-gray-500 text-xs mt-1">{game.description}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Active game */}
            {activeGame && !result && !submitting && (
              <>
                {activeGame === 'salt_dodge' && <SaltDodgeGame onComplete={s => handleGameComplete('salt_dodge', s)} />}
                {activeGame === 'yawn_stretch' && <SlimeSlideGame onComplete={s => handleGameComplete('yawn_stretch', s)} />}
                {activeGame === 'pillow_lift' && <ShellLiftGame onComplete={s => handleGameComplete('pillow_lift', s)} />}
                {activeGame === 'lucky_leaf' && <LuckyLeafGame onComplete={s => handleGameComplete('lucky_leaf', s)} />}
                {activeGame === 'speed_tap' && <SpeedTapGame onComplete={s => handleGameComplete('speed_tap', s)} />}
              </>
            )}

            {submitting && (
              <div className="py-12 text-center">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="text-4xl inline-block mb-4">{'\u{1F40C}'}</motion.div>
                <p className="text-gray-400">Submitting result...</p>
              </div>
            )}

            {result && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="py-8 text-center">
                <div className="text-5xl mb-4">{'\u{2B50}'}</div>
                <p className="text-white font-bold text-xl mb-2">Training Complete!</p>
                <p className="text-sloth-green font-bold text-lg mb-1">+{result.gain.toFixed(2)} {result.stat.toUpperCase()}</p>
                <p className="text-gray-400 text-sm">New {result.stat.toUpperCase()}: {result.newStatValue.toFixed(1)}</p>
                <div className="flex gap-3 justify-center mt-6">
                  <button onClick={closeGame} className="px-6 py-2.5 bg-sloth-purple/20 text-sloth-purple font-bold rounded-xl hover:bg-sloth-purple/30 transition-colors cursor-pointer">
                    Play Another
                  </button>
                  <button onClick={handleClose} className="px-6 py-2.5 bg-sloth-green text-sloth-dark font-bold rounded-xl hover:bg-sloth-green/90 transition-colors cursor-pointer">
                    Done
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
