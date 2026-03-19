import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import toast from 'react-hot-toast'

const CATEGORIES = [
  { id: 'bug', label: 'Bug', color: 'text-red-400 bg-red-400/10 border-red-400/30' },
  { id: 'feature', label: 'Feature', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' },
  { id: 'balance', label: 'Balance', color: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
  { id: 'general', label: 'General', color: 'text-gray-400 bg-gray-400/10 border-gray-400/30' },
]

const STATUS_OPTIONS = [
  { id: '', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'implemented', label: 'Implemented' },
]

function SentimentIcon({ sentiment }: { sentiment: string | null }) {
  if (!sentiment) return null
  if (sentiment === 'positive') return <span title="Positive">😊</span>
  if (sentiment === 'negative') return <span title="Negative">😟</span>
  return <span title="Neutral">😐</span>
}

function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return null
  const styles = {
    high: 'bg-red-500/10 text-red-400 border-red-500/30',
    medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    low: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${styles[priority as keyof typeof styles] || styles.low}`}>
      {priority}
    </span>
  )
}

export default function CommunityBoard() {
  const { address } = useAccount()

  const [feedbacks, setFeedbacks] = useState<any[]>([])
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })
  const [sort, setSort] = useState<'date' | 'upvotes'>('date')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [report, setReport] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [trending, setTrending] = useState<any[]>([])
  const [upvoted, setUpvoted] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  const loadFeedbacks = async (page = 1) => {
    try {
      const data = await api.getCommunityFeedback(page, sort, filterCategory || undefined, filterStatus || undefined)
      setFeedbacks(data.feedbacks)
      setPagination({ page: data.pagination.page, total: data.pagination.total, totalPages: data.pagination.totalPages })
    } catch (err) {
      console.error('Failed to load community feedback:', err)
    }
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      loadFeedbacks(1),
      api.getLatestReport().then(d => setReport(d.report)).catch(() => {}),
      api.getFeedbackStats().then(d => setStats(d)).catch(() => {}),
      api.getTrendingFeedback().then(d => setTrending(d.trending)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadFeedbacks(1)
  }, [sort, filterCategory, filterStatus])

  const handleUpvote = async (feedbackId: number) => {
    if (!address) {
      toast.error('Connect your wallet to upvote')
      return
    }
    if (upvoted.has(feedbackId)) return

    try {
      const result = await api.upvoteFeedback(feedbackId, address)
      setUpvoted(prev => new Set([...prev, feedbackId]))
      setFeedbacks(prev =>
        prev.map(f => f.id === feedbackId ? { ...f, upvotes: result.upvotes } : f)
      )
      toast.success('Upvoted!')
    } catch (err: any) {
      if (err.message?.includes('Already upvoted')) {
        setUpvoted(prev => new Set([...prev, feedbackId]))
      }
      toast.error(err.message || 'Failed to upvote')
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-sloth-green border-t-transparent rounded-full mx-auto" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Community Board</h1>
          <p className="text-gray-400 mt-1">See what players are saying. Vote on ideas.</p>
        </div>
        <Link
          to="/feedback"
          className="px-4 py-2 bg-sloth-green text-black font-bold rounded-lg text-sm hover:bg-sloth-green/90 transition-colors"
        >
          Submit Feedback
        </Link>
      </div>

      {/* Weekly Insights Card */}
      {report && (
        <div className="bg-gradient-to-br from-sloth-card to-sloth-green/5 border border-sloth-green/20 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-bold text-sloth-green mb-4">This Week's Insights</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{report.total_feedback}</p>
              <p className="text-xs text-gray-400">Total Feedback</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-400">{report.avg_rating ? Number(report.avg_rating).toFixed(1) : '-'}</p>
              <p className="text-xs text-gray-400">Avg Rating</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">
                {report.sentiment_breakdown?.positive || 0}
              </p>
              <p className="text-xs text-gray-400">Positive</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-400">
                {report.sentiment_breakdown?.negative || 0}
              </p>
              <p className="text-xs text-gray-400">Negative</p>
            </div>
          </div>

          {/* Sentiment Bar */}
          {report.sentiment_breakdown && (
            <div className="mb-4">
              <div className="flex h-2 rounded-full overflow-hidden bg-gray-800">
                {(() => {
                  const s = report.sentiment_breakdown
                  const total = (s.positive || 0) + (s.neutral || 0) + (s.negative || 0)
                  if (total === 0) return null
                  return (
                    <>
                      <div className="bg-green-400" style={{ width: `${(s.positive / total) * 100}%` }} />
                      <div className="bg-gray-400" style={{ width: `${(s.neutral / total) * 100}%` }} />
                      <div className="bg-red-400" style={{ width: `${(s.negative / total) * 100}%` }} />
                    </>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Top Requests */}
          {report.top_requests && report.top_requests.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-2">Top Requests</p>
              <div className="space-y-1">
                {report.top_requests.slice(0, 3).map((req: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300 truncate mr-2">{req.text}</span>
                    <span className="text-xs text-gray-500 shrink-0">{req.count}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats Summary (if no report) */}
      {!report && stats && (
        <div className="bg-sloth-card border border-sloth-border rounded-xl p-6 mb-8">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-xs text-gray-400">Total Feedback</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-400">{stats.avgRating?.toFixed(1) || '-'}</p>
              <p className="text-xs text-gray-400">Avg Rating</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-sloth-green">{stats.categories?.length || 0}</p>
              <p className="text-xs text-gray-400">Categories</p>
            </div>
          </div>
        </div>
      )}

      {/* Trending */}
      {trending.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-white mb-3">Trending</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {trending.slice(0, 5).map((fb) => (
              <div key={fb.id} className="bg-sloth-card border border-sloth-border rounded-lg p-3 min-w-[200px] shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                    CATEGORIES.find(c => c.id === fb.category)?.color || ''
                  }`}>
                    {fb.category}
                  </span>
                  <span className="text-xs text-sloth-green font-bold">▲ {fb.upvotes}</span>
                </div>
                <p className="text-sm text-gray-300 line-clamp-2">{fb.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-1 bg-sloth-card rounded-lg p-1 border border-sloth-border">
          <button
            onClick={() => setSort('date')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              sort === 'date' ? 'bg-sloth-green/20 text-sloth-green' : 'text-gray-400 hover:text-white'
            }`}
          >
            Newest
          </button>
          <button
            onClick={() => setSort('upvotes')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              sort === 'upvotes' ? 'bg-sloth-green/20 text-sloth-green' : 'text-gray-400 hover:text-white'
            }`}
          >
            Most Upvoted
          </button>
        </div>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="bg-sloth-card border border-sloth-border rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-sloth-green/50"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(c => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-sloth-card border border-sloth-border rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-sloth-green/50"
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Feedback List */}
      <div className="space-y-3">
        {feedbacks.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>No feedback yet. Be the first to share your thoughts!</p>
          </div>
        )}

        {feedbacks.map((fb) => (
          <div
            key={fb.id}
            className={`bg-sloth-card border rounded-lg p-4 transition-colors ${
              fb.status === 'implemented'
                ? 'border-sloth-green/30 bg-sloth-green/5'
                : 'border-sloth-border'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Upvote Button */}
              <button
                onClick={() => handleUpvote(fb.id)}
                disabled={upvoted.has(fb.id)}
                className={`flex flex-col items-center min-w-[40px] py-1 rounded transition-colors ${
                  upvoted.has(fb.id)
                    ? 'text-sloth-green'
                    : 'text-gray-500 hover:text-sloth-green'
                }`}
              >
                <span className="text-sm">▲</span>
                <span className="text-xs font-bold">{fb.upvotes}</span>
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-2 mb-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                    CATEGORIES.find(c => c.id === fb.category)?.color || 'text-gray-400 bg-gray-400/10 border-gray-400/30'
                  }`}>
                    {fb.category}
                  </span>
                  <span className="text-yellow-400 text-xs">
                    {'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)}
                  </span>
                  <SentimentIcon sentiment={fb.ai_sentiment} />
                  <PriorityBadge priority={fb.ai_priority} />
                  {fb.status === 'implemented' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-sloth-green/10 text-sloth-green border border-sloth-green/30 font-medium">
                      ✓ Your voice was heard!
                    </span>
                  )}
                  {fb.status === 'reviewed' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-400/10 text-blue-400 border border-blue-400/30">
                      Reviewed
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-300">{fb.text}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[10px] text-gray-600">
                    {fb.wallet.slice(0, 6)}...{fb.wallet.slice(-4)}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {new Date(fb.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => loadFeedbacks(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="px-3 py-1.5 rounded-lg text-sm border border-sloth-border text-gray-400 disabled:opacity-30 hover:border-sloth-green/50 transition-colors"
          >
            Prev
          </button>
          <span className="text-sm text-gray-500">
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            onClick={() => loadFeedbacks(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="px-3 py-1.5 rounded-lg text-sm border border-sloth-border text-gray-400 disabled:opacity-30 hover:border-sloth-green/50 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
