import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { motion } from 'framer-motion'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { api } from '../lib/api'

const PACKAGE_STYLES: Record<string, { border: string; bg: string; icon: string }> = {
  starter: { border: 'border-gray-500', bg: 'bg-gray-500/10', icon: '\u{1F331}' },
  popular: { border: 'border-blue-500', bg: 'bg-blue-500/10', icon: '\u{2B50}' },
  pro: { border: 'border-purple-500', bg: 'bg-purple-500/10', icon: '\u{1F48E}' },
  whale: { border: 'border-yellow-400', bg: 'bg-yellow-400/10', icon: '\u{1F433}' },
}

export default function Shop() {
  const { address, isConnected } = useAccount()
  const [balance, setBalance] = useState(0)
  const [buying, setBuying] = useState<string | null>(null)
  const [lastPurchase, setLastPurchase] = useState<{ name: string; coins: number } | null>(null)

  useEffect(() => {
    if (!address) return
    api.getCoinBalance(address).then(d => setBalance(d.balance)).catch(() => {})
  }, [address])

  async function handleBuy(packageId: string) {
    if (!address || buying) return
    setBuying(packageId)
    try {
      const data = await api.buyCoins(address, packageId)
      setBalance(data.newBalance)
      setLastPurchase({ name: data.package.name, coins: data.coinsAdded })
      setTimeout(() => setLastPurchase(null), 3000)
    } catch (err: any) {
      alert(err.message)
    }
    setBuying(null)
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-400">Connect your wallet to buy SLUG Coins</p>
        <ConnectButton />
      </div>
    )
  }

  const packages = [
    { id: 'starter', name: 'Starter', price: 1, coins: 120, bonus: 0 },
    { id: 'popular', name: 'Popular', price: 5, coins: 650, bonus: 8 },
    { id: 'pro', name: 'Pro', price: 10, coins: 1400, bonus: 17 },
    { id: 'whale', name: 'Whale', price: 25, coins: 4000, bonus: 25 },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">SLUG Shop</h1>
          <p className="text-gray-400 mt-1">Buy SLUG Coins to enter races and place bids</p>
        </div>
        <div className="flex items-center gap-2 bg-slug-card border border-slug-border rounded-xl px-4 py-2">
          <span className="text-slug-green font-bold text-lg">{balance}</span>
          <span className="text-slug-green/70 text-sm">SLUG</span>
        </div>
      </div>

      {/* Success toast */}
      {lastPurchase && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="mb-6 bg-slug-green/10 border border-slug-green rounded-xl p-4 text-center"
        >
          <span className="text-slug-green font-bold">
            +{lastPurchase.coins} SLUG Coins added! ({lastPurchase.name} package)
          </span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {packages.map((pkg, i) => {
          const style = PACKAGE_STYLES[pkg.id]
          return (
            <motion.div
              key={pkg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`border-2 ${style.border} ${style.bg} rounded-xl p-6 flex flex-col items-center text-center`}
            >
              <span className="text-4xl mb-3">{style.icon}</span>
              <h3 className="text-white font-bold text-lg mb-1">{pkg.name}</h3>
              <p className="text-3xl font-extrabold text-white mb-1">{pkg.coins}</p>
              <p className="text-gray-400 text-sm mb-1">SLUG Coins</p>
              {pkg.bonus > 0 && (
                <span className="text-slug-green text-xs font-bold mb-3">+{pkg.bonus}% bonus</span>
              )}
              {pkg.bonus === 0 && <div className="mb-3" />}
              <p className="text-gray-300 font-semibold mb-4">${pkg.price} USDC</p>
              <button
                onClick={() => handleBuy(pkg.id)}
                disabled={buying !== null}
                className={`w-full py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer disabled:opacity-50 ${
                  pkg.id === 'whale'
                    ? 'bg-yellow-400 text-yellow-900 hover:bg-yellow-300'
                    : pkg.id === 'pro'
                    ? 'bg-purple-500 text-white hover:bg-purple-400'
                    : pkg.id === 'popular'
                    ? 'bg-blue-500 text-white hover:bg-blue-400'
                    : 'bg-gray-600 text-white hover:bg-gray-500'
                }`}
              >
                {buying === pkg.id ? 'Processing...' : 'Buy Now'}
              </button>
            </motion.div>
          )
        })}
      </div>

      {/* Info */}
      <div className="mt-8 bg-slug-card border border-slug-border rounded-xl p-6">
        <h3 className="text-white font-semibold mb-3">What can you do with SLUG Coins?</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-300 font-medium">Race Entry</p>
            <p className="text-gray-500">Standard: 50 SLUG / Grand Prix: 150 SLUG</p>
          </div>
          <div>
            <p className="text-gray-300 font-medium">Sealed Bids</p>
            <p className="text-gray-500">Raise up to 100-300 SLUG for Pole Position</p>
          </div>
          <div>
            <p className="text-gray-300 font-medium">Daily Free Race</p>
            <p className="text-gray-500">1 free Standard Race per wallet per day</p>
          </div>
        </div>
      </div>
    </div>
  )
}
