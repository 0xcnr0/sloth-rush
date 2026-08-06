import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAccount } from 'wagmi'
import WalletConnect from '../components/WalletConnect'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { rigFor, drawRacer, cadence } from '../lib/racerRig'
import { THEME } from '../config/theme'
import RacerPortrait from '../components/RacerPortrait'
import { getCommentary } from '../data/commentary'
import { getDialogue, getEmote, getTrashTalk, type DialogueMoment, type EmoteMoment } from '../data/dialogues'
import {
  sfxRaceStart, sfxBoost, sfxProjectileHit, sfxRain, sfxLuckOrb,
  sfxMassSlow, sfxCollision, sfxOvertake, sfxHeartbeat, sfxFinish,
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
  reward: number
}

// The four locked archetype accents (ART_DIRECTION §3), reused as lane colours
// so the stripes belong to the game rather than to Tailwind's default swatches.
const RACER_COLORS = ['#E63946', '#2A6FDB', '#FFC93C', '#4CAF6D', '#E63946', '#2A6FDB', '#FFC93C', '#4CAF6D']

/**
 * Canvas colours. The stylesheet's CSS variables cannot be read cheaply per
 * frame, so ART_DIRECTION §5 is mirrored here — if one moves, move both.
 */
/**
 * The lane deck: one drawn shelf compartment, stretched into each lane.
 *
 * The lanes used to be flat rectangles, and the reason that read so badly was
 * not their size. `GROUND_AT` was 0.83, so the sky-blue wall was painted across
 * the FULL height of the lane and the wood only covered the bottom 17% —
 * starting exactly at the toy's feet and hidden behind them. Every racer was
 * standing in open sky with a sliver of floor under its soles, which is why a
 * carefully drawn toy looked pasted onto a diagram no matter what size it was.
 */
const laneDeck = new Image()
laneDeck.src = '/art/lane-deck.webp'

/** The finish line, hung across all four lanes. */
const finishBanner = new Image()
finishBanner.src = '/art/finish-banner.webp'

const PALETTE = {
  wall: '#C9DFF5',
  wallAlt: '#BFD8F0',
  floor: '#E8C99B',
  floorEdge: '#C9A97A',
  grain: 'rgba(36, 26, 56, 0.10)',
  shelf: '#9AA6B2',
  ink: '#241A38',
  paper: '#FFFDF7',
  dust: '#7A7488',
  gold: '#E0A32E',
} as const

