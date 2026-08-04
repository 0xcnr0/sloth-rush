import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { motion } from 'framer-motion'
import { api } from '../lib/api'
import { CUR } from '../config/theme'

type Quest = {
  id: number
  title: string
  description: string
  requirement_type: string
  requirement_value: number
  coin_reward: number
  xp_reward: number
  progress: number
  completed: boolean
}

export default function DailyQuests() {
  const { address } = useAccount()
  const [quests, setQuests] = useState<Quest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address) return
    setLoading(true)
    api.getDailyQuests(address)
      .then(d => setQuests(d.quests))
      .catch((err) => { console.error('Failed to load daily quests:', err) })
      .finally(() => setLoading(false))
  }, [address])

  if (!address || loading || quests.length === 0) return null

  const completedCount = quests.filter(q => q.completed).length

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold text-lg">Daily Quests</h3>
        <span className="text-xs text-gray-500">{completedCount}/{quests.length} done</span>
      </div>

      <div className="space-y-3">
        {quests.map((quest) => {
          const pct = Math.min(100, (quest.progress / quest.requirement_value) * 100)
          return (
            <motion.div
              key={quest.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-3 rounded-lg border ${
                quest.completed
                  ? 'border-brand-primary/30 bg-brand-primary/5'
                  : 'border-brand-border bg-brand-bg'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <p className={`text-sm font-semibold ${quest.completed ? 'text-brand-primary' : 'text-white'}`}>
                  {quest.completed ? '\u2705 ' : ''}{quest.title}
                </p>
                <div className="flex items-center gap-2 text-xs">
                  {quest.coin_reward > 0 && (
                    <span className="text-brand-primary font-bold">+{quest.coin_reward} {CUR}</span>
                  )}
                  {quest.xp_reward > 0 && (
                    <span className="text-brand-accent font-bold">+{quest.xp_reward} XP</span>
                  )}
                </div>
              </div>
              <p className="text-gray-500 text-xs mb-2">{quest.description}</p>
              <div className="w-full bg-brand-border rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    quest.completed ? 'bg-brand-primary' : 'bg-brand-accent'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-gray-600 text-[10px] mt-1">
                {quest.progress}/{quest.requirement_value}
              </p>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
