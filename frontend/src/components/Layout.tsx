import { useWallet } from '../hooks/useWallet'
import { Link, Outlet, useLocation } from 'react-router-dom'
import WalletConnect from './WalletConnect'
import MiniAppAutoConnect from './MiniAppAutoConnect'
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import OnboardingTutorial from './OnboardingTutorial'
import { getSafeAreaInsets } from '../lib/farcaster'
import { THEME } from '../config/theme'

/**
 * Four destinations, and they live at the bottom.
 *
 * There were five tabs across the top and five more links in a footer — ten
 * ways out of a screen whose only job is to get you into a race. That is a
 * website's furniture. A phone game puts a short bar where the thumb already
 * is, and Spectate folds into Ranks because both pages were mostly empty and
 * both answer "who else is playing".
 */
const NAV_ITEMS = [
  { path: '/collection', label: THEME.locations.home, icon: '\u{1F9F0}' },
  { path: '/race', label: 'Race', icon: '\u{1F3C1}' },
  { path: '/leaderboard', label: 'Ranks', icon: '\u{1F3C6}' },
  { path: '/guide', label: 'Guide', icon: '\u{2753}' },
]

export default function Layout() {
  const location = useLocation()
  const { address } = useWallet()
  const [xp, setXp] = useState(0)

  useEffect(() => {
    if (!address) { setXp(0); return }
    api.getXP(address).then(d => setXp(d.xp)).catch((err) => { console.error('Failed to load XP:', err) })
  }, [address, location.pathname])

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
            <Link to="/" className="text-xl font-bold text-brand-primary tracking-tight whitespace-nowrap">
              {THEME.brand.nameUpper}
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {address && (
              // The XP chip is the way to the profile now. Removing the footer
              // took the only link to it with it, and a page nothing points at
              // is a page nobody will find.
              //
              // It used to also require xp > 0, which meant the one route to
              // the record and to the only settings screen in the game did not
              // exist until you had finished a race — hidden from exactly the
              // player most likely to go looking for a settings screen.
              <Link
                to="/profile"
                className="flex shrink-0 items-center gap-1 bg-brand-accent/10 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg whitespace-nowrap hover:bg-brand-accent/20 transition-colors"
              >
                <span className="text-brand-accent font-bold text-[11px] sm:text-sm">{xp}</span>
                <span className="text-brand-accent/70 text-[9px] sm:text-xs">XP</span>
              </Link>
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

      <main className="flex-1">
        <Outlet />
      </main>

      {/* The bar. It sits above the drawn room rather than on top of it, and it
          is the only navigation on a phone — the top strip keeps the brand and
          the XP and nothing else. */}
      <nav className="sticky bottom-0 z-40 border-t-[3px] border-brand-ink bg-brand-surface">
        <div className="max-w-2xl mx-auto grid grid-cols-4">
          {NAV_ITEMS.map(item => {
            const active = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-0.5 py-2 transition-colors ${
                  active ? 'text-brand-ink' : 'text-brand-dust hover:text-brand-ink'
                }`}
              >
                <span className={`text-xl leading-none ${active ? '' : 'opacity-60'}`} aria-hidden>
                  {item.icon}
                </span>
                <span className="text-[11px] font-semibold">{item.label}</span>
                <span
                  className={`h-[3px] w-6 rounded-full ${active ? 'bg-brand-gold' : 'bg-transparent'}`}
                  aria-hidden
                />
              </Link>
            )
          })}
        </div>
      </nav>

      <MiniAppAutoConnect />
      <OnboardingTutorial />
    </div>
  )
}
