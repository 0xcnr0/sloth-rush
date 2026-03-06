import { Link, Outlet, useLocation } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import OnboardingTutorial from './OnboardingTutorial'

const NAV_ITEMS = [
  { path: '/', label: 'Home' },
  { path: '/treehouse', label: 'Treehouse' },
  { path: '/race', label: 'Race' },
  { path: '/shop', label: 'Shop' },
  { path: '/leaderboard', label: 'Leaderboard' },
]

export default function Layout() {
  const location = useLocation()
  const { address } = useAccount()
  const [balance, setBalance] = useState(0)
  const [xp, setXp] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (!address) { setBalance(0); setXp(0); return }
    api.getCoinBalance(address).then(d => setBalance(d.balance)).catch((err) => { console.error('Failed to load balance:', err) })
    api.getXP(address).then(d => setXp(d.xp)).catch((err) => { console.error('Failed to load XP:', err) })
  }, [address, location.pathname])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b border-sloth-border bg-sloth-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Hamburger button - mobile only */}
            <button
              className="sm:hidden p-3 text-gray-400 hover:text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? '\u2715' : '\u2630'}
            </button>
            <Link to="/" className="text-xl font-bold text-sloth-green tracking-tight">
              SLOTH RUSH
            </Link>
            <div className="hidden sm:flex items-center gap-1">
              {NAV_ITEMS.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'bg-sloth-green/20 text-sloth-green'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {address && balance > 0 && (
              <div className="flex items-center gap-1 sm:gap-1.5 bg-sloth-green/10 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg">
                <span className="text-sloth-green font-bold text-xs sm:text-sm">{balance}</span>
                <span className="text-sloth-green/70 text-[10px] sm:text-xs hidden sm:inline">ZZZ</span>
              </div>
            )}
            {address && xp > 0 && (
              <div className="flex items-center gap-1 sm:gap-1.5 bg-sloth-purple/10 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg">
                <span className="text-sloth-purple font-bold text-xs sm:text-sm">{xp}</span>
                <span className="text-sloth-purple/70 text-[10px] sm:text-xs hidden sm:inline">XP</span>
              </div>
            )}
            <ConnectButton
              showBalance={false}
              chainStatus="icon"
              accountStatus={{ smallScreen: 'avatar', largeScreen: 'address' }}
            />
          </div>
        </div>
      </nav>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="sm:hidden fixed inset-0 z-50 bg-black/80" onClick={() => setMobileMenuOpen(false)}>
          <div className="bg-slate-900 w-64 h-full p-4 border-r border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <span className="text-xl font-bold text-green-400">SLOTH RUSH</span>
              <button onClick={() => setMobileMenuOpen(false)} className="text-gray-400 text-xl">{'\u2715'}</button>
            </div>
            <nav className="flex flex-col gap-2">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors min-h-[44px] flex items-center ${
                    location.pathname === item.path
                      ? 'bg-green-600/20 text-green-400'
                      : 'text-gray-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 pt-4 border-t border-slate-700 flex flex-col gap-2">
              <Link to="/mint" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-slate-800 transition-colors min-h-[44px] flex items-center">Mint</Link>
              <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-slate-800 transition-colors min-h-[44px] flex items-center">Profile</Link>
              <Link to="/guide" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-slate-800 transition-colors min-h-[44px] flex items-center">How to Play</Link>
            </div>
            {address && (
              <div className="mt-4 pt-4 border-t border-slate-700 space-y-2">
                {xp > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5">
                    <span className="text-sloth-purple font-bold text-sm">{xp}</span>
                    <span className="text-sloth-purple/70 text-xs">XP</span>
                  </div>
                )}
                {balance > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5">
                    <span className="text-sloth-green font-bold text-sm">{balance}</span>
                    <span className="text-sloth-green/70 text-xs">ZZZ</span>
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

      <footer className="border-t border-sloth-border py-4 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-gray-500 text-xs">
          <span>Sloth Rush — Sloth Racing Game</span>
          <div className="flex items-center gap-4">
            <Link to="/mint" className="hover:text-white transition-colors">Mint</Link>
            <Link to="/guide" className="hover:text-white transition-colors">How to Play</Link>
            <Link to="/profile" className="hover:text-white transition-colors">Profile</Link>
            <a href="https://twitter.com/SlugRushGame" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Twitter</a>
            <a href="https://discord.gg/slugrush" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Discord</a>
          </div>
        </div>
      </footer>

      <OnboardingTutorial />
    </div>
  )
}
