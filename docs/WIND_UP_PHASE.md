# WIND-UP FAZI — Mekanik Tasarımı

**Tarih:** 2026-08-04
**Durum:** Tasarım önerisi — sayılar denenmedi, ayarlanacak
**Yerine geçtiği:** Tune-Up / Sealed Bid (paralı gizli teklif)
**İlgili:** [CLAUDE.md](../CLAUDE.md) · [ART_DIRECTION.md](ART_DIRECTION.md)

---

## 1. Ne çözmesi gerekiyor

Kilitli karar şuydu: *yarış öncesi mekanik, tamamen beceri bazlı, para yok, grid pozisyonunu belirler.* Bu bir karar, mekanik değil. Bu doküman mekaniği tanımlıyor.

Yerine geçtiği sistemin iyi olan tarafları vardı, onları kaybetmemeliyiz:

| Sealed bid'in verdiği | Korunmalı mı |
|---|---|
| 10 saniyelik gerilim | **Evet** |
| Aynı anda gizli karar → topluca açılma (Grid Reveal) | **Evet** — dramanın kaynağı buydu |
| Anlamlı bir seçim (ne kadar riske girerim) | **Evet** |
| Para gideri / prize pool katkısı | Hayır — bilinçli olarak kaldırıldı |
| Zengin oyuncunun otomatik pole alması | Hayır — asıl kaldırma sebebi |

## 2. Çekirdek fikir: fazla kurmak gerçek oyuncakta da risktir

Gerçek kurmalı oyuncakta yayı ne kadar çok kurarsan o kadar uzun/hızlı gider — ama fazla kurarsan yay gerilir, hatta kopar. Bu, uydurmadan mekaniğe çevrilebilecek hazır bir risk eğrisi.

> **Daha çok kur → daha iyi grid, ama stamina daha hızlı tükeniyor. Fazla kur → yay kopar.**

Bu, fazı bir refleks testi olmaktan çıkarıp **karar** haline getiriyor: kendi yarışçının dayanıklılığına ve yarışın uzunluğuna göre ne kadar riske gireceğine karar veriyorsun.

## 3. Etkileşim

Dikey ekran, tek başparmak. Ekranın herhangi bir yerini **basılı tut** → yay kuruluyor, gerilim çubuğu doluyor. **Bırak** → o gerilimde kilitleniyorsun.

```
 0% ─────────── Safe Wind ────── 100% ── SNAP
 │                   │              │
 │   güvenli bölge   │  aşırı kurma │  kopma
 └───────────────────┴──────────────┘
      grid: kötü→iyi    grid: en iyi    grid: sonuncu
      stamina: tam      stamina: cezalı  + ağır ceza
```

| Bant | Grid | Stamina etkisi |
|---|---|---|
| **Az kurulmuş** (0 → Safe Wind) | Gerilimle orantılı, düşükse arka sıra | Ceza yok |
| **Aşırı kurulmuş** (Safe Wind → %100) | En iyi sıralar | Aşan her puan için tükenme hızı artar |
| **Kopmuş** (%100 aşıldı) | **Sonuncu** | Ağır stamina cezası |

**Safe Wind eşiği yarışçının STA istatistiğinden türer.** Yüksek STA'lı bir Tinbot rahatça aşırı kurabilir; düşük STA'lı bir Jetster erken bırakmak zorunda. Aynı input, farklı yarışçıda farklı doğru cevap — istatistikler beceriyi öldürmeden anlam kazanıyor.

## 4. Akış ve gizlilik

Dört yarışçı **aynı anda ve birbirini görmeden** kurar. Faz bitince **Grid Reveal** — dördünün gerilimi aynı anda açılır, grid dizilir.

Bu, sealed bid'in dramatik yapısını birebir koruyor. Reveal animasyonu ve grid gösterimi zaten yapılmış durumda, yeniden kullanılıyor.

```
[Faz başlar]  →  10 sn geri sayım, herkes kuruyor (gizli)
              →  bırakan kilitlenir, kalan süre beklenir
[Faz biter]   →  GRID REVEAL: 4 gerilim aynı anda açılır
              →  grid dizilir, yarış başlar
```

