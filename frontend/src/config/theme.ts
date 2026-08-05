/**
 * THE SINGLE SOURCE OF THEME.
 *
 * Every player-visible noun lives here. Nothing else in the codebase may
 * contain theme vocabulary — code uses functional names that describe what a
 * thing *does* (`speedster`, `projectile`, `free`/`pro`), and this file maps
 * those to whatever the current brand calls them.
 *
 * Changing the theme should mean editing this file and swapping the art
 * folder. If a rename ever requires opening another source file, the
 * decoupling has sprung a leak — fix the leak, don't work around it.
 *
 * Verification: the theme grep excludes exactly this file (and the DB's
 * `migrations/legacyNames.ts`, which holds retired identifiers for one-time
 * rename SQL). Any third exclusion is a bug.
 */

export const THEME = {
  brand: {
    name: 'Wind-Up Rush',
    nameUpper: 'WIND-UP RUSH',
    tagline: 'Wind up. Race hard. Rewind later.',
    domain: 'winduprush.xyz',
    description: 'Wind-Up Toy Racing on Base',
  },

  currency: {
    /** Short form used inline next to a number. */
    symbol: 'SPRING',
    /**
     * Tek jenerik marka işareti: yükleme, cüzdan ekranı, onboarding, paylaşım
     * metni. Kurma anahtarı oyunun merkezî simgesi (ART_DIRECTION §7.2) — bir
     * hayvan maskotu değil, çünkü tema değişince maskot da değişir.
     */
    mark: '\u{1F511}',
    /** Long form used in prose. */
    name: 'SPRING',
    plural: 'SPRING',
  },

  /** Ownership tiers. Code says `free` / `pro`. */
  tiers: {
    free: 'Wind-Up',
    pro: 'Showcase',
  },

  locations: {
    /** The collection / home screen. */
    home: 'Toybox',
    /** The one V1 track. */
    track: 'Diorama Speedway',
  },

  /**
   * Rarity labels. Codes stay `common`..`legendary` everywhere in code;
   * these are real toy-collector grades, not invented fantasy words.
   */
  rarity: {
    common: 'Fair',
    uncommon: 'Good',
    rare: 'Excellent',
    epic: 'Near Mint',
    legendary: 'Mint',
  } as Record<string, string>,

  /** Archetypes. Code says `speedster` / `tank` / `trickster` / `burst`. */
  archetypes: {
    speedster: { label: 'Jetster', role: 'Speed', accent: '#E63946', emoji: '\u{1F680}' },
    tank: { label: 'Tinbot', role: 'Tank', accent: '#2A6FDB', emoji: '\u{1F916}' },
    trickster: { label: 'Waddler', role: 'Trickster', accent: '#FFC93C', emoji: '\u{1F986}' },
    burst: { label: 'Chomper', role: 'Burst', accent: '#4CAF6D', emoji: '\u{1F996}' },
  } as Record<string, { label: string; role: string; accent: string; emoji: string }>,

  /** Evolution paths. Code says `speed` / `endurance` / `luck`. */
  paths: {
    speed: {
      label: 'Overwind',
      statBonus: 'SPD/ACC +5 cap',
      description: 'The path of raw speed. Wound past the safe mark, built for final sprints.',
    },
    endurance: {
      label: 'Reinforce',
      statBonus: 'STA/REF +5 cap',
      description: 'The path of resilience. Thicker tin and a slower spring make an unstoppable tank.',
    },
    luck: {
      label: 'Charmed',
      statBonus: 'LCK/AGI +5 cap',
      description: 'The path of fortune. A lucky marble rattling inside pulls good events your way.',
    },
  } as Record<string, { label: string; statBonus: string; description: string }>,

  /** Passive abilities. Code names say what the passive does. */
  passives: {
    late_surge: { label: 'Late Surge', description: 'Last third of the track, +10% speed.' },
    overtake_boost: { label: 'Second Wind', description: 'After an overtake, a short speed burst.' },
    fatigue_resist: { label: 'Slow Spring', description: 'Fatigue builds 50% slower.' },
    impact_resist: { label: 'Tin Plating', description: 'Projectile hits slow you far less.' },
    luck_magnet: { label: 'Lucky Marble', description: 'Attracts Luck Orbs 20% more often.' },
    misfortune_flip: { label: 'Rewind', description: 'A bad event sometimes flips into a speed boost.' },
  } as Record<string, { label: string; description: string }>,

  /** Random race events. */
  events: {
    mass_slow: 'Wind-Down',
    rain: 'Sudden Rain',
    luck_orb: 'Luck Orb',
    collision: 'Collision',
  } as Record<string, string>,

  /** Tactic-mode actions. Code says `boost` / `projectile`. */
  tactics: {
    boost: 'Turbo Wind',
    projectile: 'Marble Toss',
  } as Record<string, string>,

  /** Mini games. Code names the action; the stat it trains is in the label. */
  miniGames: {
    dodge: 'Marble Dodge',
    stretch: 'Spring Stretch',
    lift: 'Tin Lift',
    charm: 'Lucky Pick',
    tap: 'Key Wind',
  } as Record<string, string>,

  /** Coin packages. Code says `bag` / `crate` / `pallet` / `container`. */
  shopPackages: {
    bag: 'Starter Pack',
    crate: 'Gift Box',
    pallet: 'Toy Chest',
    container: "Collector's Crate",
  } as Record<string, string>,

  /** Evolution tiers — form, not rarity. */
  evolutionTiers: {
    0: 'Boxed',
    1: 'Painted',
    2: 'Kitted',
    3: 'Showpiece',
  } as Record<number, string>,

  /**
   * In-race barks, keyed by archetype code. `data/dialogues.ts` owns the
   * selection mechanics; every word a player reads is here.
   */
  dialogue: {
    speedster: {
      race_start: ['Out of my way!', 'This will be easy...', 'Ready to lose?'],
      overtake: ['Step aside!', 'Nobody can stop me!', 'Eat my dust!'],
      projectile_hit: ['Ouch! That was uncalled for!', 'You threw that at ME?!', 'Dented, not stopped!'],
      boost: ['TURBO TIME!', 'Rocket mode ON!', 'Haha, see ya later!'],
      win: ['No surprise here.', 'First place as always!', 'Eat my dust!'],
      lose: ['Just bad luck this time...', 'Run it back!', 'My spring slipped!'],
    },
    tank: {
      race_start: ['May this be an honourable race!', 'All plates fastened!', 'Fair play, everyone!'],
      overtake: ['Well raced.', 'Pardon me, coming through.', 'Steady wins it.'],
      projectile_hit: ['Barely scratched the paint.', 'My plating holds!', 'A dent I can live with.'],
      boost: ['Full wind!', 'Heavy and fast!', 'Here I come!'],
      win: ['Victory with honour.', 'Well fought, everyone.', 'Built to last.'],
      lose: ['My rival outran me.', 'Next time!', 'An honourable defeat.'],
    },
    trickster: {
      race_start: ['Watch closely...', 'You will not see this coming.', 'Let us play.'],
      overtake: ['Now you see me!', 'Sleight of foot!', 'Surprise!'],
      projectile_hit: ['Rude!', 'You will regret that.', 'Noted. Filed away.'],
      boost: ['Wound to the limit!', 'Blink and I am gone!', 'Off I waddle!'],
      win: ['Cleverness wins.', 'Told you not to blink.', 'A charmed run!'],
      lose: ['My luck ran dry...', 'The marble rolled wrong.', 'Next trick will land.'],
    },
    burst: {
      race_start: ['Teeth out!', 'Get out of my way!', 'I will chew right through!'],
      overtake: ['CHOMP!', 'Move it!', 'Coming through!'],
      projectile_hit: ['GRRR!', 'You will pay for that!', 'Now I am wound up!'],
      boost: ['FULL CRANK!', 'Springs screaming!', 'BOOM!'],
      win: ['All teeth, all speed!', 'Nobody can stop me!', 'CHAMPION!'],
      lose: ['This is not over!', 'Winding back up...', 'Next time you are done for!'],
    },
  } as Record<string, Record<string, string[]>>,

  /** Pre-race trash talk, keyed by archetype code. */
  trashTalk: {
    speedster: {
      intro: ['Ready to lose?', 'Another win for me today!', 'I will handle this easily.'],
      taunt: ['You are all so slow!', 'You cannot catch me!', 'Eat my dust!'],
      confident: ['See you at first place.', 'Result is obvious.', 'Good luck... to me.'],
    },
    tank: {
      intro: ['May this be an honourable race!', 'All plates fastened!', 'Good luck to all!'],
      taunt: ['Steady always wins.', 'You cannot get past this plating!', 'A noble victory awaits.'],
      confident: ['I am ready.', 'I shall race with honour.', 'Built to last.'],
    },
    trickster: {
      intro: ['Watch closely...', 'My marble is feeling lucky!', 'Let us play.'],
      taunt: ['Blink and I am gone!', 'You will not see it coming!', 'Careful now.'],
      confident: ['Cleverness always wins.', 'The marble knows.', 'A charmed run awaits.'],
    },
    burst: {
      intro: ['Teeth out!', 'I will chew right through!', 'BOOM!'],
      taunt: ['Get out of my way!', 'I am fully wound!', 'CHOMP INCOMING!'],
      confident: ['Nobody can stop me.', 'All teeth, all speed.', 'FULL CRANK!'],
    },
  } as Record<string, { intro: string[]; taunt: string[]; confident: string[] }>,

  /** Floating emoji reactions, keyed by moment. */
  emotes: {
    overtaken: ['\u{1F624}', '\u{1F621}', '\u{1F4A2}'],
    projectile_hit: ['\u{1F631}', '\u{1F92F}', '\u{1F635}'],
    boost_self: ['\u{1F525}', '\u{1F4A8}', '\u{26A1}'],
    winning: ['\u{1F60E}', '\u{1F451}', '\u{1F4AA}'],
    comeback: ['\u{1F929}', '\u{1F603}', '\u{2728}'],
    rain: ['\u{1F622}', '\u{2614}', '\u{1F4A7}'],
    luck_orb: ['\u{2728}', '\u{1F31F}', '\u{1F4AB}'],
    close_finish: ['\u{1F628}', '\u{1F630}', '\u{1F62C}'],
    mass_slow: ['\u{1F971}', '\u{1F634}', '\u{1F62A}'],
  } as Record<string, string[]>,

  /**
   * Live commentary lines, keyed by event type.
   * `{name}` / `{name2}` / `{pos}` are filled in by data/commentary.ts.
   */
  commentary: {
    race_start: [
      'The race is on! Four racers on the shelf!',
      '3... 2... 1... GO! Springs released!',
      'Lights on at the Diorama Speedway!',
    ],
    position_change: [
      '{name} takes the lead! What a surprise!',
      '{name} surges ahead! {name2} falls behind!',
      'Position change! {name} is now P{pos}!',
      '{name} overtakes the pack! What a move!',
    ],
    tactic_boost: [
      '{name} hits the Turbo Wind! Going like a rocket!',
      'TURBO WIND! {name} winds it past the red line!',
      '{name} floors it! Everyone get out of the way!',
    ],
    tactic_projectile: [
      'MARBLE TOSS! {name} took a direct hit! Ouch!',
      '{name} caught a marble! Speed dropping!',
      'Marble incoming! {name} is staggering!',
    ],
    mass_slow: [
      'Wind-Down! Every spring on the shelf is slackening!',
      'The leader triggered a Wind-Down! Others are slowing!',
      'Springs unwinding across the track! Watch out!',
    ],
    rain: [
      'Sudden Rain! All speeds dropping!',
      'Rain is pouring down! The shelf is slippery!',
      'Clouds opened up! Everyone is slowing down!',
    ],
    luck_orb: [
      'Luck Orb appeared! {name} grabbed it!',
      'Golden orb! {name} is the lucky one!',
      'Luck Orb! {name} gains a speed boost!',
    ],
    collision: [
      'Collision! Two racers just tangled up!',
      'CRASH! {name} and {name2} clattered together!',
      'Contact! Reflexes kicking in!',
    ],
    close_race: [
      'Neck and neck! Only a few units apart!',
      'This is an incredibly close race!',
      'Side by side! Who will take it?!',
    ],
    last_100m: [
      'FINAL STRETCH! This is an amazing race!',
      'Finish line in sight! Final sprint!',
      'Home stretch! Everything will be decided here!',
    ],
    finish: [
      'AND THE WINNER IS... {name}! What a race!',
      '{name} finishes first! Incredible performance!',
      "IT'S OVER! {name} is the champion!",
    ],
  } as Record<string, string[]>,
} as const

/** Currency symbol — by far the most-used lookup, so it gets a short alias. */
export const CUR = THEME.currency.symbol

/** Display label for a racer tier code (`free` / `pro`). */
export function tierLabel(type: string | undefined): string {
  return type === 'free' ? THEME.tiers.free : THEME.tiers.pro
}

/** Display label for a rarity code, falling back to the raw code. */
export function rarityLabel(rarity: string | undefined | null): string {
  return (rarity && THEME.rarity[rarity]) || ''
}

/** Display label for an archetype code, falling back to the raw code. */
export function archetypeLabel(archetype: string | undefined | null): string {
  return (archetype && THEME.archetypes[archetype]?.label) || ''
}

/** Accent colour for an archetype code. */
export function archetypeAccent(archetype: string | undefined | null): string | undefined {
  return archetype ? THEME.archetypes[archetype]?.accent : undefined
}

/** Display label for a passive code. */
export function passiveLabel(passive: string | undefined | null): string {
  return (passive && THEME.passives[passive]?.label) || ''
}

/** Display label for an evolution path code. */
export function pathLabel(path: string | undefined | null): string {
  return (path && THEME.paths[path]?.label) || ''
}
