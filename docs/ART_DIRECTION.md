# WIND-UP RUSH — SANAT YÖNÜ

**Tarih:** 2026-08-04
**Durum:** Tema kilitlendi — üretime hazır
**İlgili:** [REBRAND_AND_VISUAL_PLAN.md](REBRAND_AND_VISUAL_PLAN.md)

**Sürüm notu:** Bu, üçüncü ve son tema. İlk sürüm "Sloth Rush" (tembel hayvan), ikincisi "Scrap Rush" (mekanik hurda yaratık) idi — ikisi de kendi sanat denemelerimizde oturmadı. Bu üçüncü yön hem kendi keşfimizde (gerçek oyun referansları → Stumble Guys/Turbo FAST → hızlı mockup testi) hem 4 bağımsız dış AI aracında (ChatGPT, Gemini, Ludo.ai, Grok — sıfır ortak bağlamla) tekrar tekrar çıktı. Beş ayrı kaynaktan aynı sonuç: bu kilitli.

---

# 1. Kuzey Yıldızı

> **Anahtarla kurulan, sevgiyle boyanmış klasik oyuncaklar — bir vitrin rafının üstünde son sürat yarışıyor.**

Her görsel karar bu cümleye hizmet eder. Bir asset bu cümleyi güçlendirmiyorsa çıkar.

Oyunun duygusal yayı isminde: **temel kurmalı → vitrin kalite.** Oyuncu kutu bile açmadan gelen basit bir oyuncakla başlıyor, koleksiyoncuların "Mint" dediği pırıl pırıl bir vitrin parçasına dönüşüyor. Bu, gerçek dünyada var olan bir duygu — herkes çocukluğundan bir oyuncağın "en güzel hali"ni hayal edebilir.

---

# 2. Ton Kararı: Vitrin Parlaklığı, Kırık Oyuncak Değil

"Oyuncak" iki yöne gidebilir. Biz birini seçiyoruz ve diğerini kapatıyoruz.

| | Seçilmedi | **Seçildi** |
|---|---|---|
| Referans | Toy Story'nin terk edilmiş oyuncakları, Nacaklı oyuncak korku filmleri | **Stumble Guys, Turbo FAST, Fall Guys** |
| Yüzey | Çatlak boya, pas, eksik parça | Parlak boya, temiz krom, net çizgiler |
| Form | Ürkütücü, asimetrik, bozuk | Tombul, okunaklı, toparlanmış |
| Duygu | Terk edilmişlik, nostalji-hüznü | Gurur, canlılık, "raftan yeni indi" hissi |
| Renk | Soluk, tozlu pastel | Doygun, parlak, oyuncak-kutusu renkleri |

## Bu sadece zevk meselesi değil — kanıtlanmış bir teknik zorunluluk

Bu proje boyunca üç farklı render tekniği test edildi: yumuşak toy-gradient (terk edildi — paletle çatıştı), sert yönlü ışıklı "dynamic-lit" (terk edildi — çok karanlık/moody), kalın outline + parlak doygun toon (**test edildi, işe yaradı**). Üçüncüsü Stumble Guys'ın imza tekniği ve doğrudan bu tema için üretildi.

Mobilde dikey pistte aynı anda 4 yarışçı var, her biri ~48-64px. **Kalın koyu outline** bu boyutta formu ayakta tutan tek şey — önceki denemelerin hiçbirinde bu yoktu.

**Kural:** Yıpranma yok, sadece durum farkı var. En düşük rarity bile "kırık" değil, sadece "vitrin kalite değil."

---

# 3. Palet

## 3.1 Çevre — sıcak ve açık

Önceki iki temanın koyu (void/deck/rail) paleti tamamen terk edildi — bu, "eski hissettirme" probleminin asıl kaynağıydı: koyu palet + parlak toy-render tekniği birbiriyle çatışıyordu. Şimdi ikisi aynı dilde.

