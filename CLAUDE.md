# WIND-UP RUSH — Proje Bağlamı ve Geliştirme Rehberi

Bu dosya Claude Code için yazılmıştır. Her oturumda önce bunu oku.
Bu proje uzun bir tasarım sürecinden geçti — buradaki kararlar rastgele değil, gerekçelidir.

> **Sürüm notu:** Bu oyun iki kez yeniden markalandı. Sloth Rush (tembel hayvan) → Scrap Rush (mekanik hurda) → **WIND-UP RUSH** (kurmalı oyuncak). Üçüncüsü kilitlidir. Eski temalara ait hiçbir isim, terim veya mekanik geçerli değildir. Kodda `sloth`, `zzz`, `sealed bid`, `pot` gibi bir kalıntı görürsen o bir bug'dır, temizlenmesi gerekir.

---

## Proje Özeti

**Wind-Up Rush** — Base L2 blockchain üzerinde çalışan kurmalı oyuncak yarış oyunu.
- Hedef: Base Batches Season 3 başvurusu ve demo
- Geliştirici profili: Developer değil, AI toollarına (Replit, Lovable, ChatGPT) aşina biri. Vibecoding yaklaşımı.
- Slogan: **"Wind up. Race hard. Rewind later."**
- Domain: `winduprush.xyz` (henüz alınmadı)
- Kuzey yıldızı: *Anahtarla kurulan, sevgiyle boyanmış klasik oyuncaklar — bir vitrin rafının üstünde son sürat yarışıyor.*

Duygusal yay isminde: **temel kurmalı → vitrin kalite.** Oyuncu kutusu bile açılmamış basit bir oyuncakla başlar, koleksiyoncuların "Mint" dediği pırıl pırıl bir vitrin parçasına dönüştürür.

---

## 0. Mimari Kural: Tema Koddan Ayrıdır

**Bu kural diğer her şeyden önce gelir.** Bu projenin üçüncü temasındayız; ilk iki geçiş 60+ adımlık find-replace operasyonlarına dönüştü çünkü tema kodun her katmanına gömülüydü. Dördüncüsü olmayacak.

### Kural: kodda fonksiyonel isim, config'de tema ismi

Kod, mekaniğin **ne yaptığını** anlatan isimler kullanır. Temanın ne olduğunu bilmez.

| Katman | Yasak (temaya bağlı) | Zorunlu (tema-nötr) |
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
| Arketip | `caffeine_junkie` | `speedster` / `tank` / `trickster` / `burst` |
| Evrim yolu | `caffeine` / `hibernate` | `speed` / `endurance` / `luck` |
| Passive | `caffeine_rush` | `late_surge` |
| Event | `yawn_wave` / `pillow_fight` | `mass_slow` / `collision` |
| Taktik | `pillow` | `projectile` |

Rarity **kodları** da tema-nötr kalır: `common` · `uncommon` · `rare` · `epic` · `legendary`. Görünen etiketler `theme.ts`'ten gelir.

### theme.ts — tek tema kaynağı

Görünen her metin `frontend/src/config/theme.ts` üzerinden okunur (backend aynı dosyayı paylaşır). Marka adı, para birimi, konum isimleri, arketip etiketleri, rarity etiketleri, passive/event/item isimleri, shop paketleri — hepsi orada.

**Kazanç:** Dördüncü tema değişimi = bu dosyayı düzenlemek + sanat klasörünü değiştirmek. Kod hiç açılmaz.

### Doğrulama grep'i (CI'da lint kuralı olmalı)

- Tema: kodda hiç `sloth` / `zzz` / `scrap` kalmamalı — sadece `theme.ts` içinde
- Bahis dili: `bid` · `bet` · `pot` · `wager` · `stake` · `odds` · `raise` · `payout` · `predict` · `whale` **hiçbiri** kalmamalı

Tek bir `bid` kelimesi tüm çabayı boşa çıkarır. Kalıcı kontrol: `npm run lint:vocab`.

**Grep'ten muaf iki dosya var, üçüncüsü olmamalı:** `config/theme.ts` (tema etiketlerinin yaşadığı yer) ve `backend/src/migrations/legacyNames.ts` (eski isimleri emekliye ayıran migration onları anmak zorunda — `status = 'bidding'`, `DROP TABLE predictions`).

### Migration tuzağı — bir kez yakalandı, tekrar yakalanır

**Postgres'te tabloyu yeniden adlandırmak CHECK constraint'lerini ve sequence'lerini yeniden adlandırmaz.** `sloths` → `racers` yapıldığında hayatta kalan `sloths_type_check`, `'sloth'` → `'pro'` güncellemesini sessizce reddetti. Migration try-catch içinde olduğu için **log başarılı göründü ama satırlar taşınmamıştı.**

