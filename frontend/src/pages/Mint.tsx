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

  /**
   * The winding-up beat, in degrees per frame.
   *
   * The reveal was reported as "just a screen rather than a moment", and the
   * reason was that nothing about the TOY changed across it. The minting state
   * already had the key spinning at full speed, so arriving at success swapped
   * some text underneath an animation that was already running — the same
   * picture with a different caption.
   *
   * A wind-up toy is inert until somebody winds it, and that is the one beat
   * this screen owns. So the toy is dead while the transaction is in flight,
   * and the first thing that happens when it becomes yours is that its key
   * starts to turn: one slow revolution, then faster, then alive. The name
   * lands on the same beat as the toy does.
   */
  const [successWind, setSuccessWind] = useState(0)
  const awake = successWind >= 5

  useEffect(() => {
    if (state !== 'success') { setSuccessWind(0); return }
    const steps = [
      setTimeout(() => setSuccessWind(1.2), 550),
      setTimeout(() => setSuccessWind(3), 1050),
      setTimeout(() => setSuccessWind(5), 1500),
    ]
    return () => steps.forEach(clearTimeout)
  }, [state])

  // Idle keeps the slowest tick that still reads as a working toy rather than a
  // failed image — a wind-up standing perfectly still looks broken, which is
  // why the portrait spins its key at all. Minting stops it, because the chain
  // has the toy and not you. Then it winds up.
  const wind = state === 'success' ? successWind : state === 'idle' ? 0.6 : 0

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

  /**
   * Mint, wind, race — and the toy is on screen for all three.
   *
   * Every state used to be its own child of an AnimatePresence in "wait" mode,
   * which meant the toy was unmounted and remounted between them: pressing MINT
   * gave roughly a third of a second of empty page before a finished screen
   * appeared. That gap is most of why the reveal was reported as "just a screen
   * rather than a moment" — the object you are supposed to be receiving blinks
   * out of existence at the exact instant you receive it.
   *
   * So the panel is rendered once, outside the transition, and only the copy
   * beneath it swaps. The toy never leaves, which lets the winding be a change
   * that happens TO IT rather than a different picture.
   */
  const onBench = state === 'idle' || state === 'minting' || state === 'success'

  return (
    <div className="max-w-md mx-auto px-4 py-8 text-center">
      {onBench && (
        <div className="toy-panel px-4 pt-4 pb-3 mb-5">
          <motion.div
            // Dim while the chain is working, and kick once the spring catches.
            animate={
              state === 'minting' ? { opacity: [0.55, 1, 0.55], scale: 1 }
              : awake ? { opacity: 1, scale: [1, 1.06, 1] }
              : { opacity: 1, scale: 1 }
            }
            transition={
              state === 'minting'
                ? { repeat: Infinity, duration: 1.4, ease: 'easeInOut' }
                : { duration: 0.45, ease: 'easeOut' }
            }
          >
            <RacerPortrait
              archetype={racer?.race}
              rarity={racer?.rarity}
              height={210}
              keySpeed={wind}
            />
          </motion.div>

          {/* One line under the toy, and it is the only thing in the panel that
              changes between states. */}
          <AnimatePresence mode="wait">
            {state === 'success' && awake ? (
              <motion.div
                key="named"
                initial={{ opacity: 0, scale: 1.4 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 16 }}
              >
                <p className="text-brand-ink font-bold text-xl leading-tight">
                  {racer?.name ?? `Your ${THEME.tiers.free}`}
                </p>
                <p className="text-brand-dust text-xs">
                  {THEME.tiers.free}{racer?.id ? ` #${racer.id}` : ''}
                </p>
              </motion.div>
            ) : (
              <motion.p
                key={state}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="text-brand-dust text-xs"
              >
                {state === 'idle'
                  ? 'Straight out of the box — unpainted, no archetype yet'
                  : state === 'minting'
                    ? 'Minting on Base\u2026'
                    : 'Winding the spring\u2026'}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence mode="wait">
        {state === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
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
          <motion.p
            key="minting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-brand-dust text-sm"
          >
            This takes a few seconds.
          </motion.p>
        )}

        {state === 'success' && awake && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
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
