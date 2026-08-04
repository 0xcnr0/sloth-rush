# REBRAND + GÖRSEL YENİLEME PLANI

**Tarih:** 2026-08-04
**Durum:** Tema kilitlendi (v2) — uygulamaya hazır
**Baz alınan commit:** `0d2e4c2` (Sprint 8)

## Revizyon notu — tema tamamen değişti

İlk sürümde tema **SCRAP RUSH** (mekanik yaratıklar/hurda) idi. Kendi sanat denemelerimiz (3 tur) hiç oturmadı; ardından hem kendi keşfimiz hem 4 bağımsız dış AI aracı (ChatGPT, Gemini, Ludo.ai, Grok) — sıfır ortak bağlamla — bağımsız olarak **kurmalı oyuncak** fikrine vardı. Detaylı süreç ve kanıt zinciri için bkz. [ART_DIRECTION.md](ART_DIRECTION.md). Bu doküman artık yeni temaya göre güncel.

## Kararlar (kilitlendi)

| Konu | Karar |
|---|---|
| İsim | **WIND-UP RUSH** |
| Para birimi | **SPRING** |
| Slogan | **"Wind up. Race hard. Rewind later."** |
| Tema | Kurmalı oyuncaklar — tin/plastik, anahtarla kurulan klasik oyuncaklar |
| Sanat stili | **Kalın outline + parlak doygun toon** (Stumble Guys/Turbo FAST ekolü) — test edildi, işe yaradı. Detay: [ART_DIRECTION.md](ART_DIRECTION.md) |
| Animasyon | Rive (oyun içi) + fal.ai video (pazarlama) hibrit |
| Üretim aracı | fal.ai — Nano Banana 2 / FLUX.2 / Seedream |
| İzleyici | **Salt izleme** — hiçbir etkileşim yok, tahmin sistemi kaldırılıyor |
| Dil | **Sıfır bahis terimi** — ücretli yarış var, bahis çağrışımı yok |

Slogan, üç marka kuşağı boyunca korunan üç vuruşlu ritmi sürdürüyor:
"Wake up. Race hard. Nap later." → "Wind up. Race hard. Rewind later."

## Rarity ladder — gerçek koleksiyoncu terminolojisi

Oyuncak koleksiyonculuğunda gerçekten kullanılan bir durum/derece skalası, uydurma fantezi kelimeleri değil:

**Fair → Good → Excellent → Near Mint → Mint**

Free/Pro tier: **Wind-Up** (temel, kutu yok) → **Showcase** (vitrin kalite, kutulu, boyalı)

---

# 1. Temel Mimari Kararı: Temayı Koddan Ayır

## Problem

Bu projenin **ikinci** rebrand'i. İlki (Slug Rush → Sloth Rush) 5 fazlık, 60+ adımlık bir find-replace operasyonu oldu — çünkü tema kodun her katmanına gömülmüştü.

Şu anki tema yüzeyi: **64 dosyada 2387 eşleşme.**

```
DB şeması      →  sloths tablosu, sloth_id kolonu, 'free_sloth' type değeri
API route      →  /api/sloth
CSS değişken   →  --color-sloth-green + 300 küsur class kullanımı
Kod tipleri    →  SlothStats, caffeine_rush, pillow_fight, yawn_wave
Kontratlar     →  FreeSloth.sol, Sloth.sol, SlothRush.sol
```

Aynı işlemi üçüncü kez yapmak istemiyoruz.

## Çözüm

**Tek seferlik yapısal migration** ile kodu tema-nötr hale getir, tüm tema-özel isimleri tek bir config dosyasına topla.

### Kural: kodda fonksiyonel isim, config'de tema ismi

Kod, mekaniğin **ne yaptığını** anlatan isimler kullanır. Temanın ne olduğunu bilmez.

| Katman | Şu an (temaya bağlı) | Hedef (tema-nötr) |
|---|---|---|
| DB tablosu | `sloths` | `racers` |
| DB kolonu | `sloth_id` | `racer_id` |
| Type değeri | `'free_sloth'` / `'sloth'` | `'free'` / `'pro'` |
| API route | `/api/sloth` | `/api/racer` |
| TS interface | `SlothStats` | `RacerStats` |
| CSS değişken | `--color-sloth-green` | `--color-brand-primary` |
| Kontrat | `FreeSloth.sol` | `FreeRacer.sol` |
| Kontrat | `Sloth.sol` | `Racer.sol` |
| Kontrat | `SlothRush.sol` | `RaceCore.sol` |

