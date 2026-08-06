import { Link, Outlet, useLocation } from 'react-router-dom'
import WalletConnect from './WalletConnect'
import MiniAppAutoConnect from './MiniAppAutoConnect'
import { useAccount } from 'wagmi'
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import OnboardingTutorial from './OnboardingTutorial'
import { FEATURES } from '../config/features'
import { getSafeAreaInsets } from '../lib/farcaster'
import { THEME } from '../config/theme'

const NAV_ITEMS = [
  { path: '/', label: 'Home' },
  { path: '/collection', label: THEME.locations.home },
  { path: '/race', label: 'Race' },
  { path: '/spectate', label: 'Spectate' },
  { path: '/leaderboard', label: 'Leaderboard' },
]

export default function Layout() {
  const location = useLocation()
  const { address } = useAccount()
  const [xp, setXp] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (!address) { setXp(0); return }
    api.getXP(address).then(d => setXp(d.xp)).catch((err) => { console.error('Failed to load XP:', err) })
  }, [address, location.pathname])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const safeArea = getSafeAreaInsets()

  return (
    <div
      className="min-h-screen flex flex-col"
      style={safeArea.top || safeArea.bottom ? {
        paddingTop: safeArea.top,
        paddingBottom: safeArea.bottom,
      } : undefined}
    >
      <nav className="border-b border-brand-border bg-brand-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Hamburger button - mobile only */}
            <button
              className="sm:hidden p-3 text-brand-dust hover:text-brand-ink"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? '\u2715' : '\u2630'}
            </button>
            <Link to="/" className="text-xl font-bold text-brand-primary tracking-tight">
              {THEME.brand.nameUpper}
            </Link>
            <div className="hidden sm:flex items-center gap-1">
              {NAV_ITEMS.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? 'bg-brand-primary/20 text-brand-primary'
                      : 'text-brand-dust hover:text-brand-ink hover:bg-brand-ink/5'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {address && xp > 0 && (
              <div className="flex items-center gap-1 sm:gap-1.5 bg-brand-accent/10 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg">
                <span className="text-brand-accent font-bold text-xs sm:text-sm">{xp}</span>
                <span className="text-brand-accent/70 text-[10px] sm:text-xs hidden sm:inline">XP</span>
              </div>
            )}
            <WalletConnect
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
          <div className="bg-brand-surface w-64 h-full p-4 border-r border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <span className="text-xl font-bold text-green-400">{THEME.brand.nameUpper}</span>
              <button onClick={() => setMobileMenuOpen(false)} className="text-brand-dust text-xl">{'\u2715'}</button>
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
                      : 'text-brand-dust hover:text-brand-ink hover:bg-brand-ink/5'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 pt-4 border-t border-slate-700 flex flex-col gap-2">
              <Link to="/mint" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-lg text-sm font-medium text-brand-dust hover:text-brand-ink hover:bg-brand-ink/5 transition-colors min-h-[44px] flex items-center">Mint</Link>
              {FEATURES.profile && <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-lg text-sm font-medium text-brand-dust hover:text-brand-ink hover:bg-brand-ink/5 transition-colors min-h-[44px] flex items-center">Profile</Link>}
              <Link to="/guide" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-lg text-sm font-medium text-brand-dust hover:text-brand-ink hover:bg-brand-ink/5 transition-colors min-h-[44px] flex items-center">How to Play</Link>
            </div>
            {address && (
              <div className="mt-4 pt-4 border-t border-slate-700 space-y-2">
                {xp > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5">
                    <span className="text-brand-accent font-bold text-sm">{xp}</span>
                    <span className="text-brand-accent/70 text-xs">XP</span>
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

      {/* The room illustration is painted on the body and bleeds to the bottom of
          the viewport, so a transparent footer sat directly on top of the shelf
          and became unreadable. It gets its own opaque band. */}
      <footer className="border-t-[3px] border-brand-ink bg-brand-surface py-4 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-brand-dust text-xs">
          <span>{THEME.brand.name} — {THEME.brand.description}</span>
          <div className="flex items-center gap-4">
            <Link to="/mint" className="hover:text-brand-ink transition-colors">Mint</Link>
            <Link to="/guide" className="hover:text-brand-ink transition-colors">How to Play</Link>
            {FEATURES.profile && <Link to="/profile" className="hover:text-brand-ink transition-colors">Profile</Link>}
            <a href="https://twitter.com/WindUpRush" target="_blank" rel="noopener noreferrer" className="hover:text-brand-ink transition-colors">Twitter</a>
            <a href="https://discord.gg/winduprush" target="_blank" rel="noopener noreferrer" className="hover:text-brand-ink transition-colors">Discord</a>
          </div>
        </div>
      </footer>

      <MiniAppAutoConnect />
      <OnboardingTutorial />
    </div>
  )
}
