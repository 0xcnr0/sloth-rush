# SLOTH RUSH — Proje Bağlamı ve Geliştirme Rehberi

Bu dosya Claude Code için yazılmıştır. Her oturumda önce bunu oku.
Bu proje uzun bir tasarım sürecinden geçti — buradaki kararlar rastgele değil, gerekçelidir.

---

## Proje Özeti

**Sloth Rush** — Base L2 blockchain üzerinde çalışan tembel hayvan yarış oyunu.
- Hedef: Base Batches Season 3 başvurusu ve demo
- Geliştirici profili: Developer değil, AI toollarına (Replit, Lovable, ChatGPT) aşina biri. Vibecoding yaklaşımı.
- Süre: ~13 gün prototip için
- Slogan: "Wake up. Race hard. Nap later."

---

## Kesinleşmiş Tasarım Kararları (Değiştirme)

Aşağıdaki kararlar uzun tartışmalar sonucu alındı. Alternatif önermeden önce bu listeyi kontrol et.

### NFT Modeli
- **Free Sloth**: Gasless mint (Base Paymaster), wallet başına 1 adet, sybil korumalı
- **Sloth**: Free Sloth yakılır (burn) + $3 USDC → yeni Sloth mint edilir
- Arz sınırı YOK — her upgrade bir Sloth üretir
- Rarity upgrade anında Chainlink VRF ile belirlenir (oyuncu bilemez)
- Üreme sistemi YOK — bu karar kesin, önerme
- 10k koleksiyon sınırı YOK — bu da kesin

### Ekonomi Modeli
- **ZZZ Coin**: Oyun içi, offchain (server DB). Blockchain token DEĞİL — V1'de
- **USDC**: Sadece iki noktada kullanılır: upgrade ($3) ve shop coin satın alımı
- Token lansmanı Faz 4'e ertelendi — erken token çıkarmıyoruz
- Token adı ileride "ZZZ Token" olacak

### Mimari — Hibrit Model (Kesin Karar)
```
ONCHAIN (Base L2):
- Free Sloth mint
- Sloth mint + burn
- Rarity belirleme (VRF)
- Yarış seed üretimi (VRF)  
- Yarış sonuç hash'i
- Kazanan adresi kaydı
- USDC transfer (upgrade + shop)

OFFCHAIN (Server):
- ZZZ Coin bakiyeleri
- Pot dağıtımı hesabı
- Günlük görev takibi
- Aksesuar drop mantığı
```

### Yarış Mekaniği
- 4 Sloth per yarış (bot doldurur, ama botlar ödül kazanamaz)
- **Sealed Bid**: 10 saniye gizli raise → aynı anda açılır → en yüksek = Pole Position
- Pot yapısı: Platform %15 keser, kalan %85 dağıtılır (1.:%50, 2.:%30, 3.:%15, 4.:%5)
- Raise limitleri: Standard'da max 100 ZZZ, Grand Prix'de max 300 ZZZ

### Taktik Mod (V1 MVP — Sadeleştirilmiş)
- Sadece 2 aksiyon: **Boost** (100 ZZZ) + **Shell At** (250 ZZZ)
- **Sabit fiyat** — GDA (Gradual Dutch Auction) V2'ye ertelendi
- Kalkan ve Şans Tobu V2'de eklenir

### Rarity (İstatistik etkisi YOK — sadece görsel)
- Common %55 / Uncommon %25 / Rare %12 / Epic %6.5 / Legendary %1.5
- Rarity istatistik farkı yaratmaz, sadece görsel ve broadcast ayrıcalığı

---

## V1 Ekonomi Tablosu (Netleştirilmiş)

```
Yarış Giriş Ücretleri:
- Exhibition:    Ücretsiz
- Standard Race: 50 ZZZ Coin  (max raise: 100)
- Grand Prix:    150 ZZZ Coin (max raise: 300)
- Taktik Meydan: 75 ZZZ Coin  (max raise: 150)

Günlük Ücretsiz Yarış: 1 Standard Race / wallet (Sloth sayısından bağımsız)

Upgrade Paketi:
- Upgrade ücreti: $3 USDC (onchain)
- Başlangıç coin: 500 ZZZ Coin
- → ~10 Standard Race yapabilir

Shop Coin Paketleri:
- Starter: $1.00  → 120 ZZZ Coin
- Popular: $5.00  → 650 ZZZ Coin (+%8 bonus)
- Pro:    $10.00  → 1.400 ZZZ Coin (+%17 bonus)
- Whale:  $25.00  → 4.000 ZZZ Coin (+%25 bonus)

Güçlendiriciler (ZZZ Coin):
- Enerji Jeli (+8 SPD):      30 ZZZ
- Turbo Sümük (+12 ACC):     25 ZZZ
- Kaya Kılığı (+8 STA):      35 ZZZ
- Şans Tozu (+8 LCK):        40 ZZZ
- Refleks Serumu (+8 REF):   35 ZZZ
- Tam Paket (+4 hepsi):      90 ZZZ
- Kalkan (1 shell engel):    50 ZZZ

Aksesuar Kutuları:
- Standart Kutu: 200 ZZZ
- Nadir Kutu:    600 ZZZ
- Efsane Kutu:   1.500 ZZZ
```