### Arketip / passive / event isimleri de fonksiyonelleşir

Bunlar DB'de string enum olarak duruyor. Tema değişince bunların da değişmesi gerekiyordu — artık gerekmeyecek.

| Kategori | Şu an | Hedef (fonksiyonel) |
|---|---|---|
| Arketip | `caffeine_junkie` | `speedster` |
| Arketip | `pillow_knight` | `tank` |
| Arketip | `dream_weaver` | `trickster` |
| Arketip | `thunder_nap` | `burst` |
| Passive | `caffeine_rush` | `late_surge` |
| Passive | `adrenaline_wake` | `overtake_boost` |
| Passive | `deep_sleep` | `fatigue_resist` |
| Passive | `thick_fur` | `damage_resist` |
| Passive | `dream_catcher` | `luck_boost` |
| Passive | `lucid_dream` | `luck_reroll` |
| Event | `yawn_wave` | `mass_slow` |
| Event | `pillow_fight` | `collision` |
| Taktik | `pillow` | `projectile` |
| Evrim yolu | `caffeine` / `hibernate` / `dreamwalk` | `speed` / `endurance` / `luck` |

### theme.ts — tek tema kaynağı

```ts
// frontend/src/config/theme.ts  (backend de aynı dosyayı paylaşır)

export const THEME = {
  brand: {
    name: 'WIND-UP RUSH',
    tagline: 'Wind up. Race hard. Rewind later.',
    currency: { code: 'SPRING', symbol: '🔧', name: 'Spring' },
  },

  locations: {
    home: 'Toybox',               // eski: Treehouse / Hangar
    track: 'Diorama Speedway',    // eski: Grand Kabuk / Grand Circuit
  },

  entities: {
    free: { label: 'Wind-Up',  plural: 'Wind-Ups' },   // kutu yok, temel
    pro:  { label: 'Showcase', plural: 'Showcases' },  // vitrin kalite, kutulu
  },

  archetypes: {
    speedster: { label: 'Jetster', blurb: 'Tapered tin rocket, built for the straightaway.' },
    tank:      { label: 'Tinbot',  blurb: 'Boxy and stubborn — nothing knocks it off line.' },
    trickster: { label: 'Waddler', blurb: 'Duck-shaped chaos. You never know which way it turns.' },
    burst:     { label: 'Chomper', blurb: 'Spiky, loud, all its power at once.' },
  },

  paths: {
    speed:     { label: 'Overwind', blurb: 'Wind the spring past its rated limit.' },
    endurance: { label: 'Diecast',  blurb: 'Solid cast metal — heavier, harder to stop.' },
    luck:      { label: 'Jackpot',  blurb: 'Bends the odds like a rigged claw machine.' },
  },

  passives: {
    late_surge:     { label: 'Second Wind', desc: 'Son %33 pistte +%10 hız' },
    overtake_boost: { label: 'Quick Wind',  desc: 'Geçiş anında hız patlaması' },
    fatigue_resist: { label: 'Steady Spring', desc: 'Yorgunluk %50 daha yavaş birikir' },
    damage_resist:  { label: 'Tin Plating', desc: 'Darbe hasarına direnç' },
    luck_boost:     { label: 'Lucky Key',   desc: 'İyi olay %20 daha sık' },
    luck_reroll:    { label: 'Rewind',      desc: 'Kötü olayı iyiye çevirir' },
  },

  events: {
    mass_slow: { label: 'Tangled Springs', desc: 'Herkesin mekanizması birbirine dolandı!' },
    collision: { label: 'Key Clash',       desc: 'İki oyuncak çarpıştı!' },
  },

  items: {
    boost:      { label: 'Turbo Wind' },
    projectile: { label: 'Marble Toss' },
    shield:     { label: 'Wind Guard' },
  },

  race: {
    prizePool:  'Prize Pool',        // değişmedi — zaten tema-nötr
    entryFee:   'Entry Fee',
    tuneUp:     'Tune-Up',
    tuneLimit:  'Tune Limit',
    grid:       'Starting Grid',
    reward:     'Reward',
  },

  shopPacks: {
    bag:       { label: 'Starter Pack' },     // eski: Scrap Bag
    crate:     { label: 'Gift Box' },         // eski: Crate
    pallet:    { label: 'Toy Chest' },        // eski: Pallet
    container: { label: "Collector's Crate" }, // eski: Container
  },

  rarities: {
    common:    { label: 'Fair',      color: '#9a8e7c' },
    uncommon:  { label: 'Good',      color: '#4a6fa0' },
    rare:      { label: 'Excellent', color: '#2a6fdb' },
    epic:      { label: 'Near Mint', color: '#8e9aa8' },
    legendary: { label: 'Mint',      color: '#ffc93c' },
  },

  art: { basePath: '/art/' },
} as const
```