export default function RaceBroadcast() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()
  const previewMode =
    import.meta.env.DEV && new URLSearchParams(window.location.search).has('preview')
  // Preview also stands in for a wallet, because the controls that need one are
  // exactly the controls nobody can look at otherwise. Three rounds of this
  // screen were changed without ever seeing it; the item buttons were about to
  // be the fourth.
  const previewRacerId = previewMode
    ? Number(new URLSearchParams(window.location.search).get('racer')) || undefined
    : undefined
  const previewWallet = previewMode ? '0xPREVIEW' : undefined
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Each archetype's art loads once and is shared; the rig draws nothing until
  // all seven of its PNGs are in.
  const archetypeRef = useRef<Record<number, string>>({})
  const rarityRef = useRef<Record<number, string>>({})
  // Walk phase and key angle accumulate per racer across frames; keeping them in
  // refs means playback scrubbing does not reset the animation mid-race.
  const phaseRef = useRef<Record<number, number>>({})
  const keyRef = useRef<Record<number, number>>({})
  const animFrameRef = useRef<number>(0)

  const isDemo = location.state?.demo === true
  const playerRacerId = (location.state?.racerId as number | undefined) ?? previewRacerId

  const [raceData, setRaceData] = useState<any>(location.state?.raceResult || null)
  const [currentTick, setCurrentTick] = useState(0)
  const [livePositions, setLivePositions] = useState<{ id: number; distance: number; name: string; speed: number }[]>([])
  const [activeEvent, setActiveEvent] = useState<RaceEvent | null>(null)
  const [raceFinished, setRaceFinished] = useState(false)
  const [loading, setLoading] = useState(!raceData)

  // Tactic mode state
  const [commentary, setCommentary] = useState<string | null>(null)
  const [soundMuted, setSoundMuted] = useState(false)
  const prevLeaderRef = useRef<number | null>(null)
  const last100Shown = useRef(false)
  const [speechBubble, setSpeechBubble] = useState<{ racerId: number; text: string; lane: number } | null>(null)
  const [emotes, setEmotes] = useState<{ id: number; emoji: string; lane: number; x: number }[]>([])
  const emoteIdRef = useRef(0)
  const [racePhase, setRacePhase] = useState<'trash_talk' | 'racing' | 'finished'>('trash_talk')
  const [canvasFlash, setCanvasFlash] = useState<string | null>(null)
  // Items the player still has. The server owns the tick an item lands on, so
  // the client only ever asks — it never proposes a moment.
  const [itemsLeft, setItemsLeft] = useState<string[]>([])
  const [deploying, setDeploying] = useState(false)
  const racerRacesRef = useRef<Map<number, string>>(new Map()) // id -> race type
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
    // Bots render desaturated with a BOT tag and never carry an accent colour
    // (ART_DIRECTION §10) — only finalOrder knows which is which.
    const bots = new Set<number>(
      (raceData.finalOrder ?? []).filter((f: any) => f.isBot).map((f: any) => f.id)
    )
    gridPositions.forEach((gp: any) => {
      names.set(gp.id, gp.name)
      // `race` is the archetype code on the racer row — speedster / tank /
      // trickster / burst. Bots carry it too, so a lane of four reads as four
      // different toys rather than four Tinbots.
      if (gp.race) archetypeRef.current[gp.id] = gp.race
      if (gp.rarity) rarityRef.current[gp.id] = gp.rarity
    })
    raceData.finalOrder?.forEach((fo: any) => {
      if (fo.race && !archetypeRef.current[fo.id]) archetypeRef.current[fo.id] = fo.race
    })
    raceData.finalOrder?.forEach((fo: any) => {
      if (!names.has(fo.id)) names.set(fo.id, fo.name)
    })

    const numRacers = frames[0]?.positions.length || 4
    const TOP_MARGIN = 50
    const BOTTOM_MARGIN = 50
    const SIDE_MARGIN = 20
    const TRACK_HEIGHT = height - TOP_MARGIN - BOTTOM_MARGIN
    // Lanes stack vertically; racers travel along X. The finish chequer eats a
    // little width on the right, so the running surface stops short of it.
    const TRACK_WIDTH = width - SIDE_MARGIN * 2 - 16
    const LANE_HEIGHT = TRACK_HEIGHT / numRacers
    /**
     * Lane composition. The toy is sized FROM the lane, not clamped inside it.
     *
     * This read `Math.min(LANE_HEIGHT * 0.84 - 12, 60)`: a hard 60px ceiling on
     * the racer while the lane height came from 65vh divided by four. On a tall
     * screen the lane grew to ~137px and the toy stayed at 60, so 40% of every
     * lane was empty wall — four times over, that is most of the track. The
     * bigger the screen, the smaller the toys looked. That is the disproportion.
     *
     * Now the lane is built out of the toy: a shelf to stand on, the toy, and a
     * little headroom for the rank badge.
     */
    const SHELF_SHARE = 0.17
    const GROUND_AT = 1 - SHELF_SHARE
    const RACER_HEIGHT = LANE_HEIGHT * GROUND_AT * 0.82
    const FRAME_DELAY = isDemo ? 80 : 280 // demo: ~18s, normal: ~65s

    function drawFrame(fi: number) {
      if (!ctx) return
      const frame = frames[fi]
      if (!frame) return

      ctx.clearRect(0, 0, width, height)

      // --- Diorama Speedway: four stacked horizontal lanes ------------------
      // The track was a vertical tree trunk, left over from the first theme.
      // CLAUDE.md locks the format as stacked horizontal lanes running left to
      // right: it is the photo-finish framing, and on a phone it keeps four
      // racers legible without shrinking them (ART_DIRECTION §8).
      for (let i = 0; i < numRacers; i++) {
        const top = TOP_MARGIN + i * LANE_HEIGHT

        // The drawn deck fills the lane. Odd lanes are mirrored so four
        // repeats of one image do not read as a repeating pattern.
        if (laneDeck.complete && laneDeck.naturalWidth > 0) {
          ctx.save()
          if (i % 2 === 1) {
            ctx.translate(SIDE_MARGIN * 2 + TRACK_WIDTH, 0)
            ctx.scale(-1, 1)
          }
          ctx.drawImage(laneDeck, SIDE_MARGIN, top, TRACK_WIDTH, LANE_HEIGHT)
          ctx.restore()
        } else {
          ctx.fillStyle = PALETTE.floor
          ctx.fillRect(SIDE_MARGIN, top, TRACK_WIDTH, LANE_HEIGHT)
        }

        // Lane accent stripe — which lane is whose, at a glance (§10).
        ctx.fillStyle = RACER_COLORS[i] || PALETTE.ink
        ctx.fillRect(SIDE_MARGIN, top, 4, LANE_HEIGHT)
      }

      // Start line (left) and chequered finish (right).
      ctx.strokeStyle = PALETTE.ink
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(SIDE_MARGIN, TOP_MARGIN)
      ctx.lineTo(SIDE_MARGIN, TOP_MARGIN + TRACK_HEIGHT)
      ctx.stroke()

      // Finish: a drawn chequered banner hung from a dowel, spanning all four
      // lanes. This was a 16px-wide loop of alternating fillRect squares with
      // the word FINISH above it — a legend in the margin rather than something
      // in the scene. The dowel is allowed to poke above the track box, which
      // is what the top margin is now for.
      const bannerW = 34
      const bannerX = SIDE_MARGIN + TRACK_WIDTH - bannerW * 0.45
      if (finishBanner.complete && finishBanner.naturalWidth > 0) {
        ctx.drawImage(
          finishBanner,
          bannerX, TOP_MARGIN - 10,
          bannerW, TRACK_HEIGHT + 10
        )
      } else {
        ctx.fillStyle = PALETTE.ink
        ctx.fillRect(SIDE_MARGIN + TRACK_WIDTH, TOP_MARGIN, 6, TRACK_HEIGHT)
      }

      // Sort for ranking
      const sorted = [...frame.positions].sort((a, b) => b.distance - a.distance)

      frame.positions.forEach((pos, i) => {
        const progress = Math.min(1, pos.distance / trackLength)
        const cx = SIDE_MARGIN + progress * TRACK_WIDTH
        const top = TOP_MARGIN + i * LANE_HEIGHT
        const ground = top + LANE_HEIGHT * GROUND_AT
        const rank = sorted.findIndex(s => s.id === pos.id) + 1
        const isBot = bots.has(pos.id)

        // The seven-part rig, driven from race state. Cadence comes from ground
        // speed so the planted foot tracks the shelf instead of moonwalking, and
        // the key's spin rate is stamina — the gauge the player learned in the
        // Wind-Up phase (ART_DIRECTION §7.2).
        const phase = phaseRef.current[pos.id] ?? 0
        const stamina = Math.max(0, Math.min(1, pos.speed / 12))
        keyRef.current[pos.id] = (keyRef.current[pos.id] ?? 0) + stamina * 14
        drawRacer(ctx, rigFor(archetypeRef.current[pos.id] ?? 'tank'), {
          x: cx,
          y: ground + 2,
          height: RACER_HEIGHT,
          phase,
          keyAngle: -keyRef.current[pos.id],
          facing: 1,
          dimmed: isBot,
          rarity: rarityRef.current[pos.id],
        })
        phaseRef.current[pos.id] = phase + cadence(pos.speed * 2.2, RACER_HEIGHT) * 0.28

        // Rank above the racer, name and speed pinned to the lane's left edge.
        // Rank badge: gold for the leader, then shelf grey. Outlined in ink so
        // it holds against both the pale wall and the warm shelf.
        ctx.fillStyle = rank === 1 ? PALETTE.gold : PALETTE.shelf
        ctx.beginPath()
        ctx.arc(cx, ground - RACER_HEIGHT - 10, 8, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = PALETTE.ink
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.fillStyle = PALETTE.ink
        ctx.font = 'bold 10px ui-monospace, monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(rank), cx, ground - RACER_HEIGHT - 10)

        // Name plate. The text used to be drawn straight onto the lane, which
        // worked on a flat fill and stopped working the moment the lane became
        // a printed surface — the labels landed on top of the gear band and
        // were unreadable. A stamped ink plate reads over anything and matches
        // the toy-packaging language the rest of the UI uses.
        const label = isBot ? `${names.get(pos.id) || '#' + pos.id}  BOT` : (names.get(pos.id) || '#' + pos.id)
        const speedText = pos.speed.toFixed(1) + ' u/t'
        ctx.font = 'bold 10px sans-serif'
        const plateW = Math.max(ctx.measureText(label).width, 42) + 14
        const plateH = 26
        const plateX = SIDE_MARGIN + 4
        const plateY = top + 4

        ctx.fillStyle = PALETTE.paper
        ctx.strokeStyle = PALETTE.ink
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.roundRect(plateX, plateY, plateW, plateH, 6)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = isBot ? PALETTE.dust : PALETTE.ink
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(label, plateX + 7, plateY + 4)
        ctx.fillStyle = PALETTE.dust
        ctx.font = '9px ui-monospace, monospace'
        ctx.fillText(speedText, plateX + 7, plateY + 15)
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
        } else if (nearEvent.type === 'tactic_projectile' && nearEvent.affectedIds[0] !== undefined) {
          const hitId = nearEvent.affectedIds[0]
          const lane = frame.positions.findIndex(p => p.id === hitId)
          if (lane >= 0) {
            showBubble(hitId, 'projectile_hit', lane)
            showEmote(lane, 'projectile_hit')
          }
          sfxProjectileHit()
        } else if (nearEvent.type === 'rain') {
          frame.positions.forEach((_p, idx) => showEmote(idx, 'rain'))
          sfxRain()
        } else if (nearEvent.type === 'luck_orb' && nearEvent.affectedIds[0] !== undefined) {
          const lane = frame.positions.findIndex(p => p.id === nearEvent.affectedIds[0])
          if (lane >= 0) showEmote(lane, 'luck_orb')
          sfxLuckOrb()
        } else if (nearEvent.type === 'mass_slow') {
          nearEvent.affectedIds.forEach(aid => {
            const lane = frame.positions.findIndex(p => p.id === aid)
            if (lane >= 0) showEmote(lane, 'mass_slow')
          })
          sfxMassSlow()
        } else if (nearEvent.type === 'collision') {
          nearEvent.affectedIds.forEach(aid => {
            const lane = frame.positions.findIndex(p => p.id === aid)
            if (lane >= 0) showEmote(lane, 'projectile_hit')
          })
          sfxCollision()
        }


        // Canvas flash effect
        const flashColors: Record<string, string> = {
          tactic_boost: 'rgba(34,197,94,0.15)',
          tactic_projectile: 'rgba(239,68,68,0.15)',
          mass_slow: 'rgba(245,158,11,0.12)',
          rain: 'rgba(59,130,246,0.12)',
          luck_orb: 'rgba(168,85,247,0.15)',
          collision: 'rgba(239,68,68,0.12)',
        }
        const flashColor = flashColors[nearEvent.type]
        if (flashColor) {
          setCanvasFlash(flashColor)
          setTimeout(() => setCanvasFlash(null), 300)
        }
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
          // Overtaken racer gets angry emote
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

    // Build racer race map for dialogue
    const racerRaces = new Map<number, string>()
    // Try to get race info from the race data (participants)
    gridPositions.forEach((gp: any) => {
      if (gp.racerRace) racerRaces.set(gp.id, gp.racerRace)
    })
    racerRacesRef.current = racerRaces

    function showBubble(racerId: number, moment: DialogueMoment, lane: number) {
      const race = racerRaces.get(racerId)
      const text = getDialogue(race, moment)
      setSpeechBubble({ racerId, text, lane })
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

  // Load the player's remaining items once the race is running.
  useEffect(() => {
    if (!id || !playerRacerId || racePhase !== 'racing') return
    api.getRaceItems(id, playerRacerId)
      .then(d => setItemsLeft(d.remaining))
      .catch(() => { /* a spectator has no loadout; the controls stay hidden */ })
  }, [id, playerRacerId, racePhase])

  // Trash talk phase: show for 5 seconds before race starts + entry SFX
  useEffect(() => {
    if (racePhase !== 'trash_talk') return
    // A race opened by direct link or after a refresh loads from the replay
    // endpoint, which stores frames and events but no grid. The intro screen
    // needs the grid, so it renders nothing — and because this effect used to
    // bail on a missing grid, the phase never advanced either and the canvas
    // stayed hidden behind `display: none`. The whole screen came up blank.
    if (!raceData?.gridPositions) {
      if (raceData?.frames?.length) setRacePhase('racing')
      return
    }
    // Skip trash talk in demo mode
    if (isDemo) {
      setRacePhase('racing')
      return
    }
    // Play entry sound for each racer with stagger
    raceData.gridPositions.forEach((_: any, i: number) => {
      setTimeout(() => sfxTrashTalkEntry(), i * 1000)
    })
    const timer = setTimeout(() => setRacePhase('racing'), 5500)
    return () => clearTimeout(timer)
  }, [raceData, racePhase, isDemo])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-brand-dust">Loading race...</div>
      </div>
    )
  }

  if (!raceData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-brand-dust">Race not found</p>
        <button onClick={() => navigate('/race')} className="text-brand-primary underline cursor-pointer">
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
            {/* Track name comes from the theme. It read "Grand Projectile Throw
                Track" — half the first theme's arena name, half the retired
                tactic vocabulary — hardcoded on the race screen. */}
            <span className="text-brand-danger">LIVE</span> — {THEME.locations.track}
            {isDemo && <span className="ml-2 px-2 py-0.5 bg-brand-gold/20 text-brand-ink text-xs font-bold rounded">DEMO</span>}
          </h1>
          <div className="flex items-center gap-2">
            <p className="text-brand-dust text-sm">Race {raceData.raceId?.slice(-8)}</p>
            {raceData.weather && (() => {
              const w: Record<string, { emoji: string; label: string; color: string }> = {
                sunny:  { emoji: '\u{2600}\uFE0F', label: 'Sunny', color: 'text-brand-gold' },
                rainy:  { emoji: '\u{1F327}\uFE0F', label: 'Rainy', color: 'text-brand-info' },
                windy:  { emoji: '\u{1F4A8}', label: 'Windy', color: 'text-brand-dust' },
                foggy:  { emoji: '\u{1F32B}\uFE0F', label: 'Foggy', color: 'text-brand-dust' },
                stormy: { emoji: '\u{26C8}\uFE0F', label: 'Stormy', color: 'text-brand-danger' },
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
            className="bg-brand-surface border border-brand-border rounded-lg px-2.5 py-2 text-lg cursor-pointer hover:bg-brand-ink/5 transition-colors"
            title={soundMuted ? 'Unmute' : 'Mute'}
          >
            {soundMuted ? '\u{1F507}' : '\u{1F50A}'}
          </button>
          <div className="bg-brand-surface border border-brand-border rounded-lg px-3 py-1.5">
            <span className="text-brand-dust text-xs">TICK</span>
            <p className="text-brand-ink font-mono font-bold">{currentTick}</p>
          </div>
        </div>
      </div>

      {/* Pre-Race Trash Talk Phase */}
      <AnimatePresence>
        {racePhase === 'trash_talk' && raceData?.gridPositions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -30 }}
            className="toy-panel p-6 mb-4"
          >
            <motion.h2
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center text-2xl font-extrabold text-brand-gold mb-6"
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
                  {/* The racers themselves. This was four copies of the brand
                      key emoji — the one screen whose entire job is introducing
                      four different toys was showing the same icon four times. */}
                  <div className="mb-1">
                    <RacerPortrait
                      archetype={gp.race ?? gp.racerRace}
                      rarity={gp.rarity}
                      height={92}
                      still
                    />
                  </div>
                  <p className="text-brand-ink font-bold text-sm mb-1">{gp.name}</p>
                  <p className="text-brand-dust text-xs mb-2">P{gp.position}</p>
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 1.0 + 0.5 }}
                    className="toy-chip bg-brand-surface text-brand-ink text-xs px-3 py-1.5 inline-block max-w-[160px]"
                  >
                    {(() => {
                      const talk = getTrashTalk(gp.racerRace)
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
              <span className="text-brand-dust text-sm animate-pulse">Race starting...</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Race Canvas + Kill Feed layout */}
      <div className="flex gap-3 mb-4" style={{ display: racePhase === 'trash_talk' ? 'none' : 'flex' }}>
      <div
        className="toy-panel relative flex-1 overflow-hidden p-0"
        // The lanes are drawn art now, so the container only needs a ground
        // colour for the sliver of canvas outside the track box.
        style={{ background: PALETTE.wall }}
      >
        <canvas
          ref={canvasRef}
          className="w-full"
          style={{
            // Four lanes of a legible toy plus margins. Taking a share of the
            // viewport instead meant the track kept growing while the toys did
            // not, which is what made the lanes read as empty bands.
            height: 'clamp(360px, 58vh, 520px)',
            // Fog used to darken (brightness 0.85), which read as atmosphere on a
            // black background and as "the whole scene is faded" on a lit one.
            // Lift and desaturate instead.
            filter: raceData?.weather === 'foggy' ? 'blur(0.4px) saturate(0.8) brightness(1.04)' : undefined,
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

        {/* Canvas flash effect on events */}
        <AnimatePresence>
          {canvasFlash && (
            <motion.div
              key="flash"
              initial={{ opacity: 0.8 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 pointer-events-none"
              style={{ backgroundColor: canvasFlash }}
            />
          )}
        </AnimatePresence>

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
                    ? 'bg-brand-primary/90 text-brand-surface'
                    : 'bg-brand-danger/90 text-brand-ink'
                  : 'bg-brand-gold/90 text-brand-surface'
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
              key={`speech-${speechBubble.racerId}`}
              initial={{ opacity: 0, scale: 0.5, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="absolute pointer-events-none"
              style={{ left: `${leftPct}%`, top: '20%', transform: 'translateX(-50%)' }}
            >
              {/* Cream text on white — the second survivor of the blanket colour
                  swap that made text-brand-bg into text-brand-surface. Invisible
                  in both cases, and in both cases only findable by looking. */}
              <div className="toy-chip text-brand-ink text-xs px-3 py-1.5 max-w-[200px]">
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
              className="toy-panel absolute bottom-4 left-1/2 -translate-x-1/2 px-5 py-2.5 max-w-[90%]"
            >
              <p className="text-brand-gold font-bold text-sm sm:text-base text-center">{commentary}</p>
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

      </div>

      </div>

      {/* Item controls. Only the player who owns a racer in this race sees them,
          and only while it is running. The button says what happens; the server
          decides when, because a client-chosen tick could land in a moment the
          player had already watched. */}
      {!raceFinished && playerRacerId && (address || previewWallet) && itemsLeft.length > 0 && (
        <div className="flex gap-3 mb-4">
          {(['boost', 'hinder'] as const).map(code => {
            const count = itemsLeft.filter(c => c === code).length
            if (count === 0) return null
            return (
              <button
                key={code}
                type="button"
                disabled={deploying}
                onClick={async () => {
                  if (!id || !playerRacerId || !address) return
                  setDeploying(true)
                  try {
                    await api.deployItem(id, playerRacerId, address, code)
                    setItemsLeft(prev => {
                      const next = [...prev]
                      next.splice(next.indexOf(code), 1)
                      return next
                    })
                    toast.success(`${THEME.items[code].name} away!`)
                  } catch (err: any) {
                    toast.error(err.message)
                  }
                  setDeploying(false)
                }}
                className="toy-btn flex-1 py-3 px-4 bg-brand-gold text-brand-ink"
              >
                {THEME.items[code].name}
                {count > 1 && <span className="ml-2 text-sm">×{count}</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* Live standings */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
        {livePositions.map((pos, i) => (
          <div
            key={pos.id}
            // Opaque. These tinted panels were translucent over a drawn room,
            // so the standings sat on top of a window and a pile of blocks and
            // could not be read at all.
            className="toy-panel flex items-center gap-3 p-3"
            style={{ borderColor: RACER_COLORS[i] || undefined }}
          >
            <span className="text-2xl font-extrabold" style={{ color: RACER_COLORS[i] }}>
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-brand-ink font-semibold text-sm truncate">{pos.name}</p>
              <p className="text-brand-dust text-xs">
                {((pos.distance / (raceData.trackLength || 1000)) * 100).toFixed(0)}% — {pos.speed.toFixed(1)} u/t
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Wallet Disconnect Overlay.
          Suppressed in dev with ?preview=1 so the race screen can actually be
          looked at and measured. Three rounds of styling went into this screen
          while every screenshot of it was covered by this dim overlay — the
          layout was being changed blind. */}
      {!isConnected && !previewMode && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-8 max-w-sm w-full mx-4 text-center">
            <div className="text-5xl mb-4">{'\u26A0\uFE0F'}</div>
            <h2 className="text-xl font-bold text-brand-ink mb-2">Wallet Disconnected</h2>
            <p className="text-brand-dust text-sm mb-6">Reconnect your wallet to continue the race and receive your rewards.</p>
            <WalletConnect />
          </div>
        </div>
      )}

      {/* Full post-race stats screen */}
      <AnimatePresence>
        {raceFinished && raceData.finalOrder && (() => {
          // Compute stats from frames/events
          const frames: RaceFrame[] = raceData.frames || []
          const trackLen = raceData.trackLength || 1000

          // Max speed per racer
          const maxSpeeds: Record<number, number> = {}
          for (const f of frames) {
            for (const p of f.positions) {
              maxSpeeds[p.id] = Math.max(maxSpeeds[p.id] || 0, p.speed)
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
          gridPositions.forEach((gp: any) => {
      names.set(gp.id, gp.name)
      // `race` is the archetype code on the racer row — speedster / tank /
      // trickster / burst. Bots carry it too, so a lane of four reads as four
      // different toys rather than four Tinbots.
      if (gp.race) archetypeRef.current[gp.id] = gp.race
      if (gp.rarity) rarityRef.current[gp.id] = gp.rarity
    })
    raceData.finalOrder?.forEach((fo: any) => {
      if (fo.race && !archetypeRef.current[fo.id]) archetypeRef.current[fo.id] = fo.race
    })
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

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-50 overflow-y-auto"
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
                  <h2 className="text-4xl font-extrabold text-brand-gold mb-1">{winner?.name} WINS!</h2>
                </motion.div>

                {/* Standings table */}
                <div className="bg-brand-surface border border-brand-border rounded-xl p-4 mb-6">
                  <h3 className="text-brand-dust text-xs font-bold uppercase mb-3">Final Standings</h3>
                  <div className="space-y-2">
                    {raceData.finalOrder.map((fo: FinalOrder, i: number) => (
                      <motion.div
                        key={fo.id}
                        initial={{ x: -40, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.2 + i * 0.15 }}
                        className={`flex items-center gap-3 p-3 rounded-lg ${
                          i === 0 ? 'bg-brand-gold/10 border border-brand-gold' : 'bg-brand-bg/50 border border-brand-border'
                        }`}
                      >
                        <span className={`text-xl font-extrabold w-8 ${
                          i === 0 ? 'text-brand-gold' : i === 1 ? 'text-brand-ink/80' : i === 2 ? 'text-amber-600' : 'text-brand-dust'
                        }`}>{i + 1}.</span>
                        <div className="flex-1 text-left">
                          <p className="text-brand-ink font-semibold">{fo.name}</p>
                          <p className="text-brand-dust text-xs">
                            Max: {(maxSpeeds[fo.id] || 0).toFixed(1)} u/t
                            {fo.isBot && ' | BOT'}
                          </p>
                        </div>
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
                    className="bg-brand-accent/10 border border-brand-accent/30 rounded-xl p-4 mb-6"
                  >
                    <h3 className="text-brand-accent font-bold text-sm mb-2">What If...?</h3>
                    <p className="text-brand-ink/80 text-sm">
                      {runnerUp.name} was only <span className="text-brand-gold font-bold">{gap} units</span> from the finish line.
                      {' A tighter wind could have taken Pole Position.'}
                    </p>
                  </motion.div>
                )}

                {/* MVP Awards */}
                {mvpAwards.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="bg-brand-surface border border-brand-border rounded-xl p-4 mb-6"
                  >
                    <h3 className="text-brand-dust text-xs font-bold uppercase mb-3 text-center">MVP Awards</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {mvpAwards.map((award, i) => (
                        <motion.div
                          key={award.title}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 1.0 + i * 0.2, type: 'spring', stiffness: 300 }}
                          className="bg-brand-bg/60 border border-brand-gold/30 rounded-xl p-3 text-center"
                        >
                          <div className="text-3xl mb-1">{award.emoji}</div>
                          <p className="text-brand-gold font-bold text-xs uppercase">{award.title}</p>
                          <p className="text-brand-ink font-semibold text-sm mt-1">{award.name}</p>
                          <p className="text-brand-dust text-xs">{award.detail}</p>
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
                      if (!address || !playerRacerId) { navigate('/race'); return }
                      try {
                        // Send them back to the lobby with the format preselected
                        // rather than simulating here. The old version called
                        // startTuning and simulateRace back to back, which skipped
                        // the Wind-Up phase entirely — the fastest loop in the game
                        // was the one that bypassed its core mechanic — then forced
                        // a full window.location.reload() on top.
                        navigate('/race', { state: { format: location.state?.format } })
                      } catch (err) { console.error('Race Again failed:', err); navigate('/race') }
                    }}
                    className="px-8 py-3 bg-brand-gold text-brand-ink font-black rounded-xl text-lg hover:brightness-105 transition-all cursor-pointer border-2 border-brand-ink"
                  >
                    Race Again
                  </button>
                  <button
                    onClick={() => navigate('/collection')}
                    className="px-6 py-2.5 border border-brand-border text-brand-ink/80 rounded-xl hover:bg-brand-ink/5 transition-colors cursor-pointer"
                  >
                    Back to {THEME.locations.home}
                  </button>
                  <button
                    onClick={async () => {
                      const standings = raceData.finalOrder
                        .map((fo: FinalOrder, i: number) => `${i + 1}. ${fo.name}`)
                        .join('\n')
                      const frameUrl = `https://app.winduprush.xyz/api/social/frame/${id}`
                      const text = `${THEME.brand.mark} ${THEME.brand.name} Race Result!\n\n\u{1F3C6} ${winner?.name} WINS!\n\n${standings}\n\n${frameUrl}`
                      if (navigator.share) {
                        try {
                          await navigator.share({ title: `${THEME.brand.name} Race Result`, text })
                        } catch { /* user cancelled */ }
                      } else {
                        await navigator.clipboard.writeText(text)
                        toast.success('Result copied to clipboard!')
                      }
                    }}
                    className="px-6 py-2.5 border border-brand-gold text-brand-gold rounded-xl hover:bg-brand-gold/10 transition-colors cursor-pointer"
                  >
                    Share Result
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
