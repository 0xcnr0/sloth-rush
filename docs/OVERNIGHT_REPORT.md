# Gece Raporu — 2026-08-05 → 06

**Dal:** `windup-phase-server` (`main`'den açıldı, `main`'e dokunulmadı)
**Kuyruk:** [OVERNIGHT_QUEUE.md](OVERNIGHT_QUEUE.md) madde 2 ve 3
**Push yapılmadı. Kontrat deploy edilmedi.**

---

## 1. Biten adımlar

| Commit | Ne |
|---|---|
| `bb64a5a` | Wind-Up ayar sabitleri, saf mantık, motor etkileri + 47 birim testi |
| `65773b6` | Faz penceresi, sunucu-ölçümlü gerilim, grid reveal, DB migration'ı |
| `<son>` | Pitch dokümanları (madde 3) + `test:unit` script'i + bu rapor |

### Madde 2 — Wind-Up fazı, sunucu tarafı: **bitti**

Kuyruğun istediği yedi kalemin tamamı:

- **Faz penceresi** — `start-tuning` pencereyi açar (`races.status = 'tuning'`, `tuning_opened_at` damgalanır), `close-tuning` kapatır ve grid'i açar.
- **VRF seed'den Safe Wind kayması** — ±%4, `safeWindThreshold()` içinde. **Seed artık simulate'te değil, pencere açılırken üretiliyor** — eşik ondan türediği için kimse kurmadan önce var olması gerekiyordu. `/simulate` aynı seed'i tekrar kullanıyor, yani grid ve sonuç tek bir değerden doğrulanıyor.
- **Bırakma zamanından gerilim** — `wind/start` ve `wind/release`, ikisi de sunucu saatiyle damgalanıyor. İstemci ne süre ne gerilim gönderiyor.
- **Gerilim → grid, eşitlikte VRF seed** — `orderGrid()`; kopanlar tensiondan bağımsız sona.
- **Aşırı kurma → stamina çarpanı; kopma → sonuncu + %70 stamina** — motorda `staminaDrainMultiplier` ve `startStaminaFactor`.
- **Bot gerilimi** — `clamp(normal(safe_wind - 3, σ), 5, 99)`, σ bot şablonundaki `skill` değerinden.
- **Birim testleri** — 47 test, `npm run test:unit`.

§6'daki bütün sayılar `backend/src/simulation/windUp.ts` içindeki tek `WIND_UP_TUNING` nesnesinde. Ayarlamak için başka dosya açmaya gerek yok.

### Madde 3 — Pitch dokümanları: **bitti**

`LIGHT_PAPER.md` ve `DEVFOLIO_ANSWERS.md`'de "Built-in Prediction Market" farklılaştırıcısı **"Base App native, mobil-öncelikli mini app"** ile değiştirildi (dikey format, passkey onboarding, uygulama içi oynanabilirlik) ve ikinci farklılaştırıcı olarak Wind-Up fazı eklendi. Sloth/ZZZ/bahis dili de temizlendi.

---

## 2. Doğrulama çıktıları

Hepsi bu dal üzerinde, az önce çalıştırıldı.

```
$ npx tsc --noEmit -p backend
project errors: 0
```
*(`node_modules/ox` içindeki 15 hata Faz 1'den önce de vardı, `main`'de de var.)*

```
$ npx tsc -b frontend --force
exit=0
```

```
$ npx tsc --noEmit ... simulation/engine.ts simulation/verify.ts simulation/windUp.ts
exit=0
```

```
$ npm run test:unit
ℹ tests 47
ℹ pass 47
ℹ fail 0
```

```
$ npm run lint:vocab
==> Theme vocabulary (allowed only in theme.ts)
OK
==> Wagering vocabulary (allowed only in the retirement migration)
OK
```

```
$ npm run qa          # sıfırdan kurulan veritabanında
  Total:  89
  Passed: 89
  Failed: 0
  Rate:   100.0%

    [OK] Happy Path: 47/47 passed
    [OK] Edge Cases: 15/15 passed
    [OK] Security: 9/9 passed
    [OK] Economy: 7/7 passed
    [OK] Race Logic: 9/9 passed
    [OK] Rate Limits: 2/2 passed
```

### Ek: uçtan uca faz denemesi