**Kazanç:** Üçüncü tema değişimi = bu dosyayı düzenlemek + sanat klasörünü değiştirmek. Kod hiç açılmaz.

**Ek maliyet:** ~yarım gün. Buna kesinlikle değer.

---

# 2. Tema Haritası (Mech → Wind-Up Toy)

## Yarışçılar

- **Wind-Up (free tier):** Kutu yok, temel boya, tek renk. Çalışıyor ama vitrin kalitesinde değil.
- **Showcase (pro tier):** Kutulu, boyalı, tam donanımlı vitrin kalite oyuncak.

## Evrim eşikleri (stat toplamına göre — mevcut sistem korunur, form dili değişti)

| Toplam stat | Eski (mech) | Yeni (wind-up toy) |
|---|---|---|
| 0-199 (T0) | Stok şasi, mat metal | Çıplak gövde, kesik hatlı panel, küçük anahtar |
| 200-349 (T1) | Açıkta devreler | Boyalı, tamamlanmış, çalışan anahtar |
| 350-499 (T2) | Enerji kanalları parlıyor | Ek plaka/kol parçaları, büyümüş anahtar |
| 500+ (T3) | Plazma aurası | Devasa, aura, dönen anahtar hareket izi |

Evrim eşikleri ile rarity **görsel olarak ayrışmalı**, yoksa oyuncu ikisini karıştırır:
- **Evrim** = form değişimi (yeni parçalar, siluet büyür, gövde dönüşür)
- **Rarity** = malzeme/durum değişimi (aynı form, farklı yüzey: Fair → Good → Excellent → Near Mint → Mint)

## Aksesuarlar

| Eski (mech) | Yeni (wind-up toy) | Etki |
|---|---|---|
| Grip Treads | **Rubber Tires** | +SPD |
| Heat Shield | **Tin Padding** | +STA |
| Lucky Chip | **Lucky Marble** | +LCK |
| Alloy Frame | **Ball-Joint Kit** | +AGI |
| Sensor Array | **Glass Eyes** | +REF |
| Nitro Cell | **Overwound Spring** | Max SPD, düşük STA |

## Güçlendiriciler

| Eski (mech) | Yeni (wind-up toy) |
|---|---|
| Coolant Flush | **Oil Can** |
| Ignition Chip | **Extra Spring** |
| Ablative Plate | **Rubber Coating** |
| Entropy Dust | **Lucky Marble Bag** |
| Neural Link | **Fine-Tuned Gears** |
| Full Overhaul | **Full Rewind** |
| Deflector Field | **Tin Shield** |

## Bot isimleri

**Jetster-01** · **Tinbot-02** · **Waddler-03** · **Chomper-04** · **Tinbot-05** · **Waddler-06** · **Jetster-07** · **Chomper-08**

## Hava durumu

Mevcut hava sistemi korunur, isimler bir oyuncak rafı/vitrin ortamına taşınır: **Static Cling** (eski: Ion Storm — statik elektrik tin gövdelere yapışıyor), **Dust Cloud** (eski: Magnetic Fog — tozlu tavan arası), **Sunbeam** (eski: Heat Wave — pencereden vuran güneş ışığı), **Clear Shelf** (eski: Clear Grid — normal koşul).

## Diyalog / trash-talk

`frontend/src/data/dialogues.ts` ve `commentary.ts` yeniden yazılacak. Ton: **oyuncak kibri + raftaki underdog** gerilimi. Jetster övünür (hız kibirli), Tinbot homurdanır (inatçı tank), Waddler dalga geçer (kurnaz), Chomper bağırır (patlamacı, yüksek sesli).

---

# 3. Bahis Dilinin ve İzleyici Tahmininin Kaldırılması

**Karar:** İzleyici sadece izler, hiçbir etkileşimi olmaz. Yarışlar ücretsiz veya ücretli olabilir, ama hiçbir yerde bahis çağrışımı yapan bir tabir kullanılmaz.

## 3.1 Bu aslında bir geri dönüş, sapma değil

CLAUDE.md'nin "Kesinleşmiş Tasarım Kararları" bölümünde şu satır zaten var:

> **Seyirci bahsi V2'de** — V1'de yok

