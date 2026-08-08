import { useEffect, useRef, useState, useCallback } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAccount } from 'wagmi'
import WalletConnect from '../components/WalletConnect'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { rigFor, drawRacer, cadence } from '../lib/racerRig'
import { THEME, racerDisplayName, archetypeAccent } from '../config/theme'
import RacerPortrait from '../components/RacerPortrait'
import { getCommentary } from '../data/commentary'
import { getDialogue, getEmote, type DialogueMoment, type EmoteMoment } from '../data/dialogues'
import {
  sfxRaceStart, sfxBoost, sfxProjectileHit, sfxRain, sfxLuckOrb,
  sfxMassSlow, sfxCollision, sfxOvertake, sfxHeartbeat, sfxFinish,
  toggleMute,
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
  /** Tick the racer crossed the line; null if the simulation capped out. */
  finishTick?: number | null
  /** Archetype and rarity codes, so the podium can draw the actual toy. */
  race?: string
  rarity?: string
}

// The four locked archetype accents (ART_DIRECTION §3), reused as lane colours
// so the stripes belong to the game rather than to Tailwind's default swatches.
/**
 * Fallback only. These four hexes are the archetype accents, and they live in
 * theme.ts — this array held a second copy of them and, worse, was indexed by
 * the racer's slot rather than by its archetype, so a Chomper was regularly
 * drawn in the Jetster's red. Colour is how a player finds their toy
 * (ART_DIRECTION §10); it has to follow the archetype.
 */
/**
 * What each finishing place grows, mirrored from the server's POSITION_STAT
 * (backend/src/routes/race.ts) and the gain from its PER_RACE_STAT_GAIN. If one
 * moves, move both — a screen that promises SPD for first place while the
 * server awards something else is worse than a screen that promises nothing.
 *
 * Last place says WEAKEST rather than a stat name because it genuinely is one:
 * it feeds whichever of REF, AGI and LCK the racer has least of, so the answer
 * differs per racer and naming any single stat here would be a lie for three
 * quarters of the field.
 */
const POSITION_STAT: Record<number, string> = { 1: 'SPD', 2: 'STA', 3: 'ACC', 4: 'WEAKEST' }
const PER_RACE_STAT_GAIN = 0.4

/** The engine ticks ten times a second; speeds are per tick. */
const TICKS_PER_SECOND = 10
/** Ticks between pressing an item and it taking effect (backend ITEM_TUNING). */
const ITEM_DELAY_TICKS = 50

const RACER_COLORS = ['#E63946', '#2A6FDB', '#FFC93C', '#4CAF6D', '#E63946', '#2A6FDB', '#FFC93C', '#4CAF6D']

/** Bare tin. A racer with no archetype yet gets its own colour rather than
 *  borrowing one of the four accents — it collided with the Jetster's red and
 *  put two identical colours in the standings. */
const WINDUP_COLOR = '#9AA6B2'

function colorFor(archetype: string | undefined, fallbackIndex: number): string {
  if (!archetype) return WINDUP_COLOR
  return archetypeAccent(archetype) ?? RACER_COLORS[fallbackIndex % RACER_COLORS.length]
}

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
// The corridor's own surfaces. lane-deck.webp was drawn for one lane of four,
// with the gear litho scaled to a 55px strip; at the corridor's height the same
// image stretched into ovals the size of a racer's torso. These are drawn for
// the shape the track actually has, and deliberately quiet — the toys are the
// only saturated thing on screen (CLAUDE.md, colour budget).
const laneDeck = new Image()
laneDeck.src = '/art/corridor-floor.webp'

