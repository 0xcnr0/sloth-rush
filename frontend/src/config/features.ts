/**
 * MVP Feature Flags — Runtime Hostname Detection
 *
 * Demo mode (slothrush.xyz, *.vercel.app): Only core features (mint + race)
 * Dev mode (app.slothrush.xyz, localhost): All features enabled
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
  training: !MVP_MODE,   // Hide in MVP
  evolution: !MVP_MODE,  // Hide in MVP
  miniGames: !MVP_MODE,  // Hide in MVP
  quests: !MVP_MODE,     // Hide in MVP
  grandPrix: !MVP_MODE,  // Hide in MVP
  tacticRace: !MVP_MODE, // Hide in MVP
  spectate: !MVP_MODE,   // Hide in MVP
  replay: !MVP_MODE,     // Hide in MVP
  profile: !MVP_MODE,    // Hide in MVP
  accessories: !MVP_MODE,// Hide in MVP
  cosmetics: !MVP_MODE,  // Hide in MVP
} as const
