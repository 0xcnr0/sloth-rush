/**
 * Live race commentary — selection mechanics only.
 *
 * Every line of text lives in `config/theme.ts` under `THEME.commentary`.
 * This file owns priority (how long a line holds the ticker) and template
 * interpolation, never the words themselves.
 */

import { THEME } from '../config/theme'

/** Higher priority = more important, held on screen longer. */
const PRIORITY: Record<string, number> = {
  race_start: 3,
  position_change: 2,
  tactic_boost: 3,
  tactic_projectile: 3,
  mass_slow: 2,
  rain: 2,
  luck_orb: 2,
  collision: 2,
  close_race: 3,
  last_100m: 3,
  finish: 3,
}

export function getCommentary(
  type: string,
  context: { name?: string; name2?: string; pos?: number }
): string {
  const templates = THEME.commentary[type]
  if (!templates || templates.length === 0) return ''
  const template = templates[Math.floor(Math.random() * templates.length)]
  return template
    .replace(/\{name\}/g, context.name || '???')
    .replace(/\{name2\}/g, context.name2 || '???')
    .replace(/\{pos\}/g, String(context.pos || 1))
}

export function getCommentaryPriority(type: string): number {
  return PRIORITY[type] || 1
}
