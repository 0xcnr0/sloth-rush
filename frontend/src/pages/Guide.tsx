import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { THEME, CUR } from '../config/theme'

// All copy is derived from THEME so a rebrand never reaches this file.
const SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: '\u{1F680}',
    content: [
      { q: `What is ${THEME.brand.name}?`, a: `${THEME.brand.name} is a racing game on Base. Mint a racer, upgrade and evolve it, train it, and compete to earn ${CUR}.` },
      { q: 'How do I start?', a: `Connect your wallet, mint a free ${THEME.tiers.free} (gasless!), then enter Exhibition races. When ready, upgrade for $3 USDC to unlock all race formats.` },
      { q: 'Is it free to play?', a: `Yes. A ${THEME.tiers.free} can race in Exhibition mode and earn ${CUR}. Upgrading to a ${THEME.tiers.pro} ($3 or the free path) unlocks all features.` },
    ]
  },
  {
    id: 'racing',
    title: 'Racing',
    icon: '\u{1F3C1}',
    content: [
      { q: 'How do races work?', a: `Four racers line up at the ${THEME.locations.track}. Grid positions are set before the start, then the race runs deterministically from your racer's stats and a verifiable seed.` },
      { q: 'Does the grid cost anything?', a: 'No. Grid position is never bought. Nothing in a race is purchasable except the optional Tactic-mode actions during Tactic and Grand Prix Final formats.' },
      { q: 'What are race formats?', a: `Exhibition (free practice), Standard (50 ${CUR} entry), Tactic (75 ${CUR}, use ${THEME.tactics.boost} and ${THEME.tactics.projectile}), and Grand Prix (150 ${CUR}, multi-round championship).` },
      { q: 'How are prizes distributed?', a: 'The platform takes 15%; the remaining prize pool splits 50% / 30% / 15% / 5% across the four finishing places. Exhibition races pay flat rewards.' },
      { q: 'Can spectators affect a race?', a: 'No. Spectating is watch-only — no interaction and no influence on the result.' },
    ]
  },
  {
    id: 'stats',
    title: 'Stats & Training',
    icon: '\u{1F4AA}',
    content: [
      { q: 'What are the 6 stats?', a: `SPD (Speed) — max speed. ACC (Acceleration) — how fast you get there. STA (Stamina) — fatigue resistance. AGI (Agility) — ${THEME.events.mass_slow} resistance. REF (Reflex) — recovery after a ${THEME.events.collision}. LCK (Luck) — chance of a lucky event.` },
      { q: 'How do I train my racer?', a: 'Timed Training: pick a stat, wait 6 hours, get +0.3. Mini Games: play short challenges for +0.1~0.5. Organic Growth: race and your dominant stat grows +0.05 per race automatically.' },
      { q: 'Does rarity affect stats?', a: `Rarity sets your stat cap, not your stats: ${THEME.rarity.common} 22, ${THEME.rarity.uncommon} 25, ${THEME.rarity.rare} 28, ${THEME.rarity.epic} 31, ${THEME.rarity.legendary} 35. Rarity gives no bonus in a race — it is condition, not power.` },
    ]
  },
  {
    id: 'economy',
    title: 'Economy',
    icon: '\u{1FA99}',
    content: [
      { q: `What is ${CUR}?`, a: 'The in-game currency. Earn it from races, quests, daily login and mini games. Spend it on race entries, training, cosmetics and tactics. It can also be bought in the Shop.' },
      { q: 'What is XP?', a: 'Experience Points measure progress. XP cannot be purchased — only earned by playing. Required for upgrades and evolution.' },
      { q: `How do I earn ${CUR}?`, a: `Race rewards, the daily login bonus (15 ${CUR}), daily and weekly quests, mini games, and the Shop.` },
    ]
  },
  {
    id: 'evolution',
    title: 'Evolution',
    icon: '\u{2B50}',
    content: [
      { q: 'How does evolution work?', a: `${THEME.tiers.free} \u2192 ${THEME.tiers.pro} (Tier 1) \u2192 Tier 2 \u2192 Tier 3 \u2192 Tier 4. Each tier requires XP, race milestones, and ${CUR}. Evolution is how big you get; rarity is how well kept you are. They are separate axes.` },
      { q: 'What are evolution paths?', a: `At Tier 3 you choose ${THEME.paths.speed.label} (${THEME.paths.speed.statBonus}), ${THEME.paths.endurance.label} (${THEME.paths.endurance.statBonus}), or ${THEME.paths.luck.label} (${THEME.paths.luck.statBonus}). Each path grants a unique passive.` },
      { q: 'Can I upgrade for free?', a: `Yes. ${THEME.tiers.free} \u2192 ${THEME.tiers.pro} can be earned with 1500 XP, 30 races, 10 wins and 25 login days. Or pay $3 for an instant upgrade.` },
    ]
  },
]

export default function Guide() {
  const [openSection, setOpenSection] = useState<string>('getting-started')

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">How to Play</h1>
        <p className="text-gray-400 mt-1">Everything you need to know about {THEME.brand.name}</p>
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
                : 'text-gray-400 hover:text-white bg-brand-surface border border-brand-border hover:bg-white/5'
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
              <h2 className="text-xl font-bold text-white mb-4">{section.icon} {section.title}</h2>
              <div className="space-y-4">
                {section.content.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <h3 className="text-white font-semibold mb-1">{item.q}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{item.a}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-8 bg-brand-surface border border-brand-primary/30 rounded-xl p-6 text-center">
        <h3 className="text-white font-bold text-lg mb-2">Ready to race?</h3>
        <p className="text-gray-400 text-sm mb-4">Mint your free racer and start racing today!</p>
        <div className="flex justify-center gap-3">
          <Link
            to="/mint"
            className="px-6 py-2.5 bg-brand-primary text-brand-bg font-bold rounded-xl hover:bg-brand-primary/90 transition-colors"
          >
            Mint {THEME.tiers.free}
          </Link>
          <Link
            to="/race"
            className="px-6 py-2.5 border border-brand-border text-gray-300 rounded-xl hover:bg-white/5 transition-colors"
          >
            Enter Race
          </Link>
        </div>
      </div>
    </div>
  )
}
