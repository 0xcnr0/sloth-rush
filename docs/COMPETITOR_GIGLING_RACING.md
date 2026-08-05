# Gigling Racing (Gigaverse) — Mekanik Sökümü

**Tarih:** 2026-08-06 · **Kaynak:** docs.gigaverse.io, canlı `gigaverse.io/api/racing/*`, prod JS bundle

Bu, bizimkine en yakın canlı üründür: onchain, NFT'li, 2–8 kişilik, item'lı, deterministik-motorlu
yarış oyunu. Abstract L2 üzerinde çalışıyor (biz Base). Aşağıdaki sayıların çoğu **dokümandan değil,
canlı motordan** okundu.

> **Kelime uyarısı.** Bu doküman rakibin sözlüğünü (`stakes`, `payout`, `odds`, `jackpot`) olduğu
> gibi aktarır — onların ürünü öyle konuşuyor. Bu kelimelerin *hiçbiri* bizim koda geçmez;
> CLAUDE.md §"Dil — Sıfır Bahis Terimi" hâlâ geçerli. `tools/check-vocabulary.sh` yalnızca
> `frontend/src` · `backend/src` · `contracts/contracts` · `simulation` tarar, `docs/` taramaz —
> bu dosya bilinçli olarak o kapsamın dışındadır.

---

## 0. Veriyi nasıl aldım (tekrarlanabilir)

Replay sayfası boş bir Next.js kabuğu. Ama arkasındaki API kimlik doğrulaması istemiyor:

```bash
# Yarış meta verisi (ücret, ödül dağılımı, sıralama, bitiş süreleri)
curl -s https://gigaverse.io/api/racing/race/31468

# Tam replay: config + faction segmentleri + yarışçılar + 661 tick'in her biri
curl -s -X POST -H 'Content-Type: application/json' -d '{}' \
     https://gigaverse.io/api/racing/race/31468/tick

# Son 50 yarışın listesi (mesafe/kadro/ücret dağılımı)
curl -s https://gigaverse.io/api/racing/races
```

Tuning sabitleri prod bundle'ında düz metin: `/_next/static/chunks/ea66e06234dba173.js` içinde
`TUNING` adlı tek bir nesne. Trait tanımları, rarity tablosu, item matematiği ve reveal sabitleri de
aynı dosyada.

---

## 1. Oyun döngüsü

| | |
|---|---|
| Kadro | 2–8 gigling, **bot yok** — boş slot varsa yarış beklemede kalır |
| Mesafe | 500m · 1200m · 2500m · 3000m (canlıda 100m ve 1000m de görüldü) |
| Giriş | Free (sadece gas) veya ETH |
| Günlük limit | Gigling başına **2 yarış**, abonelikle **3** |
| Yarış yaratma | Günde 5 (abonelikle 50) — yaratmak için Gigaverse hesabı şart, katılmak için değil |
| Çözümleme | Sunucu tarafı "Race Oracle", sonuç onchain'e yazılıyor |

Katılma kriteri host tarafından ayarlanabiliyor: public / allowlist / **ELO**. Her gigling'in bir
ELO'su var (varsayılan 1500), yani seviye eşleştirme zaten var.

**Canlı yarış dağılımı (son 50 yarış):** en yaygın konfigürasyonlar 1000m/6 kişi ve 500m/8 kişi.
Giriş ücreti neredeyse her zaman ya **0** ya da **0.0005 ETH** (~1.5$). Yani gerçekte oynanan şey
mikro-ücretli, ucuz yarışlar — büyük ücretli yarışlar teoride var, pratikte yok.

---

## 2. Gigling modeli

Dört sayısal stat (0–100), her yarış **yeniden zar atılıyor**:

| Stat | Rolü |
|---|---|
| **Start** | Çıkıştaki patlayıcılık — açılış bölümünde ağır basar |
| **Speed** | Ortadaki seyir hızı — start ve finish fazları arasında baskın |
| **Finish** | Kapanış vuruşu — son bölümde ağır basar |
| **Stamina** | Hızın mesafeye dayanması — düşük stamina uzun yarışlarda söner |