Ama `a3ab6c4 feat: Sprint 1 — real spectator prediction system` commit'i ile V1'e girmiş. Yani bu kaldırma işi kilitli tasarım kararına **geri dönüş** — yeni bir sapma değil.

## 3.2 Kaldırılacak: izleyici tahmin sistemi

| Katman | Yapılacak |
|---|---|
| DB | `predictions` tablosu düşürülür |
| Backend | `POST /api/race/predict`, `GET /:id/predictions`, `GET /predictions/stats/:wallet` silinir |
| Backend | `race.ts` içindeki doğru tahmin ödül bloğu (15 ZZZ/tahmin) silinir |
| Frontend | `Spectate.tsx` (393 satır) tahmin UI'ından arındırılır, salt-izleme olur |
| Frontend | `Profile.tsx` tahmin istatistikleri, `RaceBroadcast.tsx` tahmin gösterimi, `api.ts` tahmin çağrıları silinir |
| Transactions | `prediction_reward` tipi kaldırılır (geçmiş kayıtlar korunur) |

### Beklenmedik kazanç: bir ekonomi açığı kapanıyor

Derin audit'in Tier 3 önerisi #15 şuydu: *"Cap/Cost Predictions — sınırsız ücretsiz tahmin, ZZZ farming exploit'ini önle."* Tahmin başına 15 ZZZ × sınırsız yarış gerçek bir sızıntıydı. Sistem tamamen kalkınca **bu açık kendiliğinden kapanıyor** ve o öneri gündemden düşüyor.

### Dikkat: bir ZZZ musluğu da kapanıyor

Tahmin ödülleri günlük gelirin bir parçasıydı. Kaldırınca günlük gelir modeli yeniden hesaplanmalı — Sprint 9'un "Numbers policy" kalemine bu da eklenecek. Faz 1'de sadece kaldırma yapılır, denge ayarı Sprint 9'da.

## 3.3 Sealed Bid → Tune-Up

Mekanik aynı kalıyor: 10 saniye, gizli SPRING harcaması, en yüksek harcayan öne geçiyor. Değişen tek şey **kurgu**.

Eski kurgu bir açık artırmaydı: rakiplerinin üstüne çıkmak için teklif veriyordun.
Yeni kurgu bir hazırlık: yarıştan önce oyuncağının yayını son anda biraz daha sıkı kuruyorsun. Yayını en çok gerdiren grid'de önde başlıyor.

Mekanik özdeş, dil tamamen temiz — "tune" (ayar yapmak) yarış sporunun kendi kelimesi.

| Eski | Yeni |
|---|---|
| Sealed Bid | **Tune-Up** |
| Bidding phase | **Tune-Up Phase** |
| Bid amount | **Tune amount** |
| Max raise | **Tune limit** |
| Bid reveal | **Grid Reveal** |

## 3.4 Terim temizliği — tam liste

Kelime-sınırlı tarama sonucu, kodda temizlenecek gerçek yüzey:

| Terim | Adet | Yerine | Neden |
|---|---|---|---|
| `payout` / `payouts` | 82 | **reward** | Bahis/kumar çağrışımı |
| `prediction*` / `predict` | 60 | *(kaldırılıyor)* | Sistem tamamen çıkıyor |
| `bid` / `bidding` / `bids` | 49 | **tune / tuning** | Açık artırma dili |
| `pot` | 8 | **prizePool** | Poker terimi |
| `whale` | 6 | **container** | Kumarhane terimi (yüksek bahisçi) |
| `raise` | 2 | **tune limit** | Poker terimi |
| `stake` | 1 | *(kaldırılıyor)* | Bahis dili |

Sıfır bulunan (zaten temiz): `wager`, `odds`, `jackpot`, `gamble`

### Shop paketleri

`Starter / Popular / Pro / Whale` → **Scrap Bag / Crate / Pallet / Container**

Konteyner boyutu olarak artan bir dizi — temaya uygun, kumar çağrışımı yok. Fiyatlar ve coin miktarları değişmiyor.

### Yol haritasından çıkarılacak

Derin audit Tier 3 önerisi #18 **"Double-or-Nothing rematch"** (2× bahisle anında rövanş) tamamen iptal. Yerine sade bir **"Rematch"** — aynı ücret, aynı ödül, çarpan yok.

## 3.5 İzleyici sayfası ne olacak

Etkileşim kalkınca `Spectate.tsx`'in var olma sebebi yeniden tanımlanmalı. Salt izleme bir **yayın deneyimi** olur:

