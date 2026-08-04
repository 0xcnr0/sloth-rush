/**
 * Racer barks and emotes — selection mechanics only.
 *
 * Every line of text lives in `config/theme.ts`. This file decides *when* and
 * *which*, never *what*.
 */

import { THEME } from '../config/theme'

export type DialogueMoment = 'race_start' | 'overtake' | 'projectile_hit' | 'boost' | 'win' | 'lose'

export type EmoteMoment =
  | 'overtaken'
  | 'projectile_hit'
  | 'boost_self'
  | 'winning'
  | 'comeback'
  | 'rain'
  | 'luck_orb'
  | 'close_finish'
  | 'mass_slow'

const DEFAULT_ARCHETYPE = 'speedster'

function pick(lines: readonly string[] | undefined): string {
  if (!lines || lines.length === 0) return ''
  return lines[Math.floor(Math.random() * lines.length)]
}

/** A one-line bark for an archetype at a given moment in the race. */
export function getDialogue(archetype: string | undefined, moment: DialogueMoment): string {
  const set = THEME.dialogue[archetype || ''] || THEME.dialogue[DEFAULT_ARCHETYPE]
  return pick(set?.[moment])
}

/** A floating emoji reaction for a given moment. */
export function getEmote(moment: EmoteMoment): string {
  return pick(THEME.emotes[moment])
}

/** Pre-race trash talk for an archetype. */
export function getTrashTalk(archetype: string | undefined): {
  intro: string
  taunt: string
  confident: string
} {
  const set = THEME.trashTalk[archetype || ''] || THEME.trashTalk[DEFAULT_ARCHETYPE]
  return {
    intro: pick(set.intro),
    taunt: pick(set.taunt),
    confident: pick(set.confident),
  }
}