Sayısal olmayanlar: **Gender** (üreme için dişi gerekir), **Rarity** (6 kademe), **Faction**
(8 tane veya factionless), **sıcaklık tercihi** (cold/average/hot), **Traits**.

### Rarity — bizden farklı olarak *güç* veriyor

```
id  isim        traitCount  statFloor  mintWeight
1   uncommon        1           0         60
2   rare            2          10         25
3   epic            3          20         10
4   legendary       4          30          4
5   relic           5          40          0.9
6   giga            6          50          0.1
```

`statFloor` = yarış öncesi zarın alt sınırı. Bir Giga gigling asla 50'nin altına stat atmaz ve
6 trait taşır. **Bu bir pay-to-win eksenidir.** Bizim kararımız (rarity = sadece görsel) burada
tersine dönmüş.

---

## 3. Motor — sabitler bundle'dan birebir

```js
TUNING = {
  generation:      { statMin: 0, statRange: 100 },
  generationBonus: { perGen: 5, decayEveryGens: 10, decayPerStep: 1, minPerGen: 1 },
  finalTickSpeedMult: 0.2,
  raceStatRoll:    { spread: 8 },
  speed:           { minMPerSecond: 92, maxMPerSecond: 100 },
  faction: {
    segmentLengthM: 100, boostMin: 1.025, boostMax: 1.1,
    segmentWeights: { 1:12, 2:12, 3:12, 4:12, 5:12, 6:12, 7:12, 8:16 }   // 8 = Gigus
  },
  temperature: { matchBonus: 0.05 },
  phase:       { startBegin: 0.2, startEnd: 0.475, finishStart: 0.525, finishEnd: 0.8 },
  stamina:     { decayPerMeter: 0.000075 },
  smoothing:   { factorUp: 0.5, factorDown: 0.4 },
  raceItems:   { bpsPerPoint: 1, factionMatchMultiplier: 2, minNerfSpeedMult: 0.5 },
  modifiers:   { defaultMaxStacksPerSource: 1, maxStacksBySourceKey: { "trait:surger:proc": 2 } }
}
```

### 3.1 Hız bandı inanılmaz dar — ve bu kasıtlı

`stat 0 → 92 m/s`, `stat 100 → 100 m/s`, sonra hepsi `finalTickSpeedMult = 0.2` ile çarpılıyor:

**gerçek hız = 18.4 m/s (stat 0) … 20.0 m/s (stat 100) → yalnızca %8.7 fark.**

Replay bunu doğruluyor: 31468 numaralı yarışta ilk tick hızları 18.51 / 19.30 / 20.56 / 18.74 m/s.
1200m ≈ 60 saniye.

Karşılaştır:

| Modifiye | Etki |
|---|---|
| Ham stat farkı (0 → 100) | **+8.7%** |
| Sıcaklık tercihi tutması | +5% |
| Faction segmenti (kendi bölgesi) | +2.5% … +10% |
| Trait: Surger ★ proc | +25% (4 tick), **2 kata kadar istiflenir → +56%** |
| Trait: Clutch ★ | +20% (10 tick) |
| Item: butterfly | +5% (50 tick), kendi faction'ıysa +10% |
| Item: dung | −5% … taban %50'de kesilir |

**Tasarım dersi:** ham stat, durumsal modifiyelerin yanında önemsiz. Sonuç: her yarış foto-finiş,
zayıf gigling'in de kazanma şansı var, ve "hangi mesafe/hava/faction bileşimine gireyim" kararı
istatistik biriktirmekten daha önemli hale geliyor. Kısa bant = ilgi çekici yarış.

### 3.2 Faz eğrisi

`phase` sabitleri parkurun kesir cinsinden bölümlerini işaretliyor:

```
0.000 ──── 0.200 ─────────── 0.475 ── 0.525 ─────────── 0.800 ──── 1.000
   Start saf      Start→Speed harman   Speed saf   Speed→Finish harman   Finish saf
```

