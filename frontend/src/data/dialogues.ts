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

// Turbo Slug — kibirli, özgüvenli
const TURBO_SLUG: DialogueSet = {
  race_start: ['Yoldan çekil!', 'Kolay olacak...', 'Hazır mısınız kaybetmeye?'],
  overtake: ['Kenara çekil!', 'Beni kimse durduramaz!', 'Toz yuttunuz!'],
  shell_hit: ['Ouch! Bu haksızlık!', 'Bana mı attın?!', 'Acıttı ama durduramaz!'],
  boost: ['TURBO ZAMANI!', 'Roket modu ON!', 'Haha, hoşçakalın!'],
  win: ['Sürpriz değil.', 'Her zamanki gibi birinci!', 'Toz yuttunuz!'],
  lose: ['Bu sefer şanssızdım...', 'Tekrar deneyin bakalım!', 'Hakem!'],
}

// Shell Knight — asil, centilmen
const SHELL_KNIGHT: DialogueSet = {
  race_start: ['Onurlu bir yarış olsun!', 'Kabuğum hazır!', 'Hadi beyler, fair play!'],
  overtake: ['İyi yarıştı.', 'Affedersin, geçiyorum.', 'Bir şövalye her zaman öndedir.'],
  shell_hit: ['Bu... asil değildi.', 'Kabuğum dayanır!', 'Acı ama onurum yerinde.'],
  boost: ['Kabuğum kalkanımdır!', 'Şövalye hızlanıyor!', 'Onurlu bir sprint!'],
  win: ['Zafer onurludur.', 'İyi mücadele etti herkes.', 'Kabuğumu öpebilirsiniz.'],
  lose: ['Rakibim daha iyiydi.', 'Bir dahaki sefere!', 'Onurlu bir mağlubiyet.'],
}

// Goo Mage — tuhaf, mistik
const GOO_MAGE: DialogueSet = {
  race_start: ['Baloncuklarım güç veriyor!', 'Sümüğüm hazır!', 'Büyü zamanı!'],
  overtake: ['Sümük büyüsü!', 'Baloncuk geçişi!', 'Yapışkan sürpriz!'],
  shell_hit: ['Sümüğüm!', 'Büyüm bozuldu!', 'Baloncuklarım patlıyor!'],
  boost: ['MEGA SÜMÜK!', 'Büyü gücüyle!', 'Yapışkan turbo!'],
  win: ['Büyü kazandı!', 'Sümük her zaman kazanır!', 'Baloncuk zafer dansı!'],
  lose: ['Büyüm yetmedi...', 'Sümüğüm kurudu...', 'Daha çok baloncuk lazım...'],
}

// Storm Racer — agresif, sert
const STORM_RACER: DialogueSet = {
  race_start: ['Fırtına yaklaşıyor!', 'Yolumdan çekil!', 'Şimşek gibi geçeceğim!'],
  overtake: ['YILDIRIM!', 'Çekil önümden!', 'Fırtına geçiyor!'],
  shell_hit: ['GRRR!', 'Bunu ödeyeceksin!', 'Öfkem artıyor!'],
  boost: ['ŞIMŞEK MODU!', 'Gök gürültüsü!', 'BOOM!'],
  win: ['Fırtına kazandı!', 'Kimse duramaz!', 'ŞİMŞEK! ŞAMPİYON!'],
  lose: ['Bu fırtına bitmedi!', 'Öfke birikiyor...', 'Bir dahakine yıkılırsınız!'],
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
    intro: ['Hazir misiniz kaybetmeye?', 'Bugun de ben kazanacagim!', 'Kolayca halledecegim.'],
    taunt: ['Siz yavasssiniz!', 'Beni yakalayamazsiniz!', 'Toz yutacaksiniz!'],
    confident: ['Birinci sirada gorusuruz.', 'Sonuc belli zaten.', 'Kolay gelsin... bana.'],
  },
  shell_knight: {
    intro: ['Onurlu bir yaris olsun!', 'Kabugum hazir!', 'Herkese basarilar!'],
    taunt: ['Sovayle her zaman kazanir.', 'Kabugumdan gecemezsiniz!', 'Asil bir zafer olacak.'],
    confident: ['Hazirim.', 'Onurumla yarisacagim.', 'Kabugum kalkanim!'],
  },
  goo_mage: {
    intro: ['Buyulerim hazir!', 'Baloncuklarim guc veriyor!', 'Sumuk zamani!'],
    taunt: ['Yapiskan surpriz!', 'Buyum sizi yavaslacak!', 'Sumugumden korkmalisiniz!'],
    confident: ['Buyu her zaman kazanir.', 'Baloncuk gucu!', 'Sumuk yolu!'],
  },
  storm_racer: {
    intro: ['Firtina yaklassiyor!', 'Simsek gibi gececegim!', 'BOOM!'],
    taunt: ['Yolumdan cekilin!', 'Ofkem birikti!', 'YILDIRIM ATACAGIM!'],
    confident: ['Kimse duramaz.', 'Firtina bitmez.', 'GOK GURULTUSU!'],
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