| Rol | Hex | Kullanım |
|---|---|---|
| `wall` | `#C9DFF5` | Arka plan/gökyüzü, açık mavi |
| `floor` | `#E8C99B` | Pist/zemin, sıcak ahşap tonu |
| `shelf` | `#9AA6B2` | Uzak raf/manzara silüeti |
| `ink` | `#241A38` | Outline, birincil metin |
| `paper` | `#FFFDF7` | Kart zemini, UI beyazı |
| `dust` | `#7A7488` | İkincil metin |

## 3.2 Arketip aksan renkleri

Her arketibin **tek bir sahiplenilmiş rengi** var — klasik oyuncak kataloğu renkleri, doygun ve birincil.

| Arketip | Hex | Neden bu renk |
|---|---|---|
| **Jetster** (hız) | `#E63946` | Klasik tin-oyuncak roket kırmızısı |
| **Tinbot** (tank) | `#2A6FDB` | Klasik tin-robot mavisi |
| **Waddler** (kurnaz) | `#FFC93C` | Nostaljik kauçuk ördek sarısı |
| **Chomper** (patlama) | `#4CAF6D` | Klasik plastik dinozor yeşili |

Dört renk (kırmızı/mavi/sarı/yeşil) birincil renk çemberinde eşit aralıklı — hem en yüksek kontrastı veriyor hem de "oyuncak kutusu" hissini doğrudan taşıyor. Renk körlüğü açısından güvenli.

## 3.3 Renk bütçesi kuralı

Bir karede en fazla **iki aksan rengi** baskın olabilir. Çevre (wall/floor/shelf) her zaman nötr kalır, aksanlar sadece yarışçılarda yaşar.

---

# 4. Arketip Silüetleri

## 4.1 Silüet testi — geçilmesi zorunlu kapı

Dört arketip **48×48 piksel, düz siyah dolgu** olarak yan yana konur. Renk yok, detay yok, sadece siluet. **Dördü de birbirinden ayırt edilemiyorsa tasarım reddedilir.**

## 4.2 Tasarım

| Arketip | Siluet okuması | Oran | Ayırt edici işaret |
|---|---|---|---|
| **Jetster** | Sivri roket/damla | Uzun, dar, yatık kanatçıklı | Üç kanatçık, sivri burun |
| **Tinbot** | Kutu/dikdörtgen | Geniş, köşeli, dik | Kalın kol/bacak nubları, kare kafa |
| **Waddler** | Yuvarlak + gaga | Tombul oval, geniş gaga çıkıntısı | Belirgin düz gaga, küçük kanatçıklar |
| **Chomper** | Dikenli sırt | Yuvarlak gövde, testere-dişli üst hat | Sırt boyunca üçgen dikenler, açık ağız |

Dördü de farklı bir **birincil geometrik okuma** taşıyor: sivri üçgen (Jetster), dikdörtgen (Tinbot), oval+çıkıntı (Waddler), dişli/zigzag hat (Chomper). Bu, kelime bazında değil şekil bazında ayrışma — en katı okunabilirlik garantisi.

---

# 5. Evrim — Form Değişimi

Evrim silueti **büyütür ve karmaşıklaştırır**, arketip kimliğini bozmaz. Tier 3 bir Tinbot hâlâ ilk bakışta Tinbot okunmalı.

| Kademe | Stat | Form |
|---|---|---|
| **T0** | 0-199 | Çıplak gövde, kesik hatlı panel, açıkta dişli, küçük anahtar. Eksik parça gibi duruyor — çünkü kutu açılmamış. |
| **T1** | 200-349 | Paneller kapandı, boyalı, tamamlanmış. Anahtar çalışıyor. Artık gerçek bir oyuncak gibi duruyor. |
| **T2** | 350-499 | Ek plaka/kol parçaları eklendi, anahtar büyüdü. Detaylar (küçük ışık, ekstra kanatçık) belirdi. |
| **T3** | 500+ | Siluet dönüştü. Belirgin şekilde daha büyük, hafif aura, dönen anahtarın hareket izi görünüyor. Vitrin parçası gibi. |

