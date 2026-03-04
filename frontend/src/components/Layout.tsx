import { Link, Outlet, useLocation } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import OnboardingTutorial from './OnboardingTutorial'

const NAV_ITEMS = [
  { path: '/', label: 'Home' },
  { path: '/mint', label: 'Mint' },
  { path: '/stable', label: 'Stable' },
  { path: '/race', label: 'Race' },
  { path: '/mini-games', label: 'Games' },
  { path: '/spectate', label: 'Spectate' },
  { path: '/leaderboard', label: 'Leaderboard' },
  { path: '/shop', label: 'Shop' },
  { path: '/history', label: 'History' },
]

export default function Layout() {
  const location = useLocation()
  const { address } = useAccount()
  const [balance, setBalance] = useState(0)
  const [xp, setXp] = useState(0)

  useEffect(() => {
    if (!address) { setBalance(0); setXp(0); return }
    api.getCoinBalance(address).then(d => setBalance(d.balance)).catch(() => {})
    api.getXP(address).then(d => setXp(d.xp)).catch(() => {})
  }, [address, location.pathname])

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b border-slug-border bg-slug-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-xl font-bold text-slug-green tracking-tight">
              SLUG RUSH
            </Link>
            <div className="hidden sm:flex items-center gap-1">
              {NAV_ITEMS.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'bg-slug-green/20 text-slug-green'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {address && xp > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 bg-slug-purple/10 px-3 py-1.5 rounded-lg">
                <span className="text-slug-purple font-bold text-sm">{xp}</span>
                <span className="text-slug-purple/70 text-xs">XP</span>
              </div>
            )}
            {address && balance > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 bg-slug-green/10 px-3 py-1.5 rounded-lg">
                <span className="text-slug-green font-bold text-sm">{balance}</span>
                <span className="text-slug-green/70 text-xs">SLUG</span>
              </div>
            )}
            <ConnectButton
              showBalance={false}
              chainStatus="icon"
              accountStatus="address"
            />
          </div>
        </div>
      </nav>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slug-border py-4 text-center text-gray-500 text-xs">
        Slug Rush — Base L2 Blockchain Racing Game
      </footer>

      <OnboardingTutorial />
    </div>
  )
}
