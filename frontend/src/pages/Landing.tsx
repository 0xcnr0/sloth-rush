import { useWallet } from '../hooks/useWallet'
import { Link } from 'react-router-dom'
import WalletConnect from '../components/WalletConnect'
import RacerPortrait from '../components/RacerPortrait'
import { THEME } from '../config/theme'
import { motion } from 'framer-motion'

// Last word in white, everything before it in the accent colour — works for
// any brand name, so a fourth rebrand is still just a theme.ts edit.
const BRAND_WORDS = THEME.brand.nameUpper.split(' ')
const BRAND_TAIL = BRAND_WORDS[BRAND_WORDS.length - 1]
const BRAND_HEAD = BRAND_WORDS.slice(0, -1).join(' ')

// The four archetypes, by code — the rig maps them to art folders, so this
// stays theme-neutral (CLAUDE.md §0) and a fifth toy is one entry.
const CAST = ['speedster', 'tank', 'trickster', 'burst'] as const

export default function Landing() {
  const { isConnected } = useWallet()

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        {/*
         * The cast, drawn by the same rig the race uses.
         *
         * The front door used to be an 8xl key emoji. This is a game about four
         * hand-painted wind-up toys and the page that has to sell it showed a
         * glyph from the font — while the art it was standing in for was already
         * loaded two screens away. Four keys turning is also the clearest thing
         * the page can say about what a wind-up toy is.
         */}
        <div className="flex items-end justify-center gap-1 sm:gap-3">
          {CAST.map((archetype, i) => (
            <motion.div
              key={archetype}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.1, type: 'spring', stiffness: 180, damping: 14 }}
              className="w-1/4 max-w-[130px]"
            >
              <RacerPortrait archetype={archetype} height={128} />
            </motion.div>
          ))}
        </div>
        {/* A shelf to stand them on. Without it four toys hang in mid-air over
            the wall, which is the one thing a display piece must never look
            like — and the north star is a shelf. */}
        <div className="h-2.5 max-w-md mx-auto -mt-2 mb-7 rounded-full bg-brand-shelf border-[3px] border-brand-ink" />

        {/* Brand name and tagline come from theme.ts. Hardcoding them here is
            how the first theme's "RACER RUSH / Wake up. Race hard. Nap later."
            survived two rebrands on the game's own front door: `racer` is the
            allowed functional word, so the vocabulary lint had no reason to
            flag it, and nobody loaded the page. */}
        <h1 className="toy-title text-4xl sm:text-6xl font-extrabold tracking-tight mb-3">
          <span className="text-brand-primary">{BRAND_HEAD}</span>{' '}
          <span className="text-brand-gold">{BRAND_TAIL}</span>
        </h1>

        <p className="text-lg sm:text-xl text-brand-ink/80 mb-2 font-semibold">
          {THEME.brand.tagline}
        </p>

        <p className="text-brand-dust mb-8 max-w-md mx-auto">
          Mint a wind-up toy, race it, and it gets better at racing.
          Every race is a deterministic simulation you can verify yourself.
        </p>

        <div className="max-w-xs mx-auto">
          {isConnected ? (
            <>
              <Link
                to="/mint"
                className="toy-btn block w-full py-4 bg-brand-gold text-brand-ink text-xl font-black"
              >
                MINT &mdash; FREE
              </Link>
              <Link
                to="/collection"
                className="block w-full py-3 text-brand-dust text-sm font-semibold hover:text-brand-ink transition-colors"
              >
                Open the {THEME.locations.home}
              </Link>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <WalletConnect />
              <p className="text-brand-dust text-sm">
                Free to play. Minting costs no gas, and an email address is enough.
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Three claims, and each one is a thing the game actually does. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12"
      >
        {[
          {
            title: 'Free to start',
            desc: `A gasless ${THEME.tiers.free} mint, one per wallet. No entry fees, no in-game currency.`,
          },
          {
            title: 'Racing is the ladder',
            desc: 'Every finish grows your racer, and crossing a threshold changes its form. Nothing to buy, no timer to wait out.',
          },
          {
            title: 'Provably fair',
            desc: 'One seed, open-source simulation, result hash written to Base. Re-run any race yourself.',
          },
        ].map((f) => (
          <div key={f.title} className="toy-panel p-5 text-center">
            <h3 className="text-brand-ink font-bold mb-1">{f.title}</h3>
            <p className="text-brand-dust text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </motion.div>

      {/* The one place money appears, stated plainly rather than buried. A page
          that hides its only payment is the page players stop trusting. */}
      <p className="text-center text-brand-dust text-xs mt-6 max-w-md mx-auto">
        The only thing $3 buys is the {THEME.tiers.pro} upgrade: a boxed, painted
        toy with a rarity rolled on-chain. It changes how your racer looks, never
        how fast it is.
      </p>
    </div>
  )
}