Kural: migration'dan sonra log'a değil **şemaya** bak. Yeniden adlandırılan her tablo için constraint ve sequence isimlerini de kontrol et.

---

## Kesinleşmiş Tasarım Kararları (Değiştirme)

Aşağıdaki kararlar uzun tartışmalar sonucu alındı. Alternatif önermeden önce bu listeyi kontrol et.

### Marka ve İsimlendirme

| Konu | Karar |
|---|---|
| İsim | **WIND-UP RUSH** |
| Para birimi | **SPRING** (eski: ZZZ Coin — rakamlar birebir aynı, sadece isim değişti) |
| Free tier | **Wind-Up** — kutu yok, temel boya, tek renk |
| Pro tier | **Showcase** — kutulu, boyalı, tam donanımlı vitrin kalite |
| Ana sayfa | **Toybox** (eski: Ahır / Treehouse) |
| Pist | **Diorama Speedway** (eski: Grand Kabuk) |
| Rarity | **Fair → Good → Excellent → Near Mint → Mint** |

Rarity dili gerçek oyuncak koleksiyonculuğu terminolojisidir — uydurma fantezi kelimeleri değil. Bu bilinçli bir karar.

### NFT Modeli
- **Wind-Up**: Gasless mint (Base Paymaster), wallet başına 1 adet, sybil korumalı
- **Showcase**: Wind-Up yakılır (burn) + $3 USDC → yeni Showcase mint edilir
- Arz sınırı YOK — her upgrade bir Showcase üretir
- Rarity upgrade anında Chainlink VRF ile belirlenir (oyuncu bilemez)
- Üreme sistemi YOK — bu karar kesin, önerme
- 10k koleksiyon sınırı YOK — bu da kesin

### Ekonomi Modeli
- **SPRING**: Oyun içi, offchain (server DB). Blockchain token DEĞİL — V1'de
- **USDC**: Sadece iki noktada kullanılır: upgrade ($3) ve shop coin satın alımı
- Token lansmanı Faz 4'e ertelendi — erken token çıkarmıyoruz

### Mimari — Hibrit Model (Kesin Karar)
```
ONCHAIN (Base L2):
- Wind-Up mint
- Showcase mint + burn
- Rarity belirleme (VRF)
- Yarış seed üretimi (VRF)
- Yarış sonuç hash'i
- Kazanan adresi kaydı
- USDC transfer (upgrade + shop)

OFFCHAIN (Server):
- SPRING bakiyeleri
- Prize pool dağıtımı hesabı
- Günlük görev takibi
- Aksesuar drop mantığı
```

### Yarış Mekaniği

- 4 yarışçı per yarış (bot doldurur, ama botlar ödül kazanamaz)
- **Pist formatı: dikey ekranda üst üste 4 yatay şerit** — foto-finiş görünümü. Hem mobil ergonomi hem tema-otantiklik (bir model tren dioraması gibi). Yarışçılar soldan sağa ilerler.
- **Loadout** (yarış öncesi): İki item seçilir — `boost` (kendine) veya `hinder`
  (lidere). Yarışçı ve mesafeyle **aynı ekranda**, ayrı bir faz değil.
- **Item kullanımı** (yarış sırasında): Zamanı oyuncu seçer. Tick'i **sunucu**
  belirler — istemcinin tick önermesi, oyuncunun zaten izlediği bir ana item
  düşürmesine izin verirdi ve Taktik Mod'u bozan şey tam olarak buydu.
- Grid tohumdan türer. **Tam mekanik: [backend/src/simulation/items.ts](backend/src/simulation/items.ts)**

> **Wind-Up fazı 2026-08-07'de emekliye ayrıldı.** Bir butonu doğru sürede basılı
> tutmayı ölçüyordu — refleks testi, karar değil — ve her yarışın önünde
> duruyordu. Tarihî kayıt: [docs/RETIRED_WIND_UP_PHASE.md](docs/RETIRED_WIND_UP_PHASE.md).
- Prize pool: Platform %15 keser, kalan %85 dağıtılır (1.:%50, 2.:%30, 3.:%15, 4.:%5)

> **Bu mekanik üçüncü halidir.** Tune-Up (gizli para harcaması) → Wind-Up fazı
> (beceri bazlı basılı tutma) → loadout + yarış içi item. İlk ikisi de yarış
> öncesineydi; şimdiki tek fark, kararın **yarışın içinde** de sürmesi.
> `docs/REBRAND_AND_VISUAL_PLAN.md` §3.3 hâlâ Tune-Up'ı anlatıyor — eskidir.

