import { useWallet } from '../hooks/useWallet'
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import WalletConnect from '../components/WalletConnect'
import toast from 'react-hot-toast'
import { api } from '../lib/api'

export default function Invite() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { address, isConnected } = useWallet()
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Store referral code in localStorage so it persists through wallet connect
  useEffect(() => {
    if (code) {
      localStorage.setItem('racer-rush-referral', code)
    }
  }, [code])

  async function handleApply() {
    if (!address || !code) return
    setApplying(true)
    setError(null)
    try {
      await api.applyReferralCode(address, code)
      setApplied(true)
      localStorage.removeItem('racer-rush-referral')
      toast.success('Referral applied!')
    } catch (err: any) {
      setError(err.message || 'Failed to apply referral')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-brand-surface border border-brand-border rounded-2xl p-8 max-w-md w-full text-center"
      >
        <div className="text-5xl mb-4">&#x1F9B5;</div>
        <h1 className="text-2xl font-bold text-brand-ink mb-2">You've Been Invited!</h1>
        <p className="text-brand-dust text-sm mb-6">
          A friend invited you to Racer Rush. Connect your wallet and mint a racer to get started.
        </p>

        {!isConnected ? (
          <div className="space-y-4">
            <p className="text-brand-dust text-xs">Connect your wallet first</p>
            <WalletConnect />
          </div>
        ) : applied ? (
          <div className="space-y-4">
            <div className="bg-brand-primary/10 border border-brand-primary/30 rounded-xl p-4">
              <p className="text-brand-primary font-bold">Referral Applied!</p>
              <p className="text-brand-dust text-xs mt-1">Your friend has been rewarded</p>
            </div>
            <button
              onClick={() => navigate('/mint')}
              className="w-full bg-brand-primary text-brand-surface font-bold py-3 rounded-xl hover:bg-brand-primary/90 transition-colors cursor-pointer"
            >
              Mint Your Racer
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-brand-ink/5 rounded-xl p-3">
              <p className="text-brand-dust text-xs mb-1">Referral Code</p>
              <p className="text-brand-ink font-mono font-bold">{code}</p>
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              onClick={handleApply}
              disabled={applying}
              className="w-full bg-brand-primary text-brand-surface font-bold py-3 rounded-xl hover:bg-brand-primary/90 transition-colors cursor-pointer disabled:opacity-50"
            >
              {applying ? 'Applying...' : 'Apply Referral & Continue'}
            </button>

            <button
              onClick={() => navigate('/mint')}
              className="w-full text-brand-dust text-sm hover:text-brand-ink transition-colors cursor-pointer"
            >
              Skip and go to Mint
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
