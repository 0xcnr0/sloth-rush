import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import WalletConnect from '../components/WalletConnect'
import { api } from '../lib/api'
import { useMintFreeSloth } from '../hooks/useContracts'
import { CONTRACTS_DEPLOYED } from '../config/contracts'

type MintState = 'idle' | 'minting' | 'success' | 'error' | 'already_minted'

export default function Mint() {
  const { address, isConnected } = useAccount()
  const navigate = useNavigate()
  const [state, setState] = useState<MintState>('idle')
  const [sloth, setSloth] = useState<any>(null)
  const [error, setError] = useState('')
  const onchainMint = useMintFreeSloth()

  // If on-chain mint succeeds, also register in backend
  useEffect(() => {
    if (onchainMint.isSuccess && address) {
      api.mintSloth(address).then(data => {
        setSloth(data.sloth)
        setState('success')
      }).catch(() => setState('success'))
    }
  }, [onchainMint.isSuccess, address])

  // If on-chain mint fails
  useEffect(() => {
    if (onchainMint.error) {
      const msg = onchainMint.error.message || 'On-chain mint failed'
      if (msg.includes('Already minted')) {
        setState('already_minted')
      } else {
        setError(msg)
        setState('error')
      }
    }
  }, [onchainMint.error])

  async function handleMint() {
    if (!address) return
    setState('minting')

    if (CONTRACTS_DEPLOYED) {
      // On-chain mint — useEffect handles success
      onchainMint.mint()
    } else {
      // Mock fallback — backend only
      try {
        const data = await api.mintSloth(address)
        setSloth(data.sloth)
        setState('success')
      } catch (err: any) {
        if (err.message?.includes('already has')) {
          setState('already_minted')
        } else {
          setError(err.message)
          setState('error')
        }
      }
    }
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-400">Connect your wallet to mint a Free Sloth</p>
        <WalletConnect />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <AnimatePresence mode="wait">
        {state === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center"
          >
            <div className="text-7xl mb-6">&#x1f9a5;</div>
            <h1 className="text-3xl font-bold mb-2">Mint Your Free Sloth</h1>
            <p className="text-gray-400 mb-8 max-w-md">
              Every wallet gets one Free Sloth. Mint yours and upgrade it to a Sloth to start racing!
            </p>
            <button
              onClick={handleMint}
              className="px-8 py-3 bg-sloth-green text-sloth-dark font-bold rounded-xl text-lg hover:bg-sloth-green/90 transition-colors cursor-pointer"
            >
              Mint Free Sloth
            </button>
          </motion.div>
        )}

        {state === 'minting' && (
          <motion.div
            key="minting"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="text-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
              className="text-7xl mb-6 inline-block"
            >
              &#x1f9a5;
            </motion.div>
            <p className="text-xl text-gray-300">Minting your sloth...</p>
          </motion.div>
        )}

        {state === 'success' && sloth && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', duration: 0.6 }}
            className="text-center"
          >
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="text-8xl mb-4"
            >
              &#x1f389;
            </motion.div>
            <h2 className="text-3xl font-bold text-sloth-green mb-2">
              {sloth.name}
            </h2>
            <p className="text-gray-400 mb-6">Your Free Sloth has been minted!</p>

            <div className="bg-sloth-card border border-sloth-border rounded-xl p-6 mb-6 inline-block">
              <div className="text-6xl mb-3">&#x1f9a5;</div>
              <p className="text-white font-semibold">{sloth.name}</p>
              <p className="text-gray-500 text-sm">Free Sloth #{sloth.id}</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => navigate('/treehouse')}
                className="px-6 py-2.5 bg-sloth-green text-sloth-dark font-bold rounded-xl hover:bg-sloth-green/90 transition-colors cursor-pointer"
              >
                Go to Treehouse
              </button>
            </div>
          </motion.div>
        )}

        {state === 'already_minted' && (
          <motion.div
            key="already"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <div className="text-6xl mb-4">&#x2714;&#xfe0f;</div>
            <h2 className="text-2xl font-bold mb-2">Already Minted</h2>
            <p className="text-gray-400 mb-6">This wallet already has a Free Sloth.</p>
            <button
              onClick={() => navigate('/treehouse')}
              className="px-6 py-2.5 bg-sloth-green text-sloth-dark font-bold rounded-xl hover:bg-sloth-green/90 transition-colors cursor-pointer"
            >
              View Your Treehouse
            </button>
          </motion.div>
        )}

        {state === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <div className="text-6xl mb-4">&#x274c;</div>
            <h2 className="text-2xl font-bold text-sloth-red mb-2">Mint Failed</h2>
            <p className="text-gray-400 mb-6">{error}</p>
            <button
              onClick={() => setState('idle')}
              className="px-6 py-2.5 border border-sloth-border text-gray-300 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
