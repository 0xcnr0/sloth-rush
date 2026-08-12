# Ekran görüntüleri — oyunun şu anki hâli

`tools/capture-all.mjs` ile alındı. Akış ekranları (geri sayım, uçuştaki item,
bitiş donması, form değişimi) URL ile ulaşılamaz — script yarışı gerçekten
sürerek yakalıyor. Yeniden almak için: `node tools/capture-all.mjs`
(dev sunucuları 3001 ve 5173'te ayakta olmalı).

| dosya | ne gösteriyor |
|---|---|
| `01-onboarding` | İlk ziyarette çıkan dört adımlık tanıtım penceresi |
| `02-landing` | Karşılama sayfası — dört arketip bir rafın üstünde |
| `03-mint-idle` | Mint ekranı: kurulmamış, boyasız başlangıç oyuncağı |
| `03b-mint-winding` | Mint sürerken — anahtar durmuş, oyuncak zincirde |
| `03c-mint-alive` | Mint bitti — anahtar dönüyor, isim basıldı, RACE IT |
| `04-toybox` | Rafın: statlar, form çubuğu, günlük büyüme, item stoku |
| `05-race-lobby` | Yarış öncesi üç seçim: mesafe, yarışçı, iki item |
| `06-race-countdown` | 3-2-1-GO, oyuncaklar başlangıç çizgisinde |
| `07-race-running` | Koridor, kayan kamera, sıra+isim plakaları, canlı sıralama |
| `08-item-in-flight` | Item basıldı: şerit + hedefte dolan halka |
| `09-item-landed` | Item vardı: patlama, tepki, etki boşalıyor |
| `10-race-finish` | Bitiş çizgisi anı |
| `11-result-screen` | Podyum, stat kazancı, MVP ödülleri |
| `11b-form-change` | **Oyunun en büyük anı** — oyuncak şekil değiştiriyor |
| `12-shelf-public` | Herkese açık raf + pasaport kartı (provenance) |
| `13-profile` | Cüzdan bazında kayıt ve yarış listesi |
| `14-ranks` | Season ligleri ve Career sıralaması |
| `15-guide` | Oyunun kurallarının tamamı, tek sayfa |
