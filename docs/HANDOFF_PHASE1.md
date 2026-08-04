# Devir Notu — Faz 1: Tema Decoupling + Bahis Dili Temizliği

**Tarih:** 2026-08-05
**Kime:** Faz 1'i yürütecek ayrı oturum
**Önce oku:** [CLAUDE.md](../CLAUDE.md) — özellikle §0 (Tema Koddan Ayrıdır). Bu iş o bölümün uygulanmasıdır.

---

## Görev tek cümlede

Kodu tema-nötr hâle getir, tüm tema-özel isimleri `theme.ts`'e topla, ve bahis dilini tamamen sil.

Bu **mekanik bir iştir.** Yaratıcı karar verme. Tasarım sorusu çıkarsa dur ve sor — tahmin etme.

## Kapsam sınırı — bunlara dokunma

| Dokunma | Neden |
|---|---|
| `scripts/` | Sanat üretim araçları, paralel oturum kullanıyor |
| `scripts/generated/` | Üretilen asset'ler |
| `docs/` | Bu oturum dışında yönetiliyor |
| Wind-Up fazının **mekaniği** | Ayrı iş kalemi, Faz 1'den sonra ([WIND_UP_PHASE.md](WIND_UP_PHASE.md)) |

**Paylaşılan dış durum — sadece sen dokunuyorsun:** PostgreSQL veritabanı ve Base Sepolia deploy'ları. Paralel sanat oturumu ikisine de dokunmuyor, ama sen de tersini varsayma: migration'ı ve redeploy'u sen sahipleniyorsun.

## Ölçülmüş tema yüzeyi (2026-08-05)

`frontend` + `backend` + `contracts` + `simulation` + `qa-agent.ts` içinde:

| Terim | Adet |
|---|---|
| `sloth` | 2074 |
| `bid` | 133 |
| `zzz` | 128 |
| `predict` | 95 |
| `payout` | 85 |
| `pot` | 24 |
| `whale` | 8 |

Şema tek dosyada: **`backend/src/db.ts`** (`CREATE TABLE` ifadeleri orada). Ayrı migration klasörü yok.

## Adımlar

Sıra önemli — DB önce, sonra backend, sonra frontend. Aksi hâlde tip hataları kartopu oluyor.

### 1. Tahmin sistemini tamamen kaldır
- `predictions` tablosu düşürülür
- `POST /api/race/predict`, `GET /:id/predictions`, `GET /predictions/stats/:wallet` silinir
- `race.ts` içindeki doğru tahmin ödül bloğu (15 birim/tahmin) silinir
- `Spectate.tsx` tahmin UI'ından arındırılır → salt izleme yayın görünümü
- `Profile.tsx` tahmin istatistikleri, `RaceBroadcast.tsx` tahmin gösterimi, `api.ts` tahmin çağrıları silinir
- `prediction_reward` transaction tipi kaldırılır (geçmiş kayıtlar korunur)

### 2. DB — tema
`sloths`→`racers`, `sloth_id`→`racer_id`, type değerleri `'free_sloth'`/`'sloth'`→`'free'`/`'pro'`, arketip/passive/event/evrim-yolu değerleri fonksiyonel isimlere (tablo: CLAUDE.md §0).

### 3. DB — bahis dili
`races.status` CHECK `'bidding'`→`'tuning'`, `races.max_raise`→`max_tune`, `race_participants.bid_amount`→**`wind_tension`** (0-100 tamsayı), `race_participants.payout`→`reward`.

> `bid_amount`→`wind_tension` normal bir yeniden isimlendirme değil: Wind-Up fazı para değil gerilim saklıyor. Anlamı değişiyor, kolonu bu migration'da doğru isimle aç ki sonra ikinci kez dokunulmasın. Değeri şimdilik yazılmıyor — fazın kendisi sonraki iş kalemi.

### 4. Backend
Route `/api/sloth`→`/api/racer`, tüm tip ve değişken isimleri, `pot`→`prizePool`, `payout`→`reward`.

### 5. Simülasyon motoru
`SlothStats`→`RacerStats`, event ve passive kodları fonksiyonel isimlere.

