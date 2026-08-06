/**
 * MVP Feature Flags — Runtime Hostname Detection
 *
 * Demo mode (winduprush.xyz, *.vercel.app): Only core features (mint + race)
 * Dev mode (app.winduprush.xyz, localhost): All features enabled
 *
 * Mini App detection is handled separately in lib/farcaster.ts (async).
 * Use isInFarcasterMiniApp() from that module for Mini App context checks.
 */

function isMvpMode(): boolean {
  if (typeof window === 'undefined') return true

  const hostname = window.location.hostname

  // Full features on app subdomain and localhost
  if (hostname === 'app.winduprush.xyz') return false
  if (hostname === 'localhost' || hostname === '127.0.0.1') return false

  // Everything else is MVP/demo mode (winduprush.xyz, Vercel preview URLs, etc.)
  return true
}

export const MVP_MODE = isMvpMode()

export const FEATURES = {
  mint: true,            // Always on
  race: true,            // Always on
  leaderboard: true,     // Always on
  collection: true,       // Always on
  guide: true,           // Always on

  shop: !MVP_MODE,       // Hide in MVP
  evolution: !MVP_MODE,  // Hide in MVP
  // OFF everywhere, not hidden-in-MVP, and the difference matters.
  //
  // tacticRace is BROKEN, not deferred. The client submits an action during
  // playback and then re-runs simulateRace, which restarts the race from tick 0
  // with a different outcome — a player leading a race taps boost and watches it
  // begin again. Making it work needs the simulation resolved in batches with
  // actions queued onto a future tick; the engine computes the whole race in one
  // pass and does not assume otherwise. Do not switch this on without that.
  //
  // grandPrix is cut from v1 for scope: a second staged format, no new decision.
  grandPrix: false,
  tacticRace: false,
  spectate: true,        // Always on — demo badge shown in MVP
  replay: true,           // Always on
  profile: true,          // Always on
  accessories: !MVP_MODE,// Hide in MVP
  cosmetics: !MVP_MODE,  // Hide in MVP
  demoRace: MVP_MODE,    // Demo race format in MVP mode
} as const
