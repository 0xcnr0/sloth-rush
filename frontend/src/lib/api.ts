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

// Sloth endpoints
export const api = {
  mintSloth: (wallet: string) =>
    request<{ sloth: any }>('/sloth/mint', {
      method: 'POST',
      body: JSON.stringify({ wallet }),
    }),

  upgradeSloth: (wallet: string) =>
    request<{ sloth: any; burnedSlothId: number; coinBonus: number }>('/sloth/upgrade', {
      method: 'POST',
      body: JSON.stringify({ wallet }),
    }),

  getTreehouse: (wallet: string) =>
    request<{ sloths: any[]; coinBalance: number }>(`/sloth/treehouse/${wallet}`),

  getCoinBalance: (wallet: string) =>
    request<{ wallet: string; balance: number }>(`/sloth/coin/${wallet}`),

  getStreaks: (wallet: string) =>
    request<{ streaks: { sloth_id: number; current_wins: number; max_wins: number; current_losses: number; total_races: number; total_wins: number }[] }>(
      `/sloth/streaks/${wallet}`
    ),

  renameSloth: (wallet: string, slothId: number, name: string) =>
    request<{ renamed: boolean; slothId: number; newName: string }>('/sloth/rename', {
      method: 'POST',
      body: JSON.stringify({ wallet, slothId: slothId, name }),
    }),

  // Race endpoints
  createRace: (wallet: string, slothId: number, format: string = 'standard') =>
    request<{ raceId: string; format: string; entryFee: number; maxRaise: number; status: string }>(
      '/race/create',
      { method: 'POST', body: JSON.stringify({ wallet, slothId: slothId, format }) }
    ),

  joinRace: (raceId: string, slothId: number, wallet: string) =>
    request<{ joined: boolean; raceId: string; entryFeeCharged: number; newBalance: number }>(
      '/race/join',
      { method: 'POST', body: JSON.stringify({ raceId, slothId: slothId, wallet }) }
    ),

  startBidding: (raceId: string) =>
    request<{ raceId: string; status: string; botsAdded: number; skipBidding?: boolean }>(
      '/race/start-bidding',
      { method: 'POST', body: JSON.stringify({ raceId }) }
    ),

  submitBid: (raceId: string, wallet: string, amount: number) =>
    request<{ raceId: string; wallet: string; bidAmount: number }>(
      '/race/bid',
      { method: 'POST', body: JSON.stringify({ raceId, wallet, amount }) }
    ),

  simulateRace: (raceId: string) =>
    request<{
      raceId: string
      seed: string
      resultHash: string
      gridPositions: { id: number; name: string; position: number; bid: number }[]
      frames: { tick: number; positions: { id: number; distance: number; speed: number; event?: string }[] }[]
      events: { tick: number; type: string; description: string; affectedIds: number[] }[]
      finalOrder: { id: number; wallet: string; name: string; isBot: boolean; position: number; payout: number }[]
      totalPot: number
      trackLength: number
    }>('/race/simulate', {
      method: 'POST',
      body: JSON.stringify({ raceId }),
    }),

  submitAction: (raceId: string, wallet: string, slothId: number, actionType: 'boost' | 'pillow', tick: number) =>
    request<{ raceId: string; actionType: string; tick: number; cost: number; newBalance: number }>(
      '/race/action',
      { method: 'POST', body: JSON.stringify({ raceId, wallet, slothId: slothId, actionType, tick }) }
    ),

  getRace: (raceId: string) =>
    request<any>(`/race/${raceId}`),

  createGP: () =>
    request<{ gpId: string; qualifyRaceId: string; finalRaceId: string; stage: string; entryFee: number; maxRaise: number }>(
      '/race/gp/create',
      { method: 'POST', body: JSON.stringify({}) }
    ),

  advanceGP: (qualifyRaceId: string) =>
    request<{ finalRaceId: string; qualifiers: any[]; stage: string }>(
      '/race/gp/advance',
      { method: 'POST', body: JSON.stringify({ qualifyRaceId }) }
    ),

  predictWinner: (raceId: string, wallet: string, slothId: number) =>
    request<{ predicted: boolean; raceId: string; slothId: number }>('/race/predict', {
      method: 'POST',
      body: JSON.stringify({ raceId, wallet, slothId: slothId }),
    }),

  getGDAPrices: (raceId: string, tick: number) =>
    request<{ boostPrice: number; pillowPrice: number; boostPurchases: number; pillowPurchases: number }>(
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
      '/sloth/daily-login',
      { method: 'POST', body: JSON.stringify({ wallet }) }
    ),

  // XP
  getXP: (wallet: string) =>
    request<{ wallet: string; xp: number }>(`/sloth/xp/${wallet}`),

  // Quests
  getDailyQuests: (wallet: string) =>
    request<{ quests: { id: number; title: string; description: string; requirement_type: string; sloth_reward: number; xp_reward: number; progress: number; requirement_value: number; completed: boolean }[] }>(
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
      `/sloth/upgrade-progress/${wallet}`
    ),

  freeUpgrade: (wallet: string) =>
    request<{ sloth: any; burnedSlothId: number; coinBonus: number }>('/sloth/free-upgrade', {
      method: 'POST',
      body: JSON.stringify({ wallet }),
    }),

  // Leaderboard
  getLeaderboard: (league: string) =>
    request<{ leaderboard: { rank: number; wallet: string; sloth_name: string; rarity: string; total_rp: number }[] }>(
      `/leaderboard/${league}`
    ),

  getMyRanking: (wallet: string) =>
    request<{ rank: number; wallet: string; total_rp: number } | null>(
      `/leaderboard/me/${wallet}`
    ),

  // Training
  startTraining: (wallet: string, slothId: number, stat: string) =>
    request<{ started: boolean; slothId: number; stat: string; completedAt: string }>('/sloth/train', {
      method: 'POST',
      body: JSON.stringify({ wallet, slothId: slothId, stat }),
    }),

  claimTraining: (wallet: string, slothId: number) =>
    request<{ claimed: boolean; slothId: number; stat: string; gain: number; newStatValue: number }>('/sloth/claim-training', {
      method: 'POST',
      body: JSON.stringify({ wallet, slothId: slothId }),
    }),

  getTrainingStatus: (wallet: string) =>
    request<{ trainings: { slothId: number; slothName: string; stat: string; startedAt: string; completedAt: string; isReady: boolean }[]; weeklyCounts?: Record<number, number> }>(
      `/sloth/training-status/${wallet}`
    ),

  // Weekly & Milestone quests
  getWeeklyQuests: (wallet: string) =>
    request<{ quests: { id: number; title: string; description: string; requirement_type: string; sloth_reward: number; xp_reward: number; progress: number; requirement_value: number; completed: boolean }[] }>(
      `/quests/weekly/${wallet}`
    ),

  getMilestones: (wallet: string) =>
    request<{ quests: { id: number; title: string; description: string; requirement_type: string; sloth_reward: number; xp_reward: number; progress: number; requirement_value: number; completed: boolean }[] }>(
      `/quests/milestones/${wallet}`
    ),

  // Daily race
  getDailyRace: () =>
    request<{ raceId: string; weather: string; date: string; isNew?: boolean }>('/race/daily'),

  // Mini games
  playMiniGame: (wallet: string, slothId: number, gameType: string, score: number) =>
    request<{ gain: number; newStatValue: number; stat: string }>('/sloth/mini-game', {
      method: 'POST',
      body: JSON.stringify({ wallet, slothId: slothId, gameType, score }),
    }),

  // Evolution
  getEvolutionProgress: (slothId: number) =>
    request<{ tier: number; evolutionPath: string | null; passive: string | null; requirements: any; progress: any; eligible: boolean }>(
      `/sloth/evolution-progress/${slothId}`
    ),

  evolve: (wallet: string, slothId: number, path?: string) =>
    request<{ evolved: boolean; tier: number; evolutionPath: string | null; passive: string | null }>('/sloth/evolve', {
      method: 'POST',
      body: JSON.stringify({ wallet, slothId: slothId, path }),
    }),

  // Cosmetics
  getShopCosmetics: (wallet?: string) =>
    request<{ cosmetics: any[] }>(`/shop/cosmetics${wallet ? `?wallet=${wallet}` : ''}`),

  buyCosmetic: (wallet: string, cosmeticId: number) =>
    request<{ purchased: boolean; newBalance: number }>('/shop/buy-cosmetic', {
      method: 'POST',
      body: JSON.stringify({ wallet, cosmeticId }),
    }),

  equipCosmetic: (wallet: string, slothId: number, cosmeticId: number) =>
    request<{ equipped: boolean }>('/sloth/equip-cosmetic', {
      method: 'POST',
      body: JSON.stringify({ wallet, slothId: slothId, cosmeticId }),
    }),

  // Accessories
  getShopAccessories: (wallet?: string) =>
    request<{ accessories: any[] }>(`/shop/accessories${wallet ? `?wallet=${wallet}` : ''}`),

  buyAccessory: (wallet: string, accessoryId: number) =>
    request<{ purchased: boolean; newBalance: number }>('/shop/buy-accessory', {
      method: 'POST',
      body: JSON.stringify({ wallet, accessoryId }),
    }),

  equipAccessory: (wallet: string, slothId: number, accessoryId: number) =>
    request<{ equipped: boolean }>('/sloth/equip-accessory', {
      method: 'POST',
      body: JSON.stringify({ wallet, slothId: slothId, accessoryId }),
    }),

  unequipAccessory: (wallet: string, slothId: number) =>
    request<{ unequipped: boolean }>('/sloth/unequip-accessory', {
      method: 'POST',
      body: JSON.stringify({ wallet, slothId: slothId }),
    }),

  // Profile
  getProfile: (wallet: string) =>
    request<{ wallet: string; balance: number; xp: number; totalRaces: number; totalWins: number; totalEarnings: number; loginDays: number; freeSlothCount: number; slothCount: number }>(
      `/sloth/profile/${wallet}`
    ),

  getProfileTransactions: (wallet: string) =>
    request<{ transactions: { type: string; amount: number; description: string; created_at: string }[] }>(
      `/sloth/profile/transactions/${wallet}`
    ),

  // Race replay
  getRaceReplay: (raceId: string) =>
    request<{ replay: any }>(`/race/${raceId}/replay`),

  getActiveRaces: () =>
    request<{ races: any[] }>('/race/active'),

  getPredictionStats: (wallet: string) =>
    request<{ total: number; correct: number; percentage: number }>(
      `/race/predictions/stats/${wallet}`
    ),

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
