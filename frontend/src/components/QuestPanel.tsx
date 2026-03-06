import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../lib/api'

type Quest = {
  id: number
  title: string
  description: string
  requirement_type: string
  requirement_value: number
  sloth_reward: number
  xp_reward: number
  progress: number
  completed: boolean
}

type Tab = 'daily' | 'weekly' | 'milestones'

export default function QuestPanel() {
  const { address } = useAccount()
  const [tab, setTab] = useState<Tab>('daily')
  const [daily, setDaily] = useState<Quest[]>([])
  const [weekly, setWeekly] = useState<Quest[]>([])
  const [milestones, setMilestones] = useState<Quest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address) return
    setLoading(true)
    Promise.all([
      api.getDailyQuests(address).then(d => setDaily(d.quests)).catch((err) => { console.error('Failed to load daily quests:', err); toast.error('Failed to load data. Please refresh.') }),
      api.getWeeklyQuests(address).then(d => setWeekly(d.quests)).catch((err) => { console.error('Failed to load weekly quests:', err) }),
      api.getMilestones(address).then(d => setMilestones(d.quests)).catch((err) => { console.error('Failed to load milestones:', err) }),
    ]).finally(() => setLoading(false))
  }, [address])

  if (!address || loading) return null

  const quests = tab === 'daily' ? daily : tab === 'weekly' ? weekly : milestones
  const completedCount = quests.filter(q => q.completed).length

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'daily', label: 'Daily', count: daily.length },
    { id: 'weekly', label: 'Weekly', count: weekly.length },
    { id: 'milestones', label: 'Milestones', count: milestones.length },
  ]

  return (
    <div className="bg-sloth-card border border-sloth-border rounded-xl p-5">
      {/* Tab header */}
      <div className="flex items-center gap-1 mb-4 bg-sloth-dark rounded-lg p-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-1.5 px-3 rounded-md text-sm font-semibold transition-colors cursor-pointer ${
              tab === t.id
                ? 'bg-sloth-green/20 text-sloth-green'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-bold text-lg">
          {tab === 'daily' ? 'Daily Quests' : tab === 'weekly' ? 'Weekly Quests' : 'Milestones'}
        </h3>
        <span className="text-xs text-gray-500">{completedCount}/{quests.length} done</span>
      </div>

      {quests.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">No quests available</p>
      ) : (
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
                    ? 'border-sloth-green/30 bg-sloth-green/5'
                    : 'border-sloth-border bg-sloth-dark'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className={`text-sm font-semibold ${quest.completed ? 'text-sloth-green' : 'text-white'}`}>
                    {quest.completed ? '\u2705 ' : ''}{quest.title}
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    {quest.sloth_reward > 0 && (
                      <span className="text-sloth-green font-bold">+{quest.sloth_reward} ZZZ</span>
                    )}
                    {quest.xp_reward > 0 && (
                      <span className="text-sloth-purple font-bold">+{quest.xp_reward} XP</span>
                    )}
                  </div>
                </div>
                <p className="text-gray-500 text-xs mb-2">{quest.description}</p>
                <div className="w-full bg-sloth-border rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      quest.completed ? 'bg-sloth-green' : 'bg-sloth-purple'
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
      )}
    </div>
  )
}