**Görsel hacim artışı:** T0 → T3 arası siluet alanı yaklaşık **%60 büyür.**

---

# 6. Rarity — Malzeme/Durum Değişimi

Rarity **formu değiştirmez, yüzeyi değiştirir.** Bu ayrım kritik: oyuncu evrim ile rarity'yi karıştırmamalı.

> **Evrim = ne kadar büyüdün. Rarity = ne kadar bakımlısın.**

Rarity dili gerçek oyuncak koleksiyonculuğu terminolojisi — uydurma fantezi kelimeleri değil:

| Rarity | Yüzey | Nasıl üretilir |
|---|---|---|
| **Fair** | Donuk tin, çizik, eskimiş | Düşük doygunluk, gri-kahve ton kayması, ince çizik dokusu |
| **Good** | Düz mat boya | Orta doygunluk, nötr matlık |
| **Excellent** | Parlak cila, net highlight | Yüksek doygunluk, belirgin glossy highlight |
| **Near Mint** | Krom kaplama | Metalik gradyan, keskin yansıma, güçlü highlight bandı |
| **Mint** | Altın varak / fabrika parlaklığı | Sıcak altın gradyan, en güçlü highlight, hafif sparkle |

**Üretim avantajı:** Rarity ayrı sanat değil — **Rive'da malzeme katmanı** olarak uygulanıyor. 16 temel form × 5 rarity = 80 asset yerine **16 asset + 5 katman**.

---

# 7. Render Tekniği — Kalın Outline + Parlak Toon

Bu proje üç render tekniği denedi. Bu üçüncüsü test edildi ve işe yaradı — Stumble Guys/Turbo FAST/Fall Guys'ın ortak dili.

## 7.1 Beş teknik kural

| Kural | Detay |
|---|---|
| **Kalın koyu outline** | Her ana şeklin etrafında `#241A38` renginde, ~4-4.5 birim kalınlığında, `stroke-linejoin: round` çizgi. 48px'te formu ayakta tutan asıl şey bu. |
| **Yuvarlak siluet** | Sert mech açıları yok. Köşeler her zaman `rx`/round-join ile yumuşatılır. |
| **Yumuşak glossy highlight** | Her ana gövde parçasında, sol-üstte konumlanmış, hafif bulanık, %50-65 opaklıkta beyaz bir elips. Sert yönlü ışık değil — düz plastik/tin parıltısı. |
| **Doygun düz renk** | Gradyan ambient-lit değil, düz doygun dolgu + highlight elipsi yeterli. |
| **Büyük ifadeli gözler** | Beyaz sklera + koyu pupil + küçük highlight noktası. Kişilik anında okunuyor. |

## 7.2 Çekirdek/anahtar bir oyun mekaniği

Her karakterin sırtında/gövdesinde bir **kurma anahtarı** var — dekor değil, okunabilir bir gösterge:

- Dolu stamina → anahtar hızlı dönüyor
- Stamina düştükçe → anahtar yavaşlıyor, dönüş izi kısalıyor
- Tükendiğinde → anahtar duruyor
- T3 evrimde → anahtar sürekli hızlı dönüyor, hareket izi (motion arc) görünür

Bu, Rive'da ayrı bir katman ve `stamina`/`boosting` input'larına bağlanıyor. Oyuncu hiçbir sayı okumadan durumunu anlıyor.

---

# 8. Pist ve Çevre — Oyuncak Diorama

Dikey format korunuyor (4/4 dış araç bağımsız olarak bunu önerdi — mobil tek-el kullanım, 4 yarışçının küçülmeden görünmesi). Kule/tünel yerine **bir model tren diorama'sı** — yarışçılar boyalı bir minyatür manzaranın üstünde yarışıyor.

## 8.1 Katmanlar

