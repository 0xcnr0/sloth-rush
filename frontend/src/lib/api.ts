const BASE_URL = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json()
  if (!res.ok) {
    const message = data.error || 'Something went wrong'
    // Provide friendlier messages for common errors
    if (res.status === 429) throw new Error('Too many requests. Please wait a moment and try again.')
    if (res.status === 503) throw new Error('Server is temporarily unavailable. Please try again later.')
    throw new Error(message)
  }
  return data
}

// Racer endpoints
export const api = {
  mintRacer: (wallet: string) =>
    request<{ racer: any }>('/racer/mint', {
      method: 'POST',
      body: JSON.stringify({ wallet }),
    }),

  upgradeRacer: (wallet: string) =>
    request<{ racer: any; burnedRacerId: number; coinBonus: number }>('/racer/upgrade', {
      method: 'POST',
      body: JSON.stringify({ wallet }),
    }),

  getCollection: (wallet: string) =>
    request<{ racers: any[]; coinBalance: number }>(`/racer/collection/${wallet}`),

  getCoinBalance: (wallet: string) =>
    request<{ wallet: string; balance: number }>(`/racer/coin/${wallet}`),

  getStreaks: (wallet: string) =>
    request<{ streaks: { racer_id: number; current_wins: number; max_wins: number; current_losses: number; total_races: number; total_wins: number }[] }>(
      `/racer/streaks/${wallet}`
    ),

  renameRacer: (wallet: string, racerId: number, name: string) =>
    request<{ renamed: boolean; racerId: number; newName: string }>('/racer/rename', {
      method: 'POST',
      body: JSON.stringify({ wallet, racerId: racerId, name }),
    }),

  // Race endpoints
  createRace: (wallet: string, racerId: number, format: string = 'standard') =>
    request<{ raceId: string; format: string; entryFee: number; maxTune: number; status: string }>(
      '/race/create',
      { method: 'POST', body: JSON.stringify({ wallet, racerId: racerId, format }) }
    ),

  joinRace: (raceId: string, racerId: number, wallet: string) =>
    request<{ joined: boolean; raceId: string; entryFeeCharged: number; newBalance: number }>(
      '/race/join',
      { method: 'POST', body: JSON.stringify({ raceId, racerId: racerId, wallet }) }
    ),

  startTuning: (raceId: string) =>
    request<{ raceId: string; status: string; botsAdded: number }>(
      '/race/start-tuning',
      { method: 'POST', body: JSON.stringify({ raceId }) }
    ),

  // --- Wind-Up phase (docs/WIND_UP_PHASE.md) -------------------------------
  // Two calls, one per end of the hold. The server stamps its own arrival times
  // and uses them as a ceiling; see releaseWind for why the client sends a
  // duration rather than a timestamp.
  startWind: (raceId: string, wallet: string) =>
    request<{
      raceId: string
      winding?: boolean
      alreadyWinding?: boolean
      /** Approximate band only — the exact Safe Wind line is never sent (§9). */
      safeWindBand?: { low: number; high: number }
      fullWindMs?: number
      windowRemainingMs?: number
    }>('/race/wind/start', { method: 'POST', body: JSON.stringify({ raceId, wallet }) }),

  /**
   * `heldMs` is a duration measured with performance.now(), NOT a timestamp:
   * monotonic, needs no clock sync, and unaffected by the user's system clock.
   * The server caps it at the window it observed plus one round trip, so time
   * that never elapsed cannot be claimed while an honest slow connection keeps
   * the tension it earned (§9).
   */
  releaseWind: (raceId: string, wallet: string, heldMs: number) =>
    request<{
      raceId: string
      tension: number
      /** Server values, verified end to end: under / over / snapped. */
      band: 'under' | 'over' | 'snapped'
      snapped: boolean
      holdMs: number
      locked: boolean
    }>('/race/wind/release', {
      method: 'POST',
      body: JSON.stringify({ raceId, wallet, heldMs: Math.round(heldMs) }),
    }),

  simulateRace: (raceId: string) =>
    request<{
      raceId: string
      seed: string
      resultHash: string
      gridPositions: { id: number; name: string; position: number }[]
      frames: { tick: number; positions: { id: number; distance: number; speed: number; event?: string }[] }[]
      events: { tick: number; type: string; description: string; affectedIds: number[] }[]
      finalOrder: { id: number; wallet: string; name: string; isBot: boolean; position: number; reward: number }[]
      totalPrizePool: number
      trackLength: number
    }>('/race/simulate', {
      method: 'POST',
      body: JSON.stringify({ raceId }),
    }),

  submitAction: (raceId: string, wallet: string, racerId: number, actionType: 'boost' | 'projectile', tick: number) =>
    request<{ raceId: string; actionType: string; tick: number; cost: number; newBalance: number }>(
      '/race/action',
      { method: 'POST', body: JSON.stringify({ raceId, wallet, racerId: racerId, actionType, tick }) }
    ),

  getRace: (raceId: string) =>
    request<any>(`/race/${raceId}`),

  createGP: () =>
    request<{ gpId: string; qualifyRaceId: string; finalRaceId: string; stage: string; entryFee: number; maxTune: number }>(
      '/race/gp/create',
      { method: 'POST', body: JSON.stringify({}) }
    ),

  advanceGP: (qualifyRaceId: string) =>
    request<{ finalRaceId: string; qualifiers: any[]; stage: string }>(
      '/race/gp/advance',
      { method: 'POST', body: JSON.stringify({ qualifyRaceId }) }
    ),

  getGDAPrices: (raceId: string, tick: number) =>
    request<{ boostPrice: number; projectilePrice: number; boostPurchases: number; projectilePurchases: number }>(
      `/race/${raceId}/prices?tick=${tick}`
    ),

  // Shop endpoints
  getShopPackages: () =>
    request<{ packages: { id: string; name: string; price: number; coins: number; bonus: number }[] }>(
      '/shop/packages'
    ),

  buyCoins: (wallet: string, packageId: string) =>
    request<{ purchased: boolean; package: any; coinsAdded: number; newBalance: number }>(
      '/shop/buy-coins',
      { method: 'POST', body: JSON.stringify({ wallet, packageId }) }
    ),

  // Race history
  getRaceHistory: (wallet: string) =>
    request<{ races: any[]; summary: { totalRaces: number; winRate: number; totalEarnings: number } }>(
      `/race/history/${wallet}`
    ),

  // Daily login bonus
  claimDailyLogin: (wallet: string) =>
    request<{ claimed: boolean; bonus?: number; newBalance?: number; message?: string }>(
      '/racer/daily-login',
      { method: 'POST', body: JSON.stringify({ wallet }) }
    ),

  // XP
  getXP: (wallet: string) =>
    request<{ wallet: string; xp: number }>(`/racer/xp/${wallet}`),

  // Quests
  getDailyQuests: (wallet: string) =>
    request<{ quests: { id: number; title: string; description: string; requirement_type: string; coin_reward: number; xp_reward: number; progress: number; requirement_value: number; completed: boolean }[] }>(
      `/quests/daily/${wallet}`
    ),

  trackQuestProgress: (wallet: string, type: string) =>
    request<{ updated: boolean }>('/quests/progress', {
      method: 'POST',
      body: JSON.stringify({ wallet, requirementType: type }),
    }),

  // Upgrade progress (free path)
  getUpgradeProgress: (wallet: string) =>
    request<{ xp: number; races: number; wins: number; loginDays: number; requirements: { xp: number; races: number; wins: number; loginDays: number }; eligible: boolean }>(
      `/racer/upgrade-progress/${wallet}`
    ),

  freeUpgrade: (wallet: string) =>
    request<{ racer: any; burnedRacerId: number; coinBonus: number }>('/racer/free-upgrade', {
      method: 'POST',
      body: JSON.stringify({ wallet }),
    }),

  // Leaderboard
  getLeaderboard: (league: string) =>
    request<{ leaderboard: { rank: number; wallet: string; racer_name: string; rarity: string; total_rp: number }[] }>(
      `/leaderboard/${league}`
    ),

  getMyRanking: (wallet: string) =>
    request<{ rank: number; wallet: string; total_rp: number } | null>(
      `/leaderboard/me/${wallet}`
    ),

  // Training
  startTraining: (wallet: string, racerId: number, stat: string) =>
    request<{ started: boolean; racerId: number; stat: string; completedAt: string }>('/racer/train', {
      method: 'POST',
      body: JSON.stringify({ wallet, racerId: racerId, stat }),
    }),

  claimTraining: (wallet: string, racerId: number) =>
    request<{ claimed: boolean; racerId: number; stat: string; gain: number; newStatValue: number }>('/racer/claim-training', {
      method: 'POST',
      body: JSON.stringify({ wallet, racerId: racerId }),
    }),

  getTrainingStatus: (wallet: string) =>
    request<{ trainings: { racerId: number; racerName: string; stat: string; startedAt: string; completedAt: string; isReady: boolean }[]; weeklyCounts?: Record<number, number> }>(
      `/racer/training-status/${wallet}`
    ),

  // Weekly & Milestone quests
  getWeeklyQuests: (wallet: string) =>
    request<{ quests: { id: number; title: string; description: string; requirement_type: string; coin_reward: number; xp_reward: number; progress: number; requirement_value: number; completed: boolean }[] }>(
      `/quests/weekly/${wallet}`
    ),

  getMilestones: (wallet: string) =>
    request<{ quests: { id: number; title: string; description: string; requirement_type: string; coin_reward: number; xp_reward: number; progress: number; requirement_value: number; completed: boolean }[] }>(
      `/quests/milestones/${wallet}`
    ),

  // Daily race
  getDailyRace: () =>
    request<{ raceId: string; weather: string; date: string; isNew?: boolean }>('/race/daily'),

  // Mini games
  playMiniGame: (wallet: string, racerId: number, gameType: string, score: number) =>
    request<{ gain: number; newStatValue: number; stat: string }>('/racer/mini-game', {
      method: 'POST',
      body: JSON.stringify({ wallet, racerId: racerId, gameType, score }),
    }),

  // Evolution
  getEvolutionProgress: (racerId: number) =>
    request<{ tier: number; evolutionPath: string | null; passive: string | null; requirements: any; progress: any; eligible: boolean }>(
      `/racer/evolution-progress/${racerId}`
    ),

  evolve: (wallet: string, racerId: number, path?: string) =>
    request<{ evolved: boolean; tier: number; evolutionPath: string | null; passive: string | null }>('/racer/evolve', {
      method: 'POST',
      body: JSON.stringify({ wallet, racerId: racerId, path }),
    }),

  // Cosmetics
  getShopCosmetics: (wallet?: string) =>
    request<{ cosmetics: any[] }>(`/shop/cosmetics${wallet ? `?wallet=${wallet}` : ''}`),

  buyCosmetic: (wallet: string, cosmeticId: number) =>
    request<{ purchased: boolean; newBalance: number }>('/shop/buy-cosmetic', {
      method: 'POST',
      body: JSON.stringify({ wallet, cosmeticId }),
    }),

  equipCosmetic: (wallet: string, racerId: number, cosmeticId: number) =>
    request<{ equipped: boolean }>('/racer/equip-cosmetic', {
      method: 'POST',
      body: JSON.stringify({ wallet, racerId: racerId, cosmeticId }),
    }),

  // Accessories
  getShopAccessories: (wallet?: string) =>
    request<{ accessories: any[] }>(`/shop/accessories${wallet ? `?wallet=${wallet}` : ''}`),

  buyAccessory: (wallet: string, accessoryId: number) =>
    request<{ purchased: boolean; newBalance: number }>('/shop/buy-accessory', {
      method: 'POST',
      body: JSON.stringify({ wallet, accessoryId }),
    }),

  equipAccessory: (wallet: string, racerId: number, accessoryId: number) =>
    request<{ equipped: boolean }>('/racer/equip-accessory', {
      method: 'POST',
      body: JSON.stringify({ wallet, racerId: racerId, accessoryId }),
    }),

  unequipAccessory: (wallet: string, racerId: number) =>
    request<{ unequipped: boolean }>('/racer/unequip-accessory', {
      method: 'POST',
      body: JSON.stringify({ wallet, racerId: racerId }),
    }),

  // Profile
  getProfile: (wallet: string) =>
    request<{ wallet: string; balance: number; xp: number; totalRaces: number; totalWins: number; totalEarnings: number; loginDays: number; freeRacerCount: number; racerCount: number }>(
      `/racer/profile/${wallet}`
    ),

  getProfileTransactions: (wallet: string) =>
    request<{ transactions: { type: string; amount: number; description: string; created_at: string }[] }>(
      `/racer/profile/transactions/${wallet}`
    ),

  // Race replay
  getRaceReplay: (raceId: string) =>
    request<{ replay: any }>(`/race/${raceId}/replay`),

  getActiveRaces: () =>
    request<{ races: any[] }>('/race/active'),

  // Season
  getCurrentSeason: () =>
    request<{ season: any }>('/season/current'),

  // Leaderboard extras
  getCareerLeaderboard: () =>
    request<{ leaderboard: any[] }>('/leaderboard/career'),

  getHallOfFame: () =>
    request<{ entries: any[] }>('/leaderboard/hall-of-fame'),

  getGPLeaderboard: (gpType: string) =>
    request<{ leaderboard: any[] }>(`/leaderboard/gp/${gpType}`),

  // Referral
  generateReferralCode: (wallet: string) =>
    request<{ code: string; link: string }>('/social/referral/generate', {
      method: 'POST',
      body: JSON.stringify({ wallet }),
    }),

  getReferralCode: (wallet: string) =>
    request<{ code: string | null; link?: string }>(`/social/referral/code/${wallet}`),

  applyReferralCode: (wallet: string, code: string) =>
    request<{ applied: boolean; referrerRewarded: boolean }>('/social/referral/apply', {
      method: 'POST',
      body: JSON.stringify({ wallet, code }),
    }),

  getReferralStats: (wallet: string) =>
    request<{ totalReferrals: number; totalRewarded: number; totalEarned: number; code: string | null }>(
      `/social/referral/stats/${wallet}`
    ),

  // Feedback endpoints (Sprint 6)
  submitFeedback: (wallet: string, category: string, text: string, rating: number) =>
    request<{ submitted: boolean; feedback: any; message: string }>('/feedback/submit', {
      method: 'POST',
      body: JSON.stringify({ wallet, category, text, rating }),
    }),

  getMyFeedback: (wallet: string) =>
    request<{ feedbacks: any[] }>(`/feedback/my/${wallet}`),

  getFeedbackStats: () =>
    request<{ total: number; avgRating: number; categories: any[]; statusBreakdown: any[] }>('/feedback/stats'),

  getFeedbackEligibility: (wallet: string) =>
    request<{ eligible: boolean; racesCompleted: number; racesRequired: number; feedbackToday: number; feedbackLimit: number; canSubmit: boolean }>(
      `/feedback/eligibility/${wallet}`
    ),

  getCommunityFeedback: (page: number = 1, sort: string = 'date', category?: string, status?: string) =>
    request<{ feedbacks: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      `/feedback/community?page=${page}&sort=${sort}${category ? `&category=${category}` : ''}${status ? `&status=${status}` : ''}`
    ),

  upvoteFeedback: (feedbackId: number, wallet: string) =>
    request<{ upvoted: boolean; feedbackId: number; upvotes: number }>(`/feedback/${feedbackId}/upvote`, {
      method: 'POST',
      body: JSON.stringify({ wallet }),
    }),

  getTrendingFeedback: () =>
    request<{ trending: any[] }>('/feedback/trending'),

  getLatestReport: () =>
    request<{ report: any }>('/feedback/report/latest'),

  getFeedbackReport: (weekId: number) =>
    request<{ report: any }>(`/feedback/report/${weekId}`),

  triggerAnalysis: () =>
    request<{ analyzed: number; total: number }>('/feedback/analyze', { method: 'POST' }),

  generateReport: () =>
    request<{ generated: boolean; report: any }>('/feedback/report/generate', { method: 'POST' }),
}
