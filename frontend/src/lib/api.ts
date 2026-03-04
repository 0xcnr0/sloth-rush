const BASE_URL = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'API error')
  return data
}

// Slug endpoints
export const api = {
  mintSlug: (wallet: string) =>
    request<{ slug: any }>('/slug/mint', {
      method: 'POST',
      body: JSON.stringify({ wallet }),
    }),

  upgradeSlug: (wallet: string) =>
    request<{ snail: any; burnedSlugId: number; coinBonus: number }>('/slug/upgrade', {
      method: 'POST',
      body: JSON.stringify({ wallet }),
    }),

  getStable: (wallet: string) =>
    request<{ slugs: any[]; coinBalance: number }>(`/slug/stable/${wallet}`),

  getCoinBalance: (wallet: string) =>
    request<{ wallet: string; balance: number }>(`/slug/coin/${wallet}`),

  getStreaks: (wallet: string) =>
    request<{ streaks: { snail_id: number; current_wins: number; max_wins: number; current_losses: number; total_races: number; total_wins: number }[] }>(
      `/slug/streaks/${wallet}`
    ),

  renameSnail: (wallet: string, snailId: number, name: string) =>
    request<{ renamed: boolean; snailId: number; newName: string }>('/slug/rename', {
      method: 'POST',
      body: JSON.stringify({ wallet, snailId, name }),
    }),

  // Race endpoints
  createRace: (wallet: string, snailId: number, format: string = 'standard') =>
    request<{ raceId: string; format: string; entryFee: number; maxRaise: number; status: string }>(
      '/race/create',
      { method: 'POST', body: JSON.stringify({ wallet, snailId, format }) }
    ),

  joinRace: (raceId: string, snailId: number, wallet: string) =>
    request<{ joined: boolean; raceId: string; entryFeeCharged: number; newBalance: number }>(
      '/race/join',
      { method: 'POST', body: JSON.stringify({ raceId, snailId, wallet }) }
    ),

  startBidding: (raceId: string) =>
    request<{ raceId: string; status: string; botsAdded: number }>(
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

  submitAction: (raceId: string, wallet: string, snailId: number, actionType: 'boost' | 'shell', tick: number) =>
    request<{ raceId: string; actionType: string; tick: number; cost: number; newBalance: number }>(
      '/race/action',
      { method: 'POST', body: JSON.stringify({ raceId, wallet, snailId, actionType, tick }) }
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

  predictWinner: (raceId: string, wallet: string, snailId: number) =>
    request<{ predicted: boolean; raceId: string; snailId: number }>('/race/predict', {
      method: 'POST',
      body: JSON.stringify({ raceId, wallet, snailId }),
    }),

  getGDAPrices: (raceId: string, tick: number) =>
    request<{ boostPrice: number; shellPrice: number; boostPurchases: number; shellPurchases: number }>(
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
      '/slug/daily-login',
      { method: 'POST', body: JSON.stringify({ wallet }) }
    ),

  // XP
  getXP: (wallet: string) =>
    request<{ wallet: string; xp: number }>(`/slug/xp/${wallet}`),

  // Quests
  getDailyQuests: (wallet: string) =>
    request<{ quests: { id: number; title: string; description: string; requirement_type: string; slug_reward: number; xp_reward: number; progress: number; requirement_value: number; completed: boolean }[] }>(
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
      `/slug/upgrade-progress/${wallet}`
    ),

  freeUpgrade: (wallet: string) =>
    request<{ snail: any; burnedSlugId: number; coinBonus: number }>('/slug/free-upgrade', {
      method: 'POST',
      body: JSON.stringify({ wallet }),
    }),

  // Leaderboard
  getLeaderboard: (league: string) =>
    request<{ leaderboard: { rank: number; wallet: string; snail_name: string; rarity: string; total_rp: number }[] }>(
      `/leaderboard/${league}`
    ),

  getMyRanking: (wallet: string) =>
    request<{ rank: number; wallet: string; total_rp: number } | null>(
      `/leaderboard/me/${wallet}`
    ),
}
