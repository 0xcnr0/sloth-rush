import { useWallet } from '../hooks/useWallet'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import WalletConnect from '../components/WalletConnect'
import RacerPortrait from '../components/RacerPortrait'
import Spinner from '../components/Spinner'
import { api } from '../lib/api'
import { THEME } from '../config/theme'
import { useMintFreeRacer } from '../hooks/useContracts'
import { CONTRACTS_DEPLOYED } from '../config/contracts'

/**
 * The page where the game hands you the thing it is about.
 *
 * It used to do that without ever drawing it: a key emoji before the mint, a
 * party popper after it, and a small card holding a second key emoji where the
 * new racer should have been. The one moment the whole flow exists to produce —
 * seeing your toy — was spent on stock glyphs, and the rig that draws it was
 * already sitting in the collection screen.
 *
 * So the toy is on screen the whole way through: the plain unpainted Wind-Up
 * before you mint (that is honestly what you get), the same toy with its key
 * winding while the transaction lands, and then the minted one, named, popping
 * in. And the button underneath it is Race, because that is the next thing the
 * game wants from you and the Toybox was the only exit before.
 */
type MintState = 'checking' | 'idle' | 'minting' | 'success' | 'already_minted' | 'error'

export default function Mint() {
  const { address, isConnected } = useWallet()
  const navigate = useNavigate()
  const [state, setState] = useState<MintState>('checking')
  const [racer, setRacer] = useState<any>(null)
  const [error, setError] = useState('')
  const onchainMint = useMintFreeRacer()

  // Ask before offering. The backend refuses a second mint for any wallet that
  // still holds a racer, so a returning player pressing the button only ever
  // got a 409 — the page can know that before they touch it, and point them at
  // the racer they already own instead.
  useEffect(() => {
    if (!address) return
    let cancelled = false
    setState('checking')
    api.getCollection(address)
      .then(data => {
        if (cancelled) return
        const owned = data.racers?.[0]
        if (owned) { setRacer(owned); setState('already_minted') }
        else setState('idle')
      })
      .catch(() => { if (!cancelled) setState('idle') })
    return () => { cancelled = true }
  }, [address])

  // If on-chain mint succeeds, also register in backend
  useEffect(() => {
    if (onchainMint.isSuccess && address) {
      api.mintRacer(address).then(data => {
        setRacer(data.racer)
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
        const data = await api.mintRacer(address)
        setRacer(data.racer)
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
        <p className="text-brand-dust">Connect your wallet to mint a {THEME.tiers.free}</p>
        <WalletConnect />
      </div>
    )
  }

  if (state === 'checking') return <Spinner fullPage text="Checking your wallet..." />

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <AnimatePresence mode="wait">
        {state === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="text-center"
          >
            {/* The unpainted starter toy, drawn from the same rig the race uses.
                What you see here is exactly what comes out of the mint. */}
            <div className="toy-panel px-4 pt-4 pb-2 mb-5">
              <RacerPortrait height={200} />
              <p className="text-brand-dust text-xs mt-1">Straight out of the box &mdash; unpainted, no archetype yet</p>
            </div>

            <h1 className="text-3xl font-bold mb-2">Mint your {THEME.tiers.free}</h1>
            <p className="text-brand-dust mb-5">
              Race it and it gets better. The $3 {THEME.tiers.pro} upgrade
              changes how it looks, never how fast it is.
            </p>

            <button
              onClick={handleMint}
              className="toy-btn w-full py-4 bg-brand-gold text-brand-ink text-xl font-black"
            >
              MINT &mdash; FREE
            </button>

            <div className="flex items-center justify-center gap-2 mt-4 text-[11px] text-brand-dust">
              <span className="toy-chip px-2.5 py-1">No gas</span>
              <span className="toy-chip px-2.5 py-1">One per wallet</span>
              <span className="toy-chip px-2.5 py-1">Yours on Base</span>
            </div>
          </motion.div>
        )}

        {state === 'minting' && (
          <motion.div
            key="minting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center"
          >
            {/* Not a spinner: the toy is already there and its key is turning,
                which is the same thing a spinner says and also the thing the
                game is about. */}
            <div className="toy-panel px-4 pt-4 pb-2 mb-5">
              <motion.div
                animate={{ rotate: [-1.5, 1.5, -1.5] }}
                transition={{ repeat: Infinity, duration: 0.5, ease: 'easeInOut' }}
              >
                <RacerPortrait height={200} />
              </motion.div>
            </div>
            <p className="text-xl font-bold">Winding the spring&hellip;</p>
            <p className="text-brand-dust text-sm mt-1">Minting on Base. This takes a few seconds.</p>
          </motion.div>
        )}

        {state === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 14 }}
              className="toy-panel px-4 pt-4 pb-3 mb-5"
            >
              <RacerPortrait archetype={racer?.race} rarity={racer?.rarity} height={220} />
              <p className="text-brand-ink font-bold text-xl leading-tight">
                {racer?.name ?? `Your ${THEME.tiers.free}`}
              </p>
              <p className="text-brand-dust text-xs">
                {THEME.tiers.free}{racer?.id ? ` #${racer.id}` : ''}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <p className="text-brand-dust text-sm mb-4">
                It is yours. Racing is the only thing that improves it &mdash; so go and race it.
              </p>
              <button
                onClick={() => navigate('/race')}
                className="toy-btn w-full py-4 bg-brand-gold text-brand-ink text-xl font-black"
              >
                RACE IT
              </button>
              <button
                onClick={() => navigate('/collection')}
                className="w-full py-3 text-brand-dust text-sm font-semibold hover:text-brand-ink transition-colors cursor-pointer"
              >
                Put it in the {THEME.locations.home} first
              </button>
              {onchainMint.hash && (
                <a
                  href={`https://sepolia.basescan.org/tx/${onchainMint.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-dust text-xs hover:text-brand-ink transition-colors underline"
                >
                  View on BaseScan
                </a>
              )}
            </motion.div>
          </motion.div>
        )}

        {state === 'already_minted' && (
          <motion.div
            key="already"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <div className="toy-panel px-4 pt-4 pb-3 mb-5">
              <RacerPortrait archetype={racer?.race} rarity={racer?.rarity} height={200} still />
              {racer?.name && (
                <>
                  <p className="text-brand-ink font-bold text-xl leading-tight">{racer.name}</p>
                  <p className="text-brand-dust text-xs">
                    {racer.type === 'free' ? THEME.tiers.free : THEME.tiers.pro} #{racer.id}
                  </p>
                </>
              )}
            </div>
            <h2 className="text-2xl font-bold mb-1">You already have one</h2>
            {/* Two different reasons the mint is closed, and telling a player
                who paid $3 that they are limited to one free racer reads as the
                upgrade having taken something from them. */}
            <p className="text-brand-dust mb-5">
              {racer?.type === 'pro'
                ? `Upgrading burned your ${THEME.tiers.free} and minted this in its place. The free mint does not come back.`
                : `One ${THEME.tiers.free} per wallet — this is yours.`}
            </p>
            <button
              onClick={() => navigate('/race')}
              className="toy-btn w-full py-4 bg-brand-gold text-brand-ink text-xl font-black"
            >
              RACE IT
            </button>
            <button
              onClick={() => navigate('/collection')}
              className="w-full py-3 text-brand-dust text-sm font-semibold hover:text-brand-ink transition-colors cursor-pointer"
            >
              Open the {THEME.locations.home}
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
            <h2 className="text-2xl font-bold text-brand-danger mb-2">Mint Failed</h2>
            <p className="text-brand-dust mb-6 break-words">{error}</p>
            <button
              onClick={() => setState('idle')}
              className="toy-btn w-full py-3 bg-brand-surface text-brand-ink"
            >
              Try Again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
