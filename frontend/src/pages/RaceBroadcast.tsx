import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAccount } from 'wagmi'
import WalletConnect from '../components/WalletConnect'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { getCommentary } from '../data/commentary'
import { getDialogue, getEmote, getTrashTalk, type DialogueMoment, type EmoteMoment } from '../data/dialogues'
import {
  sfxRaceStart, sfxBoost, sfxPillowHit, sfxRain, sfxLuckOrb,
  sfxYawn, sfxPillowFight, sfxOvertake, sfxHeartbeat, sfxFinish,
  sfxTrashTalkEntry, toggleMute,
} from '../lib/audio'

interface RaceFrame {
  tick: number
  positions: { id: number; distance: number; speed: number }[]
}

interface RaceEvent {
  tick: number
  type: string
  description: string
  affectedIds: number[]
}

interface FinalOrder {
  id: number
  wallet: string
  name: string
  isBot: boolean
  position: number
  payout: number
}

const RACER_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4', '#f97316', '#ec4899']
const RACER_BG = [
  'rgba(34,197,94,0.15)', 'rgba(59,130,246,0.15)',
  'rgba(245,158,11,0.15)', 'rgba(168,85,247,0.15)',
  'rgba(239,68,68,0.15)', 'rgba(6,182,212,0.15)',
  'rgba(249,115,22,0.15)', 'rgba(236,72,153,0.15)'
]

const MAX_ENERGY = 1000

