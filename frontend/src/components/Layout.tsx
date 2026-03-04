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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (!address) { setBalance(0); setXp(0); return }
    api.getCoinBalance(address).then(d => setBalance(d.balance)).catch(() => {})
    api.getXP(address).then(d => setXp(d.xp)).catch(() => {})
  }, [address, location.pathname])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b border-slug-border bg-slug-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Hamburger button - mobile only */}
            <button
              className="sm:hidden p-2 text-gray-400 hover:text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? '\u2715' : '\u2630'}
            </button>
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

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="sm:hidden fixed inset-0 z-50 bg-black/80" onClick={() => setMobileMenuOpen(false)}>
          <div className="bg-slate-900 w-64 h-full p-4 border-r border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <span className="text-xl font-bold text-green-400">SLUG RUSH</span>
              <button onClick={() => setMobileMenuOpen(false)} className="text-gray-400 text-xl">{'\u2715'}</button>
            </div>
            <nav className="flex flex-col gap-2">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'bg-green-600/20 text-green-400'
                      : 'text-gray-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            {address && (
              <div className="mt-6 pt-4 border-t border-slate-700 space-y-2">
                {xp > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5">
                    <span className="text-slug-purple font-bold text-sm">{xp}</span>
                    <span className="text-slug-purple/70 text-xs">XP</span>
                  </div>
                )}
                {balance > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5">
                    <span className="text-slug-green font-bold text-sm">{balance}</span>
                    <span className="text-slug-green/70 text-xs">SLUG</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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
