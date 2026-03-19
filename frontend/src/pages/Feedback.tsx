import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { api } from '../lib/api'
import toast from 'react-hot-toast'

const CATEGORIES = [
  { id: 'bug', label: 'Bug', icon: '🐛', color: 'text-red-400 bg-red-400/10 border-red-400/30' },
  { id: 'feature', label: 'Feature', icon: '💡', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' },
  { id: 'balance', label: 'Balance', icon: '⚖️', color: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
  { id: 'general', label: 'General', icon: '💬', color: 'text-gray-400 bg-gray-400/10 border-gray-400/30' },
]

const MAX_TEXT = 500

export default function Feedback() {
  const { address, isConnected } = useAccount()

  const [eligibility, setEligibility] = useState<{
    eligible: boolean; racesCompleted: number; racesRequired: number; canSubmit: boolean; feedbackToday: number; feedbackLimit: number
  } | null>(null)
  const [category, setCategory] = useState('')
  const [text, setText] = useState('')
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [myFeedback, setMyFeedback] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      api.getFeedbackEligibility(address),
      api.getMyFeedback(address),
    ])
      .then(([elig, fb]) => {
        setEligibility(elig)
        setMyFeedback(fb.feedbacks)
      })
      .catch((err) => console.error('Failed to load feedback data:', err))
      .finally(() => setLoading(false))
  }, [address])

  const handleSubmit = async () => {
    if (!address || !category || !text.trim() || !rating) return
    setSubmitting(true)
    try {
      await api.submitFeedback(address, category, text.trim(), rating)
      setSubmitted(true)
      setCategory('')
      setText('')
      setRating(0)
      toast.success('Feedback submitted!')
      // Refresh data
      const [elig, fb] = await Promise.all([
        api.getFeedbackEligibility(address),
        api.getMyFeedback(address),
      ])
      setEligibility(elig)
      setMyFeedback(fb.feedbacks)
      setTimeout(() => setSubmitted(false), 3000)
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit feedback')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold text-white mb-4">Player Feedback</h1>
        <p className="text-gray-400">Connect your wallet to submit feedback.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-sloth-green border-t-transparent rounded-full mx-auto" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-2">Player Feedback</h1>
      <p className="text-gray-400 mb-8">Help shape the game. Your voice matters.</p>

      {/* Quest Gate */}
      {eligibility && !eligibility.eligible && (
        <div className="bg-sloth-card border border-sloth-border rounded-xl p-6 mb-8">
          <div className="text-center">
            <div className="text-4xl mb-3">🔒</div>
            <h2 className="text-xl font-bold text-white mb-2">Complete 10 Races to Unlock Feedback</h2>
            <p className="text-gray-400 mb-4">
              We want feedback from experienced players who understand the game.
            </p>
            <div className="w-full bg-gray-800 rounded-full h-3 mb-2">
              <div
                className="bg-sloth-green h-3 rounded-full transition-all"
                style={{ width: `${Math.min((eligibility.racesCompleted / eligibility.racesRequired) * 100, 100)}%` }}
              />
            </div>
            <p className="text-sm text-gray-500">
              {eligibility.racesCompleted} / {eligibility.racesRequired} races completed
            </p>
          </div>
        </div>
      )}

      {/* Feedback Form */}
      {eligibility?.eligible && (
        <>
          {submitted ? (
            <div className="bg-sloth-green/10 border border-sloth-green/30 rounded-xl p-6 mb-8 text-center">
              <div className="text-4xl mb-3">✅</div>
              <h2 className="text-xl font-bold text-sloth-green mb-2">Thanks! Your feedback helps shape the game.</h2>
              <p className="text-gray-400">We review every submission.</p>
            </div>
          ) : (
            <div className="bg-sloth-card border border-sloth-border rounded-xl p-6 mb-8">
              {!eligibility.canSubmit ? (
                <div className="text-center text-gray-400">
                  <p>You've submitted {eligibility.feedbackToday}/{eligibility.feedbackLimit} feedback today.</p>
                  <p className="text-sm mt-1">Try again tomorrow.</p>
                </div>
              ) : (
                <>
                  {/* Category Selection */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-300 mb-3">Category</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => setCategory(cat.id)}
                          className={`px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                            category === cat.id
                              ? cat.color + ' border-current'
                              : 'border-sloth-border text-gray-400 hover:border-gray-500'
                          }`}
                        >
                          <span className="mr-1">{cat.icon}</span> {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Star Rating */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-300 mb-3">Rating</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className={`text-3xl transition-transform hover:scale-110 ${
                            star <= (hoverRating || rating) ? 'text-yellow-400' : 'text-gray-600'
                          }`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Text Area */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-300 mb-3">Your Feedback</label>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
                      placeholder="Tell us what you think..."
                      rows={4}
                      className="w-full bg-sloth-dark border border-sloth-border rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-sloth-green/50 resize-none"
                    />
                    <div className="flex justify-end mt-1">
                      <span className={`text-xs ${text.length >= MAX_TEXT ? 'text-red-400' : 'text-gray-500'}`}>
                        {text.length}/{MAX_TEXT}
                      </span>
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    onClick={handleSubmit}
                    disabled={!category || !text.trim() || !rating || submitting}
                    className="w-full py-3 rounded-lg font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-sloth-green text-black hover:bg-sloth-green/90"
                  >
                    {submitting ? 'Submitting...' : 'Submit Feedback'}
                  </button>

                  <p className="text-xs text-gray-500 mt-3 text-center">
                    {eligibility.feedbackToday}/{eligibility.feedbackLimit} submissions used today
                  </p>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* My Feedback History */}
      {myFeedback.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Your Feedback History</h2>
          <div className="space-y-3">
            {myFeedback.map((fb) => (
              <div key={fb.id} className="bg-sloth-card border border-sloth-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      CATEGORIES.find(c => c.id === fb.category)?.color || 'text-gray-400 bg-gray-400/10 border-gray-400/30'
                    }`}>
                      {fb.category}
                    </span>
                    <span className="text-yellow-400 text-sm">
                      {'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {fb.status === 'implemented' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-sloth-green/10 text-sloth-green border border-sloth-green/30">
                        Implemented
                      </span>
                    )}
                    {fb.status === 'reviewed' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400 border border-blue-400/30">
                        Reviewed
                      </span>
                    )}
                    {fb.ai_sentiment && (
                      <span className={`text-xs ${
                        fb.ai_sentiment === 'positive' ? 'text-green-400' :
                        fb.ai_sentiment === 'negative' ? 'text-red-400' : 'text-gray-400'
                      }`}>
                        {fb.ai_sentiment === 'positive' ? '😊' : fb.ai_sentiment === 'negative' ? '😟' : '😐'}
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      {new Date(fb.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <p className="text-gray-300 text-sm">{fb.text}</p>
                {fb.upvotes > 0 && (
                  <p className="text-xs text-gray-500 mt-2">▲ {fb.upvotes} upvotes</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