export default function RaceBroadcast() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)

  const isTactic = location.state?.format === 'tactic'
  const isDemo = location.state?.demo === true
  const playerSlothId = location.state?.slothId as number | undefined

  const [raceData, setRaceData] = useState<any>(location.state?.raceResult || null)
  const [currentTick, setCurrentTick] = useState(0)
  const [livePositions, setLivePositions] = useState<{ id: number; distance: number; name: string; speed: number }[]>([])
  const [activeEvent, setActiveEvent] = useState<RaceEvent | null>(null)
  const [raceFinished, setRaceFinished] = useState(false)
  const [loading, setLoading] = useState(!raceData)
  const [prediction, setPrediction] = useState<number | null>(null)
  const [predictionSubmitted, setPredictionSubmitted] = useState(false)

  // Tactic mode state
  const [energy, setEnergy] = useState(MAX_ENERGY)
  const [boostUsed, setBoostUsed] = useState(false)
  const [pillowUsed, setPillowUsed] = useState(false)
  const [actionFeedback, setActionFeedback] = useState<string | null>(null)
  const [boostPrice, setBoostPrice] = useState(100)
  const [pillowPrice, setPillowPrice] = useState(250)
  const [commentary, setCommentary] = useState<string | null>(null)
  const [killFeed, setKillFeed] = useState<{ id: number; text: string; emoji: string; color: string }[]>([])
  const killFeedIdRef = useRef(0)
  const [soundMuted, setSoundMuted] = useState(false)
  const prevLeaderRef = useRef<number | null>(null)
  const last100Shown = useRef(false)
  const [speechBubble, setSpeechBubble] = useState<{ slothId: number; text: string; lane: number } | null>(null)
  const [emotes, setEmotes] = useState<{ id: number; emoji: string; lane: number; x: number }[]>([])
  const emoteIdRef = useRef(0)
  const [racePhase, setRacePhase] = useState<'trash_talk' | 'racing' | 'finished'>('trash_talk')
  const slothRacesRef = useRef<Map<number, string>>(new Map()) // id -> race type
  const currentTickRef = useRef(0)
  const pausedRef = useRef(false)
  const resumeCallbackRef = useRef<(() => void) | null>(null)

  // H10: Fetch race data from API if state is missing (e.g. page refresh)
  useEffect(() => {
    if (!raceData && id) {
      api.getRaceReplay(id).then((data: any) => {
        if (data) {
          const meta = typeof data.metadata === 'string' ? JSON.parse(data.metadata) : (data.metadata || {})
          const frames = typeof data.frames === 'string' ? JSON.parse(data.frames) : (data.frames || [])
          const events = typeof data.events === 'string' ? JSON.parse(data.events) : (data.events || [])
          setRaceData({
            frames,
            events,
            finalOrder: meta.finalOrder || [],
            trackLength: meta.trackLength || 1000,
            weather: meta.weather,
          })
        }
      }).catch(err => {
        console.error("Failed to fetch race replay:", err)
        toast.error("Race data could not be loaded")
      }).finally(() => setLoading(false))
    }
  }, [id, raceData])

  // Poll GDA prices during tactic mode
  useEffect(() => {
    if (!isTactic || !id || raceFinished) return
    const interval = setInterval(() => {
      const tick = currentTickRef.current * 3
      api.getGDAPrices(id, tick).then(data => {
        setBoostPrice(data.boostPrice)
        setPillowPrice(data.pillowPrice)
      }).catch((err) => { console.error('Failed to load GDA prices:', err) })
    }, 2000)
    return () => clearInterval(interval)
  }, [isTactic, id, raceFinished])

  useEffect(() => {
    if (raceData) return
    if (!id) return
    setLoading(true)
    api.simulateRace(id)
      .then(data => { setRaceData(data); setLoading(false) })
      .catch((err) => {
        console.error('Failed to simulate race:', err)
        api.getRace(id).then(data => { setRaceData(data); setLoading(false) })
          .catch((err2) => { console.error('Failed to load race:', err2); setLoading(false) })
      })
  }, [id])

  async function handleTacticAction(actionType: 'boost' | 'pillow') {
    if (!address || !id || !playerSlothId || raceFinished) return

    const cost = actionType === 'boost' ? boostPrice : pillowPrice
    if (energy < cost) return
    if (actionType === 'boost' && boostUsed) return
    if (actionType === 'pillow' && pillowUsed) return

    // Pause animation
    pausedRef.current = true
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)

    try {
      const tick = currentTickRef.current * 3 // frames are every 3rd tick
      await api.submitAction(id, address, playerSlothId, actionType, tick)

      setEnergy(prev => prev - cost)
      if (actionType === 'boost') setBoostUsed(true)
      else setPillowUsed(true)

      setActionFeedback(actionType === 'boost' ? 'BOOST ACTIVATED!' : 'PILLOW THROWN!')
      setTimeout(() => setActionFeedback(null), 2000)

      // Re-simulate with the new action
      const newData = await api.simulateRace(id)
      setRaceData(newData)
      // Animation will restart via useEffect
    } catch (err: any) {
      setActionFeedback(`Failed: ${err.message}`)
      setTimeout(() => setActionFeedback(null), 2000)
      // Resume animation
      pausedRef.current = false
      if (resumeCallbackRef.current) resumeCallbackRef.current()
    }
  }

  // Canvas animation — only starts when trash talk phase is over
  useEffect(() => {
    if (!raceData?.frames || !canvasRef.current || racePhase !== 'racing') return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    const frames: RaceFrame[] = raceData.frames
    const events: RaceEvent[] = raceData.events || []
    const trackLength = raceData.trackLength || 1000
    const gridPositions = raceData.gridPositions || []
    const names = new Map<number, string>()
    gridPositions.forEach((gp: any) => names.set(gp.id, gp.name))
    raceData.finalOrder?.forEach((fo: any) => {
      if (!names.has(fo.id)) names.set(fo.id, fo.name)
    })

    const numRacers = frames[0]?.positions.length || 4
    const TOP_MARGIN = 50
    const BOTTOM_MARGIN = 50
    const SIDE_MARGIN = 20
    const TRACK_HEIGHT = height - TOP_MARGIN - BOTTOM_MARGIN
    const LANE_WIDTH = (width - SIDE_MARGIN * 2) / numRacers
    const SLOTH_SIZE = numRacers <= 4 ? 28 : 22
    const TREE_TRUNK_WIDTH = numRacers <= 4 ? 20 : 12
    const FRAME_DELAY = isDemo ? 80 : 280 // demo: ~18s, normal: ~65s

    function drawFrame(fi: number) {
      if (!ctx) return
      const frame = frames[fi]
      if (!frame) return

      ctx.clearRect(0, 0, width, height)

      // Draw tree trunks
      for (let i = 0; i < numRacers; i++) {
        const cx = SIDE_MARGIN + i * LANE_WIDTH + LANE_WIDTH / 2

        // Tree trunk (brown rectangle, full height)
        ctx.fillStyle = '#5a3a1a'
        ctx.fillRect(cx - TREE_TRUNK_WIDTH / 2, TOP_MARGIN, TREE_TRUNK_WIDTH, TRACK_HEIGHT)

        // Tree trunk border (darker)
        ctx.strokeStyle = '#3a2510'
        ctx.lineWidth = 1
        ctx.strokeRect(cx - TREE_TRUNK_WIDTH / 2, TOP_MARGIN, TREE_TRUNK_WIDTH, TRACK_HEIGHT)

        // Subtle horizontal wood grain lines
        ctx.strokeStyle = 'rgba(0,0,0,0.15)'
        ctx.lineWidth = 1
        for (let gy = TOP_MARGIN + 30; gy < TOP_MARGIN + TRACK_HEIGHT; gy += 40 + (i * 7) % 20) {
          ctx.beginPath()
          ctx.moveTo(cx - TREE_TRUNK_WIDTH / 2 + 2, gy)
          ctx.lineTo(cx + TREE_TRUNK_WIDTH / 2 - 2, gy)
          ctx.stroke()
        }

        // For 4-racer mode: add small leaf clusters between trees
        if (numRacers <= 4 && i < numRacers - 1) {
          const midX = cx + LANE_WIDTH / 2
          const leafPositions = [0.2, 0.5, 0.8]
          leafPositions.forEach(pct => {
            const ly = TOP_MARGIN + TRACK_HEIGHT * pct + ((i * 37) % 30) - 15
            ctx.fillStyle = 'rgba(34, 120, 34, 0.3)'
            ctx.beginPath()
            ctx.ellipse(midX, ly, 12, 8, 0, 0, Math.PI * 2)
            ctx.fill()
          })
        }
      }

      // Start line (bottom)
      ctx.strokeStyle = '#374151'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(SIDE_MARGIN, height - BOTTOM_MARGIN)
      ctx.lineTo(width - SIDE_MARGIN, height - BOTTOM_MARGIN)
      ctx.stroke()

      // START label
      ctx.fillStyle = '#374151'
      ctx.font = 'bold 9px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('START', width / 2, height - BOTTOM_MARGIN + 12)

      // Finish line - checkered pattern at top
      const checkerSize = 8
      const checkerY = TOP_MARGIN - checkerSize * 2
      const checkerStartX = SIDE_MARGIN
      const checkerEndX = width - SIDE_MARGIN
      const numCheckers = Math.floor((checkerEndX - checkerStartX) / checkerSize)

      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < numCheckers; col++) {
          const isBlack = (row + col) % 2 === 0
          ctx.fillStyle = isBlack ? '#1a1a1a' : '#f5f5f5'
          ctx.fillRect(
            checkerStartX + col * checkerSize,
            checkerY + row * checkerSize,
            checkerSize,
            checkerSize
          )
        }
      }

      // FINISH label above checkered
      ctx.fillStyle = '#f59e0b'
      ctx.font = 'bold 10px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('FINISH', width / 2, checkerY - 4)

      // Progress markers
      for (let m = 0.25; m < 1; m += 0.25) {
        const my = height - BOTTOM_MARGIN - TRACK_HEIGHT * m
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
        ctx.lineWidth = 1
        ctx.setLineDash([3, 6])
        ctx.beginPath()
        ctx.moveTo(SIDE_MARGIN, my)
        ctx.lineTo(width - SIDE_MARGIN, my)
        ctx.stroke()
        ctx.setLineDash([])

        // Percentage label on left
        ctx.fillStyle = '#4a5568'
        ctx.font = '9px sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText(Math.round(m * 100) + '%', SIDE_MARGIN - 4, my + 3)
      }

      // Sort for ranking
      const sorted = [...frame.positions].sort((a, b) => b.distance - a.distance)

      frame.positions.forEach((pos, i) => {
        const cx = SIDE_MARGIN + i * LANE_WIDTH + LANE_WIDTH / 2
        const cy = height - BOTTOM_MARGIN - (pos.distance / trackLength) * TRACK_HEIGHT
        const color = RACER_COLORS[i] || '#fff'
        const rank = sorted.findIndex(s => s.id === pos.id) + 1

        // Glowing circle (sloth on tree)
        ctx.shadowColor = color
        ctx.shadowBlur = 10
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(cx, cy, SLOTH_SIZE / 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0

        // White border for visibility
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(cx, cy, SLOTH_SIZE / 2, 0, Math.PI * 2)
        ctx.stroke()

        // Rank badge (small circle above sloth)
        ctx.fillStyle = rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : '#78716c'
        ctx.beginPath()
        ctx.arc(cx, cy - SLOTH_SIZE / 2 - 8, 7, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 9px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(rank), cx, cy - SLOTH_SIZE / 2 - 8)

        // Name label at the bottom of each tree
        const name = names.get(pos.id) || '#' + pos.id
        ctx.fillStyle = '#e5e7eb'
        ctx.font = numRacers <= 4 ? 'bold 11px sans-serif' : 'bold 9px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(name, cx, height - BOTTOM_MARGIN + 4)

        // Speed below name
        ctx.fillStyle = '#6b7280'
        ctx.font = '8px sans-serif'
        ctx.fillText(pos.speed.toFixed(1) + ' u/t', cx, height - BOTTOM_MARGIN + 18)
      })

      const live = frame.positions.map((pos) => ({
        id: pos.id,
        distance: pos.distance,
        name: names.get(pos.id) || `#${pos.id}`,
        speed: pos.speed,
      })).sort((a, b) => b.distance - a.distance)

      setLivePositions(live)
      setCurrentTick(frame.tick)
      currentTickRef.current = fi

      const nearEvent = events.find(e => Math.abs(e.tick - frame.tick) < 3)
      if (nearEvent) {
        setActiveEvent(nearEvent)
        setTimeout(() => setActiveEvent(null), 2500)

        // Generate commentary for event
        const affectedName = nearEvent.affectedIds.length > 0 ? names.get(nearEvent.affectedIds[0]) : undefined
        const affectedName2 = nearEvent.affectedIds.length > 1 ? names.get(nearEvent.affectedIds[1]) : undefined
        const text = getCommentary(nearEvent.type, { name: affectedName, name2: affectedName2 })
        if (text) {
          setCommentary(text)
          setTimeout(() => setCommentary(null), 3500)
        }

        // Speech bubble + emote + SFX for event
        if (nearEvent.type === 'tactic_boost' && nearEvent.affectedIds[0] !== undefined) {
          const lane = frame.positions.findIndex(p => p.id === nearEvent.affectedIds[0])
          if (lane >= 0) {
            showBubble(nearEvent.affectedIds[0], 'boost', lane)
            showEmote(lane, 'boost_self')
          }
          sfxBoost()
        } else if (nearEvent.type === 'tactic_pillow' && nearEvent.affectedIds[0] !== undefined) {
          const hitId = nearEvent.affectedIds[0]
          const lane = frame.positions.findIndex(p => p.id === hitId)
          if (lane >= 0) {
            showBubble(hitId, 'pillow_hit', lane)
            showEmote(lane, 'pillow_hit')
          }
          sfxPillowHit()
        } else if (nearEvent.type === 'rain') {
          frame.positions.forEach((_p, idx) => showEmote(idx, 'rain'))
          sfxRain()
        } else if (nearEvent.type === 'luck_orb' && nearEvent.affectedIds[0] !== undefined) {
          const lane = frame.positions.findIndex(p => p.id === nearEvent.affectedIds[0])
          if (lane >= 0) showEmote(lane, 'luck_orb')
          sfxLuckOrb()
        } else if (nearEvent.type === 'yawn_wave') {
          nearEvent.affectedIds.forEach(aid => {
            const lane = frame.positions.findIndex(p => p.id === aid)
            if (lane >= 0) showEmote(lane, 'yawn')
          })
          sfxYawn()
        } else if (nearEvent.type === 'pillow_fight') {
          nearEvent.affectedIds.forEach(aid => {
            const lane = frame.positions.findIndex(p => p.id === aid)
            if (lane >= 0) showEmote(lane, 'pillow_hit')
          })
          sfxPillowFight()
        }

        // Kill feed entry
        const emojiMap: Record<string, { emoji: string; color: string }> = {
          tactic_boost: { emoji: '\u{1F4A8}', color: '#22c55e' },
          tactic_pillow: { emoji: '\u{1F41A}', color: '#ef4444' },
          yawn_wave: { emoji: '\u{1F4A5}', color: '#f59e0b' },
          rain: { emoji: '\u{1F327}\uFE0F', color: '#3b82f6' },
          luck_orb: { emoji: '\u{2728}', color: '#a855f7' },
          pillow_fight: { emoji: '\u{1F4A2}', color: '#ef4444' },
        }
        const feedStyle = emojiMap[nearEvent.type] || { emoji: '\u{26A1}', color: '#9ca3af' }
        killFeedIdRef.current++
        setKillFeed(prev => [
          { id: killFeedIdRef.current, text: nearEvent.description, ...feedStyle },
          ...prev,
        ].slice(0, 5))
      }

      // Commentary: position change detection
      const currentLeader = sorted[0]?.id
      if (prevLeaderRef.current !== null && currentLeader !== prevLeaderRef.current && fi > 5) {
        const leaderName = names.get(currentLeader)
        const prevName = names.get(prevLeaderRef.current)
        if (leaderName) {
          const text = getCommentary('position_change', { name: leaderName, name2: prevName, pos: 1 })
          setCommentary(text)
          setTimeout(() => setCommentary(null), 3000)
        }
        // Speech bubble + emote + SFX for overtaker
        sfxOvertake()
        if (currentLeader !== undefined) {
          const lane = frame.positions.findIndex(p => p.id === currentLeader)
          if (lane >= 0) {
            showBubble(currentLeader, 'overtake', lane)
            showEmote(lane, 'comeback')
          }
          // Overtaken sloth gets angry emote
          if (prevLeaderRef.current !== null) {
            const prevLane = frame.positions.findIndex(p => p.id === prevLeaderRef.current)
            if (prevLane >= 0) showEmote(prevLane, 'overtaken')
          }
        }
      }
      prevLeaderRef.current = currentLeader || null

      // Commentary: last 100m
      const trackLen = trackLength || 1000
      const leaderDist = sorted[0]?.distance || 0
      if (leaderDist >= trackLen * 0.9 && !last100Shown.current) {
        last100Shown.current = true
        setCommentary(getCommentary('last_100m', {}))
        sfxHeartbeat()
        setTimeout(() => setCommentary(null), 3000)
      }

      // Commentary: close race
      if (sorted.length >= 2 && fi % 20 === 0) {
        const gap = Math.abs(sorted[0].distance - sorted[1].distance)
        if (gap < 15 && leaderDist > trackLen * 0.5) {
          setCommentary(getCommentary('close_race', { name: names.get(sorted[0].id), name2: names.get(sorted[1].id) }))
          setTimeout(() => setCommentary(null), 3000)
        }
      }
    }

    // Build sloth race map for dialogue
    const slothRaces = new Map<number, string>()
    // Try to get race info from the race data (participants)
    gridPositions.forEach((gp: any) => {
      if (gp.slothRace) slothRaces.set(gp.id, gp.slothRace)
    })
    slothRacesRef.current = slothRaces

    function showBubble(slothId: number, moment: DialogueMoment, lane: number) {
      const race = slothRaces.get(slothId)
      const text = getDialogue(race, moment)
      setSpeechBubble({ slothId, text, lane })
      setTimeout(() => setSpeechBubble(null), 2500)
    }

    function showEmote(lane: number, moment: EmoteMoment, xPercent?: number) {
      emoteIdRef.current++
      const emoji = getEmote(moment)
      const x = xPercent ?? (15 + Math.random() * 70) // random x position on track
      setEmotes(prev => {
        const next = [...prev, { id: emoteIdRef.current, emoji, lane, x }]
        // Max 2 emotes at a time — remove oldest if over limit
        return next.length > 2 ? next.slice(-2) : next
      })
      const capturedId = emoteIdRef.current
      setTimeout(() => {
        setEmotes(prev => prev.filter(e => e.id !== capturedId))
      }, 1800)
    }

    // Race start commentary + speech bubble + SFX
    sfxRaceStart()
    setCommentary(getCommentary('race_start', {}))
    setTimeout(() => setCommentary(null), 3000)
    if (gridPositions.length > 0) {
      showBubble(gridPositions[0].id, 'race_start', 0)
    }
    prevLeaderRef.current = null
    last100Shown.current = false
    setKillFeed([])
    setEmotes([])
    setRacePhase('racing')

    let lastTime = 0
    let fi = 0
    pausedRef.current = false

    function animate(time: number) {
      if (pausedRef.current) {
        resumeCallbackRef.current = () => {
          animFrameRef.current = requestAnimationFrame(animate)
        }
        return
      }
      if (time - lastTime >= FRAME_DELAY) {
        drawFrame(fi)
        fi++
        lastTime = time
        if (fi >= frames.length) {
          const winnerName = names.get(frames[frames.length - 1]?.positions.sort((a, b) => b.distance - a.distance)[0]?.id || 0)
          if (winnerName) {
            setCommentary(getCommentary('finish', { name: winnerName }))
          }
          sfxFinish()
          setTimeout(() => { setCommentary(null); setRaceFinished(true) }, isDemo ? 1000 : 2500)
          return
        }
      }
      animFrameRef.current = requestAnimationFrame(animate)
    }

    animFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [raceData, racePhase])

  // Trash talk phase: show for 5 seconds before race starts + entry SFX
  useEffect(() => {
    if (!raceData?.gridPositions || racePhase !== 'trash_talk') return
    // Skip trash talk in demo mode
    if (isDemo) {
      setRacePhase('racing')
      return
    }
    // Play entry sound for each sloth with stagger
    raceData.gridPositions.forEach((_: any, i: number) => {
      setTimeout(() => sfxTrashTalkEntry(), i * 1000)
    })
    const timer = setTimeout(() => setRacePhase('racing'), 5500)
    return () => clearTimeout(timer)
  }, [raceData, racePhase, isDemo])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400">Loading race...</div>
      </div>
    )
  }

  if (!raceData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-400">Race not found</p>
        <button onClick={() => navigate('/race')} className="text-sloth-green underline cursor-pointer">
          Back to Lobby
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">
            <span className="text-sloth-green">LIVE</span> — Grand Pillow Throw Track
            {isDemo && <span className="ml-2 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded">DEMO</span>}
            {isTactic && <span className="ml-2 text-sloth-purple text-sm font-normal">(TACTIC MODE)</span>}
          </h1>
          <div className="flex items-center gap-2">
            <p className="text-gray-500 text-sm">Race {raceData.raceId?.slice(-8)}</p>
            {raceData.weather && (() => {
              const w: Record<string, { emoji: string; label: string; color: string }> = {
                sunny:  { emoji: '\u{2600}\uFE0F', label: 'Sunny', color: 'text-yellow-400' },
                rainy:  { emoji: '\u{1F327}\uFE0F', label: 'Rainy', color: 'text-blue-400' },
                windy:  { emoji: '\u{1F4A8}', label: 'Windy', color: 'text-teal-400' },
                foggy:  { emoji: '\u{1F32B}\uFE0F', label: 'Foggy', color: 'text-gray-400' },
                stormy: { emoji: '\u{26C8}\uFE0F', label: 'Stormy', color: 'text-red-400' },
              }
              const info = w[raceData.weather] || w.sunny
              return (
                <span className={`text-sm font-semibold ${info.color}`}>
                  {info.emoji} {info.label}
                </span>
              )
            })()}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { const m = toggleMute(); setSoundMuted(m) }}
            className="bg-sloth-card border border-sloth-border rounded-lg px-2.5 py-2 text-lg cursor-pointer hover:bg-white/5 transition-colors"
            title={soundMuted ? 'Unmute' : 'Mute'}
          >
            {soundMuted ? '\u{1F507}' : '\u{1F50A}'}
          </button>
          <div className="bg-sloth-card border border-sloth-border rounded-lg px-3 py-1.5">
            <span className="text-gray-400 text-xs">POT</span>
            <p className="text-sloth-gold font-bold">{raceData.totalPot ?? 0} ZZZ</p>
          </div>
          <div className="bg-sloth-card border border-sloth-border rounded-lg px-3 py-1.5">
            <span className="text-gray-400 text-xs">TICK</span>
            <p className="text-white font-mono font-bold">{currentTick}</p>
          </div>
        </div>
      </div>

      {/* Prediction panel — show before race starts */}
      {!raceFinished && !predictionSubmitted && raceData.gridPositions && currentTick < 20 && (
        <div className="bg-sloth-card border border-sloth-border rounded-xl p-3 mb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-gray-400 text-sm font-bold">Predict:</span>
            {raceData.gridPositions.map((gp: any) => (
              <button
                key={gp.id}
                onClick={async () => {
                  if (!address || !id) return
                  setPrediction(gp.id)
                  setPredictionSubmitted(true)
                  try {
                    await api.predictWinner(id, address, gp.id)
                  } catch (err) { console.error('Prediction failed:', err) }
                }}
                className={`px-3 py-1 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${
                  prediction === gp.id
                    ? 'bg-sloth-green text-sloth-dark'
                    : 'bg-sloth-dark border border-sloth-border text-gray-300 hover:border-sloth-green'
                }`}
              >
                {gp.name}
              </button>
            ))}
            <span className="text-gray-500 text-xs ml-auto">Correct prediction = 15 ZZZ!</span>
          </div>
        </div>
      )}
      {predictionSubmitted && (
        <div className="bg-sloth-green/10 border border-sloth-green/30 rounded-xl p-2 mb-3 text-center">
          <span className="text-sloth-green text-sm font-semibold">
            Prediction submitted! Correct = +15 ZZZ &#x1F3AF;
          </span>
        </div>
      )}

      {/* Pre-Race Trash Talk Phase */}
      <AnimatePresence>
        {racePhase === 'trash_talk' && raceData?.gridPositions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -30 }}
            className="bg-sloth-card border border-sloth-border rounded-xl p-6 mb-4"
          >
            <motion.h2
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center text-2xl font-extrabold text-sloth-gold mb-6"
            >
              RACERS TO THE STAGE!
            </motion.h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {raceData.gridPositions.map((gp: any, i: number) => (
                <motion.div
                  key={gp.id}
                  initial={{ x: -60, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 1.0 }}
                  className="text-center"
                >
                  <div className="text-5xl mb-2">{'\u{1F9A5}'}</div>
                  <p className="text-white font-bold text-sm mb-1">{gp.name}</p>
                  <p className="text-gray-500 text-xs mb-2">P{gp.position}</p>
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 1.0 + 0.5 }}
                    className="bg-white text-sloth-dark text-xs font-bold px-3 py-1.5 rounded-xl inline-block max-w-[160px]"
                  >
                    {(() => {
                      const talk = getTrashTalk(gp.slothRace)
                      return i === 0 ? talk.confident : i === 1 ? talk.taunt : talk.intro
                    })()}
                  </motion.div>
                </motion.div>
              ))}
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 4.5 }}
              className="text-center mt-4"
            >
              <span className="text-gray-500 text-sm animate-pulse">Race starting...</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Race Canvas + Kill Feed layout */}
      <div className="flex gap-3 mb-4" style={{ display: racePhase === 'trash_talk' ? 'none' : 'flex' }}>
      <div
        className="relative flex-1 border border-sloth-border rounded-xl overflow-hidden"
        style={{ background: 'linear-gradient(to top, #0a1a0a 0%, #0f2a0f 30%, #1a3a1a 60%, #2a5a2a 85%, #3a7a3a 100%)' }}
      >
        <canvas
          ref={canvasRef}
          className="w-full"
          style={{
            height: 'clamp(400px, 65vh, 650px)',
            filter: raceData?.weather === 'foggy' ? 'blur(0.5px) brightness(0.85)' : undefined,
          }}
        />

        {/* Weather visual overlay */}
        {raceData?.weather === 'rainy' && (
          <div className="absolute inset-0 bg-blue-500/8 pointer-events-none" />
        )}
        {raceData?.weather === 'stormy' && (
          <div className="absolute inset-0 bg-red-500/8 pointer-events-none animate-pulse" />
        )}
        {raceData?.weather === 'foggy' && (
          <div className="absolute inset-0 bg-gray-400/10 pointer-events-none" />
        )}

        {/* Event overlay */}
        <AnimatePresence>
          {activeEvent && (
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className={`absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg font-bold text-sm ${
                activeEvent.type.startsWith('tactic_')
                  ? activeEvent.type === 'tactic_boost'
                    ? 'bg-sloth-green/90 text-sloth-dark'
                    : 'bg-sloth-red/90 text-white'
                  : 'bg-sloth-gold/90 text-sloth-dark'
              }`}
            >
              {activeEvent.description}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Speech bubble */}
        <AnimatePresence>
          {speechBubble && (() => {
            const canvasW = canvasRef.current?.clientWidth || 800
            const numR = raceData?.frames?.[0]?.positions?.length || 4
            const laneW = (canvasW - 40) / numR
            const leftPct = ((20 + speechBubble.lane * laneW + laneW / 2) / canvasW) * 100
            return (
            <motion.div
              key={`speech-${speechBubble.slothId}`}
              initial={{ opacity: 0, scale: 0.5, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="absolute pointer-events-none"
              style={{ left: `${leftPct}%`, top: '20%', transform: 'translateX(-50%)' }}
            >
              <div className="bg-white text-sloth-dark text-xs font-bold px-3 py-1.5 rounded-xl rounded-bl-none shadow-lg max-w-[200px]">
                {speechBubble.text}
              </div>
            </motion.div>
            )
          })()}
        </AnimatePresence>

        {/* Live commentary overlay — hidden when speech bubble is showing */}
        <AnimatePresence>
          {commentary && !speechBubble && (
            <motion.div
              initial={{ y: 30, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-black/80 border border-sloth-gold/50 rounded-xl max-w-[90%]"
            >
              <p className="text-sloth-gold font-bold text-sm sm:text-base text-center">{commentary}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating emotes */}
        <AnimatePresence>
          {emotes.map(emote => {
            const canvasW = canvasRef.current?.clientWidth || 800
            const numR = raceData?.frames?.[0]?.positions?.length || 4
            const laneW = (canvasW - 40) / numR
            const leftPct = ((20 + emote.lane * laneW + laneW / 2) / canvasW) * 100
            return (
            <motion.div
              key={emote.id}
              initial={{ opacity: 1, y: 0, scale: 0.5 }}
              animate={{ opacity: 0, y: -50, scale: 1.8 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
              className="absolute text-2xl sm:text-3xl pointer-events-none z-10"
              style={{ left: `${leftPct}%`, top: `${20 + emote.lane * 8}%` }}
            >
              {emote.emoji}
            </motion.div>
            )
          })}
        </AnimatePresence>

        {/* Action feedback */}
        <AnimatePresence>
          {actionFeedback && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="bg-black/60 px-8 py-4 rounded-2xl">
                <p className="text-3xl font-extrabold text-white">{actionFeedback}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Kill Feed Panel (outside canvas) */}
      <div className="hidden lg:block w-48 space-y-1.5 pt-2">
        <p className="text-gray-500 text-xs font-bold uppercase mb-2">Events</p>
        <AnimatePresence>
          {killFeed.map(item => (
            <motion.div
              key={item.id}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              className="bg-sloth-dark border border-sloth-border rounded-lg px-3 py-1.5 text-xs flex items-center gap-2"
            >
              <span>{item.emoji}</span>
              <span style={{ color: item.color }}>{item.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      </div>

      {/* Tactic Mode Controls */}
      {isTactic && !raceFinished && (
        <div className="bg-sloth-card border border-sloth-border rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-300 font-semibold text-sm">TACTIC CONTROLS</span>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs">ENERGY</span>
              <div className="w-32 h-3 bg-sloth-dark rounded-full overflow-hidden">
                <div
                  className="h-full bg-sloth-purple rounded-full transition-all duration-300"
                  style={{ width: `${(energy / MAX_ENERGY) * 100}%` }}
                />
              </div>
              <span className="text-sloth-purple font-bold text-sm">{energy}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleTacticAction('boost')}
              disabled={boostUsed || energy < boostPrice || !isConnected}
              className="flex-1 py-3 bg-sloth-green/20 border border-sloth-green text-sloth-green font-bold rounded-xl hover:bg-sloth-green/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              BOOST (1.5x Speed) — {boostPrice} ZZZ
              {boostUsed && <span className="block text-xs opacity-70">USED</span>}
            </button>
            <button
              onClick={() => handleTacticAction('pillow')}
              disabled={pillowUsed || energy < pillowPrice || !isConnected}
              className="flex-1 py-3 bg-sloth-red/20 border border-sloth-red text-sloth-red font-bold rounded-xl hover:bg-sloth-red/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              PILLOW (Hit Leader) — {pillowPrice} ZZZ
              {pillowUsed && <span className="block text-xs opacity-70">USED</span>}
            </button>
          </div>
        </div>
      )}

      {/* Live standings */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
        {livePositions.map((pos, i) => (
          <div
            key={pos.id}
            className="flex items-center gap-3 rounded-xl p-3 border"
            style={{
              backgroundColor: RACER_BG[i] || '#111827',
              borderColor: RACER_COLORS[i] || '#1f2937',
            }}
          >
            <span className="text-2xl font-extrabold" style={{ color: RACER_COLORS[i] }}>
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm truncate">{pos.name}</p>
              <p className="text-gray-400 text-xs">
                {((pos.distance / (raceData.trackLength || 1000)) * 100).toFixed(0)}% — {pos.speed.toFixed(1)} u/t
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Wallet Disconnect Overlay */}
      {!isConnected && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
          <div className="bg-sloth-card border border-sloth-border rounded-2xl p-8 max-w-sm w-full mx-4 text-center">
            <div className="text-5xl mb-4">{'\u26A0\uFE0F'}</div>
            <h2 className="text-xl font-bold text-white mb-2">Wallet Disconnected</h2>
            <p className="text-gray-400 text-sm mb-6">Reconnect your wallet to continue the race and receive your rewards.</p>
            <WalletConnect />
          </div>
        </div>
      )}

      {/* Full post-race stats screen */}
      <AnimatePresence>
        {raceFinished && raceData.finalOrder && (() => {
          // Compute stats from frames/events
          const frames: RaceFrame[] = raceData.frames || []
          const events: RaceEvent[] = raceData.events || []
          const trackLen = raceData.trackLength || 1000

          // Max speed per sloth
          const maxSpeeds: Record<number, number> = {}
          for (const f of frames) {
            for (const p of f.positions) {
              maxSpeeds[p.id] = Math.max(maxSpeeds[p.id] || 0, p.speed)
            }
          }

          // Count boosts and pillows per sloth
          const boostCount: Record<number, number> = {}
          const pillowHitCount: Record<number, number> = {}
          for (const e of events) {
            if (e.type === 'tactic_boost') {
              for (const id of e.affectedIds) boostCount[id] = (boostCount[id] || 0) + 1
            }
            if (e.type === 'tactic_pillow') {
              if (e.affectedIds[0]) pillowHitCount[e.affectedIds[0]] = (pillowHitCount[e.affectedIds[0]] || 0) + 1
            }
          }

          // "Peki Ya" — find the closest loser to the winner
          const winner = raceData.finalOrder[0]
          const runnerUp = raceData.finalOrder[1]
          const lastFrame = frames[frames.length - 1]
          const winnerDist = lastFrame?.positions.find((p: any) => p.id === winner?.id)?.distance || trackLen
          const runnerDist = lastFrame?.positions.find((p: any) => p.id === runnerUp?.id)?.distance || 0
          const gap = Math.round(winnerDist - runnerDist)

          // ====== MVP Awards Computation ======
          const gridPositions = raceData.gridPositions || []
          const finalOrder: FinalOrder[] = raceData.finalOrder || []
          const names = new Map<number, string>()
          gridPositions.forEach((gp: any) => names.set(gp.id, gp.name))
          finalOrder.forEach((fo: FinalOrder) => { if (!names.has(fo.id)) names.set(fo.id, fo.name) })

          // MVP 1: "Best Overtake" — Most positions gained (grid start → final)
          let bestClimber = { id: 0, name: '', gain: -99 }
          for (const fo of finalOrder) {
            const startPos = gridPositions.findIndex((gp: any) => gp.id === fo.id) + 1
            const endPos = fo.position
            const gain = startPos - endPos // positive = climbed up
            if (gain > bestClimber.gain) {
              bestClimber = { id: fo.id, name: fo.name, gain }
            }
          }

          // MVP 2: "Speed Demon" — Highest max speed
          let speedDemon = { id: 0, name: '', speed: 0 }
          for (const [idStr, spd] of Object.entries(maxSpeeds)) {
            if (spd > speedDemon.speed) {
              speedDemon = { id: Number(idStr), name: names.get(Number(idStr)) || '', speed: spd }
            }
          }

          // MVP 3: "Comeback King" — Was in last position at some point and finished top 2
          let comebackKing: { id: number; name: string; worstPos: number } | null = null
          const top2Ids = finalOrder.slice(0, 2).map(fo => fo.id)
          for (const tid of top2Ids) {
            let worstPosition = 1
            for (const f of frames) {
              const sorted = [...f.positions].sort((a, b) => b.distance - a.distance)
              const pos = sorted.findIndex(s => s.id === tid) + 1
              if (pos > worstPosition) worstPosition = pos
            }
            if (worstPosition >= 3 && (!comebackKing || worstPosition > comebackKing.worstPos)) {
              comebackKing = { id: tid, name: names.get(tid) || '', worstPos: worstPosition }
            }
          }

          // MVP 4: "Tank" — Most hits taken and still finished
          const hitCount: Record<number, number> = {}
          for (const e of events) {
            if (['tactic_pillow', 'yawn_wave', 'pillow_fight'].includes(e.type)) {
              for (const aid of e.affectedIds) hitCount[aid] = (hitCount[aid] || 0) + 1
            }
          }
          let tankSloth: { id: number; name: string; hits: number } | null = null
          for (const [idStr, hits] of Object.entries(hitCount)) {
            if (hits > (tankSloth?.hits || 0)) {
              tankSloth = { id: Number(idStr), name: names.get(Number(idStr)) || '', hits }
            }
          }

          const mvpAwards: { emoji: string; title: string; name: string; detail: string }[] = []
          if (bestClimber.gain > 0) {
            mvpAwards.push({ emoji: '\u{1F3CE}\uFE0F', title: 'Best Overtake', name: bestClimber.name, detail: `Climbed ${bestClimber.gain} positions!` })
          }
          if (speedDemon.speed > 0) {
            mvpAwards.push({ emoji: '\u{26A1}', title: 'Speed Demon', name: speedDemon.name, detail: `Max ${speedDemon.speed.toFixed(1)} u/t` })
          }
          if (comebackKing) {
            mvpAwards.push({ emoji: '\u{1F451}', title: 'Comeback King', name: comebackKing.name, detail: `From P${comebackKing.worstPos} to top 2!` })
          }
          if (tankSloth && tankSloth.hits >= 1) {
            mvpAwards.push({ emoji: '\u{1F6E1}\uFE0F', title: 'Tank', name: tankSloth.name, detail: `Took ${tankSloth.hits} hits and still finished!` })
          }

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-50 bg-sloth-dark overflow-y-auto"
            >
              <div className="max-w-2xl mx-auto px-4 py-8">
                {/* Winner */}
                <motion.div
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring' }}
                  className="text-center mb-8"
                >
                  <div className="text-7xl mb-3">&#x1f3c6;</div>
                  <h2 className="text-4xl font-extrabold text-sloth-gold mb-1">{winner?.name} WINS!</h2>
                  <p className="text-gray-400">Total Pot: {raceData.totalPot} ZZZ</p>
                </motion.div>

                {/* Standings table */}
                <div className="bg-sloth-card border border-sloth-border rounded-xl p-4 mb-6">
                  <h3 className="text-gray-400 text-xs font-bold uppercase mb-3">Final Standings</h3>
                  <div className="space-y-2">
                    {raceData.finalOrder.map((fo: FinalOrder, i: number) => (
                      <motion.div
                        key={fo.id}
                        initial={{ x: -40, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.2 + i * 0.15 }}
                        className={`flex items-center gap-3 p-3 rounded-lg ${
                          i === 0 ? 'bg-sloth-gold/10 border border-sloth-gold' : 'bg-sloth-dark/50 border border-sloth-border'
                        }`}
                      >
                        <span className={`text-xl font-extrabold w-8 ${
                          i === 0 ? 'text-sloth-gold' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-gray-500'
                        }`}>{i + 1}.</span>
                        <div className="flex-1 text-left">
                          <p className="text-white font-semibold">{fo.name}</p>
                          <p className="text-gray-500 text-xs">
                            Max: {(maxSpeeds[fo.id] || 0).toFixed(1)} u/t
                            {(boostCount[fo.id] || 0) > 0 && ` | Boost: ${boostCount[fo.id]}`}
                            {(pillowHitCount[fo.id] || 0) > 0 && ` | Pillow Throw hit: ${pillowHitCount[fo.id]}`}
                            {fo.isBot && ' | BOT'}
                          </p>
                        </div>
                        {fo.payout > 0 && (
                          <span className="text-sloth-green font-bold">+{fo.payout} ZZZ</span>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* "Peki Ya" section */}
                {runnerUp && gap <= 50 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1 }}
                    className="bg-sloth-purple/10 border border-sloth-purple/30 rounded-xl p-4 mb-6"
                  >
                    <h3 className="text-sloth-purple font-bold text-sm mb-2">What If...?</h3>
                    <p className="text-gray-300 text-sm">
                      {runnerUp.name} was only <span className="text-sloth-gold font-bold">{gap} units</span> from the finish line.
                      {isTactic && !boostCount[runnerUp.id] && ' A well-timed Boost could have changed everything!'}
                      {isTactic && boostCount[runnerUp.id] && ' Different Pillow Throw timing could have flipped the result!'}
                      {!isTactic && ' A higher Grid Boost could have secured Pole Position!'}
                    </p>
                  </motion.div>
                )}

                {/* MVP Awards */}
                {mvpAwards.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="bg-sloth-card border border-sloth-border rounded-xl p-4 mb-6"
                  >
                    <h3 className="text-gray-400 text-xs font-bold uppercase mb-3 text-center">MVP Awards</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {mvpAwards.map((award, i) => (
                        <motion.div
                          key={award.title}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 1.0 + i * 0.2, type: 'spring', stiffness: 300 }}
                          className="bg-sloth-dark/60 border border-sloth-gold/30 rounded-xl p-3 text-center"
                        >
                          <div className="text-3xl mb-1">{award.emoji}</div>
                          <p className="text-sloth-gold font-bold text-xs uppercase">{award.title}</p>
                          <p className="text-white font-semibold text-sm mt-1">{award.name}</p>
                          <p className="text-gray-400 text-xs">{award.detail}</p>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Action buttons */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2 + mvpAwards.length * 0.2 }}
                  className="flex flex-col sm:flex-row items-center justify-center gap-3"
                >
                  <button
                    onClick={async () => {
                      if (!address || !playerSlothId) { navigate('/race'); return }
                      try {
                        const fmt = location.state?.format || 'standard'
                        const data = await api.createRace(address, playerSlothId, fmt)
                        navigate(`/race/${data.raceId}`, { state: { format: fmt, slothId: playerSlothId } })
                        window.location.reload()
                      } catch (err) { console.error('Rematch failed:', err); navigate('/race') }
                    }}
                    className="px-8 py-3 bg-sloth-green text-sloth-dark font-bold rounded-xl text-lg hover:bg-sloth-green/90 transition-colors cursor-pointer"
                  >
                    Rematch!
                  </button>
                  <button
                    onClick={() => navigate('/treehouse')}
                    className="px-6 py-2.5 border border-sloth-border text-gray-300 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Back to Treehouse
                  </button>
                  <button
                    onClick={() => navigate('/shop')}
                    className="px-6 py-2.5 border border-sloth-border text-gray-300 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Buy ZZZ Coins
                  </button>
                  <button
                    onClick={() => navigate(`/replay/${id}`)}
                    className="px-6 py-2.5 border border-sloth-purple text-sloth-purple rounded-xl hover:bg-sloth-purple/10 transition-colors cursor-pointer"
                  >
                    Watch Replay
                  </button>
                </motion.div>
              </div>
            </motion.div>
          )
        })()}
      </AnimatePresence>
    </div>
  )
}
