# Devir Notu — Meshy 3D Kurulumu ve Tinbot Golden Sample

**Tarih:** 2026-08-04
**Neden devir:** Önceki oturum çok uzadı (tam rebrand + mekanik + ekonomi tartışması + iki API entegrasyonu + 5 görsel üretim turu). Meshy MCP bağlantı hatası debug gerektiriyor — temiz bir başlangıç noktası.

---

## Önce yap: güvenlik

Önceki oturumda `claude mcp list` komutu `MESHY_API_KEY`'i yanlışlıkla açık metin olarak yazdırdı (transcript'te duruyor, hiçbir yere sızmadı ama temizlik için). **Kullanıcı Meshy panelinden eski anahtarı iptal edip yeni bir tane oluşturmuş olmalı.** Yeni anahtarı `scripts/.env` dosyasına `MESHY_API_KEY=...` olarak eklemesini iste (kendi elleriyle, chat'e yapıştırmadan — bu proje boyunca kullanılan güvenlik pratiği bu).

## Proje durumu

Oyun: **WIND-UP RUSH** (üçüncü ve son tema — Sloth Rush → Scrap Rush → Wind-Up Rush geçişinin tamamı için [docs/REBRAND_AND_VISUAL_PLAN.md](REBRAND_AND_VISUAL_PLAN.md) ve [docs/ART_DIRECTION.md](ART_DIRECTION.md)'ye bak, ikisi de güncel).

**Kilitli kararlar (hepsi CLAUDE.md'nin üstünde, henüz oraya yazılmadı — bir sonraki adımda CLAUDE.md da güncellenmeli):**
- 4 arketip: Jetster (hız, kırmızı #E63946), Tinbot (tank, mavi #2A6FDB), Waddler (kurnaz, sarı #FFC93C), Chomper (patlama, yeşil #4CAF6D)
- Rarity: **Fair → Good → Excellent → Near Mint → Mint** (gerçek oyuncak koleksiyonculuğu terminolojisi, uydurma değil)
- Evrim (T0-T3) rarity'den bağımsız bir eksen — form değişimi, rarity yüzey/malzeme değişimi
- Kurma anahtarı = stamina göstergesi (dönüş hızı stamina'ya bağlı, oyun mekaniği)
- Pist formatı: **dikey ekranda üst üste 4 yatay şerit** (foto-finiş görünümü) — hem mobil ergonomi hem tema-otantiklik
- Yarış öncesi mekanik: **Wind-Up fazı**, tamamen beceri bazlı (para yok), Tune-Up/sealed-bid'in yerine geçti
- İzleyici: salt izleme, bahis/tahmin sistemi yok

## Şu ana kadar yapılan sanat üretimi

**fal.ai (2D, çalışıyor):**
- `scripts/.env` içinde `FAL_KEY` kurulu
- `scripts/generate.ts` — bütçe zorunlu, dry-run destekli, fal-ai/flux-pro/v1.1 kullanan üretim script'i
- 5 iterasyon (`scripts/generated/tinbot-v1` → `v5`), öğrenilenler:
  - **flux-pro/v1.1'in gerçek negative prompt desteği yok** — "no rust, no dirt" gibi negatif ifadeler tam tersi etki yapıyor (pas/kir çekiyor). Sadece pozitif dille ne istendiği anlatılmalı.
  - "flat design vector sticker, Duolingo mascot style, NOT a 3D render" gibi güçlü pozitif dil, doğru toon stiline ulaştırıyor (v3, v4 bunu başardı)
  - **Kurma anahtarı en kırılgan eleman** — model sürekli antene çeviriyor, "no antenna" bile net çözmüyor. Muhtemelen çözüm: anahtarı göğse (arkaya değil) yerleştirip çok ısrarlı tarif etmek (v5'te denendi, kısmen işe yaradı)
  - En iyi sonuç v4: temiz stil, temiz krom, yazı yok — ama anahtar yok

**Tripo (3D, sadece ekran görüntüsü, indirilemedi — free tier ticari hak vermiyor):**
- Kullanıcının kendi denemesi, gerçek yansımalı krom **çok ikna edici** — bizim 5 fal.ai denememizin hiçbiri bu malzeme kalitesine yaklaşamadı
- Anahtar da net görünüyor (altın renkli, doğru form)
- **Bu, "3D gerçek PBR malzeme = daha ikna edici rarity" tezini görsel olarak doğruladı**

**Meshy (3D, kurulum yarım kaldı):**
- Kullanıcı Pro plan satın aldı (aylık)
- Önceki free-tier denemesi sadece dokusuz gri mesh verdi (adil kıyaslama değildi — Tripo dokulu, Meshy dokusuzdu)
- Resmi MCP sunucusu var: `@meshy-ai/meshy-mcp-server`, `meshy_text_to_3d`, `meshy_image_to_3d`, `meshy_text_to_3d_refine` (doku), `meshy_rig`, `meshy_animate` araçlarını içeriyor — TÜM pipeline'ı (üret→dokula→rig'le→animasyonla) kapsıyor
- REST API alternatifi de var: base `https://api.meshy.ai`, Bearer auth, text-to-3d endpoint `https://api.meshy.ai/openapi/v2/text-to-3d`, iki adımlı (preview mesh → refine/texture)
- **Kurulum yapıldı ama bağlantı başarısız oldu:** `claude mcp add meshy -- npx -y @meshy-ai/meshy-mcp-server -e MESHY_API_KEY=...` çalıştırıldı, `claude mcp list` "Failed to connect — Connection closed" gösterdi. Debug edilmedi.

## Hemen yapılacaklar

1. Kullanıcıdan yeni (rotate edilmiş) Meshy anahtarını `scripts/.env`'e eklemesini iste
2. MCP bağlantı hatasını debug et — önce `npx -y @meshy-ai/meshy-mcp-server` komutunu doğrudan çalıştırıp (anahtar env'den, `set -a && source scripts/.env && set +a &&` ile) ham hata mesajını gör, node sürümünü kontrol et (`node --version`), gerekirse `claude mcp remove meshy` ile kaldırıp yeniden ekle
3. Bağlantı kurulunca: Tinbot T1, Near Mint (krom) golden sample'ı Meshy'nin tam pipeline'ıyla üret (text-to-3d → refine/texture → rig) — aynı prompt mantığını kullan ama Meshy'nin image-to-3d girişine `scripts/generated/tinbot-v4-*.png`'yi (en temiz 2D sonucumuz) referans olarak vermeyi düşün, tutarlılık için
4. Sonucu Tripo'nun ekran görüntüleriyle ve bizim en iyi fal.ai sonucumuzla (v4) yan yana koy, dürüst bir üçlü kıyaslama yap
5. Animasyon sorusu hâlâ açık: rig'li mesh'i PlayCanvas'ın parametre-güdümlü animasyon sistemine (stamina → anahtar dönüş hızı) bağlamak hiç test edilmedi — bu, 3D yönüne kesin karar vermeden önce ayrıca doğrulanmalı

## Genel bağlam

Proje `/Users/canerpinarbasi/Claude main/_arsiv/sloth-rush` — Base L2 blockchain yarış oyunu, CLAUDE.md'de tüm mekanik/ekonomi detayları var (ama tema kısmı hâlâ eski "Sloth" referanslarını taşıyor, güncellenmedi — bu da ayrı bir iş kalemi). Faz 1 (tema decoupling refactor, bahis dili temizliği) henüz koda uygulanmadı, sadece planlandı.
