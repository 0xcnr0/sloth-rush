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
      'Yarış başlıyor! Pistte 4 cesur sümüklü böcek!',
      '3... 2... 1... START! Sümüklü böcekler fırladı!',
      'Grand Kabuk pistinde ışıklar yandı!',
    ],
  },
  {
    type: 'position_change',
    priority: 2,
    templates: [
      '{name} liderliğe geçti! Bu bir sürpriz!',
      '{name} öne atıldı! {name2} geride kaldı!',
      'Sıralama değişti! {name} şimdi {pos}. sırada!',
      '{name} rakiplerini geçiyor! Ne bir hamle!',
    ],
  },
  {
    type: 'tactic_boost',
    priority: 3,
    templates: [
      '{name} BOOST aktifleştirdi! Roket gibi gidiyor!',
      'BOOST! {name} turbo moduna geçti!',
      '{name} gazı kökledi! Herkes yoldan çekilsin!',
    ],
  },
  {
    type: 'tactic_shell',
    priority: 3,
    templates: [
      'SHELL! {name} kabuğuna saklandı! Bu acıttı!',
      '{name} shell yedi! Hızı düşüyor!',
      'Kabuk saldırısı! {name} sendeliyor!',
    ],
  },
  {
    type: 'slime_burst',
    priority: 2,
    templates: [
      'Sümük Patlaması! Herkes kayıyor! KAOS!',
      'Lider sümük izi bıraktı! Arkadakiler kaydı!',
      'Pistte sümük! Dikkatlı olun!',
    ],
  },
  {
    type: 'rain',
    priority: 2,
    templates: [
      'Ani Yağmur! Tüm hızlar düştü!',
      'Yağmur bastırdı! Pist kayganlaştı!',
      'Bulutlar açıldı! Herkes yavaşlıyor!',
    ],
  },
  {
    type: 'luck_orb',
    priority: 2,
    templates: [
      'Şans Tobu belirdi! {name} yakaladı!',
      'Altın küre! {name} şanslı olan!',
      'Şans Tobu! {name} hız kazandı!',
    ],
  },
  {
    type: 'clash',
    priority: 2,
    templates: [
      'Kavga Anı! İki snail çarpıştı!',
      'ÇARPIŞ! {name} ve {name2} birbirine girdi!',
      'Temas! Refleksler devreye giriyor!',
    ],
  },
  {
    type: 'close_race',
    priority: 3,
    templates: [
      'Kafa kafaya! Sadece birkaç birim fark var!',
      'Bu inanılmaz yakın bir yarış!',
      'Boyun boyuna gidiyorlar! Kim kazanacak?!',
    ],
  },
  {
    type: 'last_100m',
    priority: 3,
    templates: [
      'SON 100 METRE! Bu inanılmaz bir yarış!',
      'Bitiş çizgisi göründü! Son sprint!',
      'Son düzlük! Herşey burada belli olacak!',
    ],
  },
  {
    type: 'finish',
    priority: 3,
    templates: [
      'VE KAZANAN... {name}! İnanılmaz bir yarış!',
      '{name} birinci! Muhteşem bir performans!',
      'BİTTİ! {name} şampiyon! 🏆',
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