### Yarış Formatları (V1 — iki mesafe, aynı ücret)

V1'de iki ücretli format var ve **tek farkları mesafe.** Bu bilinçli: ikinci bir
format ancak farklı bir soru soruyorsa yerini hak eder, ve ölçülen tek kaldıraç
mesafe. İkisi de 50 SPRING — Endurance daha pahalı olsaydı oyuncu cüzdanına göre
seçerdi, sahip olduğu oyuncağa göre değil.

| Format | Mesafe | Süre (taze yarışçı) | Neyi ödüllendirir |
|---|---|---|---|
| **Practice Run** | 800 | ~22s | Isınma |
| **Sprint** | 800 | ~22s | En yüksek SPD kazanır |
| **Endurance** | 1.400 | ~53s | Dengeli dağılım kazanır |

**V1'de yarış ücretsizdir ve ödül vermez.** Üç formatın da girişi bedava; fark
sadece mesafede. Ayrıntı için aşağıdaki "Para birimi V1'den çıkarıldı" bölümü.

Sayılar tahminden değil ölçümden geldi: `backend/src/simulation/distanceLever.check.ts`
ve `fatigueSweep.ts`. Mesafe sabitleri `backend/src/simulation/formats.ts`'te;
etiketler `theme.ts`'te.

> **"Uzun pisti STA kazanır" yanlış bir cümle.** Uzun pistte saf hızcının
> kaybettiğini saf dayanıklı değil, **dengeli** yarışçı alıyor (55/55). STA hızı
> korur, tek başına kazanmaz — SPD taban para birimidir. `distanceLever.check.ts`
> bunu çıktısında açıkça yazar.

### Taktik Mod ve Grand Prix — V1'den çıkarıldı

İkisi de `frontend/src/config/features.ts`'te **sert kapalı** (hostname'e bağlı
değil), sunucu tarafında da `/api/race/create` bu formatları 400 ile reddeder.
Ama çıkarılma sebepleri farklı ve bu fark önemli:

- **Grand Prix: kapsam.** İki aşamalı bir format, yeni bir karar üretmiyordu.
- **Taktik Mod: bozuktu.** Oyuncu yarışı izlerken aksiyon gönderiyor, istemci
  `simulateRace`'i yeniden çağırıyor ve yarış sıfırdan, farklı bir sonuçla
  baştan başlıyordu. Önde giden oyuncu boost'a basıp yarışın yeniden
  başladığını görüyordu. Çalışması için simülasyonun parça parça çözülmesi ve
  aksiyonların ileri bir tick'e kuyruklanması gerekir; motor yarışı tek geçişte
  hesaplıyor. **Bu düzeltilmeden açılmamalı.**