- Canlı yarış görüntüsü
- Canlı sıralama tablosu
- Yorum akışı (`commentary.ts` zaten var, kullanılıyor)
- Yarış istatistikleri ve olay akışı
- Yarış sonu klip paylaşımı

Bu aynı zamanda audit'in Socializer boşluğuna (2/10) bahis olmadan cevap veriyor: arkadaşının yarışını izlemek sosyal içeriktir.

## 3.6 Pitch dokümanlarına etkisi — dürüst maliyet

Bu kararın gerçek bir bedeli var ve saklamayalım.

`LIGHT_PAPER.md` dört ana farklılaştırıcıdan birini **"Built-in Prediction Market"** olarak sunuyor. `DEVFOLIO_ANSWERS.md` ise "her yarış hem yarışçıdan hem izleyiciden onchain işlem üretir" argümanını Base başvurusunun merkezine koymuş. İkisi de gidiyor.

Yeniden yazılması gerekenler:
- `LIGHT_PAPER.md` — satır 19, 25, 38, 42, 44, 47
- `DEVFOLIO_ANSWERS.md` — satır 39, 55, 104, 107, 141, 168, 174, 194, 198, 204, 206
- `README.md` ve `CLAUDE.md` — sealed bid / pot referansları

**Boşalan 4. farklılaştırıcı yerine öneri:** *Base App native, mobil-öncelikli mini app* — dikey yarış formatı, passkey onboarding, uygulama içinde oynanabilirlik. Bu zaten doğru ve inşa edilmiş; sadece pitch'te öne çıkarılmamış.

Onchain işlem hacmi argümanı da tek taraflı hale geliyor ama ölmüyor: günlük yarışlar, upgrade'ler, training, sezonluk sıfırlamalar hâlâ tekrarlayan işlem üretiyor.

---

# 4. Sanat Pipeline (fal.ai)

> **Görünüşün kendisi ayrı dokümanda:** [ART_DIRECTION.md](ART_DIRECTION.md) — palet, arketip siluetleri, evrim kademeleri, rarity malzemeleri, ışık şeması, prompt şablonu ve kalite kontrol listesi. Bu bölüm sadece **üretim sürecini** anlatıyor.

## Adım 1 — Stil kilidi (en kritik adım)

Herhangi bir üretim asseti çıkarmadan önce **master style sheet** üret ve kilitle:

- Malzeme dili: metal cinsi, aşınma seviyesi, ışık yayan parça mantığı
- Palet: 5 rarity rengi + 4 arketip aksan rengi + nötr metal tonları
- Işık: yön, sertlik, rim-light kuralı
- Silüet kuralı: her arketip küçük boyutta bile ayırt edilebilmeli
- Kamera açısı: yarış üstten-arkadan (vertical track), kart görünümü 3/4

Çıktı: 1 adet referans sayfası + kilitli prompt şablonu. **Bu sayfa sonraki her generation'a reference olarak verilir.**

## Adım 2 — Karakter tutarlılığı yöntemi

Araştırma sonucu: **multi-image reference sheet** yaklaşımı (Nano Banana 2) LoRA'nın faydasının büyük kısmını, teknik kurulum olmadan veriyor. LoRA sadece çok yüksek hacimde mantıklı — bizim hacmimiz onu gerektirmiyor.

Yöntem: master sheet + 3-5 açıdan referans → her yeni asset bu referanslarla üretilir.

## Adım 3 — Asset envanteri

Kritik optimizasyon: **rarity ayrı sanat değil.** CLAUDE.md'ye göre rarity sadece görsel — o yüzden rarity'yi malzeme/palet katmanı olarak Rive'da uygula, ayrı asset üretme. Bu 80 asset'i 16'ya düşürüyor.

| Grup | Adet | Not |
|---|---|---|
| Yarışçı formları | 16 | 4 arketip × 4 evrim eşiği |
| Rarity treatment | 5 | Palet/materyal katmanı, Rive'da uygulanır |
| Bot varyantları | 0 | Arketip sanatı + palet swap |
| Pist arka planı | 12 | 3 parallax katman × 4 hava durumu |
| UI ikonları | ~40 | 6 stat, item, aksesuar, rarity rozeti, coin, quest |
| Pazarlama | ~8 | Landing hero, og:image, mint reveal, splash |

## Adım 4 — Rive için parçalama (atlanamaz)

Rive'da rig edilebilmesi için karakterler **katmanlı parçalar** halinde lazım — tek düz görsel işe yaramaz.

Her yarışçı şu parçalara ayrılır: gövde · kafa/sensör · ön uzuv ×2 · arka uzuv ×2 · thruster · enerji çekirdeği (ayrı katman, parlama animasyonu için)

