/**
 * MVP Feature Flags — Runtime Hostname Detection
 *
 * Demo mode (slothrush.xyz, *.vercel.app): Only core features (mint + race)
 * Dev mode (app.slothrush.xyz, localhost): All features enabled
 *
 * Mini App detection is handled separately in lib/farcaster.ts (async).
 * Use isInFarcasterMiniApp() from that module for Mini App context checks.
 */

function isMvpMode(): boolean {
  if (typeof window === 'undefined') return true

  const hostname = window.location.hostname

  // Full features on app subdomain and localhost
  if (hostname === 'app.slothrush.xyz') return false
  if (hostname === 'localhost' || hostname === '127.0.0.1') return false

  // Everything else is MVP/demo mode (slothrush.xyz, Vercel preview URLs, etc.)
  return true
}

export const MVP_MODE = isMvpMode()

export const FEATURES = {
  mint: true,            // Always on
  race: true,            // Always on
  leaderboard: true,     // Always on
  treehouse: true,       // Always on
  guide: true,           // Always on

  shop: !MVP_MODE,       // Hide in MVP
  training: true,         // Always on
  evolution: !MVP_MODE,  // Hide in MVP
  miniGames: !MVP_MODE,  // Hide in MVP
  quests: true,           // Always on
  grandPrix: !MVP_MODE,  // Hide in MVP
  tacticRace: !MVP_MODE, // Hide in MVP
  spectate: true,        // Always on — demo badge shown in MVP
  replay: true,           // Always on
  profile: true,          // Always on
  accessories: !MVP_MODE,// Hide in MVP
  cosmetics: !MVP_MODE,  // Hide in MVP
  demoRace: MVP_MODE,    // Demo race format in MVP mode
} as const