### İzleyici — Salt İzleme
- İzleyici sadece izler, **hiçbir etkileşimi yoktur**
- Tahmin/bahis sistemi tamamen kaldırıldı (V1'e yanlışlıkla girmişti, kilitli karara geri dönüldü)
- İzleme deneyimi bir **yayın** deneyimidir: canlı görüntü, canlı sıralama, yorum akışı, olay kaydı, yarış sonu klip paylaşımı

### Dil — Sıfır Bahis Terimi
Ücretli yarış vardır, bahis çağrışımı yoktur. `payout`→**reward**, `pot`→**prizePool**, `bid`→*(mekanik kaldırıldı)*, `whale`→**container**. Bu bir pazarlama tercihi değil, uygulama mağazası ve düzenleyici riski kararıdır.

### Rarity (İstatistik etkisi YOK — sadece görsel)
- Fair %55 / Good %25 / Excellent %12 / Near Mint %6.5 / Mint %1.5
- Rarity istatistik farkı yaratmaz, sadece görsel ve broadcast ayrıcalığı

---

## Arketipler

Dört arketip, dört farklı **birincil geometrik okuma**. Silüet testi geçilmesi zorunlu bir kapıdır: dördü 48×48 piksel düz siyah dolgu olarak yan yana konur, ayırt edilemiyorsa tasarım reddedilir.

| Arketip | Kod | Rol | Siluet | Aksan rengi |
|---|---|---|---|---|
| **Jetster** | `speedster` | Hız | Sivri roket/damla, üç kanatçık | `#E63946` |
| **Tinbot** | `tank` | Tank | Kutu/dikdörtgen, kare kafa | `#2A6FDB` |
| **Waddler** | `trickster` | Kurnaz | Yuvarlak + geniş düz gaga | `#FFC93C` |
| **Chomper** | `burst` | Patlama | Dikenli sırt, testere-dişli üst hat | `#4CAF6D` |

Bot isimleri: Jetster-01 · Tinbot-02 · Waddler-03 · Chomper-04 · Tinbot-05 · Waddler-06 · Jetster-07 · Chomper-08

Botlar görsel olarak da ayrışır: **desatüre gövde + "BOT" etiketi + aksan rengi yok.**

---

## İstatistikler ve İlerleme

6 stat: **SPD** (Hız), **ACC** (İvme), **STA** (Dayanıklılık), **AGI** (Çeviklik), **REF** (Refleks), **LCK** (Şans)

### Evrim — form değişimi (rarity'den bağımsız eksen)

| Kademe | Toplam stat | Form |
|---|---|---|
| **T0** | <90 | Çıplak gövde, kesik hatlı panel, açıkta dişli, küçük anahtar. Kutu açılmamış. |
| **T1** | 90-129 | Paneller kapandı, boyalı, tamamlanmış. Anahtar çalışıyor. |
| **T2** | 130-169 | Ek plaka/kol parçaları, anahtar büyüdü, detaylar belirdi. |
| **T3** | 170+ | Siluet dönüştü, belirgin daha büyük, hafif aura, dönen anahtarın hareket izi. |

> **Bu sayılar 2026-08-06'da düzeltildi ve eskisi kurguydu.** Tablo 0/200/350/500
> diyordu; ama stat tavanları stat başına 15 (free) ve 22-35 (rarity), yani altı
> stat en fazla **90** (Wind-Up) ve **210** (Mint Showcase) toplayabiliyor. T2 ve
> T3 **hiçbir zaman ulaşılabilir değildi.** Fark edilmemesinin sebebi, eski manuel
> evrim ucunun kademeyi bu tabloya değil XP/yarış/para şartlarına göre vermesiydi
> — doküman ve kod farklı oyunları anlatıyordu ve ikisi birbirine karşı hiç
> kontrol edilmemişti.
>
> Yeni merdiven ulaşılabilir aralığa oturuyor ve oyunun iki eksenine denk düşüyor:
> tavanındaki bir Wind-Up tam T1'e ulaşıp durur, T2 upgrade ister, T3 upgrade
> **ve** iyi bir rarity ister. `backend/src/simulation/evolution.ts`.

**Evrim otomatiktir.** Basılacak buton, ödenecek bedel yoktur; statlar eşiği
geçtiği anda form değişir. Eski manuel akış bir karar üretmiyordu — oyuncu
buton yandığı anda basıyordu.

T0 → T3 arası siluet alanı yaklaşık **%60 büyür.** Bir T3 Tinbot hâlâ ilk bakışta Tinbot okunmalı.

> **Evrim = ne kadar büyüdün. Rarity = ne kadar bakımlısın.** İkisi ayrı eksendir, oyuncu karıştırmamalı.

### İlerleme — yarışarak

Training, mini oyunlar, güçlendiriciler ve aksesuarlar V1'den çıktı. Geriye tek
bir kaynak kaldı ve o da oyunun kendisi:

| | Değer |
|---|---|
| Kaynak | **Yarışmak** — başka hiçbir şey stat vermez |
| Kazanç | Bitiriş sırasına bağlı bir stata **+0.4** |
| Günlük tavan | **+4.0** (yani ~10 yarış bir günü doldurur) |
| Sınır | Rarity'ye bağlı stat tavanı |

Rakamlar +0.05/yarış ve +0.3/gün idi; o değerler training tek başına +0.5
verirken ayarlanmıştı. Diğer kaynaklar kapanınca o hızda **taze bir yarışçının
ilk evrim kademesine ulaşması 100 gün** sürüyordu — yani kimse bir evrim
görmeyecekti. Yeni hızda ilk kademe yaklaşık bir haftalık oyuna denk geliyor.

> **Açık kalem:** mint stat başına ~10 veriyor, tavanlar ise 15 (free) ve 22-35
> (rarity). Yani taze bir yarışçı, bütün sayıların ayarlandığı aralığın çok
> altında başlıyor; Endurance'ı 53 saniyede koşmasının sebebi bu (gelişmiş bir
> yarışçı 36 saniyede koşuyor). Doğru düzeltme mint tabanını yükseltmek, ve bu
> karar alınmadı.

---

## Para birimi V1'den çıkarıldı (2026-08-06)

**V1'de oyun içi para yoktur.** SPRING, `coin_balances`, `transactions`, giriş
ücretleri, ödül havuzu, shop, günlük giriş bonusu, hoşgeldin bonusu ve
referans ödülü — hepsi kaldırıldı. Tablolar `migrations/legacyNames.ts` içinde
düşürülüyor.

