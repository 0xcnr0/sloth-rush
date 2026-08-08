import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import RacerPortrait from '../components/RacerPortrait'
import Spinner from '../components/Spinner'
import { THEME, rarityLabel, archetypeLabel, formatLabel } from '../config/theme'

/**
 * Somebody's shelf, and it is public.
 *
 * The game has been writing down everything a collector cares about since the
 * first race — how many, how many won, the first win, the longest streak, the
 * day it was minted, the shape it grew into — and showing none of it. A toy
 * whose history is invisible is just a picture, and a picture is not a
 * collectible. This page is the game reading its own notes back.
 *
 * It takes a wallet in the URL and asks for nothing else. No connect button, no
 * guard: a shelf you have to log in to see is a drawer, and the point of a
 * shelf is that other people look at it.
 */
export default function Shelf() {
  const { wallet } = useParams<{ wallet: string }>()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!wallet) return
    setLoading(true)
    fetch(`/api/shelf/${wallet}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setData)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }, [wallet])

  if (loading) return <Spinner fullPage text="Opening the case..." />

  if (failed || !data) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-2">No shelf here</h1>
        <p className="text-brand-dust mb-6">That address does not have a {THEME.locations.home}.</p>
        <Link to="/" className="toy-btn inline-block px-6 py-3 bg-brand-gold text-brand-ink font-bold">
          {THEME.brand.nameUpper}
        </Link>
      </div>
    )
  }

  const short = `${data.wallet.slice(0, 6)}…${data.wallet.slice(-4)}`
  const racers: any[] = data.racers ?? []

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-6">
        <p className="text-brand-dust text-sm font-mono">{short}</p>
        <h1 className="toy-title text-3xl font-bold">{THEME.locations.home}</h1>
        {data.totals.races > 0 && (
          <p className="text-brand-dust text-sm mt-1">
            {data.totals.racers} {data.totals.racers === 1 ? 'toy' : 'toys'} · {data.totals.races} races
            {' '}· {data.totals.wins} wins
          </p>
        )}
      </div>

      {racers.length === 0 ? (
        <div className="toy-panel p-10 text-center">
          <p className="text-brand-ink font-bold mb-1">This shelf is empty</p>
          <p className="text-brand-dust text-sm">Nothing has been minted to this address yet.</p>
        </div>
      ) : (
        <>
          {/* The shelf itself. The toys stand on it rather than sitting in a
              grid of cards, because the whole claim of this page is that these
              are objects on display and not rows in a table. */}
          <div className="mb-10">
            <div className="flex items-end justify-center gap-2 sm:gap-6">
              {racers.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, type: 'spring', stiffness: 180, damping: 15 }}
                  className="w-full max-w-[150px]"
                >
                  <RacerPortrait archetype={r.archetype} rarity={r.rarity} height={140} />
                </motion.div>
              ))}
            </div>
            <div className="h-3 max-w-lg mx-auto -mt-3 rounded-full bg-brand-shelf border-[3px] border-brand-ink" />
          </div>

          <div className="space-y-4">
            {racers.map(r => <Passport key={r.id} racer={r} />)}
          </div>
        </>
      )}

      <div className="toy-panel p-5 text-center mt-10">
        <p className="text-brand-ink font-bold mb-1">{THEME.brand.nameUpper}</p>
        <p className="text-brand-dust text-sm mb-4">
          {THEME.brand.tagline}
        </p>
        <Link
          to="/mint"
          className="toy-btn inline-block px-6 py-3 bg-brand-gold text-brand-ink font-black"
        >
          START YOUR OWN
        </Link>
      </div>
    </div>
  )
}

function when(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * One toy's card.
 *
 * Split deliberately in two. The top half is what the toy IS — form, finish,
 * grade — and the bottom half is where it has BEEN. In real collecting those
 * are the two things that set the price of otherwise identical objects, and
 * keeping them apart on the card is what makes the second half read as
 * provenance rather than as statistics.
 */
function Passport({ racer }: { racer: any }) {
  const h = racer.history
  const form = THEME.evolutionTiers[racer.tier] ?? THEME.evolutionTiers[0]
  const grade = rarityLabel(racer.rarity)
  const kind = racer.type === 'free' ? THEME.tiers.free : THEME.tiers.pro
  const archetype = archetypeLabel(racer.archetype)

  return (
    <div className="toy-panel p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-brand-ink font-bold text-lg leading-tight truncate">{racer.name}</p>
          <p className="text-brand-dust text-xs">
            {kind} #{racer.id}
            {archetype && ` · ${archetype}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="toy-chip px-2.5 py-0.5 text-[11px]">{form}</span>
          {grade && <span className="toy-chip px-2.5 py-0.5 text-[11px] bg-brand-gold/25">{grade}</span>}
        </div>
      </div>

      {/* What it is */}
      <div className="grid grid-cols-3 gap-1 text-center text-xs mb-3">
        {(['spd', 'acc', 'sta', 'agi', 'ref', 'lck'] as const).map(k => (
          <div key={k} className="rounded px-1 py-1">
            <span className="text-brand-dust uppercase">{k} </span>
            <span className="text-brand-ink font-bold">
              {Number(racer.stats[k]) % 1 === 0 ? racer.stats[k] : Number(racer.stats[k]).toFixed(1)}
            </span>
            <span className="text-brand-dust/70 text-[10px]">/{racer.statCap}</span>
          </div>
        ))}
      </div>

      {/* Where it has been. Nothing below this line is a new mechanic — every
          number was already being recorded and never shown. */}
      <div className="border-t-[3px] border-brand-ink/10 pt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <Fact label="Minted" value={when(racer.mintedAt)} />
        <Fact label="Races" value={String(h.races)} />
        <Fact label="First raced" value={when(h.firstRaceAt)} />
        <Fact label="Wins" value={h.races ? `${h.wins} · ${h.winRate}%` : '—'} />
        <Fact label="First win" value={when(h.firstWinAt)} />
        <Fact label="Best streak" value={h.bestStreak ? `${h.bestStreak} in a row` : '—'} />
        <Fact
          label="Runs mostly"
          value={h.favouriteFormat ? formatLabel(h.favouriteFormat) : '—'}
        />
        <Fact
          label="Next form"
          value={racer.nextFormAt ? `${racer.statTotal} / ${racer.nextFormAt}` : 'Final form'}
        />
      </div>

      {racer.milestones?.length > 0 && (
        <div className="border-t-[3px] border-brand-ink/10 mt-3 pt-3">
          <p className="text-brand-dust text-[11px] font-semibold mb-1">Changed form</p>
          <div className="flex flex-wrap gap-1.5">
            {racer.milestones
              .filter((m: any) => m.kind === 'form')
              .map((m: any, i: number) => (
                <span key={i} className="toy-chip px-2 py-0.5 text-[10px]">
                  {THEME.evolutionTiers[Number(m.detail)] ?? m.detail} · {when(m.created_at)}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-brand-dust">{label}</span>
      <span className="text-brand-ink font-semibold tabular-nums text-right">{value}</span>
    </div>
  )
}
