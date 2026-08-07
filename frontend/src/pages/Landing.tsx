import { useWallet } from '../hooks/useWallet'
import { Link } from 'react-router-dom'
import WalletConnect from '../components/WalletConnect'
import { THEME } from '../config/theme'
import { motion } from 'framer-motion'

// Last word in white, everything before it in the accent colour — works for
// any brand name, so a fourth rebrand is still just a theme.ts edit.
const BRAND_WORDS = THEME.brand.nameUpper.split(' ')
const BRAND_TAIL = BRAND_WORDS[BRAND_WORDS.length - 1]
const BRAND_HEAD = BRAND_WORDS.slice(0, -1).join(' ')

export default function Landing() {
  const { isConnected } = useWallet()

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-2xl"
      >
        {/* Logo / Hero */}
        <div className="text-8xl mb-6">
          <span role="img" aria-label="pro">{THEME.brand.mark}</span>
        </div>

        {/* Brand name and tagline come from theme.ts. Hardcoding them here is
            how the first theme's "RACER RUSH / Wake up. Race hard. Nap later."
            survived two rebrands on the game's own front door: `racer` is the
            allowed functional word, so the vocabulary lint had no reason to
            flag it, and nobody loaded the page. */}
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight mb-4">
          <span className="text-brand-primary">{BRAND_HEAD}</span>{' '}
          <span className="text-brand-ink">{BRAND_TAIL}</span>
        </h1>

        <p className="text-xl text-brand-dust mb-2 font-medium">
          {THEME.brand.tagline}
        </p>

        <p className="text-brand-dust mb-10 max-w-md mx-auto">
          Mint a wind-up toy, race it, and it gets better at racing.
          Every race is a deterministic simulation you can verify yourself.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {isConnected ? (
            <>
              <Link
                to="/mint"
                className="px-8 py-3 bg-brand-primary text-brand-surface font-bold rounded-xl text-lg hover:bg-brand-primary/90 transition-colors"
              >
                Mint {THEME.tiers.free}
              </Link>
              <Link
                to="/collection"
                className="px-8 py-3 border border-brand-border text-brand-ink/80 rounded-xl text-lg hover:bg-brand-ink/5 transition-colors"
              >
                View {THEME.locations.home}
              </Link>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <p className="text-brand-dust text-sm">Connect your wallet to get started</p>
              <WalletConnect />
            </div>
          )}
        </div>
      </motion.div>

      {/* Features */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-20 max-w-4xl w-full"
      >
        {[
          { title: 'Free Mint', desc: `Gasless ${THEME.tiers.free} mint — one per wallet`, icon: '&#x2728;' },
          { title: 'Upgrade', desc: 'Upgrade your racer for $3 USDC and get random rarity', icon: '&#x1f525;' },
          { title: 'Race to Improve', desc: 'Every finish grows your racer. No timers, nothing to buy.', icon: '&#x1f3c6;' },
        ].map((f) => (
          <div
            key={f.title}
            className="bg-brand-surface border border-brand-border rounded-xl p-6 text-center"
          >
            <div className="text-3xl mb-3" dangerouslySetInnerHTML={{ __html: f.icon }} />
            <h3 className="text-brand-ink font-semibold mb-1">{f.title}</h3>
            <p className="text-brand-dust text-sm">{f.desc}</p>
          </div>
        ))}
      </motion.div>
    </div>
  )
}