Süreyi doldurmadan bırakmak dezavantaj değil — erken bırakmak da bir strateji (düşük gerilim = temiz stamina). Süre dolarken hiç dokunmayan oyuncu minimum gerilimle başlar, ceza almaz.

## 5. Neden bu mekanik anahtarla aynı göstergeyi kullanıyor

ART_DIRECTION §7.2'ye göre kurma anahtarının dönüş hızı zaten **stamina göstergesi**. Wind-Up fazında oyuncu tam olarak o anahtarı kuruyor ve dönüş hızının arttığını görüyor.

Yani faz, oyunun ana okunabilirlik aracının **öğreticisi** oluyor. Oyuncu daha yarış başlamadan "hızlı dönen anahtar = çok enerji" bağlantısını kendi eliyle kuruyor. Ayrı bir tutorial gerekmiyor.

## 6. Başlangıç sayıları (denenmedi — ayarlanacak)

Bunlar tasarımın çalışması için gereken şeklin sayısal karşılığı, ölçüm değil. İlk playtest'te değişmeleri beklenir.

```
Faz süresi:            10 sn
Gerilim dolum süresi:  0 → 100%  ≈ 3.5 sn  (basılı tutarak)

Safe Wind eşiği:       %55 + (STA / 4)        → STA 60'ta ≈ %70
Snap noktası:          %100

Grid sıralaması:       gerilime göre azalan sıra
Eşitlik bozucu:        VRF seed (deterministik, doğrulanabilir)

Pole avantajı:         yarış başında kısa ivme bonusu
                       — mesafe avantajı DEĞİL (bkz. §8)

Aşırı kurma cezası:    Safe Wind'i aşan her %1 için
                       stamina tükenme hızı +%1.5

Snap cezası:           grid sonuncu + başlangıç stamina %70
```

**Kritik ayar noktası:** pole avantajı, aşırı kurmanın stamina maliyetini *biraz* aşmalı ki risk almak mantıklı olsun — ama her yarışta herkesin kırmızıya kadar kurmasını sağlayacak kadar değil. Doğru ayarda üç strateji de yaşayabilir olmalı: temiz kur (uzun yarış), sınırda kur (dengeli), kırmızıya kur (kısa yarış / son tur kumarı).

## 7. Botlar

Botların da bir gerilim değeri olmalı, yoksa grid saçmalar. Bot davranışı: kendi Safe Wind eşiği etrafında normal dağılımdan örneklenir.

```
bot_tension = clamp(normal(safe_wind - 3, σ), 5, 99)
σ: zorluk seviyesine göre 4 (iyi bot) → 12 (kötü bot)
```

Kötü botlar bazen kopartır, iyi botlar sınıra yakın oynar. Bu, oyuncuya karşısındakinin becerisi hakkında okunabilir bir sinyal verir. Botlar ödül kazanamaz (CLAUDE.md kararı), ama grid'i doldurur.

## 8. Pole avantajı neden mesafe değil ivme

4 yatay şerit üst üste dizili ve foto-finiş görünümü hedefleniyor. Grid'de görünür bir mesafe farkı vermek dört şeridin başlangıç hizasını bozar ve "hepsi aynı anda başlıyor" görselini kaybettirir.

Bunun yerine dördü de aynı hizada başlar, pole'daki yarışçı ilk saniyelerde daha hızlı ivmelenir. Görsel hiza korunur, avantaj yarışın içinde ortaya çıkar.

## 9. Hile riski — dürüst değerlendirme

Bu bir istemci-input mekaniği ve **script'le mükemmel oynanabilir.** Bir bot her seferinde tam Safe Wind'de bırakabilir.

### İstemci sözleşmesi (S1 — karar verildi 2026-08-05)

Bu dokümanın ilk hâli "istemci ham zaman damgasını gönderir, gerilimi sunucu hesaplar" diyordu. **Bu yanlıştı:** zaman damgasını uyduran, gerilimi de uydurmuş olur. Sunucunun hesaplaması tek başına koruma değil.