Yöntem: fal.ai'dan tam karakter üret → Figma/Photoshop'ta 7-8 katmana kes → PNG olarak Rive'a aktar. Bu manuel adım, otomatikleştirilemiyor.

**Parça mimarisi 4 arketipte aynı tutulmalı** → tek rig + 4 skin. Aksi halde 4 ayrı rig yapmak gerekir.

## Maliyet

| Kalem | Tahmin |
|---|---|
| Stil keşfi (~200 generation) | ~$8 |
| Yarışçılar (16 × ~8 deneme) | ~$5 |
| Arka planlar (12 × ~6 deneme) | ~$3 |
| UI ikonları (~40 × ~5 deneme) | ~$6 |
| Trailer videosu (30sn, birkaç deneme) | $15-60 |
| **Toplam** | **~$40-100** |

Para maliyeti önemsiz. Asıl maliyet **küratörlük zamanı ve Rive rig işi.**

---

# 5. Animasyon (Rive)

## Neden Rive

- Lottie 17fps'de kalırken Rive ~60fps
- 100kb'lık Lottie dosyası Rive'da ~10kb
- **State machine** — animasyon oyun durumuna tepki verir, sadece döngü oynatmaz
- Tek dosya hem web hem mobilde çalışır

Maliyet: Rive web runtime ~200KB gzipped (WASM içeriyor). Mobilde kabul edilebilir ama farkında olalım.

## Yarışçı state machine

**Inputs (oyun motorundan gelir):**

```
speed      : number  (0-1 normalize hız)
boosting   : boolean
hit        : trigger (EMP/çarpışma anı)
stamina    : number  (0-1, yorgunluk görselini sürer)
finished   : boolean
rank       : number  (1-4)
```

**States:** `idle` (grid) → `running` (speed hızı sürer) → `boosting` (thruster alevi) → `staggered` (hit tetikler) → `exhausted` (stamina düşükse) → `victory` / `defeat`

Kritik nokta: `speed` input'u animasyon hızını **sürekli** sürüyor. Yarışçı gerçekten hızlanıp yavaşlıyor — bu, sprite sheet'in veremeyeceği his.

## UI animasyonları (Rive)

Mint reveal · rarity reveal (Rust→Singularity dramatik fark) · coin burst · evrim progress bar · buton mikro-etkileşimleri

## fal.ai video nerede kullanılır

**Sadece** oyun dışı: landing hero loop, 30-60sn trailer, sosyal paylaşım klipleri, Farcaster embed. Oyun içinde asla — etkileşimli değil ve dosyalar çok ağır.

---

# 6. Responsive: Mobil + Web

Mevcut yarış dikey canvas (ağaç gövdesi pist). Dikey format Base App mini app için doğru ama masaüstünde kenarlarda boşluk bırakıyor.

**Çözüm: boşluğu içerikle doldur, formatı bozma.**

| Breakpoint | Layout |
|---|---|
| < 768px (mobil) | Tam ekran dikey pist, üstte HUD, altta aksiyon butonları |
| 768-1279px (tablet) | Dikey pist ortada + sağda sıralama paneli |
| ≥ 1280px (masaüstü) | **Broadcast layout** — sol: canlı sıralama + stat, orta: pist, sağ: yorum akışı + olay kaydı |

Masaüstünde boşa giden alan yayın deneyimine dönüşüyor. Bölüm 3.5'teki salt-izleme kararıyla birebir uyumlu: sağ panel etkileşim değil, **anlatım** taşıyor — yorum akışı, olay kaydı, yarış istatistikleri.

Sanat asset'leri bunu desteklemeli: arka planlar hem 9:16 hem geniş kadraj için üretilmeli (ya da kenarları güvenli alan bırakacak şekilde geniş üretilip kırpılmalı).

---

# 7. Faz Planı

## Faz 0 — Temizlik (0.5 gün)
- ~~İsim + currency kesinleştir~~ ✅ WIND-UP RUSH / SPRING
- `winduprush.xyz` domain'ini al
- `.mcp.json` yolları kırık (`/Users/canerpinarbasi/sloth-rush` gösteriyor, proje `_arsiv/sloth-rush` altında) — düzelt
- Projeyi `_arsiv`'den ana dizine taşı
- Bekleyen audit dokümanlarını commit'le

