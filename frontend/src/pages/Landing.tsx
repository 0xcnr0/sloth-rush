import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { motion } from 'framer-motion'

export default function Landing() {
  const { isConnected } = useAccount()

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
          <span role="img" aria-label="snail">&#x1f40c;</span>
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight mb-4">
          <span className="text-slug-green">SLUG</span>{' '}
          <span className="text-white">RUSH</span>
        </h1>

        <p className="text-xl text-gray-400 mb-2 font-medium">
          Slug up. Race hard. Win big.
        </p>

        <p className="text-gray-500 mb-10 max-w-md mx-auto">
          Mint your slug, upgrade to a snail, and compete in races to earn SLUG Coins.
          Every race is deterministic and verifiable.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {isConnected ? (
            <>
              <Link
                to="/mint"
                className="px-8 py-3 bg-slug-green text-slug-dark font-bold rounded-xl text-lg hover:bg-slug-green/90 transition-colors"
              >
                Mint Free Slug
              </Link>
              <Link
                to="/stable"
                className="px-8 py-3 border border-slug-border text-gray-300 rounded-xl text-lg hover:bg-white/5 transition-colors"
              >
                View Stable
              </Link>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <p className="text-gray-500 text-sm">Connect your wallet to get started</p>
              <ConnectButton />
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
          { title: 'Free Mint', desc: 'Gasless Free Slug mint — one per wallet', icon: '&#x2728;' },
          { title: 'Upgrade', desc: 'Burn your slug, pay $3 USDC, get a Snail with random rarity', icon: '&#x1f525;' },
          { title: 'Race & Earn', desc: 'Compete in races — win SLUG Coins and climb the ranks', icon: '&#x1f3c6;' },
        ].map((f) => (
          <div
            key={f.title}
            className="bg-slug-card border border-slug-border rounded-xl p-6 text-center"
          >
            <div className="text-3xl mb-3" dangerouslySetInnerHTML={{ __html: f.icon }} />
            <h3 className="text-white font-semibold mb-1">{f.title}</h3>
            <p className="text-gray-500 text-sm">{f.desc}</p>
          </div>
        ))}
      </motion.div>
    </div>
  )
}
