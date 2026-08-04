# Gece Kuyruğu — Gözetimsiz Çalışma Talimatı

**Tarih:** 2026-08-05
**Kime:** Uzun süre tek başına çalışacak terminal oturumu
**Durum:** Kullanıcı uyuyor. Sabah birlikte gözden geçirilecek.

Bu doküman **ne yapılacağını anlatmıyor** — onlar ayrı spec'lerde. Bu doküman
**hangi sırayla** ve **hangi korkuluklarla** çalışılacağını anlatıyor.

---

## Korkuluklar — istisnasız

| Kural | Neden |
|---|---|
| **Kendi dalında çalış** (`git checkout -b phase1-theme-decoupling`) | `main` her zaman yeşil kalmalı; sabah geri dönülecek bir nokta lazım |
| **Her tamamlanan adımdan sonra commit at** | Gece boyu iş kaybolmasın, sabah git geçmişi okunabilir bir ilerleme kaydı olsun |
| **Asla `git push` yapma** | Uzak dal kullanıcının onayı olmadan değişmez |
| **Kontratları testnet'e DEPLOY ETME** | Anahtar, gas ve adres yayılımı gerektirir; kullanıcı başındayken yapılır. Yeniden isimlendir, derle, testleri koştur, deploy'u yazılı bir TODO olarak bırak |
| **DB migration'ını çalıştırmadan önce yedek al** | `pg_dump` ya da eşdeğeri. Alamıyorsan migration'ı YAZ ama ÇALIŞTIRMA, sabaha bırak |
| **`scripts/`, `docs/art/` ve sanat hattına dokunma** | Paralel yürüyen iş; çakışma çıkar |
| **Takılırsan durma, atla** | Tasarım kararı gerektiren bir şey çıkarsa raporun "SORULAR" bölümüne yaz ve bir sonraki **bağımsız** adıma geç. Gece boyu bir soruda beklemek en kötü sonuç |

**Tahmin etme.** Spec'te olmayan bir tasarım kararıyla karşılaşırsan uydurma —
yaz ve devam et. Yanlış tahminle ilerlemiş 2000 satır, yapılmamış 2000 satırdan
pahalıdır.

---

## Sıra

Sıralama zorunlu — 2 numara 1 numaranın açtığı DB kolonuna bağlı.

### 1. Faz 1 — tema decoupling + bahis dili temizliği
**Spec:** [HANDOFF_PHASE1.md](HANDOFF_PHASE1.md)
**Beklenen süre:** saatler. Gecenin ana işi bu.

Bitmiş sayılma kriteri o dokümanda: iki `tsc --noEmit`, `npm run qa`, ve iki grep
taraması. **Dördü de temiz dönmeden 2 numaraya geçme.**

### 2. Wind-Up fazı — sunucu tarafı
**Spec:** [WIND_UP_PHASE.md](WIND_UP_PHASE.md)
**Ön koşul:** Faz 1 bitmiş ve `race_participants.wind_tension` kolonu açılmış olmalı.

Sadece **sunucu tarafını** kur — istemci UI'ını sabaha bırak (görsel karar
gerektiriyor, gözetimsiz yapılacak iş değil):

- Faz penceresini açan/kapatan durum geçişi (`races.status` → `'tuning'`)
- VRF seed'den Safe Wind eşiği kaydırması (§9'daki ±%4)
- Bırakma zaman damgasından gerilim hesabı — **istemciden gelen gerilime asla güvenme**, sunucu hesaplar (§9)
- Gerilim → grid sıralaması, eşitlikte VRF seed
- Aşırı kurma → stamina tükenme çarpanı; kopma → sonuncu + %70 stamina
- Bot gerilimi: `clamp(normal(safe_wind - 3, σ), 5, 99)` (§7)
- Bu mantığın birim testleri

§6'daki sayılar **denenmemiş başlangıç değerleri.** Tek bir yerde sabit olarak
tut ki sabah tek dosyadan ayarlayabilelim.

### 3. Pitch dokümanları (yer kalırsa)
1 ve 2 biterse ya da ikisi de bloke olursa buna geç. Koda dokunmaz, güvenli.

`docs/LIGHT_PAPER.md` ve `docs/DEVFOLIO_ANSWERS.md` dört ana farklılaştırıcıdan
birini **"Built-in Prediction Market"** olarak sunuyor — o sistem kaldırıldı.
Yerine **"Base App native, mobil-öncelikli mini app"** konacak (dikey format,
passkey onboarding, uygulama içi oynanabilirlik). Ayrıca her iki dokümandaki
Sloth/ZZZ/bahis dili de temizlenmeli.

---

## Sabah raporu

Bitirdiğinde ya da durduğunda `docs/OVERNIGHT_REPORT.md` yaz:

1. **Biten adımlar** — hangi commit'ler
2. **Doğrulama çıktıları** — dört komutun gerçek çıktısı, özet değil
3. **SORULAR** — tasarım kararı gerektirdiği için atladığın her şey
4. **Yapılmayanlar** — özellikle deploy edilmemiş kontratlar ve çalıştırılmamış migration'lar
5. **Şüphelendiklerin** — "çalışıyor ama emin değilim" dediğin yerler

Rapor dürüst olsun. Test geçmiyorsa geçmiyor yaz, çıktısını koy. Yarım kalan
işi tam göstermek, sabahki iki saati boşa harcatır.
