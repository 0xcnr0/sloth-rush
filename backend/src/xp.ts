import { query, getOne } from "./db";

// XP Constants
export const XP_AMOUNTS = {
  RACE_COMPLETE: 10,
  RACE_WIN: 20,
  DAILY_LOGIN: 5,
  QUEST_COMPLETE: 10,
} as const;

export async function awardXP(wallet: string, amount: number): Promise<void> {
  await query(
    `INSERT INTO user_xp (wallet, total_xp) VALUES ($1, $2)
     ON CONFLICT(wallet) DO UPDATE SET total_xp = user_xp.total_xp + $3, updated_at = NOW()`,
    [wallet, amount, amount]
  );
}

export async function getXP(wallet: string): Promise<number> {
  const row = await getOne("SELECT total_xp FROM user_xp WHERE wallet = $1", [wallet]);
  return row?.total_xp || 0;
}
