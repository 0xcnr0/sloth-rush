import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { THEME } from '../config/theme'

/**
 * The in-game reference, not the FAQ.
 *
 * All copy is derived from THEME so a rebrand never reaches this file, and the
 * numbers below are the ones the server actually uses — PER_RACE_STAT_GAIN and
 * DAILY_STAT_CAP in `routes/race.ts`, TIER_THRESHOLDS in
 * `simulation/evolution.ts`, ITEM_TUNING in `simulation/items.ts`. This page is
 * the only place the game explains itself, which makes it the place most likely
 * to describe a version that no longer exists; it has already documented a
 * currency, a shop, training, quests and three race formats, none of which are
 * in the game. Keep it honest or delete it. A wrong guide is worse than none.
 *
 * It was nineteen questions in four accordions, one open at a time — a document
 * with three quarters of itself behind a click. Guide is one of four buttons on
 * the bottom bar, so it is somewhere a player arrives mid-game with a specific
 * question ("why did nothing happen when I won?"), and the answer to that has
 * to be visible by scrolling, not by guessing which heading hides it. Hence:
 * the loop first, then the numbers, then the short honest answers.
 */

/** The three beats of the whole game. Nothing else is a source of progress. */
const LOOP = [
  {
    n: '1',
    title: 'Mint',
    body: `One free ${THEME.tiers.free} per wallet. No gas, and an email address is enough to start.`,
  },
  {
    n: '2',
    title: 'Race',
    body: 'Pick a distance, pack two items, and watch it run. Races are free and always will be.',
  },
  {
    n: '3',
    title: 'It grows',
    body: 'Every finish makes your racer measurably better, and enough of them change its shape.',
  },
]

const FAQ = [
  {
    q: 'Can a race be rigged?',
    a: 'No. Every race is a deterministic simulation of one seed, the simulation is open source, and the result hash is written to Base. Feed the same seed to the same code and you get the same race, frame for frame.',
  },
  {
    q: 'Who am I racing?',
    a: 'Bots fill any empty slot so a race always starts. They are labelled BOT, and they are not competing for anything.',
  },
  {
    q: `What does the ${THEME.tiers.pro} upgrade do?`,
    a: `Your ${THEME.tiers.free} is burned and a ${THEME.tiers.pro} is minted in its place: boxed, painted, and carrying a rarity rolled on-chain. It costs $3 in USDC and it is the only payment in the game.`,
  },
  {
    q: 'Does upgrading make me faster?',
    a: 'Not directly. It lifts your stat ceilings, so a Showcase can keep improving past the point where a Wind-Up stops. The rarity it rolls has no effect on racing at all.',
  },
  {
    q: 'Can I choose my rarity?',
    a: 'No. Chainlink VRF draws it on-chain at the moment of upgrade. Nobody — including us — can see or influence it beforehand.',
  },
  {
    q: 'Do I need to know anything about crypto?',
    a: 'No. Sign up with an email address, and minting costs no gas.',
  },
]