| Katman | İçerik |
|---|---|
| **Gökyüzü** | Açık mavi-krem gradyan (`wall`), sabit |
| **Uzak** | Raf/manzara silüeti (`shelf`), düşük opaklık |
| **Zemin** | Sıcak ahşap ton (`floor`), boyalı şerit desenleri |
| **Ray** | Beyaz kesikli çizgiler — model tren rayı hissi |

## 8.2 Hava durumu

Mevcut sistem korunur, isimler bir oyuncak rafı/vitrin ortamına taşınır:

| Hava | Eski (mech) | Yeni (toy) |
|---|---|---|
| Static Cling | Ion Storm | Statik elektrik tin gövdelere yapışıyor |
| Dust Cloud | Magnetic Fog | Tozlu tavan arası/vitrin |
| Sunbeam | Heat Wave | Pencereden vuran güneş ışığı |
| Clear Shelf | Clear Grid | Normal koşul |

---

# 9. UI Dili

**Vitrin etiketi** — bir oyuncak kutusunun/koleksiyon kartının üstündeki bilgi kartı gibi.

- **Çerçeveler:** Yuvarlak köşeli kalın kart kenarlığı (köşe bracket değil — bu artık mech değil)
- **Sayılar:** Monospace — sıralama, süre, SPRING miktarı hep aynı genişlikte
- **Metin:** Sans-serif, temiz, başlıklarda büyük harf
- **Rarity göstergesi:** Malzeme dokulu çerçeve — Mint kartı gerçekten altın varaklı görünür
- **Dokunma hedefleri:** Minimum 44×44px

**Kısıt:** UI asla aksan renklerini yarışçılardan çalmaz. Arayüz nötr (paper/ink) kalır; renk yarışçılara aittir.

---

# 10. Okunabilirlik Kuralları

Yarışın herhangi bir anında oyuncu **yarım saniyede** şunları görebilmeli:

1. **Hangisi benim?** → Kalıcı ok göstergesi + rakiplerden belirgin daha parlak outline
2. **Kaçıncıyım?** → Büyük monospace sıra numarası, doğrudan yarışçının üstünde
3. **Ne kadar dayanabilirim?** → Anahtar dönüş hızı (birincil) + ince bar (ikincil)
4. **Az önce ne oldu?** → Olay bildirimi, yarışçının kendi konumunda patlar

## Bot ayrımı

Botlar ödül kazanamıyor (CLAUDE.md kararı), görsel olarak da ayrışmalılar: **desatüre gövde + "BOT" etiketi + aksan rengi yok.** Gerçek oyuncular renkli, botlar gri.

---

# 11. Prompt Şablonu

> **Güncelleme 2026-08-05 — üretim modeli değişti.** Aşağıdaki şablon fal.ai / `flux-pro v1.1` için yazılmıştı. O model **emekli**: gerçek negative prompt desteği yok, `[NEGATIVE]` bloğu ters etki yapıyor (5 tur denendi, "no antenna" yazdıkça anten çıktı). Üretim artık **`nano-banana-pro`** ile, Meshy'nin text-to-image API'si üzerinden — `scripts/meshy.ts image`.
>
> Yeni modelde kurallar farklı: `[NEGATIVE]` bloğu **kullanılmaz**, her kısıt olumlu dille yazılır ("kafanın üstü pürüzsüz ve boştur"). **Poz mutlaka açıkça tarif edilmeli** — yazılmazsa model uyduruyor ve kollar bozuluyor. Prompt sınırı **800 karakter** (script zorluyor).
>
> Çalışan güncel örnek: [`scripts/prompts/tinbot-t1-excellent-race.txt`](../scripts/prompts/tinbot-t1-excellent-race.txt)

## 11.1 Eski fal.ai şablonu (arşiv)

