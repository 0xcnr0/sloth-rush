import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { THEME } from '../config/theme'

// All copy is derived from THEME so a rebrand never reaches this file.
//
// This page is the only place the game explains itself, which makes it the
// place most likely to describe a version that no longer exists. It previously
// documented an in-game currency, a shop, training, quests, mini games, four
// evolution tiers gated on coins, and three race formats — none of which are in
// the game. Keep it honest or delete it; a wrong guide is worse than none.
const SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: '\u{1F680}',
    content: [
      { q: `What is ${THEME.brand.name}?`, a: `A racing game on Base. Mint a wind-up toy, race it, and it gets better at racing. Nothing to buy, nothing to grind.` },
      { q: 'How do I start?', a: `Connect a wallet and mint a ${THEME.tiers.free}. It is free and gasless, one per wallet. Then pick a distance and race.` },
      { q: 'Is it free to play?', a: 'Yes, entirely. Races cost nothing and there is no in-game currency. The only thing money buys is the $3 upgrade, and that changes how your racer looks, not how fast it is.' },
      { q: 'Do I need to know anything about crypto?', a: 'No. You can sign up with an email address, and minting costs no gas.' },
    ]
  },
  {
    id: 'racing',
    title: 'Racing',
    icon: '\u{1F3C1}',
    content: [
      { q: 'What are the race formats?', a: `${THEME.raceFormats.exhibition.name} is practice. ${THEME.raceFormats.sprint.name} and ${THEME.raceFormats.endurance.name} differ in one thing only: distance.` },
      { q: 'Which one should I enter?', a: `${THEME.raceFormats.sprint.name} is short, so raw top speed decides it. ${THEME.raceFormats.endurance.name} is twice as long, and a racer that is only fast fades before the line — the long track is won by balance. Pick the one your racer is built for.` },
      { q: 'What is the Wind-Up phase?', a: 'Before the grid is set, all four racers wind their springs at the same time, hidden from each other. Hold to wind, release to lock. Winding further gives a better grid slot but drains stamina faster, and winding past the limit snaps the spring and puts you last. The safe limit comes from your STA.' },
      { q: 'Who am I racing?', a: 'Bots fill any empty slot so a race always starts. They are labelled BOT and they are not competing for anything.' },
      { q: 'Can a race be rigged?', a: 'No. Every race is a deterministic simulation of one seed, the code is open, and the result hash is written to Base. The same seed always produces the same race.' },
    ]
  },
  {
    id: 'progression',
    title: 'Getting Better',
    icon: '\u{1F4C8}',
    content: [
      { q: 'How does my racer improve?', a: 'By racing. Every finish adds a little to one of its six stats, based on where it placed, up to a daily limit. There is nothing to buy and no timer to wait out.' },
      { q: 'What are the six stats?', a: 'SPD (top speed), ACC (acceleration), STA (stamina), AGI (agility), REF (reflex) and LCK (luck). SPD is the base currency of a race; STA is what protects it over distance.' },
      { q: 'What is evolution?', a: 'As total stats cross a threshold your racer changes form — bigger, more finished, more detail. It happens on its own the moment you cross it. Evolution is how big you got.' },
      { q: 'What is rarity?', a: `Surface, not power. Fair through Mint changes how well kept your racer looks and never changes how it races. Rarity is how well kept you are — a separate axis from evolution.` },
    ]
  },
  {
    id: 'upgrade',
    title: 'Upgrading',
    icon: '\u{2728}',
    content: [
      { q: `What does the ${THEME.tiers.pro} upgrade do?`, a: `Your ${THEME.tiers.free} is burned and a ${THEME.tiers.pro} is minted in its place: boxed, painted, with an archetype and a rarity rolled on-chain. It costs $3 in USDC.` },
      { q: 'Does upgrading make me faster?', a: 'It raises your stat ceilings, so a Showcase can keep improving past where a Wind-Up stops. The rarity you roll has no effect on racing at all.' },
      { q: 'Can I choose my rarity?', a: 'No. It is drawn by Chainlink VRF at the moment of upgrade, on-chain, and nobody can see or influence it beforehand.' },
    ]
  },
]

export default function Guide() {
  const [openSection, setOpenSection] = useState<string>('getting-started')

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">How to Play</h1>
        <p className="text-brand-dust mt-1">Everything you need to know about {THEME.brand.name}</p>
      </div>

      {/* Quick Links */}
      <div className="flex flex-wrap gap-2 mb-8">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setOpenSection(s.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              openSection === s.id
                ? 'bg-brand-primary/20 text-brand-primary'
                : 'text-brand-dust hover:text-brand-ink bg-brand-surface border border-brand-border hover:bg-brand-ink/5'
            }`}
          >
            {s.icon} {s.title}
          </button>
        ))}
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {SECTIONS.map(section => (
          <motion.div
            key={section.id}
            initial={false}
            animate={{ height: openSection === section.id ? 'auto' : 'auto' }}
            className={`bg-brand-surface border border-brand-border rounded-xl overflow-hidden ${
              openSection !== section.id ? 'hidden' : ''
            }`}
          >
            <div className="p-6">
              <h2 className="text-xl font-bold text-brand-ink mb-4">{section.icon} {section.title}</h2>
              <div className="space-y-4">
                {section.content.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <h3 className="text-brand-ink font-semibold mb-1">{item.q}</h3>
                    <p className="text-brand-dust text-sm leading-relaxed">{item.a}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-8 bg-brand-surface border border-brand-primary/30 rounded-xl p-6 text-center">
        <h3 className="text-brand-ink font-bold text-lg mb-2">Ready to race?</h3>
        <p className="text-brand-dust text-sm mb-4">Mint your free racer and start racing today!</p>
        <div className="flex justify-center gap-3">
          <Link
            to="/mint"
            className="px-6 py-2.5 bg-brand-primary text-brand-surface font-bold rounded-xl hover:bg-brand-primary/90 transition-colors"
          >
            Mint {THEME.tiers.free}
          </Link>
          <Link
            to="/race"
            className="px-6 py-2.5 border border-brand-border text-brand-ink/80 rounded-xl hover:bg-brand-ink/5 transition-colors"
          >
            Enter Race
          </Link>
        </div>
      </div>
    </div>
  )
}
