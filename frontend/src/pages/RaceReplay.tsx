import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '../lib/api'

const RACER_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#a855f7']

export default function RaceReplay() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [replay, setReplay] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api.getRaceReplay(id)
      .then(d => setReplay(d.replay))
      .catch(err => setError(err.message || 'Failed to load replay'))
      .finally(() => setLoading(false))
  }, [id])

  const frames = replay?.frames || []
  const events = replay?.events || []
  const trackLength = replay?.trackLength || 1000
  const finalOrder = replay?.finalOrder || []
  const totalFrames = frames.length

  const play = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (currentFrame >= totalFrames - 1) setCurrentFrame(0)
    setPlaying(true)
    intervalRef.current = setInterval(() => {
      setCurrentFrame(prev => {
        if (prev >= totalFrames - 1) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          setPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, Math.round(80 / speed))
  }, [currentFrame, totalFrames, speed])

  const pause = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setPlaying(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  // Restart interval when speed changes during play
  useEffect(() => {
    if (playing) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(() => {
        setCurrentFrame(prev => {
          if (prev >= totalFrames - 1) {
            if (intervalRef.current) clearInterval(intervalRef.current)
            setPlaying(false)
            return prev
          }
          return prev + 1
        })
      }, Math.round(80 / speed))
    }
  }, [speed, playing, totalFrames])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400">Loading replay...</div>
      </div>
    )
  }

  if (error || !replay) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <div className="text-6xl mb-4">{'\u{1F4FC}'}</div>
        <p className="text-gray-400 mb-4">{error || 'Replay not found'}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-2.5 bg-sloth-card border border-sloth-border text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
        >
          Go Back
        </button>
      </div>
    )
  }

  const frameData = frames[currentFrame]
  const positions = frameData?.positions || []
  const sortedPositions = [...positions].sort((a: any, b: any) => b.distance - a.distance)

  // Map id to name from finalOrder or gridPositions
  const nameMap = new Map<number, string>()
  for (const fo of finalOrder) nameMap.set(fo.id, fo.name)
  if (replay.gridPositions) {
    for (const gp of replay.gridPositions) nameMap.set(gp.id, gp.name)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Race Replay</h1>
          <p className="text-gray-400 mt-1">Race #{id}</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 border border-sloth-border text-gray-300 rounded-xl hover:bg-white/5 transition-colors cursor-pointer text-sm"
        >
          Back
        </button>
      </div>

      {/* Race visualization */}
      <div className="bg-sloth-card border border-sloth-border rounded-xl p-4 mb-4">
        <div className="space-y-3">
          {sortedPositions.map((pos: any, i: number) => {
            const pct = Math.min(100, (pos.distance / trackLength) * 100)
            const color = RACER_COLORS[i] || '#6b7280'
            const name = nameMap.get(pos.id) || `Sloth #${pos.id}`
            return (
              <div key={pos.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white text-sm font-semibold">{name}</span>
                  <span className="text-gray-400 text-xs">{pct.toFixed(0)}% | {pos.speed?.toFixed(1)} u/t</span>
                </div>
                <div className="relative h-6 bg-sloth-dark rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: color, width: `${Math.max(2, pct)}%` }}
                    transition={{ duration: 0.08 }}
                  />
                  <div
                    className="absolute top-0 h-full flex items-center"
                    style={{ left: `${Math.max(1, pct - 3)}%` }}
                  >
                    <span className="text-sm">{'\u{1F9A5}'}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Frame counter */}
        <div className="mt-4 text-center text-gray-500 text-xs">
          Frame {currentFrame + 1} / {totalFrames}
          {frameData?.tick !== undefined && <span> (Tick {frameData.tick})</span>}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-sloth-card border border-sloth-border rounded-xl p-4 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={playing ? pause : play}
            className="px-5 py-2 bg-sloth-green text-sloth-dark font-bold rounded-lg hover:bg-sloth-green/90 transition-colors cursor-pointer text-sm"
          >
            {playing ? 'Pause' : currentFrame >= totalFrames - 1 ? 'Replay' : 'Play'}
          </button>

          <button
            onClick={() => { if (playing) pause(); setCurrentFrame(prev => Math.max(0, prev - 1)) }}
            className="px-3 py-2 bg-sloth-dark text-gray-400 hover:text-white rounded-lg cursor-pointer text-sm font-semibold"
          >
            &lt;
          </button>
          <button
            onClick={() => { if (playing) pause(); setCurrentFrame(prev => Math.min(totalFrames - 1, prev + 1)) }}
            className="px-3 py-2 bg-sloth-dark text-gray-400 hover:text-white rounded-lg cursor-pointer text-sm font-semibold"
          >
            &gt;
          </button>

          <div className="flex gap-1">
            {[0.5, 1, 2, 4].map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-3 py-2 rounded-lg font-semibold text-xs cursor-pointer transition-colors ${
                  speed === s
                    ? 'bg-sloth-purple text-white'
                    : 'bg-sloth-dark text-gray-400 hover:text-white'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Seek bar */}
        <input
          type="range"
          min={0}
          max={Math.max(0, totalFrames - 1)}
          value={currentFrame}
          onChange={e => {
            const val = Number(e.target.value)
            setCurrentFrame(val)
            if (playing) pause()
          }}
          className="w-full accent-sloth-green cursor-pointer"
        />
      </div>

      {/* Events feed */}
      <div className="bg-sloth-card border border-sloth-border rounded-xl p-4">
        <h3 className="text-gray-400 text-xs font-bold uppercase mb-3">Event Feed</h3>
        <div className="max-h-48 overflow-y-auto space-y-1.5">
          {events.filter((e: any) => e.tick <= (frameData?.tick ?? 0)).reverse().map((e: any, i: number) => (
            <div
              key={`${e.tick}-${i}`}
              className={`text-xs px-3 py-1.5 rounded-lg ${
                e.tick === frameData?.tick
                  ? 'bg-sloth-green/10 text-sloth-green'
                  : 'text-gray-500'
              }`}
            >
              <span className="text-gray-600 mr-2">[T{e.tick}]</span>
              {e.description}
            </div>
          ))}
          {events.length === 0 && (
            <p className="text-gray-500 text-xs">No events recorded for this race.</p>
          )}
        </div>
      </div>

      {/* Final standings (visible at end) */}
      {currentFrame >= totalFrames - 1 && finalOrder.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 bg-sloth-card border border-sloth-border rounded-xl p-4"
        >
          <h3 className="text-gray-400 text-xs font-bold uppercase mb-3">Final Standings</h3>
          <div className="space-y-2">
            {finalOrder.map((fo: any, i: number) => (
              <div
                key={fo.id}
                className={`flex items-center gap-3 p-2 rounded-lg ${
                  i === 0 ? 'bg-sloth-green/10' : 'bg-sloth-dark/50'
                }`}
              >
                <span className={`font-bold w-6 ${
                  i === 0 ? 'text-sloth-green' : 'text-gray-500'
                }`}>{i + 1}.</span>
                <span className="text-white font-semibold text-sm flex-1">{fo.name}</span>
                {fo.payout > 0 && (
                  <span className="text-sloth-green text-sm font-bold">+{fo.payout} ZZZ</span>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