```
[SUBJECT]
a classic wind-up toy racer, chunky rounded tin/plastic body,
{archetype: tapered bullet-shaped rocket toy with three tail fins and a round face
          | boxy rectangular robot toy with stubby block arms and a square head
          | plump round duck toy with a wide flat beak and small wings
          | spiky-backed dinosaur/monster toy with a short tail and open mouth},
{tier: bare unpainted frame with a small key, exposed gap in one panel
     | fully painted, closed panels, working key
     | added plate/limb details, bigger key
     | large deluxe model, glowing motion-blur key spin, subtle aura},
a prominent wind-up key on its back or chest

[STYLE]
Stumble Guys / Turbo FAST / Fall Guys toon rendering, thick dark clean outline,
flat saturated primary colors, soft single highlight blob (not hard directional
light), big expressive glossy eyes, rounded silhouette, no sharp angles,
no photorealism, no muddy/gritty textures

[MATERIAL — driven by rarity tier]
dull scratched tin (Fair) | matte painted (Good) | glossy painted with clear
highlight (Excellent) | chrome-plated mirror finish (Near Mint) | gold-leaf
shimmer finish (Mint)

[LIGHT]
single soft key light upper-left, one glossy highlight ellipse per major body
part, no colored shadow, no rim light

[CAMERA]
three-quarter front view, full body, centered, no crop

[BACKGROUND]
flat neutral warm cream #FFFDF7, no environment, no ground shadow

[NEGATIVE]
dark, moody, gritty, industrial, mechanical scrap, rust, dirt, gore, weapons,
text, watermark, logo, busy background, multiple characters, soft toy-gradient
without outline, photorealistic
```

**Referans zinciri:** Her generation'a master style sheet + o arketibin önceki kademesi referans olarak verilir.

---

# 12. Rive Katman Şeması

Karakterler bu **8 katmana** kesilir. Şema dört arketipte **birebir aynı** — tek rig + dört skin bu sayede mümkün oluyor.

| # | Katman | Not |
|---|---|---|
| 1 | `key` | **Emissive/animasyonlu** — dönüş hızı `stamina` ile sürülür |
| 2 | `body` | Ana gövde, rig kökü |
| 3 | `head` | Boyun pivotundan döner (Waddler/Chomper'da gaga/çene ile birlikte) |
| 4 | `limb_L` (kol/kanat/fin) | Omuz pivotu |
| 5 | `limb_R` | Omuz pivotu |
| 6 | `base_L` (bacak/ayak) | Kalça pivotu |
| 7 | `base_R` | Kalça pivotu |
| 8 | `highlight` | **Ayrı katman** — glossy highlight elipsi, rarity malzemesiyle birlikte değişir |

Pivot noktaları dört arketipte aynı göreli konumda olmalı.

---

# 13. Kalite Kontrol Listesi

Her asset üretime girmeden önce:

- [ ] 48×48 siyah siluet testinden geçiyor mu — diğer üçünden ayırt edilebiliyor mu?
- [ ] Kalın koyu outline tutarlı kalınlıkta mı?
- [ ] Highlight tek, yumuşak, sol-üst konumlu mu (sert yönlü ışık yok)?
- [ ] Arka plan gerçekten düz mu?
- [ ] Anahtar net bir animasyonlu katman olarak ayrılabiliyor mu?
- [ ] 8 katman şemasına kesilebiliyor mu, pivotlar standart konumda mı?
- [ ] Aksan rengi doğru arketip rengi mi?
- [ ] Mobilde 64px'e küçültüldüğünde hâlâ okunuyor mu?
- [ ] Bir önceki evrim kademesiyle yan yana konduğunda ilerleme hissediliyor mu?

---

# 14. Üretim Sırası

1. **Tinbot T1 Excellent** — tek bir "altın örnek". Outline kalınlığı, highlight tekniği, kesim şeması burada kilitlenir.
2. Bu asset Rive'da rig edilir ve oyuna sokulur — **pipeline'ın uçtan uca çalıştığı kanıtlanır. Atlanamaz.**
3. Tinbot'un kalan 3 kademesi (T0, T2, T3)
4. Diğer 3 arketip × 4 kademe
5. 5 rarity malzeme katmanı
6. Diorama çevre katmanları
7. UI ikonları
8. Pazarlama asset'leri