---

## Sloth İstatistikleri

6 stat: SPD (Hız), ACC (İvme), STA (Dayanıklılık), AGI (Çeviklik), REF (Refleks), LCK (Şans)

Görsel evrim eşikleri (toplam stat puanına göre):
- 0-199: Başlangıç
- 200-349: Eşik 1 (kabukta çatlaklar)
- 350-499: Eşik 2 (parlayan kabuk)
- 500+: Eşik 3 / Max evrim (aura, tam dönüşüm)

Training:
- Haftada 2 kez / Sloth
- 4 saat %60 başarı / 12 saat %80 / 24 saat %95
- Başarılı → +1 hedef istatistik (onchain metadata güncellenir)
- Training süresinde Sloth yarışa giremez

---

## Demo Day Öncelik Sırası

### ŞART (bunlar olmadan demo olmaz):
1. Free Sloth gasless mint
2. Sloth upgrade ($3 USDC mock + burn + mint)
3. Rarity reveal animasyonu (VRF veya mock)
4. Ahır sayfası (Sloth görüntüleme)
5. Standard Race yarış akışı (tek pist: Grand Kabuk)
6. Sealed bid UI (10 sn geri sayım + reveal animasyonu)
7. Pol pozisyonu belirleme ve grid gösterimi
8. Broadcast görünüm (yarış animasyonu)
9. ZZZ Coin bakiye sistemi
10. Pot dağıtımı (kazananlar coin alır)

### BONUS (varsa güçlü, yoksa sorun değil):
- Taktik Mod (Boost + Shell)
- Training sistemi
- Güçlendirici satın alma
- Aksesuar sistemi
- Mini oyunlar (Sloth Sprint, Shell Dodge)
- Günlük görevler

---

## Teknik Stack

```
Frontend:   React + TypeScript
Styling:    Tailwind CSS
Animasyon:  PixiJS (yarış) + Framer Motion (UI)
Cüzdan:     Wagmi + RainbowKit
Onboarding: Privy (e-posta ile kayıt)
Network:    Base Sepolia (testnet) → Base Mainnet
NFT:        ERC-721 + OpenZeppelin
Randomness: Chainlink VRF v2.5
USDC:       Base'deki native USDC kontrat
Gasless:    Base Paymaster (ERC-4337)
DB:         PostgreSQL (ZZZ Coin bakiyeleri)
Backend:    Node.js + Express
Deploy:     Hardhat (kontratlar)
```

---

## Klasör Yapısı (Hedef)

```
sloth-rush/
├── contracts/           # Solidity kontratları
│   ├── FreeSloth.sol     # Free Sloth ERC-721
│   ├── Sloth.sol        # Sloth ERC-721 (dinamik metadata)
│   └── SlothRush.sol     # Ana oyun kontratı (hash kayıt, kazanan)
├── frontend/            # React uygulaması
│   ├── src/
│   │   ├── components/
│   │   │   ├── Race/    # Yarış animasyonu (PixiJS)
│   │   │   ├── SealedBid/  # 10sn geri sayım + reveal
│   │   │   ├── Treehouse/  # Ahır sayfası
│   │   │   └── Shop/    # Coin + aksesuar
│   │   ├── hooks/       # Wagmi hooks
│   │   └── pages/
├── backend/             # Node.js API
│   ├── routes/
│   │   ├── coin.ts      # ZZZ Coin bakiye
│   │   ├── race.ts      # Yarış mantığı
│   │   └── shop.ts      # Satın alma
│   └── simulation/      # Yarış simülasyon motoru (açık kaynak)
└── CLAUDE.md            # Bu dosya
```

---

## Güven Modeli (Jüriye Anlatılacak)

1. Rarity manipüle edilemez → Chainlink VRF onchain
2. Yarış sonucu manipüle edilemez → VRF seed + deterministik kod + onchain hash
3. Kim kazandı şeffaf → kazanan adresi Base'e yazılır
4. NFT güvenli → ERC-721 standardı
5. Coin bakiyesi → platforma güven (V4'te tam onchain token ile çözülür)

Simülasyon kodu açık kaynak olacak → anyone-can-verify

---

## Önemli Notlar

- **Kart/paket sistemi YOK** — ertelendi, tartışmaya açma
- **Üreme sistemi YOK** — tamamen çıkarıldı
- **Seyirci bahsi V2'de** — V1'de yok
- **Lonca sistemi V2'de** — V1'de yok
- **GDA fiyat motoru V2'de** — V1 sabit fiyat
- Bot Sloth'ler UI'da "BOT" etiketiyle gösterilir, ödül kazanamaz
- Daily free race wallet başına 1 — Sloth sayısından bağımsız
- Sybil koruması: 1 Free Sloth per wallet + rate limit

---

## Şu An Neredeyiz

GDD v3.1 tamamlandı. Prototip geliştirmeye başlıyoruz.
İlk hedef: testnet'te çalışan sealed bid + yarış akışı.

Sıradaki adım: Proje klasörünü kur, dependencies yükle, Free Sloth kontratını yaz.