**Sebep ölçümdü, tercih değil.** Kadroyu botlar dolduruyor ve bot ne para yatırır
ne kazanabilir; dolayısıyla ücretli bir yarışın havaya bakan iki hâli vardı:

1. Havuz **yoktan basılıyordu** — her bot, var olmadığı hâlde giriş ücretinin
   %75'ini havuza koyuyordu. Ölçüldü: 50 giriş, **3. sıra**, **136** ödül.
   Kazanmak ve kaybetmek aynı ödüyordu.
2. Bu düzeltilince havuz **yalnızca oyuncunun kendi parası** oldu; platform
   kesintisi düşülüp geri veriliyordu. Ölçüldü: 50 ver, 21 al. Üstelik tek
   insan gerçek oyuncular arasında hep birinci olduğu için **sırası yine hiçbir
   şeyi değiştirmiyordu.**

Sıralamanın anlam kazanması için iki gerçek oyuncu gerekiyor; o gelene kadar
ücretli yarış ya enflasyon ya da zarar. İkisi de oyun değil.

**Yerine geçen:** yarışmak yarışçıyı geliştirir (yukarıdaki tablo), evrim
kademeleri statlardan türer, sıralama ve seri kaydı tutulur. Tek ödeme noktası
**$3 USDC Showcase upgrade**'idir ve o da görünüşü değiştirir, hızı değil.

**Onchain tarafı değişmedi:** mint, burn, VRF rarity, yarış seed'i, sonuç hash'i
ve kazanan adresi aynen duruyor.

> Bu, CLAUDE.md'de kilitli olan "SPRING offchain oyun içi para" kararını
> geçersiz kılar. Karar 2026-08-06'da, yukarıdaki ölçümler görüldükten sonra
> bilinçli olarak alındı.

---

## Sanat Yönü

Tam doküman: [docs/ART_DIRECTION.md](docs/ART_DIRECTION.md). Özet:

### Üretim hattı kararı: 2D asıl, 3D pazarlama

Oyun içi 16 form **2D üretilir** ve Rive'ın 8 katmanlı şemasına kesilir. Rarity ayrı sanat değil, Rive'da malzeme katmanı. **3D sadece pazarlama ve mint/rarity reveal görselleri için** — PBR kromun gerçekten sattığı yer orası.

Bu, 3D denendikten sonra alınmış bir karar, peşin hüküm değil:

| Bulgu | Sonuç |
|---|---|
| Meshy auto-rig iki kez `Pose estimation failed` verdi | Tıknaz oyuncak oranları (dev kafa, boyun yok, güdük uzuvlar) insansı poz tahmincisinin dışında |
| Kilitli animasyon kararı zaten Rive (2D katman) | Rig'e ihtiyaç yoktu — 3D'nin çözdüğü sorun bizde yoktu |
| 3D'ye geçişte yüz ifadesi bozuluyor (güleç → asık) | Karakterin kişiliği transferde kayboluyor |
| Yarış görünümü 48-64px | PBR yansımanın okunacağı ölçek değil |

**Üretim modeli: `nano-banana-pro`** (Meshy'nin text-to-image API'si üzerinden, 9 kredi/görsel). `fal.ai` / `flux-pro v1.1` **emekli** — gerçek negative prompt desteği yok, "anten yok" gibi kısıtlara uymuyor, 5 tur denendi. nano-banana-pro aynı kısıtları tek seferde tutturdu. Taslak turlarında `nano-banana` (3 kredi) yeterli.



- **Render tekniği: kalın koyu outline (`#241A38`) + parlak doygun toon.** Stumble Guys / Turbo FAST / Fall Guys ekolü. Üç teknik denendi, işe yarayan bu.
- **Malzeme: gerçek PBR.** Toon form korunur, ama yüzey gerçek metal/roughness taşır — rarity'nin ikna ediciliği buna bağlı. Krom, yansıyacak bir ortam olmadan krom gibi görünmez: **yarış sahnesinde environment map / IBL zorunludur.**
- **Ton: vitrin parlaklığı, kırık oyuncak değil.** Yıpranma yok, sadece durum farkı var. En düşük rarity bile "kırık" değil, "vitrin kalite değil."
- **Çevre paleti sıcak ve açık:** `wall #C9DFF5` · `floor #E8C99B` · `shelf #9AA6B2` · `ink #241A38` · `paper #FFFDF7` · `dust #7A7488`
- **Renk bütçesi:** Bir karede en fazla iki aksan rengi baskın olabilir. Çevre nötr kalır, aksanlar sadece yarışçılarda yaşar.
- **Rarity = yüzey değişimi:** Fair (donuk tin, çizik) → Good (düz mat boya) → Excellent (parlak cila) → Near Mint (krom kaplama) → Mint (altın varak). Ayrı sanat değil, malzeme katmanı — 16 asset + 5 katman.