### 6. Shop paketleri
`Starter/Popular/Pro/Whale` → `bag`/`crate`/`pallet`/`container` kodları; etiketler `theme.ts`'te (Starter Pack / Gift Box / Toy Chest / Collector's Crate). **Fiyatlar ve miktarlar değişmiyor.**

### 7. Frontend
CSS değişkenleri `--color-brand-*`, `frontend/src/config/theme.ts` oluştur, **görünen her metin `THEME`'den okusun.** İçerik için REBRAND_AND_VISUAL_PLAN.md §1'deki `theme.ts` taslağı kullanılabilir — ama rarity etiketleri Fair→Mint, para birimi SPRING olmalı.

### 8. Kontratlar
`FreeSloth.sol`→`FreeRacer.sol`, `Sloth.sol`→`Racer.sol`, `SlothRush.sol`→`RaceCore.sol`. Base Sepolia'ya yeniden deploy, frontend config'deki adresler güncellenir.

### 9. Testler
`qa-agent.ts` (`npm run qa`) — tahmin testleri kaldırılır, kalanlar yeni isimlere uyarlanır.

## Bitti sayılma kriteri — hepsi geçmeli

```bash
# 1. tip kontrolü, iki projede de sıfır hata
npx tsc --noEmit -p frontend
npx tsc --noEmit -p backend

# 2. testler
npm run qa

# 3. tema grep'i — sıfır sonuç vermeli
grep -rinE '\b(sloth|zzz|scrap)\b' --include='*.ts' --include='*.tsx' \
  --include='*.sol' --include='*.css' frontend/src backend/src \
  contracts/contracts simulation --exclude-dir=node_modules \
  | grep -vE 'config/theme\.ts|migrations/legacyNames\.ts'

# 4. bahis dili grep'i — sıfır sonuç vermeli
grep -rinE '\b(bid|bidding|bids|bet|bets|pot|pots|wager|stake|odds|raise|payout|payouts|predict|prediction|predictions|whale)\b' \
  --include='*.ts' --include='*.tsx' --include='*.sol' \
  frontend/src backend/src contracts/contracts simulation \
  --exclude-dir=node_modules | grep -v 'migrations/legacyNames\.ts'
```

3 ve 4 boş dönmeden iş bitmemiştir. **Tek bir `bid` kelimesi tüm çabayı boşa çıkarır** — bu yüzden CI'a kalıcı lint kuralı olarak da eklenmeli.

**Grep'in üç detayı önemli, değiştirme:**

- **Her iki tarafta `\b`.** Sadece `\bbet` yazarsan "between" ve "better" da eşleşir — bu haliyle 168 sahte sonuç veriyordu, gerçek sayı 3'tü. Kelime sonu sınırı olmadan bu tarama işe yaramaz.
- **`--exclude-dir=node_modules`.** Aksi halde TypeScript'in kendi `lib.dom.d.ts`'indeki `raise` sayılıyor.
- **`legacyNames.ts` hariç.** Eski isimleri emekliye ayıran migration, eski isimleri anmak ZORUNDA (`status = 'bidding'`, `DROP TABLE predictions`). Oradaki eşleşmeler doğru, silinmemeli.

Ayrıca `raise` masum bağlamlarda da geçer (`raise an error`). Grep sonucunu körlemesine değiştirme, her eşleşmeye bak.

## Riskler

| Risk | Azaltma |
|---|---|
| DB migration mevcut oyuncu verisini bozar | Önceki rebrand'de try-catch bloklu desen kullanılmış — aynısını uygula |
| Kontrat redeploy testnet adreslerini değiştirir | Base Sepolia ucuz; frontend config'i aynı commit'te güncelle |
| Yarım kalırsa kod derlenmez durumda kalır | Kendi branch'inde çalış, ana dal her zaman yeşil kalsın |

## Bitince

Kısa bir sonuç notu bırak: hangi adımlar bitti, dört doğrulama komutunun çıktısı, ve tasarım kararı gerektirdiği için atladığın bir şey varsa ne olduğu.
