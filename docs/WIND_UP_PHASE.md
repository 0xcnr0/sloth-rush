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

Sunucu tarafı doğrulama zorunlu: istemci sadece ham bırakma zaman damgasını gönderir, gerilimi **sunucu** hesaplar. Bu, uydurma gerilim değeri göndermeyi engeller — ama mükemmel zamanlamayı engellemez.

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
4. **Exhibition (ücretsiz) yarışta faz olmalı mı?** Öğrenme için evet gibi duruyor, ama akışı uzatıyor.
