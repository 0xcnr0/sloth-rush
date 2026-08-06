import { useState } from 'react'
import WindUpPhase from '../components/PreRace/WindUpPhase'
import GridReveal from '../components/PreRace/GridReveal'
import RarityLadder from '../components/RarityLadder'
import RacerPortrait from '../components/RacerPortrait'
import { visibleFormats } from './RaceLobby'
import { rarityLabel, archetypeLabel } from '../config/theme'
import { THEME } from '../config/theme'

/**
 * Dev-only component gallery.
 *
 * Most screens sit behind a connected wallet, so a UI change could not be looked
 * at without going through mint and race entry first — and a component that
 * renders nothing still passes the typecheck and the unit tests. This route
 * renders components against stub props so they can be screenshotted directly:
 *
 *   node tools/screenshot.mjs http://localhost:5199/dev 3000 /tmp/x.png
 *
 * It is registered only when import.meta.env.DEV is true, so it never ships.
 */
const PANELS = ['wind-up', 'grid-reveal', 'rarity', 'portraits', 'formats'] as const
type Panel = (typeof PANELS)[number]

export default function DevPreview() {
  // Initial panel comes from the hash (`/dev#formats`) so a screenshot can be
  // taken of one directly — the capture tool loads a URL, it cannot click.
  const fromHash = window.location.hash.slice(1) as Panel
  const [panel, setPanel] = useState<Panel>(
    PANELS.includes(fromHash) ? fromHash : 'wind-up'
  )

  return (
    <div className="min-h-screen bg-brand-bg text-white p-4">
      <header className="mb-4">
        <p className="text-xs tracking-[0.16em] uppercase text-gray-500">
          {THEME.brand.name} — dev preview
        </p>
        <p className="text-gray-400 text-sm mt-1">
          Components with stub props, no wallet required. Dev builds only.
        </p>
      </header>

      <nav className="flex gap-2 mb-6 flex-wrap">
        {PANELS.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setPanel(p)}
            className={`px-4 py-2 rounded-full border-2 text-sm font-semibold min-h-11 ${
              panel === p
                ? 'bg-brand-primary border-brand-primary text-black'
                : 'border-brand-border text-gray-300'
            }`}
          >
            {p}
          </button>
        ))}
      </nav>

      {panel === 'rarity' && <RarityLadder />}

      {panel === 'formats' && (
        // The lobby's format cards sit behind a connected wallet, so a broken
        // label or a format that quietly vanished could not be seen without
        // minting first. This is the filtered list — what a player actually
        // sees: one free, two paid at the same price differing only in distance.
        <div className="space-y-3">
          {visibleFormats.map(f => (
            <div key={f.id} className="rounded-xl border-2 border-brand-border bg-brand-surface p-4">
              <p className="text-white font-bold">{f.name}</p>
              <p className="text-gray-400 text-sm mt-1">{f.desc}</p>
              <p className="text-gray-600 text-xs mt-2">id: {f.id}</p>
            </div>
          ))}
        </div>
      )}

      {panel === 'portraits' && (
        // One per archetype, each on a different rung, so both axes are visible
        // at once: which toy you got, and how well kept it is.
        <div className="grid grid-cols-2 gap-4">
          {([
            ['tank', 'common'],
            ['speedster', 'rare'],
            ['trickster', 'epic'],
            ['burst', 'legendary'],
          ] as const).map(([code, rarity]) => (
            <div key={code} className="rounded-xl border-2 border-brand-border bg-brand-surface p-3">
              <RacerPortrait archetype={code} rarity={rarity} height={170} />
              <p className="text-white text-sm font-semibold mt-2">{archetypeLabel(code)}</p>
              <p className="text-gray-400 text-xs">{rarityLabel(rarity)}</p>
            </div>
          ))}
        </div>
      )}

      {panel === 'grid-reveal' && (
        // Stub grid covering every outcome the reveal has to render: a pole
        // taken by overwinding, two clean winds, and a snapped spring at the back.
        <GridReveal
          entries={[
            { id: 1, name: 'Speedy Comet', position: 1, race: 'tank', tension: 78, snapped: false },
            { id: 2, name: 'Waddler-03', position: 2, race: 'trickster', tension: 64, snapped: false },
            { id: 3, name: 'Jetster-01', position: 3, race: 'speedster', tension: 51, snapped: false },
            { id: 4, name: 'Chomper-04', position: 4, race: 'burst', tension: 100, snapped: true },
          ]}
        />
      )}

      {panel === 'wind-up' && (
        // A real raceId is not needed: the calls fail, the component shows its
        // error state, and the layout — which is what needs looking at — renders.
        <WindUpPhase raceId="dev-preview" wallet="0x0" onLocked={() => {}} />
      )}
    </div>
  )
}