### Kurma anahtarı = oyun mekaniği, dekor değil

Her yarışçının **kurma anahtarı** okunabilir bir göstergedir:
- Dolu stamina → anahtar hızlı dönüyor
- Stamina düştükçe → yavaşlıyor, dönüş izi kısalıyor
- Tükendiğinde → duruyor
- T3 evrimde → sürekli hızlı, hareket izi görünür

**Yerleşim:** Anahtar, yarış kamerasının gördüğü tarafta olmalı — pist soldan sağa aktığı için bu sabit ve bilinen bir taraftır. Gerçek kurmalı oyuncaklarda anahtar neredeyse her zaman gövdenin yanındadır (yay namlusu yatay geçer); kelebek/çift kanat formu da oradan gelir. Kamera tarafına bakan bir kelebek anahtar dönerken ekran düzleminde pervane gibi okunur.

**Üretim kısıtı:** Anahtar **ayrı bir mesh/katman** olmalı, gövdeye kaynatılmış değil — dönüşü koddan sürülüyor. Otomatik rig araçları insansı iskelet üretir ve anahtar için kemik vermez. ART_DIRECTION §12'deki 8 katmanlı şemada `key` zaten 1. katman.

---

## Teknik Stack

```
Frontend:   React + TypeScript
Styling:    Tailwind CSS
Animasyon:  Rive (oyun içi) + Framer Motion (UI) + fal.ai video (sadece pazarlama)
Cüzdan:     Wagmi + RainbowKit
Onboarding: Privy (e-posta ile kayıt)
Network:    Base Sepolia (testnet) → Base Mainnet
NFT:        ERC-721 + OpenZeppelin
Randomness: Chainlink VRF v2.5
USDC:       Base'deki native USDC kontrat
Gasless:    Base Paymaster (ERC-4337)
DB:         PostgreSQL (SPRING bakiyeleri)
Backend:    Node.js + Express
Deploy:     Hardhat (kontratlar)
Sanat:      Meshy (3D) + fal.ai (2D) — scripts/meshy.ts, scripts/generate.ts
```

**Rive neden:** Lottie 17fps'de kalırken Rive ~60fps; 100kb'lık Lottie ~10kb; ve asıl sebep **state machine** — animasyon oyun durumuna tepki verir, sadece döngü oynatmaz. `speed` input'u animasyon hızını sürekli sürer. Maliyet: web runtime ~200KB gzipped (WASM), yarış sayfasında lazy load edilir.

**Sanat script'leri para/kredi harcar.** İkisi de `--budget` bayrağını zorunlu tutar, varsayılanı yoktur ve `--dry-run` her zaman ücretsizdir. Anahtarlar `scripts/.env` içindedir (gitignored, chmod 600) — başka hiçbir yerde tutulmaz.

---

## Klasör Yapısı (Hedef)

```
wind-up-rush/
├── contracts/
│   ├── FreeRacer.sol    # Wind-Up ERC-721
│   ├── Racer.sol        # Showcase ERC-721 (dinamik metadata)
│   └── RaceCore.sol     # Ana oyun kontratı (hash kayıt, kazanan)
├── frontend/
│   ├── src/
│   │   ├── config/theme.ts   # TEK tema kaynağı
│   │   ├── components/
│   │   │   ├── Race/         # Yarış animasyonu (Rive)
│   │   │   ├── PreRace/      # Yarış öncesi beceri fazı (etiket: Wind-Up)
│   │   │   ├── Collection/    # Ana sayfa / koleksiyon (etiket: Toybox)
│   │   │   └── Shop/
│   │   ├── hooks/
│   │   └── pages/
├── backend/
│   ├── routes/
│   │   ├── currency.ts  # SPRING bakiye
│   │   ├── race.ts
│   │   └── shop.ts
│   └── simulation/      # Yarış simülasyon motoru (açık kaynak)
├── scripts/             # Sanat üretim araçları (bütçe zorunlu)
├── docs/
└── CLAUDE.md
```

---

## Güven Modeli (Jüriye Anlatılacak)

