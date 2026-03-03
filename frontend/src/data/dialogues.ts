// Snail personality dialogues by race type

export type DialogueMoment = 'race_start' | 'overtake' | 'shell_hit' | 'boost' | 'win' | 'lose'

export interface DialogueSet {
  race_start: string[]
  overtake: string[]
  shell_hit: string[]
  boost: string[]
  win: string[]
  lose: string[]
}

// Turbo Slug — cocky, overconfident
const TURBO_SLUG: DialogueSet = {
  race_start: ['Out of my way!', 'This will be easy...', 'Ready to lose?'],
  overtake: ['Step aside!', 'Nobody can stop me!', 'Eat my dust!'],
  shell_hit: ['Ouch! That\'s unfair!', 'You threw that at ME?!', 'That hurt but can\'t stop me!'],
  boost: ['TURBO TIME!', 'Rocket mode ON!', 'Haha, see ya later!'],
  win: ['No surprise here.', 'First place as always!', 'Eat my dust!'],
  lose: ['Just bad luck this time...', 'Try me again!', 'Rigged!'],
}

// Shell Knight — noble, gentleman
const SHELL_KNIGHT: DialogueSet = {
  race_start: ['May this be an honorable race!', 'My shell is ready!', 'Fair play, everyone!'],
  overtake: ['Well raced.', 'Pardon me, passing through.', 'A knight always leads.'],
  shell_hit: ['That was... ungentlemanly.', 'My shell endures!', 'Painful, but my honor stands.'],
  boost: ['My shell is my shield!', 'The knight accelerates!', 'An honorable sprint!'],
  win: ['Victory with honor.', 'Well fought, everyone.', 'You may kiss my shell.'],
  lose: ['My rival was better.', 'Next time!', 'An honorable defeat.'],
}

// Goo Mage — weird, mystical
const GOO_MAGE: DialogueSet = {
  race_start: ['My bubbles give me power!', 'My slime is ready!', 'Spell time!'],
  overtake: ['Slime magic!', 'Bubble pass!', 'Sticky surprise!'],
  shell_hit: ['My slime!', 'My spell broke!', 'My bubbles are popping!'],
  boost: ['MEGA SLIME!', 'With spell power!', 'Sticky turbo!'],
  win: ['Magic wins!', 'Slime always wins!', 'Bubble victory dance!'],
  lose: ['My spell wasn\'t enough...', 'My slime dried up...', 'Need more bubbles...'],
}

// Storm Racer — aggressive, fierce
const STORM_RACER: DialogueSet = {
  race_start: ['The storm is coming!', 'Get out of my way!', 'I\'ll pass like lightning!'],
  overtake: ['THUNDER!', 'Move it!', 'Storm coming through!'],
  shell_hit: ['GRRR!', 'You\'ll pay for that!', 'My rage is building!'],
  boost: ['LIGHTNING MODE!', 'Thunder roars!', 'BOOM!'],
  win: ['The storm wins!', 'Nobody can stop me!', 'LIGHTNING CHAMPION!'],
  lose: ['This storm isn\'t over!', 'Rage building...', 'Next time you\'re going down!'],
}

const DIALOGUE_MAP: Record<string, DialogueSet> = {
  turbo_slug: TURBO_SLUG,
  shell_knight: SHELL_KNIGHT,
  goo_mage: GOO_MAGE,
  storm_racer: STORM_RACER,
}

export function getDialogue(race: string | undefined, moment: DialogueMoment): string {
  const set = DIALOGUE_MAP[race || ''] || TURBO_SLUG
  const lines = set[moment]
  return lines[Math.floor(Math.random() * lines.length)]
}

// --- Floating Emoji Reactions ---
export type EmoteMoment = 'overtaken' | 'shell_hit' | 'boost_self' | 'winning' | 'comeback' | 'rain' | 'luck_orb' | 'close_finish' | 'slime'

export const RACE_EMOTES: Record<EmoteMoment, string[]> = {
  overtaken:    ['\u{1F624}', '\u{1F621}', '\u{1F4A2}'],     // angry when overtaken
  shell_hit:    ['\u{1F631}', '\u{1F92F}', '\u{1F635}'],     // shocked when hit
  boost_self:   ['\u{1F525}', '\u{1F4A8}', '\u{26A1}'],      // fired up when boosting
  winning:      ['\u{1F60E}', '\u{1F451}', '\u{1F4AA}'],     // confident when leading
  comeback:     ['\u{1F929}', '\u{1F603}', '\u{2728}'],      // excited when overtaking
  rain:         ['\u{1F622}', '\u{2614}', '\u{1F4A7}'],      // sad in rain
  luck_orb:     ['\u{2728}', '\u{1F31F}', '\u{1F4AB}'],      // sparkle when lucky
  close_finish: ['\u{1F628}', '\u{1F630}', '\u{1F62C}'],     // nervous at close finish
  slime:        ['\u{1F922}', '\u{1F4A9}', '\u{1F92E}'],     // disgusted by slime
}

export function getEmote(moment: EmoteMoment): string {
  const emotes = RACE_EMOTES[moment]
  return emotes[Math.floor(Math.random() * emotes.length)]
}

// --- Pre-Race Trash Talk ---
export type TrashTalkSet = {
  intro: string[]
  taunt: string[]
  confident: string[]
}

const TRASH_TALK_MAP: Record<string, TrashTalkSet> = {
  turbo_slug: {
    intro: ['Ready to lose?', 'Another win for me today!', 'I\'ll handle this easily.'],
    taunt: ['You\'re all so slow!', 'You can\'t catch me!', 'Eat my dust!'],
    confident: ['See you at first place.', 'Result is obvious.', 'Good luck... to me.'],
  },
  shell_knight: {
    intro: ['May this be an honorable race!', 'My shell is ready!', 'Good luck to all!'],
    taunt: ['A knight always wins.', 'You can\'t get past my shell!', 'A noble victory awaits.'],
    confident: ['I am ready.', 'I shall race with honor.', 'My shell is my shield!'],
  },
  goo_mage: {
    intro: ['My spells are ready!', 'My bubbles give me power!', 'Slime time!'],
    taunt: ['Sticky surprise!', 'My spell will slow you down!', 'Fear my slime!'],
    confident: ['Magic always wins.', 'Bubble power!', 'The way of slime!'],
  },
  storm_racer: {
    intro: ['The storm approaches!', 'I\'ll strike like lightning!', 'BOOM!'],
    taunt: ['Get out of my way!', 'My rage has built up!', 'THUNDER INCOMING!'],
    confident: ['Nobody can stop me.', 'The storm never ends.', 'THUNDER ROARS!'],
  },
}

export function getTrashTalk(race: string | undefined): { intro: string; taunt: string; confident: string } {
  const set = TRASH_TALK_MAP[race || ''] || TRASH_TALK_MAP.turbo_slug
  return {
    intro: set.intro[Math.floor(Math.random() * set.intro.length)],
    taunt: set.taunt[Math.floor(Math.random() * set.taunt.length)],
    confident: set.confident[Math.floor(Math.random() * set.confident.length)],
  }
}
