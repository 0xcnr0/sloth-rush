// Live race commentary templates
// {name} = snail name, {name2} = second snail, {pos} = position

export interface CommentaryEntry {
  type: string
  templates: string[]
  priority: number // higher = more important, shown longer
}

export const COMMENTARY: CommentaryEntry[] = [
  {
    type: 'race_start',
    priority: 3,
    templates: [
      'The race is on! 4 brave snails on the track!',
      '3... 2... 1... GO! The snails are off!',
      'Lights on at the Grand Shell track!',
    ],
  },
  {
    type: 'position_change',
    priority: 2,
    templates: [
      '{name} takes the lead! What a surprise!',
      '{name} surges ahead! {name2} falls behind!',
      'Position change! {name} is now P{pos}!',
      '{name} overtakes the pack! What a move!',
    ],
  },
  {
    type: 'tactic_boost',
    priority: 3,
    templates: [
      '{name} activated BOOST! Going like a rocket!',
      'BOOST! {name} hits turbo mode!',
      '{name} floors it! Everyone get out of the way!',
    ],
  },
  {
    type: 'tactic_shell',
    priority: 3,
    templates: [
      'SHELL HIT! {name} took a direct hit! Ouch!',
      '{name} got shelled! Speed dropping!',
      'Shell attack! {name} is staggering!',
    ],
  },
  {
    type: 'slime_burst',
    priority: 2,
    templates: [
      'Slime Burst! Everyone is sliding! CHAOS!',
      'The leader left a slime trail! Others are slipping!',
      'Slime on the track! Watch out!',
    ],
  },
  {
    type: 'rain',
    priority: 2,
    templates: [
      'Sudden Rain! All speeds dropping!',
      'Rain is pouring down! Track is slippery!',
      'Clouds opened up! Everyone is slowing down!',
    ],
  },
  {
    type: 'luck_orb',
    priority: 2,
    templates: [
      'Luck Orb appeared! {name} grabbed it!',
      'Golden orb! {name} is the lucky one!',
      'Luck Orb! {name} gains a speed boost!',
    ],
  },
  {
    type: 'clash',
    priority: 2,
    templates: [
      'Clash! Two snails collided!',
      'CRASH! {name} and {name2} tangled up!',
      'Contact! Reflexes kicking in!',
    ],
  },
  {
    type: 'close_race',
    priority: 3,
    templates: [
      'Neck and neck! Only a few units apart!',
      'This is an incredibly close race!',
      'Side by side! Who will take it?!',
    ],
  },
  {
    type: 'last_100m',
    priority: 3,
    templates: [
      'FINAL 100 METERS! This is an amazing race!',
      'Finish line in sight! Final sprint!',
      'Home stretch! Everything will be decided here!',
    ],
  },
  {
    type: 'finish',
    priority: 3,
    templates: [
      'AND THE WINNER IS... {name}! What a race!',
      '{name} finishes first! Incredible performance!',
      'IT\'S OVER! {name} is the champion!',
    ],
  },
]

export function getCommentary(type: string, context: { name?: string; name2?: string; pos?: number }): string {
  const entry = COMMENTARY.find(c => c.type === type)
  if (!entry) return ''
  const template = entry.templates[Math.floor(Math.random() * entry.templates.length)]
  return template
    .replace(/\{name\}/g, context.name || '???')
    .replace(/\{name2\}/g, context.name2 || '???')
    .replace(/\{pos\}/g, String(context.pos || 1))
}

export function getCommentaryPriority(type: string): number {
  return COMMENTARY.find(c => c.type === type)?.priority || 1
}