## Faz 1 — Tema decoupling + bahis dili temizliği (3-4 gün)
Sanat işinden **bağımsız**, paralel yürüyebilir. Bölüm 3'ün tamamı buraya dahil — ayrı sprint gerekmiyor, çünkü aynı DB migration'ı ve aynı dosyaları zaten açıyoruz.

1. **Tahmin sistemini kaldır** (Bölüm 3.2) — `predictions` tablosu, 3 endpoint, ödül bloğu, tüm frontend tahmin UI'ı
2. DB migration: `sloths`→`racers`, `sloth_id`→`racer_id`, type/arketip/passive/event değerleri fonksiyonel isimlere
3. **DB migration — bahis dili:** `races.status` CHECK `'bidding'`→`'tuning'`, `races.max_raise`→`max_tune`, `race_participants.bid_amount`→`tune_amount`, `race_participants.payout`→`reward`
4. Backend: route `/api/sloth`→`/api/racer`, tüm tip ve değişken isimleri, `pot`→`prizePool`
5. Simülasyon motoru: `SlothStats`→`RacerStats`, event ve passive kodları
6. Shop paketleri: `whale`→`container` + diğer üç paket yeniden isimlendirilir
7. Frontend: CSS değişkenleri `--color-brand-*`, `theme.ts` oluştur, tüm görünen metinler `THEME`'den okusun
8. `Spectate.tsx` salt-izleme yayın görünümüne dönüştürülür (Bölüm 3.5)
9. Kontratlar: yeniden isimlendir + Base Sepolia'ya yeniden deploy
10. `npx tsc --noEmit` her iki projede 0 hata
11. **Doğrulama grep'i — iki ayrı tarama:**
    - Tema: kodda hiç `sloth`/`zzz` kalmamalı (sadece `theme.ts` içinde)
    - Bahis dili: `bid`, `bet`, `pot`, `wager`, `stake`, `odds`, `raise`, `payout`, `predict`, `whale` **hiçbiri** kalmamalı
12. Pitch dokümanlarını yeniden yaz (Bölüm 3.6) — LIGHT_PAPER, DEVFOLIO_ANSWERS, README, CLAUDE.md
13. `qa-agent.ts` içindeki tahmin testleri kaldırılır, kalan testler yeni isimlere uyarlanır (92 test)

## Faz 2 — Sanat yönü ve stil kilidi (2-3 gün)
Faz 1 ile paralel.
1. fal.ai'da stil keşfi — 3-4 aday yön üret
2. Bir yön seç, master style sheet'i kilitle
3. Prompt şablonunu ve palet sistemini dokümante et

## Faz 3 — Asset üretimi (3-4 gün)
1. 16 yarışçı formu (4 arketip × 4 eşik)
2. 5 rarity malzeme treatment'ı
3. 12 arka plan katmanı (3 parallax × 4 hava)
4. ~40 UI ikonu
5. Hepsini Rive için katmanlara kes

## Faz 4 — Rive rig ve entegrasyon (4-5 gün)
1. Tek yarışçı rig'i + 4 skin
2. State machine kur, input'ları bağla
3. Yarış motorunu Rive'a bağla (canvas render'ı değiştir)
4. UI animasyonları (mint/rarity reveal, coin burst)
5. Mobil performans testi — 60fps hedefi

## Faz 5 — Responsive layout (2-3 gün)
1. Üç breakpoint layout'u
2. Masaüstü broadcast görünümü
3. Gerçek cihazlarda test (Base App dahil)

## Faz 6 — Pazarlama asset'leri (1-2 gün)
1. Landing hero (fal.ai video loop)
2. 30-60sn trailer
3. og:image, splash, Farcaster embed

**Toplam: ~3-3.5 hafta.** Faz 1 ve 2 paralel yürüdüğü için takvim sıkışabilir. Bahis dili temizliği Faz 1'e gömülü olduğu için takvimi yaklaşık 1 gün uzatıyor — ayrı bir sprint gerektirmiyor.

---

# 8. Riskler