Alternatif — sunucunun hem basışı hem bırakışı kendi damgalaması — forjeyi kapatıyor ama yerine daha kötü bir şey koyuyor: **gecikme sistematik dezavantaj olur.** Yüksek pingli oyuncu, tamamen beceri bazlı ilan edilmiş bir mekanikte kalıcı olarak kaybeder. Parayla pole almayı kaldırıp yerine bant genişliğiyle pole almayı koymuş oluruz.

**Karar: istemci süreyi gönderir, sunucu sınırlar.**

```
POST /api/race/:id/wind/press     → sunucu varış anını kaydeder (pencere başı)
POST /api/race/:id/wind/release   → { heldMs }
                                    sunucu varış anını kaydeder (pencere sonu)
```

- İstemci `performance.now()` farkını gönderir — **süre, zaman damgası değil.** Monotonik, saat senkronu gerekmez, kullanıcının sistem saatinden etkilenmez.
- Sunucu kendi gözlediği pencereyi biliyor. Kabul koşulu: `heldMs <= gözlenenPencere + tolerans`.
- **Olmayan süreyi uydurmak imkânsız** — fiziksel olarak geçmemiş zamanı talep edemezsin.
- Gecikme cezası yok: dürüst oyuncu, pingi ne olursa olsun gerçek süresini alır.

**Artık risk, dürüstçe:** istemci gerçekte tuttuğundan **kısa** bir süre bildirebilir, yani istediği değeri tam tutturabilir. Bunu engelleyen şey zamanlama değil, **eşiğin gizli olması** — Safe Wind her yarışta VRF seed'inden kaydırılıyor ve oyuncuya yaklaşık gösteriliyor. Bu savunma her iki tasarımda da aynı; süre sınırlaması onun yerine geçmiyor, üstüne biniyor.

Azaltıcılar:

