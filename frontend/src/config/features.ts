/**
 * MVP Feature Flags
 * Set MVP_MODE = false to enable all features
 */
export const MVP_MODE = true

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
