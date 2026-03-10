import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { motion } from 'framer-motion'
import WalletConnect from '../components/WalletConnect'
import toast from 'react-hot-toast'
import { api } from '../lib/api'

export default function Invite() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Store referral code in localStorage so it persists through wallet connect
  useEffect(() => {
    if (code) {
      localStorage.setItem('sloth-rush-referral', code)
    }
  }, [code])

  async function handleApply() {
    if (!address || !code) return
    setApplying(true)
    setError(null)
    try {
      await api.applyReferralCode(address, code)
      setApplied(true)
      localStorage.removeItem('sloth-rush-referral')
      toast.success('Referral applied! Your friend earned 25 ZZZ')
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
        className="bg-sloth-card border border-sloth-border rounded-2xl p-8 max-w-md w-full text-center"
      >
        <div className="text-5xl mb-4">&#x1F9B5;</div>
        <h1 className="text-2xl font-bold text-white mb-2">You've Been Invited!</h1>
        <p className="text-gray-400 text-sm mb-6">
          A friend invited you to Sloth Rush. Connect your wallet and mint a sloth to get started.
        </p>

        {!isConnected ? (
          <div className="space-y-4">
            <p className="text-gray-500 text-xs">Connect your wallet first</p>
            <WalletConnect />
          </div>
        ) : applied ? (
          <div className="space-y-4">
            <div className="bg-sloth-green/10 border border-sloth-green/30 rounded-xl p-4">
              <p className="text-sloth-green font-bold">Referral Applied!</p>
              <p className="text-gray-400 text-xs mt-1">Your friend has been rewarded</p>
            </div>
            <button
              onClick={() => navigate('/mint')}
              className="w-full bg-sloth-green text-black font-bold py-3 rounded-xl hover:bg-sloth-green/90 transition-colors cursor-pointer"
            >
              Mint Your Sloth
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-gray-500 text-xs mb-1">Referral Code</p>
              <p className="text-white font-mono font-bold">{code}</p>
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              onClick={handleApply}
              disabled={applying}
              className="w-full bg-sloth-green text-black font-bold py-3 rounded-xl hover:bg-sloth-green/90 transition-colors cursor-pointer disabled:opacity-50"
            >
              {applying ? 'Applying...' : 'Apply Referral & Continue'}
            </button>

            <button
              onClick={() => navigate('/mint')}
              className="w-full text-gray-500 text-sm hover:text-white transition-colors cursor-pointer"
            >
              Skip and go to Mint
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