| Risk | Etki | Azaltma |
|---|---|---|
| Kontrat yeniden deploy | Testnet adresleri değişir | Base Sepolia'da ucuz; frontend config güncellenir |
| DB migration hatası | Mevcut oyuncu verisi | Migration'ı try-catch bloklarıyla yaz (önceki rebrand'de bu yapılmış, aynı deseni kullan) |
| Rive öğrenme eğrisi | Faz 4 uzayabilir | Faz 2 sırasında tek basit rig ile prova yap |
| Rive WASM 200KB | Mobil ilk yükleme | Lazy load — sadece yarış sayfasında yükle |
| AI asset tutarsızlığı | Sanat dağınık görünür | Stil kilidi (Faz 2) atlanmamalı; her generation referans sayfasıyla |
| Parça mimarisi uyuşmazlığı | 4 ayrı rig gerekir | Katman şemasını Faz 2'de sabitle, Faz 3'te ona uy |
| Pitch'te farklılaştırıcı boşluğu | Base Batches başvurusu zayıflar | 4. farklılaştırıcıyı "Base App native mobil mini app" ile doldur (Bölüm 3.6) |
| Bahis terimi sızıntısı | Tek bir "bid" kelimesi tüm çabayı boşa çıkarır | Faz 1 adım 11'deki grep taraması zorunlu; CI'a kalıcı lint kuralı olarak ekle |
| Tahmin musluğu kapanması | Günlük ZZZ geliri düşer | Faz 1'de sadece kaldır; denge yeniden hesabı Sprint 9 "Numbers policy" kalemine eklendi |

---

# 9. Marka Geçişi

| | Eski (Sloth) | Ara (Scrap — terk edildi) | Nihai (Wind-Up) |
|---|---|---|---|
| İsim | Sloth Rush | ~~Scrap Rush~~ | **WIND-UP RUSH** |
| Slogan | Wake up. Race hard. Nap later. | ~~Scrap up...~~ | **Wind up. Race hard. Rewind later.** |
| Para birimi | ZZZ Coin | ~~SCRAP~~ | **SPRING** |
| Domain | slothrush.xyz | ~~scraprush.xyz~~ | **winduprush.xyz** (alınması gerekiyor) |
| Free tier | Free Sloth | ~~Husk~~ | **Wind-Up** |
| Pro tier | Sloth | ~~Mech Racer~~ | **Showcase** |
| Rarity dili | — | Rust→Singularity (uydurma) | **Fair→Mint (gerçek koleksiyoncu terimi)** |
| Ana sayfa | Treehouse | ~~Hangar~~ | **Toybox** |
| Pist | Grand Kabuk | ~~Grand Circuit~~ | **Diorama Speedway** |
| Grid mekaniği | Sealed Bid | Tune-Up | **Tune-Up** (değişmedi) |
| Ödül havuzu | Pot | Prize Pool | **Prize Pool** (değişmedi) |
| Kazanç | Payout | Reward | **Reward** (değişmedi) |
| İzleyici | Tahmin sistemi | Salt izleme | **Salt izleme** (değişmedi) |

Tema-nötr mimari kararı (Bölüm 1) tam olarak burada karşılığını veriyor: `race`/`entities`/rarity **kodları** (`free`/`pro`, `common`→`legendary`) hiç değişmedi, sadece `theme.ts`'teki **etiketler** değişti. Scrap→Wind-Up geçişi kod tarafında sıfır maliyetli.

## Marka geçişi iş kalemleri

- `winduprush.xyz` domain'ini al, Vercel'e bağla
- `slothrush.xyz`'den 301 yönlendirme kur (eski linkler ve Farcaster embed'leri kırılmasın)
- Farcaster frame metadata'sını güncelle
- Base App mini app manifest'ini güncelle
- README, LIGHT_PAPER, DEVFOLIO_ANSWERS dokümanlarını yenile
- CLAUDE.md'yi yeni tema ve tema-nötr mimari kuralıyla güncelle

## Ekonomi dokümantasyonu

CLAUDE.md'deki tüm ZZZ değerleri birebir SPRING'e çevrilir — **ekonomi rakamları değişmez.** Sprint 8'de yapılan denge düzeltmeleri (bot pot katkısı, teselli ödülü, ödül patlaması) korunur. Bu rebrand sadece isimlendirme ve görsel katmanı ilgilendiriyor, denge çalışması Sprint 9'un konusu.

---

## Kaynaklar

- [Rive vs Lottie 2026 karşılaştırması](https://unicornicons.com/learn/rive-vs-lottie)
- [Lottie vs Rive mobil performans (Callstack)](https://www.callstack.com/blog/lottie-vs-rive-optimizing-mobile-app-animation)
- [fal.ai fiyatlandırma 2026](https://pricepertoken.com/image)
- [fal.ai sprite sheet üretici](https://github.com/blendi-remade/sprite-sheet-creator)
- [Karakter tutarlılığı yöntemleri 2026](https://magichour.ai/blog/best-ai-image-generators-for-character-consistency)
- [AI 2D oyun asset üretimi — dürüst rehber](https://www.summerengine.com/blog/ai-2d-game-asset-generator)
