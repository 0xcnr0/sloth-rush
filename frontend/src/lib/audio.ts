// Procedural sound effects using Web Audio API — no audio files needed!

let audioCtx: AudioContext | null = null
let muted = false

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

export function isMuted(): boolean { return muted }
export function setMuted(m: boolean) { muted = m }
export function toggleMute(): boolean { muted = !muted; return muted }

// --- Helper: play a tone with envelope ---
function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) {
  if (muted) return
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + duration)
}

// --- Helper: noise burst (for shell/crack sounds) ---
function playNoise(duration: number, volume = 0.08) {
  if (muted) return
  const ctx = getCtx()
  const bufferSize = ctx.sampleRate * duration
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1)
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  source.connect(gain)
  gain.connect(ctx.destination)
  source.start()
}

// ==========================================
// PUBLIC SOUND EFFECTS
// ==========================================

/** Race countdown horn — 3 ascending beeps then a long blast */
export function sfxRaceStart() {
  if (muted) return
  const ctx = getCtx()
  const now = ctx.currentTime
  const notes = [440, 440, 440, 880]
  const durations = [0.15, 0.15, 0.15, 0.6]
  const gaps = [0, 0.4, 0.8, 1.2]
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.12, now + gaps[i])
    gain.gain.exponentialRampToValueAtTime(0.001, now + gaps[i] + durations[i])
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now + gaps[i])
    osc.stop(now + gaps[i] + durations[i])
  })
}

/** Boost activation — rising "whoosh" */
export function sfxBoost() {
  if (muted) return
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(200, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.3)
  gain.gain.setValueAtTime(0.1, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + 0.4)
}

/** Shell hit — sharp crack */
export function sfxShellHit() {
  playNoise(0.15, 0.15)
  playTone(120, 0.2, 'square', 0.1)
}

/** Rain starting — soft low rumble */
export function sfxRain() {
  playNoise(1.2, 0.04)
  playTone(80, 1.0, 'sine', 0.05)
}

/** Luck orb — sparkle (two quick high tones) */
export function sfxLuckOrb() {
  playTone(1200, 0.15, 'sine', 0.08)
  setTimeout(() => playTone(1600, 0.2, 'sine', 0.08), 100)
}

/** Slime burst — squishy bubble */
export function sfxSlime() {
  playTone(200, 0.2, 'sine', 0.1)
  setTimeout(() => playTone(150, 0.3, 'sine', 0.08), 100)
}

/** Clash — metallic crash */
export function sfxClash() {
  playNoise(0.1, 0.12)
  playTone(300, 0.15, 'square', 0.1)
  playTone(180, 0.2, 'triangle', 0.08)
}

/** Position overtake — quick ascending beep */
export function sfxOvertake() {
  playTone(600, 0.08, 'sine', 0.06)
  setTimeout(() => playTone(900, 0.1, 'sine', 0.06), 80)
}

/** Dramatic pulse for last 100m — heartbeat rhythm */
export function sfxHeartbeat() {
  if (muted) return
  const ctx = getCtx()
  const now = ctx.currentTime
  // thump-thump pattern
  for (let i = 0; i < 4; i++) {
    const t = now + i * 0.6
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 60
    gain.gain.setValueAtTime(0.15, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.2)

    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.value = 60
    gain2.gain.setValueAtTime(0.1, t + 0.2)
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(t + 0.2)
    osc2.stop(t + 0.4)
  }
}

/** Finish — crowd cheer (noise burst + rising tones) */
export function sfxFinish() {
  if (muted) return
  const ctx = getCtx()
  const now = ctx.currentTime

  // Noise base (crowd)
  const bufferSize = ctx.sampleRate * 1.5
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.5
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer
  const lpFilter = ctx.createBiquadFilter()
  lpFilter.type = 'lowpass'
  lpFilter.frequency.value = 2000
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.08, now)
  gain.gain.linearRampToValueAtTime(0.12, now + 0.3)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5)
  source.connect(lpFilter)
  lpFilter.connect(gain)
  gain.connect(ctx.destination)
  source.start()

  // Victory fanfare (3 rising notes)
  const fanfareNotes = [523, 659, 784]
  fanfareNotes.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    g.gain.setValueAtTime(0.1, now + 0.1 + i * 0.15)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.5 + i * 0.15)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(now + 0.1 + i * 0.15)
    osc.stop(now + 0.6 + i * 0.15)
  })
}

/** Trash talk entrance — playful ping */
export function sfxTrashTalkEntry() {
  playTone(800, 0.1, 'sine', 0.06)
  setTimeout(() => playTone(1000, 0.08, 'sine', 0.05), 60)
}