1. Rarity manipüle edilemez → Chainlink VRF onchain
2. Yarış sonucu manipüle edilemez → VRF seed + deterministik kod + onchain hash
3. Kim kazandı şeffaf → kazanan adresi Base'e yazılır
4. NFT güvenli → ERC-721 standardı
5. SPRING bakiyesi → platforma güven (V4'te tam onchain token ile çözülür)

Simülasyon kodu açık kaynak olacak → anyone-can-verify

---

## Demo Day Öncelik Sırası

### ŞART:
1. Wind-Up gasless mint
2. Showcase upgrade ($3 USDC mock + burn + mint)
3. Rarity reveal animasyonu (VRF veya mock)
4. Toybox sayfası (koleksiyon görüntüleme)
5. Sprint ve Endurance yarış akışı (tek pist: Diorama Speedway, iki mesafe)
6. Wind-Up fazı UI (beceri bazlı grid belirleme)
7. Grid gösterimi
8. Broadcast görünüm (4 yatay şerit, yarış animasyonu)
9. SPRING bakiye sistemi
10. Prize pool dağıtımı

### V1'DEN ÇIKARILDI (2026-08-06 sadeleştirmesi)
- **Training** — 2 saat boyunca yarışçıyı *oynanamaz* yapıyordu. İlerlemek için oyundan çıkmayı zorunlu kılan tek mekanikti.
- **Mini oyunlar** — 449 satır, yarıştan bağımsız ikinci bir oyun.
- **Günlük görevler** — sınırsız SPRING kaynağıydı, karar üretmiyordu.
- **Community Board / Feedback** — oyun değil, 630 satır ve 11 uç.
- **Taktik Mod / Grand Prix** — yukarıda, ayrı gerekçelerle.

### BONUS (hâlâ kodda, MVP'de gizli):
- Güçlendirici satın alma
- Aksesuar sistemi
- Evrim modalı

---

## Önemli Notlar

- **Kart/paket sistemi YOK** — ertelendi, tartışmaya açma
- **Üreme sistemi YOK** — tamamen çıkarıldı
- **Seyirci bahsi/tahmini YOK** — V1'de de V2'de de yok, kaldırıldı
- **Lonca sistemi V2'de** — V1'de yok
- **GDA fiyat motoru V2'de** — V1'de taktik aksiyon yok
- **Gizli statlar YOK** — V2 adayı olarak not edildi, V1'de alınmadı
- **Double-or-Nothing rövanş iptal** — yerine sade "Rematch" (aynı ücret, çarpan yok)
- Botlar UI'da "BOT" etiketiyle gösterilir, ödül kazanamaz
- Daily free race wallet başına 1 — yarışçı sayısından bağımsız
- Sybil koruması: 1 Wind-Up per wallet + rate limit

---

## Şu An Neredeyiz

V1 kapsamı sadeleştirildi ve `main`'de. Oyun döngüsü: **mint → mesafe ve loadout
seç → yarış → yarışçı gelişir.** Oyun içi para yok; tek ödeme $3 Showcase
upgrade'i ve o da görünüşü değiştiriyor.

Kapılar tek komut: **`npm run verify`** (typecheck + `lint:vocab` +
`check:verifier` + 17 birim testi). Uçtan uca: `QA_BYPASS_TOKEN=local-dev` ile
iki tarafta da → **57/57**. Kontrat testleri ayrı: `cd contracts && npx hardhat test` → 4/4.

> **`check:verifier` neden var:** `simulation/` altındaki bağımsız doğrulayıcı
> motorun kendi kopyasını taşıyor — "sunucuya güvenmek zorunda değilsin"
> iddiasının tamamı ona dayanıyor. O kopya 123 satır geride kalmıştı ve README'si
> iki marka önceki oyunu anlatıyordu. Sunucudan farklı sonuç veren bir açık
> doğrulayıcı, adalet iddiasını kanıtsız bırakmaz — **yanlış yapar.**

### ⚠ Passive'ler yazılmış ama hiç çalışmamış

Motorda altı passive dalı var (`late_surge`, `impact_resist`, `luck_magnet`,
`fatigue_resist`, `misfortune_flip`, `overtake_boost`) ve `theme.ts` etiketlerini
taşıyor. Ama **hiçbir şey passive atamıyor** — atayan tek yer kaldırdığımız manuel
evrim ucuydu. Veritabanındaki 114 yarışçının hiçbirinde passive yok, yani bu
dallar bir kez bile tetiklenmemiş.

Dallar zararsız ve bir passive atanırsa doğru çalışırlar; o yüzden silmedim.
Ama **doküman çalışıyormuş gibi yazıyordu, yazmıyor artık.** Karar: passive'ler
nereden gelecek (mint? rarity? upgrade?) — alınmadı.

### Kontrat redeploy'u — bilinçli olarak bekletiliyor

Kontratlar yeniden adlandırıldı (`FreeRacer` / `Racer` / `RaceCore`), derlendi, testleri geçiyor ve deploy'u yerel bir node'a karşı prova edildi — ama **testnet'e atılmadı.** Bu bir eksik değil, karar:

- **Kırık bir şey yok.** ABI fonksiyon imzalarından üretilir, kontrat adından değil. Frontend zincirdeki kontratlarla konuşmaya devam ediyor.
- **Rarity kontrata dokunmuyor.** Zincirdeki enum `Common…Legendary` — tema-nötr. Fair→Mint sadece `theme.ts` etiketi.
- **Bayat olan tek şey ERC-721 name/symbol.** Constructor'da sabitlenir; cüzdanda ve OpenSea'de NFT hâlâ eski markayı taşıyor.

**Tetikleyici:** kontrat *mantığı* değişince, ya da **başvurudan önce** — hangisi önce gelirse. `DEVFOLIO_ANSWERS.md` başvuruda kullanılacak üç adresi listeliyor ve üstünde "NOTE BEFORE SUBMITTING" uyarısı duruyor: o adresler redeploy öncesi bytecode'a ait. Deploy sonrası `contracts/scripts/verify-deployment.ts` dört bağlantıyı geri okuyup doğruluyor.

### Sıradaki iş kalemleri

1. **Cüzdan bağlı tam oyun denemesi.** Uçtan uca API ile doğrulandı (57/57) ve
   ekranla bakıldı, ama gerçek bir oyuncu tarafından baştan sona oynanmadı.
   Özellikle yarış içi item butonları cüzdan gerektiriyor, o yüzden önizleme
   modunda hiç görünmediler.
2. **Mint stat tabanı.** Mint stat başına ~10 veriyor, tavanlar 15 (free) ve
   22-35 (rarity). Taze yarışçı bütün sayıların ayarlandığı aralığın altında
   başlıyor; Endurance'ı 53 saniyede koşmasının sebebi bu. Denge kararı.
3. **Passive'ler** — yukarıdaki açık kalem.
4. **Ücretsiz yarışçılara arketip atanmıyor**, hepsi Tinbot çiziliyor.
5. **Kontrat redeploy'u** — aşağıdaki tetikleyiciye bağlı.

### Sanat hattı — kanıtlanmış ve tekrarlanabilir

Dört arketip de üretildi (`frontend/public/art/{tinbot,jetster,waddler,chomper}/`). Yöntem:

1. **Üret:** `scripts/meshy.ts image --ref <kilitli sayfa>` — kilitli parça sayfasını referans ver, prompt'ta **sadece değişecek şeyi** iste. Metinden tarif etmek üç turda battı; referansla tek turda tutuyor. **Parça sayısını açıkça yaz** ("exactly seven pieces"), yoksa üç kol bir bacak geliyor.
2. **Ayıkla:** `scripts/extract-parts.py` — sayfayı parçalara böler. Zemin "kenara bağlı olan bölge"dir, "zemin rengine yakın" değil; aksi halde sanattaki beyazlar delik olur.
3. **Doğrula:** `scripts/silhouette-test.py` (§4.1 şeridi), `scripts/rig-preview.py` (pivotlar), `tools/screenshot.mjs` (gerçek ekran).

Rig geometrisi arketip başına, eklem noktaları gövdenin oranı olarak: `frontend/src/lib/racerRig.ts`. Parça boyutları arketipler arasında çok değiştiği için (gövde 138–214 geniş) tek bir sabit set çalışmıyor.

**Bilinen boşluk:** ücretsiz (`free`) yarışçılara arketip atanmıyor — sadece upgrade'de atanıyor. O yüzden her ücretsiz yarışçı Tinbot çiziliyor. Tema açısından savunulabilir (Wind-Up = kutusu açılmamış temel oyuncak, arketip upgrade'de belli oluyor) ama **bilinçli bir karar değil, veri sonucu.** Ayrı bir "sade ücretsiz oyuncak" asset'i mi üretilsin, karar verilmedi.

### İlgili dokümanlar

- [docs/RETIRED_WIND_UP_PHASE.md](docs/RETIRED_WIND_UP_PHASE.md) — emekli faz, tarihî kayıt
- [docs/ART_DIRECTION.md](docs/ART_DIRECTION.md) — palet, siluetler, evrim, rarity malzemeleri, Rive katman şeması, QC listesi
- [docs/REBRAND_AND_VISUAL_PLAN.md](docs/REBRAND_AND_VISUAL_PLAN.md) — migration planı, faz planı, riskler *(§3.3 Tune-Up bölümü eskidir — Wind-Up fazı onu geçersiz kıldı)*
- [docs/HANDOFF_MESHY_3D.md](docs/HANDOFF_MESHY_3D.md) — 3D sanat pipeline durumu