const wallStrip = new Image()
wallStrip.src = '/art/corridor-wall.webp'

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
  // Preview asks the server (dev-only route) for the address that actually owns
  // this racer, instead of the 0xPREVIEW placeholder it used to invent. The
  // placeholder was refused by /item on every press, so the one decision the
  // game asks a player to make could not be played or looked at without a
  // wallet. Nothing about connecting a wallet needs to be finished for the rest
  // of the game to be built and seen.
  const [previewWallet, setPreviewWallet] = useState<string | undefined>()
  useEffect(() => {
    if (!previewMode || !id || !previewRacerId) return
    let cancelled = false
    fetch(`/api/race/${id}/preview-identity?racerId=${previewRacerId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d?.wallet) setPreviewWallet(d.wallet) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [previewMode, id, previewRacerId])
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
  const framesRef = useRef<RaceFrame[]>([])
  // The settled result, once the server has it. The podium prefers this over
  // the frames it animated, because an item deployed mid-race changes both.
  const finalOrderRef = useRef<any[] | null>(null)
  // What the race gave this racer. The daily cap is real and invisible: a
  // player at the cap races, wins, and watches nothing move with no
  // explanation anywhere on screen. A playtest with database access read that
  // silence as a dead feature; a player would read it the same way.
  const [statAward, setStatAward] = useState<
    { stat: string; gain: number; dayTotal: number; dayCap: number } | null
  >(null)

  const isDemo = location.state?.demo === true
  const playerRacerId = (location.state?.racerId as number | undefined) ?? previewRacerId

  const [raceData, setRaceData] = useState<any>(location.state?.raceResult || null)
  const [currentTick, setCurrentTick] = useState(0)
  const [livePositions, setLivePositions] = useState<{
    id: number; distance: number; name: string; speed: number; color: string
    toGo: number; gap: number; isBot: boolean; move: number
  }[]>([])
  /** Last frame's finishing order, so a change of place can be shown as it happens. */
  const prevRankRef = useRef<Record<number, number>>({})
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
  /**
   * There is no pre-race phase any more.
   *
   * "RACERS TO THE STAGE!" held the screen for five and a half seconds and
   * produced no decision — it listed the grid, which the race itself shows, and
   * then let you watch. A playtest measured 27.9 seconds from pressing Race to
   * the animation stopping on an 800m race that runs in about twenty; most of
   * the difference was this.
   */
  const [racePhase, setRacePhase] = useState<'racing' | 'finished'>('racing')
  const [canvasFlash, setCanvasFlash] = useState<string | null>(null)
  // Items the player still has. The server owns the tick an item lands on, so
  // the client only ever asks — it never proposes a moment.
  const [itemsLeft, setItemsLeft] = useState<string[]>([])
  /** The stock the racer carries between races, not what is left in this one. */
  const [itemStock, setItemStock] = useState(0)
  const [deploying, setDeploying] = useState(false)
  const [aimingAt, setAimingAt] = useState<'hinder' | null>(null)

  /**
   * Re-ask the server for the simulation.
   *
   * Called after an item is deployed (the future changed) and once the
   * animation reaches the line (the server can now settle). It replaces the
   * frame array in place; it must never go through setState for raceData,
   * because that would re-run the animation effect and restart the race.
   */
  const refreshSimulation = useCallback(async () => {
    if (!id) return
    try {
      const fresh = await api.simulateRace(id)
      if (fresh?.frames?.length) framesRef.current = fresh.frames as RaceFrame[]
      if (fresh?.finalOrder) finalOrderRef.current = fresh.finalOrder
      const mine = fresh?.statAwards?.find(a => a.racerId === playerRacerId)
      if (mine) setStatAward(mine)
    } catch (err) {
      console.error('Failed to refresh simulation:', err)
    }
  }, [id, playerRacerId])
  const racerRacesRef = useRef<Map<number, string>>(new Map()) // id -> race type
  const currentTickRef = useRef(0)
  const pausedRef = useRef(false)
  const resumeCallbackRef = useRef<(() => void) | null>(null)

  /**
   * One loader, and it has to be /simulate.
   *
   * There were two, both guarded on the same missing raceData, both firing at
   * once: this one built the race from the replay record and the one below from
   * the simulation. Whichever resolved first won — and the replay record
   * carries no gridPositions, so when it won there were no archetypes and no
   * rarities at all. Every racer then fell back to the default art and four
   * different toys were drawn as four identical ones. That is what made the
   * field unreadable, not the corridor.
   *
   * /simulate answers for a live race and a finished one alike, deterministically
   * from the seed, and it is the only response that carries the grid.
   */

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

    /**
     * Frames live in a ref, not a closure variable, because two things have to
     * replace them mid-race and neither may restart the animation — restarting
     * it is exactly the bug that killed Tactic Mode.
     *
     *  - Deploying an item changes the future. The server schedules it beyond
     *    the revealed frontier and applying it consumes no randomness, so the
     *    already-played prefix comes back bit-identical (proved in
     *    itemsPreserveHistory.test.ts). Swapping the array is therefore
     *    invisible. Without it the player watches the race they would have had
     *    if they had never pressed the button — and the podium then disagrees
     *    with the result the server recorded.
     *  - Reaching the line has to settle the race, and the server settles only
     *    when asked after its own clock has run out.
     */
    framesRef.current = raceData.frames
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
      names.set(gp.id, racerDisplayName(gp.name, gp.race))
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
      if (!names.has(fo.id)) names.set(fo.id, racerDisplayName(fo.name, (fo as any).race ?? archetypeRef.current[fo.id]))
    })

    const TOP_MARGIN = 22
    const BOTTOM_MARGIN = 16
    const SIDE_MARGIN = 20
    const TRACK_HEIGHT = height - TOP_MARGIN - BOTTOM_MARGIN
    // Lanes stack vertically; racers travel along X. The finish chequer eats a
    // little width on the right, so the running surface stops short of it.
    const TRACK_WIDTH = width - SIDE_MARGIN * 2 - 16

    /**
     * One corridor, not four lanes.
     *
     * Four parallel corridors meant no two racers could ever be in the same
     * place, so nothing ever jostled: four toys travelling down four private
     * tunnels, each one a quarter of the height and therefore small. Gigling
     * runs a single open field between a top and a bottom wall — the racers
     * scatter, clump, overlap and pass each other bodily, and each one gets to
     * be more than twice as tall because it is no longer dividing the screen
     * with three others.
     *
     * Identity moves off the track and into the standings: a shared field has
     * nowhere to put four name plates without covering the race. What stays on
     * the toy is its speed, and the player's own racer gets its name.
     */
    const WALL_SHARE = 0.10
    const WALL_H = TRACK_HEIGHT * WALL_SHARE
    const RUN_TOP = TOP_MARGIN + WALL_H
    const RUN_H = TRACK_HEIGHT - WALL_H * 2
    const RACER_HEIGHT = RUN_H * 0.46

    /**
     * Where a racer sits across the corridor.
     *
     * A hash looked like the honest way to scatter them and was not: hashes
     * clump, and three of four toys ended up stacked in the same place with
     * their speed plates covering each other. Gigling's field is not chaos
     * either — its racers sit at clearly separate heights and weave. So:
     * spread evenly by a stable order, then weave, which guarantees separation
     * without rebuilding fixed lanes.
     */
    const yOrder = (frames[0]?.positions ?? []).map(pt => pt.id).sort((a, b) => a - b)
    function laneFraction(id: number): number {
      const n = yOrder.length
      if (n <= 1) return 0.5
      const slot = Math.max(0, yOrder.indexOf(id))
      return slot / (n - 1)
    }
    const FRAME_DELAY = isDemo ? 80 : 280 // demo: ~18s, normal: ~65s

    /**
     * The camera, and why there now is one.
     *
     * The whole track used to be drawn end to end: 800 units squeezed into
     * ~370px, so 0.47px per unit. A racer travelling 40 units a second crossed
     * 19px a second while standing 37px tall — half a body length per second.
     * That is not a racer that looks slow, that is a racer that is slow, and no
     * amount of decoration was ever going to fix it.
     *
     * Gigling shows a 100m window of a 500m race, with a zoom control on it.
     * The whole track is never on screen, and that is the entire source of the
     * speed: the ground moves past you.
     *
     * A window of ~18% of the track gives about six times the pixels per unit.
     * The camera clamps at both ends, so the start line is still under you at
     * the start and the finish is on screen for the run-in.
     */
    const VIEW_UNITS = Math.max(120, trackLength * 0.18)
    const PX_PER_UNIT = TRACK_WIDTH / VIEW_UNITS
    const LEADER_AT = 0.72 // where across the viewport the leader sits
    const CAM_MAX = Math.max(0, trackLength - VIEW_UNITS)

    /**
     * Blend two sampled frames. The server sends every third tick — 158 frames
     * for a 47-second race, which played back at 3.6 frames a second. That is a
     * slide show, and it read as walking just as much as the scale did.
     * Rendering now runs every animation frame and interpolates between the two
     * nearest samples, so the motion is continuous at 60fps.
     */
    function frameAt(fp: number): RaceFrame {
      const src = framesRef.current
      const i0 = Math.max(0, Math.min(src.length - 1, Math.floor(fp)))
      const i1 = Math.min(src.length - 1, i0 + 1)
      const t = i1 === i0 ? 0 : Math.max(0, Math.min(1, fp - i0))
      const a = src[i0]
      const b = src[i1]
      const next = new Map(b.positions.map(q => [q.id, q]))
      return {
        tick: Math.round(a.tick + (b.tick - a.tick) * t),
        positions: a.positions.map(pt => {
          const q = next.get(pt.id) ?? pt
          return {
            ...pt,
            distance: pt.distance + (q.distance - pt.distance) * t,
            speed: pt.speed + (q.speed - pt.speed) * t,
          }
        }),
      }
    }

    function renderFrame(frame: RaceFrame) {
      if (!ctx) return

      ctx.clearRect(0, 0, width, height)

      // Camera position for this frame. Everything below is placed in world
      // units and mapped through toScreen, rather than being squeezed to fit.
      const lead = frame.positions.reduce((m, pt) => Math.max(m, pt.distance), 0)
      const camStart = Math.max(0, Math.min(CAM_MAX, lead - VIEW_UNITS * LEADER_AT))
      const camPx = camStart * PX_PER_UNIT
      const toScreen = (d: number) => SIDE_MARGIN + (d - camStart) * PX_PER_UNIT

      // The scenery scrolls now, so it has to be kept inside the track box.
      ctx.save()
      ctx.beginPath()
      ctx.rect(SIDE_MARGIN, TOP_MARGIN, TRACK_WIDTH, TRACK_HEIGHT)
      ctx.clip()

      // --- Diorama Speedway: one open corridor ------------------------------
      // Segment colour. Gigling repaints its walls at every segment boundary,
      // and that is how you know you have got somewhere — the environment
      // changes, not just a bar at the top. Six segments, six accents.
      const SEG_COUNT = 6
      const SEG_COLORS = [
        PALETTE.gold, '#7FB7D9', '#C99BD6', '#8FCBA1', '#E8A87C', PALETTE.gold,
      ]

      // Floor. One strip, tiled and scrolling, mirrored on alternate tiles
      // because the art is not seamless.
      const tileW = TRACK_WIDTH * 0.62
      const period = tileW * 2
      const firstX = -(((camPx % period) + period) % period)
      if (laneDeck.complete && laneDeck.naturalWidth > 0) {
        let k = 0
        for (let tx = firstX; tx < TRACK_WIDTH + tileW; tx += tileW, k++) {
          ctx.save()
          if (k % 2 === 1) {
            ctx.translate(2 * (SIDE_MARGIN + tx) + tileW, 0)
            ctx.scale(-1, 1)
          }
          ctx.drawImage(laneDeck, SIDE_MARGIN + tx, RUN_TOP, tileW, RUN_H)
          ctx.restore()
        }
      } else {
        ctx.fillStyle = PALETTE.floor
        ctx.fillRect(SIDE_MARGIN, RUN_TOP, TRACK_WIDTH, RUN_H)
      }

      // Top and bottom walls, repainted per segment. Drawn in world space so
      // the boundary between two segments actually travels past you.
      for (const wallTop of [TOP_MARGIN, TOP_MARGIN + TRACK_HEIGHT - WALL_H]) {
        for (let sg = 0; sg < SEG_COUNT; sg++) {
          const x0 = toScreen((sg / SEG_COUNT) * trackLength)
          const x1 = toScreen(((sg + 1) / SEG_COUNT) * trackLength)
          if (x1 < SIDE_MARGIN || x0 > SIDE_MARGIN + TRACK_WIDTH) continue
          ctx.fillStyle = SEG_COLORS[sg]
          ctx.fillRect(x0, wallTop, x1 - x0, WALL_H)
        }
        // A neutral panel texture multiplied over the tint: the wall keeps its
        // segment colour but stops reading as a flat block of it.
        if (wallStrip.complete && wallStrip.naturalWidth > 0) {
          ctx.save()
          ctx.globalCompositeOperation = 'multiply'
          ctx.globalAlpha = 0.55
          const wTile = TRACK_WIDTH * 0.5
          const wFirst = -(((camPx % wTile) + wTile) % wTile)
          for (let tx = wFirst; tx < TRACK_WIDTH + wTile; tx += wTile) {
            ctx.drawImage(wallStrip, SIDE_MARGIN + tx, wallTop, wTile, WALL_H)
          }
          ctx.restore()
        }
        ctx.fillStyle = PALETTE.ink
        ctx.fillRect(SIDE_MARGIN, wallTop === TOP_MARGIN ? wallTop + WALL_H - 2 : wallTop, TRACK_WIDTH, 2)
      }

      // Push the printed deck back. Zooming in magnified the litho 2.7x, so a
      // gear became the size of a racer's torso and the ground competed with
      // the toys for attention. CLAUDE.md's colour budget already settles this:
      // the environment stays neutral and the accents live on the racers.
      ctx.fillStyle = 'rgba(255, 253, 247, 0.42)'
      ctx.fillRect(SIDE_MARGIN, RUN_TOP, TRACK_WIDTH, RUN_H)

      // Start line, at world zero — it scrolls away behind you now instead of
      // being pinned to the left edge for the whole race.
      const startX = toScreen(0)
      if (startX > SIDE_MARGIN - 4 && startX < SIDE_MARGIN + TRACK_WIDTH) {
        ctx.strokeStyle = PALETTE.ink
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(startX, RUN_TOP)
        ctx.lineTo(startX, RUN_TOP + RUN_H)
        ctx.stroke()
      }

      // Distance posts every 50 units. These are the speed cue: something has
      // to visibly stream past, and with the whole track on screen nothing ever
      // did. Every other one is labelled so the number is readable.
      const POST_EVERY = 50
      const firstPost = Math.floor(camStart / POST_EVERY) * POST_EVERY
      for (let d = firstPost; d <= camStart + VIEW_UNITS + POST_EVERY; d += POST_EVERY) {
        if (d <= 0 || d >= trackLength) continue
        const px = toScreen(d)
        ctx.strokeStyle = 'rgba(36, 26, 56, 0.18)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(px, RUN_TOP)
        ctx.lineTo(px, RUN_TOP + RUN_H)
        ctx.stroke()
        if (d % (POST_EVERY * 2) === 0) {
          ctx.fillStyle = 'rgba(36, 26, 56, 0.45)'
          ctx.font = 'bold 9px ui-monospace, monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillText(`${d}m`, px, RUN_TOP + 3)
        }
      }

      // Finish: a drawn chequered banner hung from a dowel, spanning the
      // corridor. This was a 16px-wide loop of alternating fillRect squares with
      // the word FINISH above it — a legend in the margin rather than something
      // in the scene. The dowel is allowed to poke above the track box, which
      // is what the top margin is now for.
      const bannerW = 34
      const bannerX = toScreen(trackLength) - bannerW * 0.45
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

      // Segment posts. Gigling splits a race into six segments and changes the
      // track decoration at each boundary, which is what stops a long lane from
      // reading as one repeated texture. We cannot restyle the deck art per
      // segment without six more assets, but the boundaries themselves are free
      // and they are most of the effect: the eye gets a ruler.
      for (let sgi = 1; sgi < SEG_COUNT; sgi++) {
        const sx = toScreen((sgi / SEG_COUNT) * trackLength)
        if (sx < SIDE_MARGIN - 12 || sx > SIDE_MARGIN + TRACK_WIDTH + 12) continue
        ctx.strokeStyle = 'rgba(36, 26, 56, 0.24)'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 6])
        ctx.beginPath()
        ctx.moveTo(sx, RUN_TOP)
        ctx.lineTo(sx, RUN_TOP + RUN_H)
        ctx.stroke()
        ctx.setLineDash([])
      }

      ctx.restore() // end of the scrolling scenery clip

      // Sort for ranking
      const sorted = [...frame.positions].sort((a, b) => b.distance - a.distance)

      /**
       * Place every racer in the corridor, then draw back to front.
       *
       * Depth is the whole reason the open field works: a racer nearer the
       * bottom of the screen is nearer the camera, so it is drawn later and
       * drawn bigger. Without that, four toys at four heights read as four
       * lanes again, just without the lines.
       */
      const placed = frame.positions.map(pos => {
        const base = laneFraction(pos.id)
        const weave = Math.sin(frame.tick / 34 + pos.id) * 0.045
        const yFrac = Math.max(0, Math.min(1, base * 0.9 + 0.05 + weave))
        const depth = 0.86 + 0.30 * yFrac // nearer the camera, larger
        return {
          pos,
          color: colorFor(archetypeRef.current[pos.id], Math.max(0, yOrder.indexOf(pos.id))),
          yFrac,
          h: RACER_HEIGHT * depth,
          ground: RUN_TOP + RUN_H * (0.46 + 0.54 * yFrac),
          cx: toScreen(pos.distance),
          rank: sorted.findIndex(sr => sr.id === pos.id) + 1,
          isBot: bots.has(pos.id),
        }
      })
      placed.sort((a, b) => a.ground - b.ground)

      for (const r of placed) {
        const { pos, cx, ground, rank, isBot } = r

        if (cx < SIDE_MARGIN - r.h * 0.6) {
          // Dropped out of the back of the camera. Mark the edge so the field
          // does not just look like it lost a member.
          ctx.fillStyle = r.color
          ctx.beginPath()
          ctx.moveTo(SIDE_MARGIN + 14, ground - 10)
          ctx.lineTo(SIDE_MARGIN + 4, ground - 18)
          ctx.lineTo(SIDE_MARGIN + 14, ground - 26)
          ctx.closePath()
          ctx.fill()
          ctx.fillStyle = PALETTE.ink
          ctx.font = 'bold 9px ui-monospace, monospace'
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillText(`${Math.round(camStart - pos.distance)}m`, SIDE_MARGIN + 18, ground - 18)
          continue
        }

        // Contact shadow, in the racer's own accent. With no lane stripe left
        // to own, this is where identity lives on the track — and it also
        // plants the toy on the floor, which matters a lot more now that the
        // floor is shared and toys overlap each other.
        ctx.save()
        ctx.globalAlpha = 0.34
        ctx.fillStyle = r.color
        ctx.beginPath()
        ctx.ellipse(cx, ground + 2, r.h * 0.30, r.h * 0.075, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()

        // The seven-part rig, driven from race state. Cadence comes from ground
        // speed so the planted foot tracks the floor instead of moonwalking, and
        // the key's spin rate is stamina (ART_DIRECTION §7.2).
        const phase = phaseRef.current[pos.id] ?? 0
        const stamina = Math.max(0, Math.min(1, pos.speed / 12))
        keyRef.current[pos.id] = (keyRef.current[pos.id] ?? 0) + stamina * 14
        drawRacer(ctx, rigFor(archetypeRef.current[pos.id] ?? 'windup'), {
          x: cx,
          y: ground + 2,
          height: r.h,
          phase,
          keyAngle: -keyRef.current[pos.id],
          facing: 1,
          dimmed: isBot,
          rarity: rarityRef.current[pos.id],
        })
        phaseRef.current[pos.id] = phase + cadence(pos.speed * 2.2, r.h) * 0.28

        // Leader bracket.
        if (rank === 1) {
          const bw = r.h * 0.9
          const bh = r.h * 1.15
          const bx = cx - bw / 2
          const by = ground - bh
          const arm = Math.max(6, bw * 0.28)
          ctx.strokeStyle = PALETTE.gold
          ctx.lineWidth = 2.5
          ctx.beginPath()
          for (const [ox, oy, dx, dy] of [
            [bx, by, 1, 1], [bx + bw, by, -1, 1],
            [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1],
          ] as const) {
            ctx.moveTo(ox + dx * arm, oy)
            ctx.lineTo(ox, oy)
            ctx.lineTo(ox, oy + dy * arm)
          }
          ctx.stroke()
        }
      }

      /**
       * Pass two: the plates, and why they are a second pass.
       *
       * A playtest read the running order off the list under the track and not
       * off the track — "the list is currently doing a better job than the race
       * itself". The corridor had already made the toys twice as tall, so the
       * problem was never size. It was four separate things, all here:
       *
       *   1. The plate led with SPEED. `44` at 13px was the largest glyph on the
       *      track, and speed is the one number a viewer never asks for — it is
       *      in the standings anyway. Rank, the thing being asked, was an 11px
       *      chip beside it.
       *   2. Only the player's toy carried a name, so identifying any of the
       *      other three meant going to the list. That is exactly the reported
       *      behaviour, and it was by design: the old note says four name plates
       *      "cover the race", which was true of four private lanes stacked in a
       *      quarter of the height each. It is not true of one open corridor.
       *   3. The rank chip is drawn in the archetype accent, and that colour is
       *      the only thread tying a toy to its row in the standings — but
       *      `rank === 1` overrode it to gold, so the thread broke on precisely
       *      the racer a viewer is most likely to be following.
       *   4. Plates were drawn inside the back-to-front toy loop, so a toy
       *      nearer the camera painted over the plate of the toy behind it, and
       *      nothing tied a floating rectangle to a body when three toys clumped.
       *
       * So: one plate per racer, carrying rank and NAME, in the racer's own
       * colour, drawn after every toy, tethered to its head by a line, and
       * nudged upward off any plate it would collide with.
       */
      type Plate = { x: number; y: number; w: number; h: number; r: (typeof placed)[number]; label: string }
      const PLATE_H = 20
      const plates: Plate[] = []

      for (const r of placed) {
        if (r.cx < SIDE_MARGIN - r.h * 0.6) continue
        // A bot's plate says BOT and not "Tinbot-02", and the difference is
        // worth 90 pixels. At the start the whole field occupies one body-width
        // of track, and four full-width plates there buried the toys they were
        // labelling — the product, hidden behind its own captions. The name of a
        // bot is the one label a viewer will never need: it cannot be caught,
        // beaten or lost to. Its rank and its colour are the whole story, and
        // both stay. Names are for racers somebody owns.
        const label = r.isBot ? 'BOT' : names.get(r.pos.id) || `#${r.pos.id}`
        ctx.font = `bold ${r.isBot ? 9 : 11}px sans-serif`
        const w = ctx.measureText(label).width + 30
        const x = Math.min(SIDE_MARGIN + TRACK_WIDTH - w, Math.max(SIDE_MARGIN, r.cx - w / 2))
        plates.push({ x, y: r.ground - r.h - PLATE_H - 10, w, h: PLATE_H, r, label })
      }

      // Lift a plate off anything already placed. Leader first, so the racer in
      // front keeps the position closest to its own head and the field stacks
      // around it rather than the other way round.
      //
      // The ceiling is the track box, NOT the running surface: this pass is
      // outside the scenery clip, so a plate may hover over the top wall, and it
      // needs to. A back-row toy's head sits within a few pixels of RUN_TOP by
      // construction, so clamping plates to the running surface left them
      // nowhere to go — and clamping AFTER the search put them straight back
      // into the collision they had just been moved out of, which is how the
      // player's own plate ended up underneath a bot's.
      const CEILING = TOP_MARGIN + 2
      plates.sort((a, b) => a.r.rank - b.r.rank)
      const settled: Plate[] = []
      const clashes = (a: Plate, y: number, b: Plate) =>
        a.x < b.x + b.w + 3 && b.x < a.x + a.w + 3 && y < b.y + b.h + 3 && b.y < y + a.h + 3
      for (const p of plates) {
        const natural = p.y
        // Up first — a plate over the toy's head is the natural reading — then
        // down, for the back row that has no sky left above it.
        const slots = [0, -1, -2, -3, 1, 2, 3].map(s => natural + s * (PLATE_H + 4))
        p.y = slots.find(y => y >= CEILING && !settled.some(q => clashes(p, y, q))) ?? Math.max(CEILING, natural)
        settled.push(p)
      }

      // Your own racer's plate is drawn last, so that if the field ever does run
      // out of room the one plate that must stay legible is the one on top.
      settled.sort((a, b) => Number(a.r.pos.id === playerRacerId) - Number(b.r.pos.id === playerRacerId))

      for (const p of settled) {
        const { r } = p
        const isMine = playerRacerId != null && r.pos.id === playerRacerId

        // Tether. A plate pushed up off a collision is no longer over its own
        // toy, and a label that could belong to either of two overlapping
        // bodies is worse than no label.
        ctx.strokeStyle = r.color
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(p.x + p.w / 2, p.y + p.h)
        ctx.lineTo(r.cx, r.ground - r.h + 2)
        ctx.stroke()

        // Your own toy is gold, a bot is muted, everyone else is paper. Who is
        // leading is told by the bracket around the toy and by the rank in the
        // chip — never by the plate's colour, which has to stay the racer's.
        ctx.fillStyle = isMine ? PALETTE.gold : r.isBot ? '#E7E3DA' : PALETTE.paper
        ctx.strokeStyle = PALETTE.ink
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.roundRect(p.x, p.y, p.w, p.h, 6)
        ctx.fill()
        ctx.stroke()

        // Rank chip, always in the racer's accent so it matches the coloured bar
        // on that racer's standings row.
        ctx.fillStyle = r.color
        ctx.beginPath()
        ctx.roundRect(p.x + 3, p.y + 3, 17, p.h - 6, 4)
        ctx.fill()
        ctx.strokeStyle = PALETTE.ink
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.fillStyle = PALETTE.paper
        ctx.font = 'bold 11px ui-monospace, monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(r.rank), p.x + 11.5, p.y + p.h / 2 + 0.5)

        // Bots are labelled on the track and not only in the standings. Three of
        // the four toys in a solo race are bots, and which ones is the first
        // thing that tells a viewer how much of what they are watching counts.
        ctx.fillStyle = r.isBot ? PALETTE.dust : PALETTE.ink
        ctx.font = `bold ${r.isBot ? 9 : 11}px sans-serif`
        ctx.textAlign = 'left'
        ctx.fillText(p.label, p.x + 25, p.y + p.h / 2 + 0.5)
      }
    }

    /**
     * Everything that is not drawing: React state, commentary, sound, emotes.
     *
     * This has to be separate from rendering now. Rendering runs every
     * animation frame so the motion is smooth; the data still arrives every
     * third tick. Left together, a setState and a sound cue would fire about
     * seventeen times per sample.
     */
    function advanceFrame(fi: number, frame: RaceFrame) {
      const sorted = [...frame.positions].sort((a, b) => b.distance - a.distance)

      // Standings rows carry the two things a viewer actually wants: how far is
      // left, and how far behind the leader you are. A percentage answers
      // neither — "47%" tells you nothing about whether the race is close.
      const ordered = [...frame.positions].sort((a, b) => b.distance - a.distance)
      const leadDist = ordered[0]?.distance ?? 0
      const live = ordered.map((pos, idx) => {
        const prev = prevRankRef.current[pos.id]
        return {
          id: pos.id,
          distance: pos.distance,
          name: names.get(pos.id) || `#${pos.id}`,
          speed: pos.speed,
          color: colorFor(archetypeRef.current[pos.id], Math.max(0, yOrder.indexOf(pos.id))),
          toGo: Math.max(0, Math.round(trackLength - pos.distance)),
          gap: Math.round(leadDist - pos.distance),
          isBot: bots.has(pos.id),
          // -1 climbed, 1 dropped, 0 held. Compared against the previous frame,
          // so an overtake is visible for the moment it happens rather than
          // having to be inferred from two numbers moving past each other.
          move: prev == null ? 0 : Math.sign(idx - prev),
        }
      })
      live.forEach((r, idx) => { prevRankRef.current[r.id] = idx })

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
      const capturedId = ++emoteIdRef.current
      const emoji = getEmote(moment)
      const x = xPercent ?? (15 + Math.random() * 70) // random x position on track
      setEmotes(prev => {
        const next = [...prev, { id: capturedId, emoji, lane, x }]
        // Max 2 emotes at a time — remove oldest if over limit
        return next.length > 2 ? next.slice(-2) : next
      })
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
    let framePos = 0
    let lastAdvanced = -1
    pausedRef.current = false

    function animate(time: number) {
      if (pausedRef.current) {
        lastTime = 0 // so the pause does not count as elapsed race time
        resumeCallbackRef.current = () => {
          animFrameRef.current = requestAnimationFrame(animate)
        }
        return
      }
      if (lastTime === 0) lastTime = time
      // Clamped: a backgrounded tab must not fast-forward the race on return.
      const dt = Math.min(120, time - lastTime)
      lastTime = time
      framePos += dt / FRAME_DELAY

      const live = framesRef.current
      const fi = Math.floor(framePos)
      if (framePos < live.length - 1) {
        renderFrame(frameAt(framePos))
        if (fi !== lastAdvanced) {
          lastAdvanced = fi
          advanceFrame(fi, live[fi])
        }
      } else {
        const lastFrame = live[live.length - 1]
        renderFrame(lastFrame)
        advanceFrame(live.length - 1, lastFrame)
        const winnerName = names.get(
          lastFrame?.positions.slice().sort((a, b) => b.distance - a.distance)[0]?.id || 0
        )
        if (winnerName) setCommentary(getCommentary('finish', { name: winnerName }))
        sfxFinish()
        // Ask once more, now the clock has run out. The server settles a race
        // only when its own clock says it is over, and the client asked exactly
        // once — at the start, when it never is. So a race the player finished
        // stayed `racing` forever: no finishing position, no streak, no stat
        // growth, nothing recorded anywhere.
        void refreshSimulation()
        setTimeout(() => { setCommentary(null); setRaceFinished(true) }, isDemo ? 1000 : 2500)
        return
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
      .then(d => { setItemsLeft(d.remaining); setItemStock(d.itemStock ?? 0) })
      .catch(() => { /* a spectator has no loadout; the controls stay hidden */ })
  }, [id, playerRacerId, racePhase])


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
          <div className="toy-chip px-3 py-1.5">
            <span className="text-brand-dust text-[10px] tracking-widest">TIME</span>
            <p className="text-brand-ink font-mono font-bold leading-none tabular-nums">
              {(currentTick / 10).toFixed(1)}s
            </p>
          </div>
        </div>
      </div>

      {/* Segment bar.
          The whole race as one line, split into segments, with a crown on the
          leader. Gigling puts this above the track and it does the job the lanes
          cannot: it says how much race is left, in one glance, without reading
          four positions and comparing them. */}
      {racePhase === 'racing' && livePositions.length > 0 && (() => {
        const len = raceData?.trackLength || 1000
        const leadPct = Math.min(100, ((livePositions[0]?.distance ?? 0) / len) * 100)
        const SEGMENTS = 6
        const segment = Math.min(SEGMENTS, Math.floor((leadPct / 100) * SEGMENTS) + 1)
        return (
          <div className="toy-panel px-4 py-3 mb-4">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-brand-dust text-[10px] tracking-widest uppercase">
                Segment {segment}/{SEGMENTS}
              </span>
              <span className="text-brand-dust text-[10px] tabular-nums">
                {Math.round(len - (livePositions[0]?.distance ?? 0))}m to go
              </span>
            </div>
            <div className="relative h-4">
              <div className="absolute inset-0 flex gap-[3px]">
                {Array.from({ length: SEGMENTS }, (_, i) => {
                  const done = leadPct >= ((i + 1) / SEGMENTS) * 100
                  const active = !done && leadPct > (i / SEGMENTS) * 100
                  return (
                    <span
                      key={i}
                      className={`flex-1 rounded-[3px] border-2 border-brand-ink ${
                        done ? 'bg-brand-gold' : active ? 'bg-brand-gold/40' : 'bg-brand-ink/10'
                      }`}
                    />
                  )
                })}
              </div>
              {/* Every racer as a tick, so the spread of the field is visible
                  even when four lanes make it hard to compare. */}
              {livePositions.map((pos, i) => (
                <span
                  key={pos.id}
                  className="absolute top-0 h-4 w-[3px] rounded-full"
                  style={{
                    left: `calc(${Math.min(100, (pos.distance / len) * 100)}% - 1.5px)`,
                    backgroundColor: pos.color,
                    opacity: i === 0 ? 1 : 0.55,
                  }}
                />
              ))}
              <span
                className="absolute -top-3 text-xs leading-none -translate-x-1/2 select-none"
                style={{ left: `${leadPct}%` }}
                aria-hidden
              >
                {'\u{1F451}'}
              </span>
            </div>
          </div>
        )
      })()}

      <div className="flex gap-3 mb-4">
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
            // One corridor, not four lanes: a wide band rather than a tall box.
            // Left at four lanes' height the corridor came out nearly square,
            // the floor art stretched to fit it, and the toys had to be
            // enormous to fill it. Freed height goes to the standings.
            height: 'clamp(230px, 32vh, 300px)',
            // Fog used to darken (brightness 0.85), which read as atmosphere on a
            // black background and as "the whole scene is faded" on a lit one.
            // Lift and desaturate instead.
            filter: raceData?.weather === 'foggy' ? 'blur(0.4px) saturate(0.8) brightness(1.04)' : undefined,
          }}
        />

        {/* Weather visual overlay */}
        {raceData?.weather === 'rainy' && (
          <div className="absolute inset-0 bg-brand-ink/10 pointer-events-none" />
        )}
        {raceData?.weather === 'stormy' && (
          <div className="absolute inset-0 bg-red-500/8 pointer-events-none animate-pulse" />
        )}
        {raceData?.weather === 'foggy' && (
          <div className="absolute inset-0 bg-brand-shelf/10 pointer-events-none" />
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

      {/* Item controls.
          `hinder` names its victim. It used to land on whoever happened to be
          leading, which looked like a decision and was not one — the game chose
          the target and the player only chose a moment. Choosing who is the
          decision: slow the leader, or slow the one closing on you. The server
          still chooses the tick, because a client-chosen one could land in a
          moment the player had already watched. */}
      {!raceFinished && playerRacerId && (address || previewWallet) && itemsLeft.length > 0 && (() => {
        const wallet = address ?? previewWallet
        const canDeploy = Boolean(wallet)
        const mine = livePositions.find(p => p.id === playerRacerId)
        const targets = livePositions.filter(p => p.id !== playerRacerId)

        async function send(code: 'boost' | 'hinder', targetId?: number) {
          if (!id || !playerRacerId || !wallet) return
          setDeploying(true)
          try {
            await api.deployItem(id, playerRacerId, wallet, code, targetId)
            await refreshSimulation()
            setItemsLeft(prev => {
              const next = [...prev]
              next.splice(next.indexOf(code), 1)
              return next
            })
            setItemStock(v => Math.max(0, v - 1))
            toast.success(`${THEME.items[code].name} away!`)
          } catch (err: any) {
            toast.error(err.message)
          }
          setDeploying(false)
          setAimingAt(null)
        }

        return (
          <div className="mb-4">
            <div className="flex gap-3">
              {(['boost', 'hinder'] as const).map(code => {
                const count = itemsLeft.filter(c => c === code).length
                if (count === 0) return null
                const arming = aimingAt === code
                return (
                  <button
                    key={code}
                    type="button"
                    disabled={deploying || !canDeploy}
                    title={canDeploy ? undefined : 'Connect a wallet to deploy items'}
                    data-testid={`item-${code}`}
                    onClick={() => {
                      if (code === 'boost') { void send('boost'); return }
                      setAimingAt(arming ? null : 'hinder')
                    }}
                    className={`toy-btn flex-1 py-3 px-4 ${
                      !canDeploy ? 'bg-brand-shelf text-brand-dust cursor-not-allowed'
                      : arming ? 'bg-brand-accent text-brand-surface'
                      : 'bg-brand-gold text-brand-ink'
                    }`}
                  >
                    {arming ? 'Pick a target' : THEME.items[code].name}
                    {count > 1 && <span className="ml-2 text-sm">{'\u00D7'}{count}</span>}
                    {!arming && canDeploy && (
                      // Items are a stock the racer carries between races now,
                      // so the button has to say what pressing it costs. "Last
                      // one" is the whole reason the decision exists.
                      <span className="block text-[10px] font-normal opacity-70">
                        {itemStock === 1
                          ? 'your last one \u00B7 lands ~' + (ITEM_DELAY_TICKS / TICKS_PER_SECOND).toFixed(0) + 's later'
                          : `${itemStock} in stock \u00B7 lands ~${(ITEM_DELAY_TICKS / TICKS_PER_SECOND).toFixed(0)}s later`}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {aimingAt === 'hinder' && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {targets.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={deploying}
                    data-testid={`target-${t.id}`}
                    onClick={() => void send('hinder', t.id)}
                    className="toy-panel px-2 py-2 text-left"
                  >
                    <span
                      className="block h-1 w-8 rounded-full mb-1"
                      style={{ backgroundColor: t.color }}
                    />
                    <span className="block text-brand-ink text-xs font-semibold truncate">{t.name}</span>
                    <span className="block text-brand-dust text-[10px]">
                      {(() => {
                        // Relative to the player, not to the leader — "18m
                        // ahead of you" is the number that decides who to hit.
                        const d = Math.round(t.distance - (mine?.distance ?? 0))
                        if (t.gap === 0) return d > 0 ? `leader, +${d}m` : 'leader'
                        return d >= 0 ? `+${d}m ahead` : `${-d}m behind`
                      })()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Live standings.
          Gap in metres, not a percentage. "47%" answers neither question a
          viewer has — how much is left, and is this close? The lane colour
          runs down the left edge so a row and its lane are the same object,
          and a change of place flashes on the row that changed. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        {livePositions.map((pos, i) => (
          <motion.div
            key={pos.id}
            layout
            // The flash is an inset shadow, not a background. Animating
            // backgroundColor here wrote an inline transparent fill over
            // .toy-panel's own surface and the whole row went see-through on
            // top of the drawn room — unreadable, and only visible by looking.
            animate={{
              boxShadow:
                pos.move < 0 ? 'inset 0 0 0 999px rgba(46,125,79,0.16), 0 4px 0 0 var(--color-brand-ink)'
                : pos.move > 0 ? 'inset 0 0 0 999px rgba(194,67,78,0.14), 0 4px 0 0 var(--color-brand-ink)'
                : 'inset 0 0 0 999px rgba(0,0,0,0), 0 4px 0 0 var(--color-brand-ink)',
            }}
            transition={{ duration: 0.45 }}
            className="toy-panel flex items-center gap-3 py-2 pr-3 pl-0 overflow-hidden"
          >
            <span
              className="self-stretch w-2 shrink-0"
              style={{ backgroundColor: pos.color }}
              aria-hidden
            />
            <span className="text-xl font-extrabold w-6 text-center" style={{ color: pos.color }}>
              {i + 1}
            </span>
            <span className="w-4 text-center text-sm" aria-hidden>
              {pos.move < 0 ? '\u25B2' : pos.move > 0 ? '\u25BC' : ''}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-brand-ink font-semibold text-sm truncate">
                {pos.name}
                {pos.isBot && <span className="text-brand-dust font-normal text-xs ml-1.5">BOT</span>}
              </p>
              <p className="text-brand-dust text-xs tabular-nums">
                {pos.toGo}m to go {i === 0 ? '\u00B7 leader' : `\u00B7 ${pos.gap}m back`}
              </p>
            </div>
            {/* What this place is worth.
                Finishing position already decides WHICH stat grows — 1st feeds
                SPD, 2nd ACC, 3rd STA, 4th REF (routes/race.ts POSITION_STAT) —
                so pressing a boost to move from second to first is buying SPD
                rather than buying a place. That was true before any of this and
                the game said it nowhere: not on this screen, not in the lobby,
                not in the guide. An item nobody knows the price of is an item
                nobody has a reason to spend. */}
            <span className="shrink-0 text-right">
              {POSITION_STAT[i + 1] && (
                // Dimmed on a bot's row. The number is what the PLACE pays, and
                // a player in second needs to see what first is worth — but a
                // bot earns nothing (it is not competing for anything), so on
                // its row the same figure must not read as being collected.
                <span
                  className={`block text-[11px] font-bold tabular-nums ${
                    pos.isBot ? 'text-brand-dust/50' : 'text-brand-ink'
                  }`}
                >
                  +{PER_RACE_STAT_GAIN.toFixed(1)} {POSITION_STAT[i + 1]}
                </span>
              )}
              <span className="block text-brand-dust text-xs tabular-nums">
                {Math.round(pos.speed * TICKS_PER_SECOND)} m/s
              </span>
            </span>
          </motion.div>
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
          // The frames actually animated, which after an item deploy are not
          // the ones raceData was first loaded with. Max speed and the MVP
          // awards are computed from these, so they have to agree with the
          // podium above them.
          const frames: RaceFrame[] = framesRef.current.length ? framesRef.current : (raceData.frames || [])

          // Max speed per racer
          const maxSpeeds: Record<number, number> = {}
          for (const f of frames) {
            for (const p of f.positions) {
              maxSpeeds[p.id] = Math.max(maxSpeeds[p.id] || 0, p.speed)
            }
          }


          // "Peki Ya" — find the closest loser to the winner
          const winner = raceData.finalOrder[0]
          // Only the player's own near miss is worth a "what if". Second place
          // being close to first says nothing to a reader who came fourth, and
          // says something actively wrong to one who came first.
          const playerEntry = playerRacerId
            ? raceData.finalOrder.find((f: any) => f.id === playerRacerId)
            : undefined
          const playerLostNarrowly = Boolean(
            playerEntry && winner && playerEntry.id !== winner.id &&
            playerEntry.finishTick != null && winner.finishTick != null &&
            (playerEntry.finishTick - winner.finishTick) / 10 <= 1.5
          )
          const gapSeconds =
            playerEntry?.finishTick != null && winner?.finishTick != null
              ? (playerEntry.finishTick - winner.finishTick) / 10
              : null

          // ====== MVP Awards Computation ======
          const gridPositions = raceData.gridPositions || []
          const finalOrder: FinalOrder[] = raceData.finalOrder || []
          const names = new Map<number, string>()
          gridPositions.forEach((gp: any) => {
      names.set(gp.id, racerDisplayName(gp.name, gp.race))
      // `race` is the archetype code on the racer row — speedster / tank /
      // trickster / burst. Bots carry it too, so a lane of four reads as four
      // different toys rather than four Tinbots.
      if (gp.race) archetypeRef.current[gp.id] = gp.race
      if (gp.rarity) rarityRef.current[gp.id] = gp.rarity
    })
    raceData.finalOrder?.forEach((fo: any) => {
      if (fo.race && !archetypeRef.current[fo.id]) archetypeRef.current[fo.id] = fo.race
    })
          finalOrder.forEach((fo: FinalOrder) => { if (!names.has(fo.id)) names.set(fo.id, racerDisplayName(fo.name, (fo as any).race ?? archetypeRef.current[fo.id])) })

          // MVP 1: "Best Overtake" — Most positions gained (grid start → final)
          let bestClimber = { id: 0, name: '', gain: -99 }
          for (const fo of finalOrder) {
            const startPos = gridPositions.findIndex((gp: any) => gp.id === fo.id) + 1
            const endPos = fo.position
            const gain = startPos - endPos // positive = climbed up
            if (gain > bestClimber.gain) {
              bestClimber = { id: fo.id, name: racerDisplayName(fo.name, (fo as any).race ?? archetypeRef.current[fo.id]), gain }
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
            mvpAwards.push({ emoji: '\u{26A1}', title: 'Speed Demon', name: speedDemon.name, detail: `Max ${Math.round(speedDemon.speed * TICKS_PER_SECOND)} m/s` })
          }
          if (comebackKing) {
            mvpAwards.push({ emoji: '\u{1F451}', title: 'Comeback King', name: comebackKing.name, detail: `From P${comebackKing.worstPos} to top 2!` })
          }

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-50 overflow-y-auto bg-brand-bg"
            >
              <div className="max-w-2xl mx-auto px-4 py-8">
                {/* Podium.
                    The whole trade is settled here. During the race the toys are
                    small on purpose — the speed readouts carry the reading — so
                    the finish is where they finally get to be large. Gigling does
                    exactly this: tiny for twenty seconds, enormous at the line.

                    Times are gaps, not absolutes: "+0.4s" says the race was close,
                    "23.1s" says nothing without doing the arithmetic yourself. */}
                {(() => {
                  // Prefer the settled result over the one fetched before the
                  // player touched anything. Deploying an item changes the
                  // outcome, and the podium used to replay the pre-item race —
                  // so a boost that won you the race showed you losing it.
                  const order = (finalOrderRef.current ?? raceData.finalOrder) as FinalOrder[]
                  const winTick = order[0]?.finishTick ?? 0
                  const RANK_LABEL = ['1.', '2.', '3.']
                  const RANK_TINT = ['bg-brand-gold', 'bg-brand-shelf', 'bg-brand-accent/60']
                  return (
                    <div className="mb-8">
                      <div className="space-y-3">
                        {order.slice(0, 3).map((fo, i) => (
                          <motion.div
                            key={fo.id}
                            initial={{ x: i % 2 ? 60 : -60, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.15 + i * 0.25, type: 'spring', stiffness: 120 }}
                            className="relative"
                          >
                            <div className={`toy-panel flex items-center gap-4 pl-4 pr-5 ${i === 0 ? 'py-7' : 'py-4'}`}>
                              <span className={`shrink-0 rounded-lg border-[3px] border-brand-ink px-3 ${RANK_TINT[i]} ${i === 0 ? 'text-3xl py-1' : 'text-xl'} font-extrabold text-brand-ink`}>
                                {RANK_LABEL[i]}
                              </span>
                              <div className="w-16 sm:w-20 shrink-0 -my-1 flex justify-center">
                                <RacerPortrait
                                  archetype={(fo as any).race ?? archetypeRef.current[fo.id]}
                                  rarity={(fo as any).rarity ?? rarityRef.current[fo.id]}
                                  height={i === 0 ? 104 : 70}
                                  still
                                />
                              </div>
                              <div className="flex-1 min-w-0 text-left">
                                <p className={`text-brand-ink font-semibold truncate ${i === 0 ? 'text-xl' : ''}`}>
                                  {racerDisplayName(fo.name, (fo as any).race ?? archetypeRef.current[fo.id])}
                                </p>
                                <p className="text-brand-dust text-xs">
                                  {fo.isBot ? 'BOT' : 'Player'} · top {Math.round((maxSpeeds[fo.id] || 0) * TICKS_PER_SECOND)} m/s
                                </p>
                              </div>
                              <span className={`shrink-0 tabular-nums font-bold ${i === 0 ? 'text-brand-gold text-xl' : 'text-brand-dust'}`}>
                                {fo.finishTick == null
                                  ? '—'
                                  : i === 0
                                    ? `${(fo.finishTick / 10).toFixed(2)}s`
                                    : `+${((fo.finishTick - winTick) / 10).toFixed(2)}s`}
                              </span>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      {order.length > 3 && (
                        <div className="toy-panel mt-3 divide-y-2 divide-brand-ink/10">
                          {order.slice(3).map((fo, k) => (
                            <div key={fo.id} className="flex items-center gap-3 px-4 py-2">
                              <span className="text-brand-dust font-bold w-6">{k + 4}.</span>
                              <span className="flex-1 text-brand-ink text-sm truncate">{racerDisplayName(fo.name, (fo as any).race ?? archetypeRef.current[fo.id])}</span>
                              <span className="text-brand-dust text-xs tabular-nums">
                                {fo.finishTick == null ? '—' : `+${((fo.finishTick - winTick) / 10).toFixed(2)}s`}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* "Peki Ya" section */}
                {playerLostNarrowly && gapSeconds != null && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1 }}
                    className="bg-brand-accent/10 border border-brand-accent/30 rounded-xl p-4 mb-6"
                  >
                    <h3 className="text-brand-accent font-bold text-sm mb-2">What If...?</h3>
                    <p className="text-brand-ink/80 text-sm">
                      You finished <span className="text-brand-gold font-bold">{gapSeconds.toFixed(2)}s</span> behind.
                      {' One item held back a little longer could have taken it.'}
                    </p>
                  </motion.div>
                )}

                {/* What the race did to the racer.
                    This is the only screen where a player finds out, and until
                    now it said nothing at all — so a racer that had spent its
                    daily budget looked identical to one the game had forgotten
                    about. The cap is a rule; a rule the player cannot see is
                    indistinguishable from a bug. */}
                {statAward && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55 }}
                    className="toy-panel px-4 py-3 mb-6"
                  >
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-brand-ink font-bold text-sm">
                        {statAward.gain > 0
                          ? `+${statAward.gain.toFixed(1)} ${statAward.stat.toUpperCase()}`
                          : 'No gain from this race'}
                      </span>
                      <span className="text-brand-dust text-xs tabular-nums">
                        {statAward.dayTotal.toFixed(1)} / {statAward.dayCap.toFixed(1)} today
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-brand-ink/10 overflow-hidden border-2 border-brand-ink">
                      <div
                        className="h-full bg-brand-gold"
                        style={{ width: `${Math.min(100, (statAward.dayTotal / statAward.dayCap) * 100)}%` }}
                      />
                    </div>
                    {statAward.gain === 0 && (
                      <p className="text-brand-dust text-[11px] mt-2">
                        {statAward.dayTotal >= statAward.dayCap
                          ? 'This racer has used up today. The cap resets at midnight.'
                          : 'This stat is already at its ceiling for this tier and rarity.'}
                      </p>
                    )}
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
                          className="bg-brand-surface border-2 border-brand-gold/40 rounded-xl p-3 text-center"
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
                        .map((fo: FinalOrder, i: number) => `${i + 1}. ${racerDisplayName(fo.name, (fo as any).race ?? archetypeRef.current[fo.id])}`)
                        .join('\n')
                      const frameUrl = `https://app.winduprush.xyz/api/social/frame/${id}`
                      const text = `${THEME.brand.mark} ${THEME.brand.name} Race Result!\n\n\u{1F3C6} ${racerDisplayName(winner?.name, (winner as any)?.race ?? archetypeRef.current[winner?.id])} WINS!\n\n${standings}\n\n${frameUrl}`
                      // Every branch has to say something. The clipboard write
                      // throws whenever permission has not been granted, and
                      // the throw took the toast with it — so the button did
                      // nothing at all, visibly.
                      if (navigator.share) {
                        try {
                          await navigator.share({ title: `${THEME.brand.name} Race Result`, text })
                          return
                        } catch { /* fall through to the clipboard */ }
                      }
                      try {
                        await navigator.clipboard.writeText(text)
                        toast.success('Result copied to clipboard!')
                      } catch {
                        toast.error('Could not copy — your browser blocked it.')
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