export default function Guide() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="toy-title text-3xl font-bold">How to play</h1>
        <p className="text-brand-dust mt-1">
          {THEME.brand.name} in three steps, and every number the game runs on.
        </p>
      </div>

      {/* The loop. Three rows in one panel rather than three stacked cards: on a
          phone the cards filled the screen, so a player who opened Guide to
          find out why their stats did not move had to scroll past the entire
          tutorial to reach the answer. */}
      <div className="toy-panel divide-y-[3px] divide-brand-ink/10">
        {LOOP.map((step, i) => (
          <motion.div
            key={step.n}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="p-4 flex gap-3"
          >
            <span className="inline-flex shrink-0 items-center justify-center w-7 h-7 rounded-full bg-brand-gold text-brand-ink font-black text-sm border-[3px] border-brand-ink">
              {step.n}
            </span>
            <div>
              <h2 className="text-brand-ink font-bold leading-tight">{step.title}</h2>
              <p className="text-brand-dust text-sm leading-relaxed">{step.body}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Inside a race */}
      <section>
        <h2 className="text-lg font-bold mb-3">Inside a race</h2>
        <div className="toy-panel divide-y-[3px] divide-brand-ink/10">
          <Row
            label="Two distances"
            body={
              <>
                <strong className="text-brand-ink">{THEME.raceFormats.sprint.name}</strong> &mdash;{' '}
                {THEME.raceFormats.sprint.blurb}
                <br />
                <strong className="text-brand-ink">{THEME.raceFormats.endurance.name}</strong> &mdash;{' '}
                {THEME.raceFormats.endurance.blurb}
                <br />
                That is their only difference, and it is the whole decision: the short track
                is won by raw top speed, the long one by a racer that does not fade.
              </>
            }
          />
          <Row
            label="Two items"
            body={
              <>
                <strong className="text-brand-ink">{THEME.items.boost.name}</strong> speeds you up
                for five seconds. <strong className="text-brand-ink">{THEME.items.hinder.name}</strong>{' '}
                slows one racer you name, for the same five seconds &mdash; you choose who, not the
                game. You pack up to two before the start and spend them during the race.
              </>
            }
          />
          <Row
            label="Where items come from"
            body={
              <>
                Your racer carries a stock of them, up to <Num>6</Num>. Carrying them costs
                nothing &mdash; one comes off only when you actually press it. Every finish earns
                one back and a win earns <Num>2</Num>, so an empty racer is packing a full
                loadout again after two races.
              </>
            }
          />
          <Row
            label="What a place is worth"
            body={
              <>
                Where you finish decides <em>which</em> stat grows: 1st feeds SPD, 2nd ACC,
                3rd STA, 4th REF. So spending a boost to take a place is buying that stat &mdash;
                the standings show what each place pays while the race is running.
              </>
            }
          />
          <Row
            label="When to spend them"
            body={
              <>
                Early rather than at the line. The server sets the exact tick, always a
                little ahead of what you have already watched &mdash; that is what stops an item
                from rewriting a moment you have seen &mdash; so one pressed on the last stretch
                may land after it.
              </>
            }
          />
          <Row
            label="The grid"
            body={
              <>
                Drawn from the race seed. Starting nearer the front is worth a small
                acceleration bonus for the first few seconds and then it is gone. Nobody
                gets a head start.
              </>
            }
          />
        </div>
      </section>

      {/* Getting better */}
      <section>
        <h2 className="text-lg font-bold mb-3">Getting better</h2>
        <div className="toy-panel divide-y-[3px] divide-brand-ink/10">
          <Row
            label="Racing, and only racing"
            body={
              <>
                Every finish adds <Num>+0.4</Num> to one stat &mdash; which stat depends on where
                you placed. There is nothing to buy, no training timer, and no other source.
              </>
            }
          />
          <Row
            label="A day holds four"
            body={
              <>
                A racer can gain at most <Num>+4.0</Num> per day, so about ten races fill it,
                and the count resets at midnight. <strong className="text-brand-ink">If you
                race, win, and nothing moves, this is almost always why.</strong>
              </>
            }
          />
          <Row
            label="Ceilings"
            body={
              <>
                Stats also stop at a ceiling: <Num>18</Num> per stat as a {THEME.tiers.free},{' '}
                <Num>22&ndash;35</Num> as a {THEME.tiers.pro} depending on rarity. A stat already
                at its ceiling will not move however well you race. Your racer&rsquo;s own
                ceiling is printed next to each stat in the {THEME.locations.home}.
              </>
            }
          />
          <Row
            label="Changing form"
            body={
              <>
                Add the six stats up. Crossing <Num>90</Num>, <Num>130</Num> or <Num>170</Num>{' '}
                changes your racer&rsquo;s shape &mdash; {THEME.evolutionTiers[0]} &rarr;{' '}
                {THEME.evolutionTiers[1]} &rarr; {THEME.evolutionTiers[2]} &rarr;{' '}
                {THEME.evolutionTiers[3]}. It happens on its own the moment you cross;
                there is no button and no fee. The first one also decides which of the four
                toys you become, from whichever stat you pushed hardest.
              </>
            }
          />
          <Row
            label="The six stats"
            body={
              <>
                SPD (top speed), ACC (acceleration), STA (stamina), AGI (agility),
                REF (reflex), LCK (luck). SPD is the base currency of a race; STA is what
                protects it over distance.
              </>
            }
          />
        </div>
      </section>

      {/* The two axes — the single most confusable thing in the game. */}
      <section className="toy-panel p-5 bg-brand-gold/10">
        <h2 className="text-brand-ink font-bold mb-2">Form and finish are different things</h2>
        <p className="text-brand-dust text-sm leading-relaxed">
          <strong className="text-brand-ink">Form</strong> is how big you grew, and you grow it
          by racing. <strong className="text-brand-ink">Rarity</strong> &mdash;{' '}
          {THEME.rarity.common} through {THEME.rarity.legendary} &mdash; is how well kept you
          are, and it comes from the upgrade roll. Rarity changes the surface of your toy and{' '}
          <strong className="text-brand-ink">never changes how it races.</strong>
        </p>
      </section>

      {/* The short answers */}
      <section>
        <h2 className="text-lg font-bold mb-3">Anything else</h2>
        <div className="space-y-4">
          {FAQ.map(item => (
            <div key={item.q}>
              <h3 className="text-brand-ink font-semibold">{item.q}</h3>
              <p className="text-brand-dust text-sm leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="toy-panel p-5 text-center">
        <p className="text-brand-ink font-bold mb-3">That is the whole game.</p>
        <Link
          to="/race"
          className="toy-btn block w-full py-3.5 bg-brand-gold text-brand-ink text-lg font-black"
        >
          RACE
        </Link>
        <Link
          to="/mint"
          className="block w-full py-2.5 text-brand-dust text-sm font-semibold hover:text-brand-ink transition-colors"
        >
          I do not have a racer yet
        </Link>
      </div>
    </div>
  )
}

/** One labelled fact. The label is the thing you scan for; the body answers it. */
function Row({ label, body }: { label: string; body: React.ReactNode }) {
  return (
    <div className="p-4 sm:flex sm:gap-4">
      <p className="text-brand-ink font-bold text-sm shrink-0 sm:w-40 mb-1 sm:mb-0">{label}</p>
      <p className="text-brand-dust text-sm leading-relaxed">{body}</p>
    </div>
  )
}

/** A number the server actually enforces, set apart so it can be found again. */
function Num({ children }: { children: React.ReactNode }) {
  return <span className="text-brand-ink font-bold tabular-nums">{children}</span>
}
