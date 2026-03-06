import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

const SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: '\u{1F680}',
    content: [
      { q: 'What is Slug Rush?', a: 'Slug Rush is a snail racing game. Mint your slug, upgrade to a snail, train it, and compete in races to earn SLUG Coins.' },
      { q: 'How do I start?', a: 'Connect your wallet, mint a free slug (gasless!), then enter Exhibition races. When ready, upgrade to a Snail for $3 USDC to unlock all race formats.' },
      { q: 'Is it free to play?', a: 'Yes! Free Slugs can race in Exhibition mode and earn SLUG Coins. Upgrading to a Snail ($3 or free path) unlocks all features.' },
    ]
  },
  {
    id: 'racing',
    title: 'Racing',
    icon: '\u{1F3C1}',
    content: [
      { q: 'How do races work?', a: 'Each race has 4 participants. Before the race, there\'s a Grid Boost phase where you spend SLUG Coins to boost your starting position. The highest boost gets pole position. Then the race simulates based on your snail\'s stats.' },
      { q: 'What are race formats?', a: 'Exhibition (free, practice), Standard (50 SLUG entry), Tactic (75 SLUG, use Boost & Shell), and Grand Prix (150 SLUG, multi-round championship).' },
      { q: 'How are prizes distributed?', a: 'Platform takes 15%, remaining pot: 1st gets 50%, 2nd 30%, 3rd 15%, 4th 5%. Exhibition races have flat rewards.' },
      { q: 'What is Grid Boost?', a: 'Before each race, you have 10 seconds to spend SLUG Coins to boost your grid position. All boosts are revealed simultaneously. Highest boost = pole position (starting advantage). Boost wisely!' },
    ]
  },
  {
    id: 'stats',
    title: 'Stats & Training',
    icon: '\u{1F4AA}',
    content: [
      { q: 'What are the 6 stats?', a: 'SPD (Speed) - max speed. ACC (Acceleration) - how fast you speed up. STA (Stamina) - fatigue resistance. AGI (Agility) - slime burst resistance. REF (Reflex) - crash recovery. LCK (Luck) - lucky event chance.' },
      { q: 'How do I train my snail?', a: 'Timed Training: Pick a stat, wait 6 hours, get +0.3. Mini Games: Play fun challenges for instant +0.1~0.5. Organic Growth: Race and your dominant stat grows +0.05 per race automatically.' },
      { q: 'Does rarity affect stats?', a: 'Rarity determines your stat cap (max level). Common: 22, Uncommon: 25, Rare: 28, Epic: 31, Legendary: 35. It does NOT give stat bonuses in races.' },
    ]
  },
  {
    id: 'economy',
    title: 'Economy',
    icon: '\u{1FA99}',
    content: [
      { q: 'What is SLUG Coin?', a: 'The in-game currency. Earn from races, quests, daily login, and mini games. Spend on race entries, training, cosmetics, and tactics. Can also be purchased from the Shop.' },
      { q: 'What is XP?', a: 'Experience Points measure your progress. XP CANNOT be purchased \u2014 only earned by playing. Required for upgrades and evolution.' },
      { q: 'How do I earn SLUG Coins?', a: 'Race payouts, daily login bonus (15 SLUG), daily/weekly quests, mini games, and purchasing from the Shop.' },
    ]
  },
  {
    id: 'evolution',
    title: 'Evolution',
    icon: '\u{2B50}',
    content: [
      { q: 'How does evolution work?', a: 'Free Slug \u2192 Snail (Tier 1) \u2192 Elite (Tier 2) \u2192 Specialized (Tier 3) \u2192 Master (Tier 4). Each tier requires XP, race milestones, and SLUG Coins.' },
      { q: 'What are evolution paths?', a: 'At Tier 3 you choose: Velocity (speed focus), Fortress (defense focus), or Mystic (luck focus). Each path gives unique passive abilities.' },
      { q: 'Can I upgrade for free?', a: 'Yes! Free Slug \u2192 Snail can be done by earning 1500 XP, completing 30 races, winning 10, and logging in 25 days. Or pay $3 for instant upgrade.' },
    ]
  },
]

export default function Guide() {
  const [openSection, setOpenSection] = useState<string>('getting-started')

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">How to Play</h1>
        <p className="text-gray-400 mt-1">Everything you need to know about Slug Rush</p>
      </div>

      {/* Quick Links */}
      <div className="flex flex-wrap gap-2 mb-8">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setOpenSection(s.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              openSection === s.id
                ? 'bg-slug-green/20 text-slug-green'
                : 'text-gray-400 hover:text-white bg-slug-card border border-slug-border hover:bg-white/5'
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
            className={`bg-slug-card border border-slug-border rounded-xl overflow-hidden ${
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
      <div className="mt-8 bg-slug-card border border-slug-green/30 rounded-xl p-6 text-center">
        <h3 className="text-white font-bold text-lg mb-2">Ready to race?</h3>
        <p className="text-gray-400 text-sm mb-4">Mint your free slug and start racing today!</p>
        <div className="flex justify-center gap-3">
          <Link
            to="/mint"
            className="px-6 py-2.5 bg-slug-green text-slug-dark font-bold rounded-xl hover:bg-slug-green/90 transition-colors"
          >
            Mint Free Slug
          </Link>
          <Link
            to="/race"
            className="px-6 py-2.5 border border-slug-border text-gray-300 rounded-xl hover:bg-white/5 transition-colors"
          >
            Enter Race
          </Link>
        </div>
      </div>
    </div>
  )
}
