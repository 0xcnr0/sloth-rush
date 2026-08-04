import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { motion } from 'framer-motion'
import WalletConnect from '../components/WalletConnect'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { THEME, CUR } from '../config/theme'
import Spinner from '../components/Spinner'

// Keyed by package size code; the display names come from THEME.shopPackages.
const PACKAGE_STYLES: Record<string, { border: string; bg: string; icon: string }> = {
  bag: { border: 'border-gray-500', bg: 'bg-gray-500/10', icon: '\u{1F331}' },
  crate: { border: 'border-blue-500', bg: 'bg-blue-500/10', icon: '\u{2B50}' },
  pallet: { border: 'border-purple-500', bg: 'bg-purple-500/10', icon: '\u{1F48E}' },
  container: { border: 'border-yellow-400', bg: 'bg-yellow-400/10', icon: '\u{1F433}' },
}

type ShopTab = 'coins' | 'cosmetics' | 'accessories'

export default function Shop() {
  const { address, isConnected } = useAccount()
  const [tab, setTab] = useState<ShopTab>('coins')
  const [balance, setBalance] = useState(0)
  const [buying, setBuying] = useState<string | null>(null)
  const [lastPurchase, setLastPurchase] = useState<{ packageId: string; coins: number } | null>(null)
  const [cosmetics, setCosmetics] = useState<any[]>([])
  const [accessories, setAccessories] = useState<any[]>([])
  const [cosmeticsLoading, setCosmeticsLoading] = useState(false)
  const [accessoriesLoading, setAccessoriesLoading] = useState(false)

  const [_racers, setRacers] = useState<any[]>([])

  useEffect(() => {
    if (!address) return
    api.getCoinBalance(address).then(d => setBalance(d.balance)).catch((err) => { console.error('Failed to load balance:', err) })
    api.getCollection(address).then(d => {
      const racersOnly = d.racers.filter((s: any) => s.type === 'pro')
      setRacers(racersOnly)
    }).catch((err) => { console.error('Failed to load collection:', err) })
  }, [address])

  // Load cosmetics
  useEffect(() => {
    if (tab !== 'cosmetics') return
    setCosmeticsLoading(true)
    api.getShopCosmetics(address)
      .then(d => setCosmetics(d.cosmetics))
      .catch(() => setCosmetics([]))
      .finally(() => setCosmeticsLoading(false))
  }, [tab, address])

  // Load accessories
  useEffect(() => {
    if (tab !== 'accessories') return
    setAccessoriesLoading(true)
    api.getShopAccessories(address)
      .then(d => setAccessories(d.accessories))
      .catch(() => setAccessories([]))
      .finally(() => setAccessoriesLoading(false))
  }, [tab, address])

  async function handleBuy(packageId: string) {
    if (!address || buying) return
    setBuying(packageId)
    try {
      const data = await api.buyCoins(address, packageId)
      setBalance(data.newBalance)
      setLastPurchase({ packageId, coins: data.coinsAdded })
      setTimeout(() => setLastPurchase(null), 3000)
    } catch (err: any) {
      toast.error(err.message)
    }
    setBuying(null)
  }

  async function handleBuyCosmetic(cosmeticId: number) {
    if (!address || buying) return
    setBuying(`cosmetic-${cosmeticId}`)
    try {
      const data = await api.buyCosmetic(address, cosmeticId)
      setBalance(data.newBalance)
      toast.success('Purchased! Go to your Collection to equip it.')
      const d = await api.getShopCosmetics(address)
      setCosmetics(d.cosmetics)
    } catch (err: any) {
      toast.error(err.message)
    }
    setBuying(null)
  }

  async function handleBuyAccessory(accessoryId: number) {
    if (!address || buying) return
    setBuying(`accessory-${accessoryId}`)
    try {
      const data = await api.buyAccessory(address, accessoryId)
      setBalance(data.newBalance)
      toast.success('Purchased! Go to your Collection to equip it.')
      const d = await api.getShopAccessories(address)
      setAccessories(d.accessories)
    } catch (err: any) {
      toast.error(err.message)
    }
    setBuying(null)
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-400">Connect your wallet to buy {CUR}</p>
        <WalletConnect />
      </div>
    )
  }

  const packages = [
    { id: 'bag', price: 1, coins: 120, bonus: 0 },
    { id: 'crate', price: 5, coins: 650, bonus: 8 },
    { id: 'pallet', price: 10, coins: 1400, bonus: 17 },
    { id: 'container', price: 25, coins: 4000, bonus: 25 },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Shop</h1>
          <p className="text-gray-400 mt-1">Buy coins, cosmetics, and accessories</p>
        </div>
        <div className="flex items-center gap-2 bg-brand-surface border border-brand-border rounded-xl px-4 py-2">
          <span className="text-brand-primary font-bold text-lg">{balance}</span>
          <span className="text-brand-primary/70 text-sm">{CUR}</span>
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex gap-2 mb-6">
        {([
          { id: 'coins' as ShopTab, label: 'Coins' },
          { id: 'cosmetics' as ShopTab, label: 'Cosmetics' },
          { id: 'accessories' as ShopTab, label: 'Accessories' },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-lg font-semibold text-sm transition-colors cursor-pointer ${
              tab === t.id
                ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary'
                : 'bg-brand-surface border border-brand-border text-gray-500 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Success toast */}
      {lastPurchase && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="mb-6 bg-brand-primary/10 border border-brand-primary rounded-xl p-4 text-center"
        >
          <span className="text-brand-primary font-bold">
            +{lastPurchase.coins} {CUR} added! ({THEME.shopPackages[lastPurchase.packageId]})
          </span>
        </motion.div>
      )}

      {/* Coins Tab */}
      {tab === 'coins' && (
        <>
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
                  <h3 className="text-white font-bold text-lg mb-1">{THEME.shopPackages[pkg.id]}</h3>
                  <p className="text-3xl font-extrabold text-white mb-1">{pkg.coins}</p>
                  <p className="text-gray-400 text-sm mb-1">{CUR}</p>
                  {pkg.bonus > 0 && (
                    <span className="text-brand-primary text-xs font-bold mb-3">+{pkg.bonus}% bonus</span>
                  )}
                  {pkg.bonus === 0 && <div className="mb-3" />}
                  <p className="text-gray-300 font-semibold mb-4">${pkg.price} USDC</p>
                  <button
                    onClick={() => handleBuy(pkg.id)}
                    disabled={buying !== null}
                    className={`w-full py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer disabled:opacity-50 ${
                      pkg.id === 'container'
                        ? 'bg-yellow-400 text-yellow-900 hover:bg-yellow-300'
                        : pkg.id === 'pallet'
                        ? 'bg-purple-500 text-white hover:bg-purple-400'
                        : pkg.id === 'crate'
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
          <div className="mt-8 bg-brand-surface border border-brand-border rounded-xl p-6">
            <h3 className="text-white font-semibold mb-3">What can you do with {CUR}?</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-300 font-medium">Race Entry</p>
                <p className="text-gray-500">Standard: 50 {CUR} / Grand Prix: 150 {CUR}</p>
              </div>
              <div>
                <p className="text-gray-300 font-medium">Tactic Actions</p>
                <p className="text-gray-500">{THEME.tactics.boost} and {THEME.tactics.projectile} mid-race</p>
              </div>
              <div>
                <p className="text-gray-300 font-medium">Daily Free Race</p>
                <p className="text-gray-500">1 free Standard Race per wallet per day</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Cosmetics Tab */}
      {tab === 'cosmetics' && (
        <>
          {cosmeticsLoading ? (
            <div className="text-center py-12"><Spinner text="Loading cosmetics..." /></div>
          ) : cosmetics.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">{'\u{1F3A8}'}</div>
              <p className="text-gray-400">No cosmetics available yet.</p>
              <p className="text-gray-500 text-sm mt-1">Check back soon for fur skins and trail effects!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cosmetics.map((item: any, i: number) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`bg-brand-surface border rounded-xl p-5 ${
                    item.owned ? 'border-brand-primary/40' : 'border-brand-border'
                  }`}
                >
                  <div className="text-center mb-3">
                    <span className="text-4xl">{item.icon || '\u{1F3A8}'}</span>
                  </div>
                  <h3 className="text-white font-bold text-center mb-1">{item.name}</h3>
                  <p className="text-gray-400 text-xs text-center mb-2">{item.description || 'Cosmetic item'}</p>
                  {item.rarity && (
                    <p className="text-center mb-3">
                      <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                        item.rarity === 'legendary' ? 'bg-yellow-500/20 text-yellow-400' :
                        item.rarity === 'epic' ? 'bg-purple-500/20 text-purple-400' :
                        item.rarity === 'rare' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {item.rarity}
                      </span>
                    </p>
                  )}
                  {!item.owned ? (
                    <>
                      <p className="text-brand-primary font-bold text-center mb-3">{item.price} {CUR}</p>
                      <button
                        onClick={() => handleBuyCosmetic(item.id)}
                        disabled={buying !== null || balance < (item.price || 0)}
                        className="w-full py-2 bg-brand-primary/20 text-brand-primary font-semibold rounded-lg hover:bg-brand-primary/30 transition-colors cursor-pointer disabled:opacity-40 text-sm"
                      >
                        {buying === `cosmetic-${item.id}` ? 'Buying...' : 'Buy'}
                      </button>
                    </>
                  ) : (
                    <p className="text-brand-primary text-xs font-semibold text-center flex items-center justify-center gap-1">
                      {'\u2705'} Owned — Equip in Collection
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Accessories Tab */}
      {tab === 'accessories' && (
        <>
          {accessoriesLoading ? (
            <div className="text-center py-12"><Spinner text="Loading accessories..." /></div>
          ) : accessories.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">{'\u{1F451}'}</div>
              <p className="text-gray-400">No accessories available yet.</p>
              <p className="text-gray-500 text-sm mt-1">Stat-boosting gear coming soon!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {accessories.map((item: any, i: number) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`bg-brand-surface border rounded-xl p-5 ${
                    item.owned ? 'border-brand-accent/40' : 'border-brand-border'
                  }`}
                >
                  <div className="text-center mb-3">
                    <span className="text-4xl">{item.icon || '\u{2699}\uFE0F'}</span>
                  </div>
                  <h3 className="text-white font-bold text-center mb-1">{item.name}</h3>
                  <p className="text-gray-400 text-xs text-center mb-2">{item.description || 'Accessory item'}</p>

                  {/* Stat bonuses */}
                  {item.statBonuses && (
                    <div className="flex flex-wrap justify-center gap-1 mb-3">
                      {Object.entries(item.statBonuses).map(([stat, val]: [string, any]) => (
                        <span key={stat} className="bg-brand-bg text-brand-primary text-[10px] font-bold px-2 py-0.5 rounded">
                          {stat.toUpperCase()} +{val}
                        </span>
                      ))}
                    </div>
                  )}

                  {!item.owned ? (
                    <>
                      <p className="text-brand-primary font-bold text-center mb-3">{item.price} {CUR}</p>
                      <button
                        onClick={() => handleBuyAccessory(item.id)}
                        disabled={buying !== null || balance < (item.price || 0)}
                        className="w-full py-2 bg-brand-primary/20 text-brand-primary font-semibold rounded-lg hover:bg-brand-primary/30 transition-colors cursor-pointer disabled:opacity-40 text-sm"
                      >
                        {buying === `accessory-${item.id}` ? 'Buying...' : 'Buy'}
                      </button>
                    </>
                  ) : (
                    <p className="text-brand-primary text-xs font-semibold text-center flex items-center justify-center gap-1">
                      {'\u2705'} Owned — Equip in Collection
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