Çalışan sunucuya karşı 39 kontrol, hepsi geçti (harness commit edilmedi, `scratchpad`'de). Kapsadıkları:

- pencere açılınca seed üretiliyor, 3 bot dolduruluyor ve **botlar o anda kuruyor**
- bot gerilimleri 5..99 arasında ve birbirinden farklı
- 1200 ms basılı tutma → ~34 gerilim (3500 ms tam kurma ile tutarlı)
- ikinci `release` 409, kilitlendikten sonra `press` 409
- 3900 ms tutma → kopma, gerilim 100'e sıkışıyor, **yine de sonuncu başlıyor**
- hiç dokunmayan oyuncu: gerilim 0, ceza yok, yarış normal koşuyor
- yarış başladıktan sonra kurma 400, katılımcı olmayan cüzdan 403
- `/simulate` faz seed'ini ve açılan grid'i aynen devralıyor
- şeritler başlangıçta görsel olarak hizalı (yayılma < 0.25 birim), pole avantajı tick 30'da hâlâ ölçülebilir

---

## 3. SORULAR — tasarım kararı gerektirdiği için karar vermedim ya da verip işaretledim

### S1. İstemci sözleşmesi: iki damga mı, tek damga mı? *(en önemlisi — UI'ı bu belirliyor)*

Spec §9 "istemci sadece ham bırakma zaman damgasını gönderir" diyor. Ben **iki uçlu** yaptım: `wind/start` ve `wind/release`, ikisini de sunucu damgalıyor, tutma süresi tamamen sunucu saatinden çıkıyor.

Sebep: istemciden gelen tek bir sayı sahtelenebilir; §9'un kendi cümlesi "gerilime asla güvenme" diyor ve süre de bir gerilimdir. İki damga bunu tamamen kapatıyor.

**Bedeli:** ağ gecikmesi. Tutma süresine yaklaşık bir gidiş-dönüş biniyor; 100 ms RTT, 3500 ms tam kurmada ~%3 hata demek. Mükemmel oynamayı zorlaştırır ama dürüst oyuncuyu da hafifçe cezalandırır. Alternatif, istemcinin kendi ölçtüğü süreyi göndermesi ve sunucunun onu pencereye göre **yukarıdan kırpması** — daha hassas, biraz daha az sıkı.

Karar senin. UI'a başlamadan önce netleşmeli.

### S2. Exhibition yarışlarında faz olmalı mı?

Spec §12 soru 4 bunu açıkça açık bırakıyor. Ben **bütün formatlara** uyguladım — en basit hâli ve spec "öğrenme için evet gibi duruyor" diyor. Ama akışı uzatıyor, özellikle ücretsiz günlük yarışta. Kapatmak tek satır (`start-tuning` içinde formata bakıp gerilimi 0 bırakmak).

### S3. Botlar gerçekten kopabilmeli mi?

Spec §7 iki şey söylüyor ve bunlar çelişiyor: formül `clamp(..., 5, 99)`, yani bot asla 100'ü aşamıyor; ama metin "kötü botlar bazen kopartır" diyor. Formülle bot kopamaz.

Ben tavana (99) dayanan botu **kopmuş** saydım. Bu bir yorum. Alternatif: botun ham örneğinin 100'ü aşmasına izin verip gerçekten koparmak. İkincisi metne daha sadık, ama clamp'i anlamsızlaştırıyor.

### S4. Pole avantajının büyüklüğü

§6 "yarış başında kısa ivme bonusu" diyor, sayı vermiyor. `poleAccelerationBonus: 0.12`, `poleAccelerationTicks: 40` (4 saniye) koydum — **tamamen tahmin.**

§6'nın kendi "kritik ayar noktası" notu şunu istiyor: pole avantajı, aşırı kurmanın stamina maliyetini *biraz* aşmalı ki risk almak mantıklı olsun, ama herkesin kırmızıya kurmasını sağlayacak kadar değil. **Bu dengeyi ölçmedim.** Üç stratejinin de yaşayabilir olup olmadığı bilinmiyor. Bir simülasyon taraması gerekiyor (aynı yarışçıyı farklı gerilimlerle N kez koşturup kazanma oranına bakmak) — yapmadım.

### S5. Pencereyi kim kapatıyor?

Şu an istemci `close-tuning` çağırıyor, `/simulate` de savunma amaçlı aynı finalizer'ı çağırıyor. **Sunucu tarafında zamanlayıcı yok.** İstemci hiç dönmezse yarış `tuning`'de asılı kalır — kimse simulate etmediği sürece. Tek oyunculu akışta sorun değil; izleyicili ya da çok oyunculu bir akışta bir cron/timer gerekir.

### S6. Bot skill dağılımı

Sekiz bot şablonuna 0.2–0.9 arası `skill` değerleri verdim. Spec sadece σ aralığını (4→12) veriyor, hangi botun ne kadar iyi olduğunu söylemiyor. Rakamlar benim uydurmam; zorluk eğrisi kararıysa senin.

---

## 4. Yapılmayanlar

| Ne | Neden |
|---|---|
| **İstemci UI'ı** | Senin talimatın — görsel karar gerektiriyor, birlikte yapılacak. Sunucu sözleşmesi hazır; S1 netleşmeden başlanmamalı. |
| **Kontrat deploy'u** | Korkuluk. Faz 1'den beri bekliyor. Kontratlar yeniden adlandırıldı ve derleniyor, ama zincirde hâlâ eski isimlerle duruyorlar. |
| **`DEVFOLIO_ANSWERS.md` kontrat adresleri** | Dokümanda `FreeRacer.sol` yazıyor ama adresler **deploy öncesi** kontratlara ait; zincirde o adreslerde eski isimli kontratlar var. Dokümana büyük harfli bir "NOTE BEFORE SUBMITTING" uyarısı koydum. **Bu hâliyle başvuru gönderilmemeli.** |
| **Pole avantajı denge taraması** | S4. Sayı kondu, ölçülmedi. |
| **Faz için sunucu zamanlayıcısı** | S5. |
| **`hre.viem` Hardhat hatası** | Faz 1 öncesinden var, Hardhat 3 API değişikliği, kapsam dışı. |

---

## 5. Şüphelendiklerim — "çalışıyor ama emin değilim"

**Pole avantajı artık ölçülebilir ama dengeli mi bilmiyorum.** Eskiden pole 1.5 birim mesafe önde başlıyordu; §8 bunu yasakladığı için ivme bonusuna çevirdim. Uçtan uca testte pole tick 30'da hâlâ önde — yani etki *var*. Etkinin *doğru büyüklükte* olduğuna dair hiçbir kanıtım yok. S4.

**Ağ gecikmesi gerilime karışıyor.** S1'in bedeli. Yerelde ölçtüğümde 1200 ms tutma 34 gerilim verdi (beklenen 34.3), yani localhost'ta hata ihmal edilebilir. Gerçek mobil ağda ne olacağını bilmiyorum.

**Yarış sonuçları bu değişiklikle kaydı.** Grid mesafe avantajını kaldırmak ve stamina çarpanı eklemek, aynı seed'in artık farklı bir yarış üretmesi demek. Eski replay'ler yeni motorla birebir yeniden üretilemez. Yeni yarışlar kendi içinde tutarlı; bu sadece geçmişe dönük bir kopukluk. QA'nın etkilenmemesinin sebebi, testlerin sonuçları değil değişmezleri kontrol etmesi.

**`wind_snapped` botlar için tavan değerinden türetiliyor.** S3'ün doğrudan sonucu. Bot 99 çekerse "koptu" sayılıyor; bu, 99'un altındaki bir botun asla kopamaması demek. Yorum değişirse bu satır da değişir.

**Migration gerçekten koştu.** `wind_up_rush` veritabanında doğruladım: `tuning_opened_at`, `wind_pressed_at`, `wind_snapped`, `wind_locked` kolonları duruyor, veri kaybı yok. Yedek: `~/wind-up-rush-db-backups/` (`pg_dump`, 2026-08-05, migration öncesi, iki veritabanı da).

**`simulation/engine.ts` artık backend kopyasıyla bayt bayt aynı.** Dört yorum satırında ayrışmışlardı. Açık kaynak doğrulayıcının sunucunun koştuğu koddan farklı olması, doğrulayıcının doğrulamayı bırakması demek — eşitledim, ama bunu koruyacak otomatik bir kontrol **yok**. Elle bozulabilir.