| Önlem | Etki |
|---|---|
| Safe Wind eşiği faz başında ±%4 rastgele kaydırılır (VRF seed'den) | Önceden hesaplanamaz, her yarışta yeniden okunmalı |
| Eşik oyuncuya **yaklaşık** gösterilir, kesin değer gizli | Mükemmel oynamak için bile risk kalır |
| Pole avantajı bilinçli olarak mütevazı tutulur | Mükemmel oynamanın getirisi sınırlı |
| Bahis yok, giriş ücreti SPRING (offchain) | Ekonomik saldırı yüzeyi düşük |

**Bu risk V1 için kabul edilebilir ama sıfırlanmış değil.** Gerçek çözüm (sunucu-otoriter input örneklemesi, davranış analizi) V2 konusudur. Demo'da bunu saklamaya gerek yok — jüriye "grid becerinin, sonuç VRF'in" demek dürüst ve yeterli.

## 10. Ekonomiye etkisi

Tune-Up kalkınca prize pool'un ikinci kaynağı kayboldu; artık havuzu **sadece giriş ücretleri** besliyor. Wind-Up fazı bilinçli olarak para almıyor, yani bu açığı kapatmıyor.

CLAUDE.md'deki ekonomi tablosu bu yüzden geçici işaretli. Sprint 9'un "Numbers policy" kaleminde ya giriş ücretleri ya da platform kesintisi yeniden hesaplanmalı.

## 11. Uygulama notları

**İstemci:** basılı tut/bırak, gerilim çubuğu, anahtarın hızlanan dönüşü (Rive `stamina` input'u zaten var — burada `tension` olarak sürülür), yaklaşık Safe Wind işareti, geri sayım.

**Sunucu:** faz penceresini açar, VRF seed'den eşik kaymasını üretir, bırakma zaman damgalarını alır, gerilimleri hesaplar, grid'i sıralar, sonucu yarış simülasyonuna başlangıç durumu olarak verir.

**DB:** `race_participants.tune_amount` kolonu `wind_tension` olarak yeniden kullanılabilir (0-100 tamsayı) — Faz 1 migration'ında zaten o kolona dokunuluyor, ayrı migration gerekmez.

**Rive:** yeni state gerekmiyor. Grid öncesi `idle` state'inde `stamina` input'u gerilimle sürülür, anahtarın dönüşü onu takip eder.

## 12. Açık sorular

1. **Basılı tut mu, tekrarlı dokunuş mu?** Basılı tut daha sakin ve erişilebilir; tekrarlı dokunuş daha fiziksel ve "kurma" hissine daha yakın ama mobilde yorucu ve erişilebilirlik açısından kötü. Öneri: basılı tut.
2. **Oyuncu kendi Safe Wind'ini tam olarak görmeli mi?** Kesin değer gösterilirse mekanik bir refleks testine iner. Yaklaşık göstermek riski korur ama sinir bozucu olabilir. Öneri: yaklaşık bant göster, kesin çizgiyi gizle.
3. **Az kurmanın bir ödülü olmalı mı?** Şu an sadece "ceza yok". Uzun yarışlarda gerçek bir avantaja dönüşüyor mu, playtest gösterecek.
4. ~~**Exhibition (ücretsiz) yarışta faz olmalı mı?**~~ **Karar: evet, her yarışta.** Faz aynı zamanda anahtar/stamina göstergesinin öğreticisi (§5); Exhibition yeni oyuncunun öğrendiği yer. Oradan çıkarmak, oyuncuya oyunu merkezî yarış öncesi mekaniği olmadan öğretmek olurdu.

## 13. Ölçüldü: risk almak kazandırıyor — ayar kilitli (2026-08-06)

> **GÜNCELLEME (aynı gün, yorgunluk modeli değişince):** Ceza **0.015 → 0.0005**.
> Pole avantajı **0.12** olarak kaldı. Sebep §14'te.

**Karar: pole avantajı 0.12, aşırı kurma cezası 0.0005.** Değiştirme; değiştirmek istersen önce aşağıdaki taramayı yeniden koştur.

§6 şunu kritik ayar noktası olarak işaretlemişti: *"pole avantajı, aşırı kurmanın stamina maliyetini biraz aşmalı ki risk almak mantıklı olsun — ama herkesin kırmızıya kadar kurmasını sağlayacak kadar değil."* Bu tartışmayla değil ölçümle kapandı.

**Yöntem:** pole × ceza ızgarasında N yarış, her hücrede üç stratejinin (temiz / sınırda / kırmızı) **oyuncu kazançlarındaki payı**. Ham kazanma oranı kullanılamaz — dördüncü koltuktaki bot herkesin oranını yapısal olarak %40 civarına sıkıştırıyor, o yüzden %50 eşiği erişilemez oluyor. Üç eşit strateji %33'te oturur. Bir strateji %50'yi geçerse hücre elenir; %20'nin altına düşerse aç sayılır.

**Sonuç:** committed hücre beş koşulun hepsinde ayakta — `20/46/34`, hiçbiri baskın değil, hiçbiri aç değil.

Üç bağımsız ölçüm aynı sonuca vardı: `tools/windup-tuning-sweep.ts` (ana harness), `backend/src/simulation/tuningSweep.ts` (ayrı yazım, doğrulama için), ve düzeltilmiş motorda ikisinin yeniden koşturulması.

**İki bulgu kayda değer:**

- **Uygulama hatası arttıkça temiz strateji yükseliyor** (26→35), kırmızı düşüyor (34→26). Faz cesareti değil beceriyi ödüllendiriyor — §2'nin fazdan beklediği şey buydu.
- **En "dengeli" hücre bir tuzak.** `(0.00, 0.000)` en dar dağılımı veriyor çünkü orada gerilim hiçbir şey yapmıyor: üç strateji mükemmel dengeli, çünkü üçü aynı strateji. Dengeyi tek başına optimize etmek, içinde karar olmayan tek hücreyi seçiyor. Doğru metrik "kötü seçmenin maliyeti" — committed hücrede 9.4 puan, o hücrede 2.6.

**Ölçüm sırası önemliydi:** ilk tarama, foto-finiş beraberliklerini grid sırasına düşüren motor hatasından (`6138d9b`) önce koşmuştu. O hata sayılmamış fazladan bir pole avantajıydı, yani tam da ölçülen büyüklüğü kirletiyordu. Düzeltmeden sonra sayılar 0-3 puan kaydı, karar değişmedi — ama bu ancak yeniden koşturulduğu için bilinebilirdi.

**Açık kalan:** faz karışık kadroda belirgin biçimde zayıflıyor (~33/35/31). Stat farkı mekaniği bastırıyor. Ayar aynasal maç verisinden okunmalı, ve fazın canlı oyunda ızgaranın ima ettiğinden daha az fark yaratması beklenmeli.


---

## 14. Ceza yeniden ölçüldü: yorgunluk değişti, ayar bayatladı (2026-08-06)

§13'ün kararı doğru ölçülmüştü ama **ölçüldüğü zemin değişti.** V1'e ikinci bir
mesafe (Sprint 1.600 / Endurance 3.200) eklenirken motorun yorgunluk modeli
yeniden yazıldı, ve o model bu fazın tek gerçek maliyeti olan stamina'yı
sürüyor. Kilitli bir sayıyı yerinde bırakmak, artık ölçmediği bir şeyi ölçüyor
sanmak olurdu.

**Neden yeniden yazıldı.** Eski model iki şeyi yanlış yapıyordu:

1. Sönüm katsayısı `0.35 - STA × 0.015` idi ve **STA 20'de tabana çakılıyordu.**
   Oyundaki her yarışçı 20'nin üstünde, yani STA 25 ile STA 100 tıpatıp aynı
   hızda yoruluyordu. Altı istatistik ilan edilmişti, biri hiçbir şey yapmıyordu.
2. Yorgunluk **pistin oranı** olarak ölçülüyordu (`mesafe > uzunluk × 0.6`).
   İki kat uzun bir pist, iki kat mesafeye yayılmış yarı hızda bir sönüm
   demekti — eğrinin şekli her mesafede aynı. Uzun pist sadece uzun bir bekleyiş
   olurdu, farklı bir soru değil.

Şimdi mutlak: herkes `freeDistance` kadar dinç koşar, sonra aşılan her
`spanDistance` için bir tam sönüm adımı yer. Sabitler `engine.ts`'teki `FATIGUE`
bloğunda; `fatigueSweep.ts` ile taranarak seçildiler, göz kararıyla değil.

**Fazı ilgilendiren sonuç.** Aşırı kurma cezası bir *çarpandır* — çok daha dik
bir eğriye çarpınca büyüdü. Yeniden taramada 0.005 ve üstündeki her ceza,
kırmızı stratejiyi Sprint mesafesinde tamamen siliyordu (oyuncu kazançlarının
%0-2'si). **Cesur seçeneğin hiç kazanmadığı bir faz, seçim içermez.** İlgi alanı
bir büyüklük mertebesi aşağı kaymıştı, o yüzden ceza ekseni ince yeniden kesildi.

**Yeni ölçüm — hücre iki mesafede birden ayakta kalmak zorunda:**

| pole × ceza | Sprint (1.600) | Endurance (3.200) |
|---|---|---|
| 0.08 × 0.0005 | 30/47/24 | 32/44/24 |
| **0.12 × 0.0005** | **26/46/28** | **29/45/26** |
| 0.16 × 0.0005 | 23/47/31 | 26/46/28 |

*(2.600 yarış/hücre, her iki mesafede de doğrulama koşusu.)*

`clean/edge/red`, oyuncu kazançlarındaki pay. Ceza 0.0005, iki mesafede de üç
stratejinin birden yaşadığı **tek** sütun.

**Karar: pole 0.12 (değişmedi), ceza 0.0005.** Pole değerinin ayakta kalması
tesadüf değil — §8'de gerekçelendirildiği gibi o bir ivme avantajı, mesafe
avantajı değil, ve ivme yorgunluktan bağımsız. Değişmesi gereken, yorgunluğa
*çarpan* olarak bağlı olan taraftı.

**Alınacak ders §13'ün kendi cümlesinden daha geniş:** bir sayıyı ölçüp
kilitlemek, o sayının dayandığı modeli de kilitlemez. Model değiştiğinde ölçüm
sessizce bayatlar ve kilit hâlâ sağlam görünür. Bu tarama, yorgunluk
değiştirildiği için değil, **değiştirildiği fark edildiği için** koştu.

**Doğrulama komutu:**

```
npx tsx tools/windup-tuning-sweep.ts --races 2600 --distance 1600
npx tsx tools/windup-tuning-sweep.ts --races 2600 --distance 3200
npx tsx backend/src/simulation/distanceLever.check.ts
```
