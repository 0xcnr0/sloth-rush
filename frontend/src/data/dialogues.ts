// Sloth personality dialogues by race type

export type DialogueMoment = 'race_start' | 'overtake' | 'pillow_hit' | 'boost' | 'win' | 'lose'

export interface DialogueSet {
  race_start: string[]
  overtake: string[]
  pillow_hit: string[]
  boost: string[]
  win: string[]
  lose: string[]
}

// Caffeine Junkie — cocky, overconfident
const CAFFEINE_JUNKIE: DialogueSet = {
  race_start: ['Out of my way!', 'This will be easy...', 'Ready to lose?'],
  overtake: ['Step aside!', 'Nobody can stop me!', 'Eat my dust!'],
  pillow_hit: ['Ouch! That\'s unfair!', 'You threw that at ME?!', 'That hurt but can\'t stop me!'],
  boost: ['TURBO TIME!', 'Rocket mode ON!', 'Haha, see ya later!'],
  win: ['No surprise here.', 'First place as always!', 'Eat my dust!'],
  lose: ['Just bad luck this time...', 'Try me again!', 'Rigged!'],
}

// Pillow Knight — noble, gentleman
const PILLOW_KNIGHT: DialogueSet = {
  race_start: ['May this be an honorable race!', 'My pillow is ready!', 'Fair play, everyone!'],
  overtake: ['Well raced.', 'Pardon me, passing through.', 'A knight always leads.'],
  pillow_hit: ['That was... ungentlemanly.', 'My fur endures!', 'Painful, but my honor stands.'],
  boost: ['My pillow is my shield!', 'The knight accelerates!', 'An honorable sprint!'],
  win: ['Victory with honor.', 'Well fought, everyone.', 'You may bow to the knight.'],
  lose: ['My rival was better.', 'Next time!', 'An honorable defeat.'],
}

// Dream Weaver — weird, mystical
const DREAM_WEAVER: DialogueSet = {
  race_start: ['My dreams give me power!', 'My dream spell is ready!', 'Spell time!'],
  overtake: ['Dream magic!', 'Dream pass!', 'Sleepy surprise!'],
  pillow_hit: ['My dream!', 'My dream broke!', 'My dreams are fading!'],
  boost: ['MEGA DREAM!', 'With dream power!', 'Sleepy turbo!'],
  win: ['Dream magic wins!', 'Dreams always win!', 'Dream victory dance!'],
  lose: ['My dream wasn\'t enough...', 'My dream faded...', 'Need more sleep...'],
}

// Thunder Nap — aggressive, fierce
const THUNDER_NAP: DialogueSet = {
  race_start: ['The storm is coming!', 'Get out of my way!', 'I\'ll pass like lightning!'],
  overtake: ['THUNDER!', 'Move it!', 'Storm coming through!'],
  pillow_hit: ['GRRR!', 'You\'ll pay for that!', 'My rage is building!'],
  boost: ['LIGHTNING MODE!', 'Thunder roars!', 'BOOM!'],
  win: ['The storm wins!', 'Nobody can stop me!', 'LIGHTNING CHAMPION!'],
  lose: ['This storm isn\'t over!', 'Rage building...', 'Next time you\'re going down!'],
}

const DIALOGUE_MAP: Record<string, DialogueSet> = {
  caffeine_junkie: CAFFEINE_JUNKIE,
  pillow_knight: PILLOW_KNIGHT,
  dream_weaver: DREAM_WEAVER,
  thunder_nap: THUNDER_NAP,
}

export function getDialogue(race: string | undefined, moment: DialogueMoment): string {
  const set = DIALOGUE_MAP[race || ''] || CAFFEINE_JUNKIE
  const lines = set[moment]
  return lines[Math.floor(Math.random() * lines.length)]
}

// --- Floating Emoji Reactions ---
export type EmoteMoment = 'overtaken' | 'pillow_hit' | 'boost_self' | 'winning' | 'comeback' | 'rain' | 'luck_orb' | 'close_finish' | 'yawn'

export const RACE_EMOTES: Record<EmoteMoment, string[]> = {
  overtaken:    ['\u{1F624}', '\u{1F621}', '\u{1F4A2}'],     // angry when overtaken
  pillow_hit:    ['\u{1F631}', '\u{1F92F}', '\u{1F635}'],     // shocked when hit
  boost_self:   ['\u{1F525}', '\u{1F4A8}', '\u{26A1}'],      // fired up when boosting
  winning:      ['\u{1F60E}', '\u{1F451}', '\u{1F4AA}'],     // confident when leading
  comeback:     ['\u{1F929}', '\u{1F603}', '\u{2728}'],      // excited when overtaking
  rain:         ['\u{1F622}', '\u{2614}', '\u{1F4A7}'],      // sad in rain
  luck_orb:     ['\u{2728}', '\u{1F31F}', '\u{1F4AB}'],      // sparkle when lucky
  close_finish: ['\u{1F628}', '\u{1F630}', '\u{1F62C}'],     // nervous at close finish
  yawn:         ['\u{1F971}', '\u{1F634}', '\u{1F62A}'],     // sleepy from yawn wave
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
  caffeine_junkie: {
    intro: ['Ready to lose?', 'Another win for me today!', 'I\'ll handle this easily.'],
    taunt: ['You\'re all so slow!', 'You can\'t catch me!', 'Eat my dust!'],
    confident: ['See you at first place.', 'Result is obvious.', 'Good luck... to me.'],
  },
  pillow_knight: {
    intro: ['May this be an honorable race!', 'My pillow is ready!', 'Good luck to all!'],
    taunt: ['A knight always wins.', 'You can\'t get past my defense!', 'A noble victory awaits.'],
    confident: ['I am ready.', 'I shall race with honor.', 'My pillow is my shield!'],
  },
  dream_weaver: {
    intro: ['My spells are ready!', 'My dreams give me power!', 'Dream time!'],
    taunt: ['Sleepy surprise!', 'My spell will slow you down!', 'Fear my dreams!'],
    confident: ['Magic always wins.', 'Dream power!', 'The way of dreams!'],
  },
  thunder_nap: {
    intro: ['The storm approaches!', 'I\'ll strike like lightning!', 'BOOM!'],
    taunt: ['Get out of my way!', 'My rage has built up!', 'THUNDER INCOMING!'],
    confident: ['Nobody can stop me.', 'The storm never ends.', 'THUNDER ROARS!'],
  },
}

export function getTrashTalk(race: string | undefined): { intro: string; taunt: string; confident: string } {
  const set = TRASH_TALK_MAP[race || ''] || TRASH_TALK_MAP.caffeine_junkie
  return {
    intro: set.intro[Math.floor(Math.random() * set.intro.length)],
    taunt: set.taunt[Math.floor(Math.random() * set.taunt.length)],
    confident: set.confident[Math.floor(Math.random() * set.confident.length)],
  }
}