Replay hız eğrisi bu sınırları birebir gösteriyor: 4602 numaralı gigling'in hızı `frac 0.200`'de
tam minimum yapıp yükselmeye başlıyor, `frac ~0.49`'da tepe yapıp düşüşe geçiyor. Sunucu tarafındaki
tam harman formülü bundle'da yok (oracle'da), ama şekli belirsiz değil.

`smoothing.factorUp/factorDown` = hız değişimleri üstel yumuşatmadan geçiyor; bir trait devreye
girdiğinde hız 4–5 tick içinde yeni değere oturuyor, sıçramıyor. (Replay'de `frac 0.75`'te Closer
trait'inin devreye girişi tam olarak böyle görünüyor: 17.436 → 18.076, 5 tick içinde.)

### 3.3 Stamina = tek gerçek mesafe kaldıracı

`maxTicks` hesabındaki formül bileşenin biçimini ele veriyor:

```js
Math.max(0.05, 1 - trackLength * decayPerMeter / 2)   // /2 → stamina = 50 orta nokta
```

Yani **doğrusal** bir sönüm: `hızçarpanı = 1 − mesafe × 0.000075 × (1 − STA/100)`.

| Mesafe | STA 0 | STA 50 | STA 100 |
|---|---|---|---|
| 500m | −3.8% | −1.9% | 0% |
| 1200m | −9.0% | −4.5% | 0% |
| 3000m | −22.5% | −11.3% | 0% |

3000m'de stamina, diğer bütün modifiyeleri toplamından daha büyük. **Mesafe seçimi = build seçimi.**
Bu, "bir gigling'i her yarışa sokmak" yerine "doğru yarışı seçmek" oyununu yaratan mekanik.

### 3.4 Faction segmentleri

Parkur her 100m'de bir faction'a atanıyor, ağırlıklı çekilişle (Gigus 16, diğerleri 12 → Gigus
%14.8, diğerleri %11.1). Kendi bölgende +2.5%…+10%.

Gerçek örnek (yarış 31468, 1200m): `1, 5, 8, 6, 7, 4, 3, 3, 6, 3, 4, 7` — **hiç faction 2 yok.**
Yarıştaki tek faction'lı gigling (Overseer, id 2) parkur boyunca sıfır ev sahibi avantajı aldı.
Yani faction bir şans katmanı; segment dizilimi yarış başında açıklanıyor ve odds'u değiştiriyor.

### 3.5 Traits — 12 tane, hepsi bundle'dan

Her trait ★ / ★★ / ★★★ kademesinde. `spec` alanları tetikleyici + efekt olarak veri tanımlı
(hardcoded `if` değil) — bizim de benimsememiz gereken yapı.

| Trait | Tetikleyici | Etki (★/★★/★★★) |
|---|---|---|
| **Fast Start** | ilk 50 tick | +15% / +20% / +25% hız |
| **Closer** | son %25 | +4% / +7% / +10% hız |
| **Clutch** | son 100/200/300m, tick başına %10 şans | +20/+25/+30%, 10 tick |
| **Surger** | her tick %2/%3/%4 şans | +25/+30/+35%, 4 tick, **2 stack** |
| **Comeback** | kadronun arka yarısındayken | +5% / +7% / +9% |
| **Faction Heart** | kendi faction segmentinde | +3% / +5% / +8% (faction boost'a eklenir) |
| **Steady** | yarış başında | stat zarının sigması ×0.7 / ×0.5 / ×0.3 |
| **Volatile** | yarış başında | stat zarının sigması ×1.5 / ×2.0 / ×2.5 |
| **Dung Lover** (gen-2) | üzerine dung atıldığında | %25/40/60 ihtimalle nerf'i **boost'a çevirir** |
| **Sticky Wings** (gen-2) | üzerine butterfly atıldığında | boost süresi ×1.25 / ×1.5 / ×1.75 |
| **Gigus' Blessing** (koşullu) | Gigus segmentinde, tick başına %30/40/50 | +10% |
| **First Born** (koşullu) | liderdeyken | yavaşlama ×0.7 / ×0.55 / ×0.4 |

Dikkat çeken üçü:

- **Steady / Volatile** stat'ı değil **varyansı** değiştiriyor. Aynı gigling "güvenilir" ya da
  "piyango" olarak oynanabiliyor. Zar-şekli bir trait, güç trait'i değil. Çok zarif.
- **Dung Lover / Sticky Wings** item meta'sına karşı trait. Sabotaj ağırlıklı bir lobide anti-meta
  bir build var. Item sistemi tek boyutlu kalmıyor.
- **Surger** tek trait ki 2 kez istiflenebiliyor (`maxStacksBySourceKey`). Replay'de gördüm:
  8079 numaralı gigling t=440'ta **28.95 m/s** yaptı — taban ~18.5'in 1.5625 katı = 1.25².
  Bir yarışın tek anda kopabildiği yer burası.

### 3.6 Item matematiği

```js
puan   = item.pointsPerAmount × miktar          // temel item: 500
         × 2 eğer item faction'ı = gigling faction'ı
çarpan = puan × bpsPerPoint / 10000              // 500 → 0.05 = %5
boost  → 1 + çarpan          nerf → max(0.5, 1 − çarpan)
```

Item'lar: `butterfly` (boost) ve `dung` (nerf), her ikisinin de 8 faction versiyonu. Süre 50 tick
(5 saniye). Gigus versiyonları çift puanlı (1000). Nerf tabanı %50'de sabit — kimse tamamen
durdurulamıyor.

Item'lar **hatchery'den** geliyor: gigling'leri besliyorsun, erkekler dung, dişiler butterfly
üretiyor. Yani sabotaj kaynağı da NFT sahipliğine bağlı, mağazadan alınmıyor.

---

## 4. Bilgi asimetrisi — oyunun asıl kancası

Bu, oyunun mekanik olarak en özgün parçası ve bizde karşılığı yok.

**Bir gigling aldığında stat'larını görmüyorsun.** Sadece gender, faction ve rarity açık. Geri
kalan `0-100` aralığı olarak gösteriliyor ve yarıştıkça daralıyor.

Bundle'dan sabitler:

```
DEFAULT_MAX_RACES            = 60   // kariyer ömrü
RACES_PER_STAT_FULL_REVEAL   = 10   // bir stat'ın tam açılması için gereken "pip"
MIN_RACES_TO_DUEL            = 20   // (doküman 40 diyor — doküman eski)
MAX_DUELS                    = 5    // (doküman 3 diyor — doküman eski)
```

Açılma algoritması:
- Her **5.** yarışta rastgele bir trait'in **adı** ya da **kademesi** açılır (dönüşümlü).
- Diğer yarışlarda henüz dolmamış rastgele bir stat'a +1 pip eklenir.
- Her pip, o stat'ın tahmin aralığını daraltır — aralık deterministik olarak (petId'den türetilen
  seed ile) gerçek değerin etrafına sıkışır, yani sahte daralma değil, gerçek bilgi.
- 60 yarışlık kariyerde ~48 stat pip'i dağılır; 4 stat'ı da tam açmak 40 pip ister. **Bir gigling'i
  tam tanıdığında kariyeri neredeyse bitmiş oluyor.**

Bu üç şeyi aynı anda çözüyor:
1. Yarışmak için içsel bir sebep verir (para değil, **bilgi** kazanırsın).
2. NFT ikinci el piyasasını canlı tutar — "yarı-açılmış" bir gigling bir bahistir.
3. Kariyer sonu üremeyi zorunlu kılar; stat'lar ancak üreme sonrası tam açılır.

---

## 5. Ekonomi

Giriş ücreti dört yere bölünüyor. **Doküman ile canlı zincir verisi uyuşmuyor:**

| Kalem | Doküman | Canlı (yarış 31468) |
|---|---|---|
| Protokol ücreti | 3% (abonelikle 1%) | **2.5%** (abonelikle **0.5%**) |
| Yaratıcı ücreti | 1–10% | 0.5% (bu yarışta) |
| Jackpot besleme | 2.5% | **5%** |
| Ödül havuzu | 85–95% | kalan |
| Jackpot'tan kazanılabilen | 40% | 40% ✓ |
| Jackpot şansı tavanı | 2% (abonelikle 4%) | 2% / 4% ✓ |
| Hedef giriş ücreti (şans tavanı için) | 0.1 ETH | 0.1 ETH ✓ |

Anlık jackpot bakiyesi: **2.81 ETH**. Yalnızca 1.'ye çıkan piyango çeker, şans girişe ve kadro
boyutuna göre %0.005–%2 arası.

Abonelik (Giga Juice) sattıkları şey: daha çok yarış, daha çok yaratma hakkı, **iki kat piyango
şansı**, düşük protokol ücreti, artan XP. Yani abonelik doğrudan güç değil, **hacim ve varyans**
satıyor — düzenleyici açıdan da rahat bir konum.

---

## 6. Mimari — bizim için en kritik bulgu

Yarış **tek seferde önceden hesaplanmıyor.** `tick` cevabındaki alanlar:

```json
{ "seed": 1694000970, "lastResolvedTick": 661, "resolverBatchSizeTicks": 50,
  "scheduledItems": [], "finished": true }
```

Motor mulberry32 PRNG'yi tek bir `uint32` seed'den sürüyor ve **50 tick'lik (5 saniyelik) partiler
halinde** çözümlüyor. Yarış sürerken atılan item'lar `scheduledItems` olarak kuyruğa giriyor ve
gelecek bir tick'te uygulanıyor. Böylece hem canlı etkileşim var hem determinizm bozulmuyor: aynı
seed + aynı scheduled item listesi = aynı yarış, herkes doğrulayabilir.

**Bu doğrudan bizim Taktik Mod'umuzun cevabı.** Turbo Wind ve Marble Toss yarış sırasında
kullanılıyor; dolayısıyla VRF seed'inden yarışın tamamını `t=0`'da hesaplayamayız. Parti-parti
çözümleyen bir resolver + zamanlanmış aksiyon kuyruğu gerekiyor. Şu an `backend/src/simulation/`
bunu varsaymıyor.

Diğer notlar:
- Tick hızı **10 Hz**, `secondsPerTick: 0.1`. 1200m = 661 tick. Replay verisi 91 KB — tamamen
  makul bir istemci yükü.
- Client sadece `positions[]`, `ranks[]`, `speedMultipliers[]` alıyor; stat'ları ve trait'leri
  hiç görmüyor (bilgi asimetrisi sunucuda korunuyor).
- Yarış sonucu onchain'e tek bir `broadcastTxHash` ile yazılıyor.

---

## 7. Wind-Up Rush'a çıkarımlar

### 7.1 Doğrudan çalınacaklar

1. **Dar hız bandı.** Ham stat farkını %10 civarında tut, gerçek farkı durumsal modifiyelerden
   (faz, pist bölgesi, item, trait) çıkar. Bizde 6 stat var ve SPD'nin ham etkisi muhtemelen fazla;
   §13 tuning sweep'i bu gözle bir daha bakmalı.
2. **Stamina'yı mesafe kaldıracı yap.** Tek doğrusal sönüm katsayısı, mesafeye göre ölçeklenen.
   Bizde tek pist var (Diorama Speedway) — **ikinci bir mesafe eklemek build çeşitliliğini
   bedavaya getirir.** Şu an STA'nın ne işe yaradığı oyuncuya belirsiz.
3. **Parti-parti resolver.** Bkz. §6. Taktik Mod bunu zorunlu kılıyor.
4. **Veri-tanımlı trait/passive'ler.** `{trigger: {...}, effect: {...}}` şeması, `if` yığını değil.
   Yeni passive eklemek tablo satırı eklemeye dönüşüyor ve test edilebilir oluyor.
5. **Varyans trait'i (Steady/Volatile).** Gücü değil zarı değiştiren bir modifiye ekseni bizde yok
   ve neredeyse bedava derinlik veriyor.
6. **Faz sınırları sabit olarak dışarı çıkarılsın.** `startBegin/startEnd/finishStart/finishEnd`
   tek bir tuning nesnesinde. Bizim `theme.ts` disiplinimizin motor karşılığı.

### 7.2 Bilinçli olarak yapmayacaklarımız

- **Rarity → güç.** Onlarda `statFloor` var. Bizim kararımız (rarity = sadece görsel/vitrin)
  duruyor; app store ve "pay-to-win" optiği açısından daha temiz. Ama bunun bir bedeli var:
  onlarda rarity mint'i satıyor, bizde satmıyor. Showcase upgrade'inin ($3) çekiciliği tamamen
  görsele ve broadcast ayrıcalığına yaslanmak zorunda.
- **Jackpot / piyango.** Doğrudan kumar mekaniği. Bizim dil politikamızla uyumsuz.
- **Kariyer ölümü + üreme.** CLAUDE.md'de "Üreme sistemi YOK" kesin karar. Onlarda arz kontrolü
  bunun üzerine kurulu; bizde arz kontrolü yok (her upgrade bir Showcase üretiyor) — bu bizim
  **çözülmemiş** ekonomi kalemimiz, Sprint 9'un konusu.
- **Bot yok.** Onlarda boş slot yarışı bekletiyor. Bizim 4 yarışçılık kadroyu bot dolduruyor ve
  bu doğru karar — soğuk başlangıçta lobi doldurmayı bekleyemeyiz.

### 7.3 Ciddiye alınması gereken tek büyük fikir: **bilgi asimetrisi**

Bizim Wind-Up Fazı beceri bazlı hale gelince (§"Açık ekonomi kalemi"), oyuncunun yarış öncesi
verecek bir *kararı* kalmadı — sadece bir refleks testi kaldı. Gigling'in çözümü, kararı
**yarış öncesine değil yarış seçimine** taşımak: "bu gigling'i hangi mesafeye, hangi havaya,
hangi kadroya sokayım?" Bu karar ancak stat'lar gizliyse anlamlı.

Bizde stat'lar tamamen açık ve training ile deterministik büyüyor. Yani şu an:
- yarış seçimi kararı yok (tek pist, tek mesafe),
- yarış öncesi karar yok (beceri testi),
- yarış içi karar sadece Taktik Mod'da var (2 aksiyon, sabit fiyat).

**Karar yoğunluğumuz düşük.** Gigling'in bu üç katmanı da dolduruyor olması tesadüf değil.
En ucuz telafi, sırasıyla: (a) ikinci mesafe, (b) pist koşulu / bölge sistemi, (c) mint'te
kısmen gizli stat.

### 7.4 Bizim için ders olan bir doküman hatası

Onların dokümanı canlı koddan sapmış: duel eşiği 40 diyor, kod 20; max duel 3 diyor, kod 5;
protokol ücreti 3% diyor, zincir 2.5%; jackpot 2.5% diyor, zincir 5%.

Bu bizim `qa-agent.ts`'in Sprint 8 training değerlerinden geride kalması ve 5 testin aylarca
kırmızı kalmasıyla **birebir aynı hata sınıfı**. CLAUDE.md'deki kural doğru: denge değişikliğinde
kod, testler ve doküman birlikte güncellenir. Rakip bunu yapmıyor ve dokümanı artık güvenilmez.

---

## 8. Ham veri

Bu inceleme için çekilen dosyalar oturum scratchpad'inde (kalıcı değil). Yeniden üretmek için §0'daki
üç curl komutu yeterli. Yarış 31468'in özeti:

```
1200m · cold · 4 yarışçı · free · faction segmentleri: 1,5,8,6,7,4,3,3,6,3,4,7
bitiş:  15460 (59.53s) · 24376 (61.34s) · 8079 (62.07s) · 4602 (66.06s)
en hızlı tick: 8079 → 28.95 m/s (t=440, Surger ×2 stack)
```
