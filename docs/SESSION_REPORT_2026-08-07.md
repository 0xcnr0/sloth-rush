# Oturum Raporu — 2026-08-07

**Dal:** `main` · **Son commit:** `9ebaefb` · **Push yok, testnet deploy yok.**

## Doğrulama

```
npm run verify                    → exit 0
  frontend (tsc -b)                 OK
  backend (tsc --noEmit)            OK
  Theme vocabulary                  OK
  Retired theme symbols             OK
  Raw codes rendered to players     OK
  Wagering vocabulary               OK
  Public verifier matches engine    OK      ← bu oturumda eklendi
  17 birim testi                    17/17

QA_BYPASS_TOKEN=local-dev npm run qa → 57/57 (%100)
```

## Ne yapıldı

Üç büyük iş, sırayla: **V1 kapsamının sadeleştirilmesi**, **görsel yön**, ve
**Wind-Up'ın yerine item sistemi.**

### 1. Kapsam ve ekonomi

Taktik Mod, Grand Prix, training, quest, mini oyunlar, Community, Feedback,
shop, aksesuar, kozmetik ve **oyun içi para** V1'den çıkarıldı. Yaklaşık 6.000
satır silindi.

Para birimi bir tercihle değil, **ölçümle** gitti. Botlu bir yarışta ücretli
modun iki hâli vardı ve ikisi de bozuktu:

1. **Havuz yoktan basılıyordu.** Her bot, var olmadığı hâlde giriş ücretinin
   %75'ini havuza koyuyordu. Ölçüldü: 50 giriş, **3. sıra**, **136 ödül**.
   Kazanmak ve kaybetmek aynı ödüyordu — yani motorun ürettiği her sonuç
   ekonomik olarak birbirinin aynısıydı.
2. Düzeltilince havuz oyuncunun kendi parası oldu, kesinti düşülüp geri
   veriliyordu (50 ver, 21 al). Üstelik tek insan gerçek oyuncular arasında hep
   birinci olduğu için **sırası yine hiçbir şeyi değiştirmiyordu.**

### 2. Ölçümlerin yanlış aralıkta yapıldığının fark edilmesi

Mesafe kaldıracı ve yorgunluk modeli, stat başına 45-80 değerleriyle
ayarlanmıştı. **Gerçek tavanlar 15 (free) ve 22-35 (rarity), mint ~10 veriyor.**
24 saniye olması gereken Sprint 56 saniye sürüyordu; Endurance simülasyonun tick
tavanına çarpıp bitmiyordu.

Gerçek aralıkta yeniden türetildi. Kaldıraç **güçlendi**: sapma 16 puandan
**119 puana** çıktı.

Aynı hata dokümanda da vardı: **evrim tablosu (0/200/350/500) hiçbir zaman
ulaşılabilir değildi** — altı stat en fazla 90 (Wind-Up) veya 210 (Mint
Showcase) toplayabiliyor. Merdiven 90/130/170 oldu ve bir test bunu
ulaşılabilirliğe karşı doğruluyor.

### 3. Görsel

Uygulama **kendi kilitli sanat yönünü hiç kullanmamıştı** — ART_DIRECTION §5'in
tek rengi bile yoktu, Tailwind varsayılanları vardı. Palet uygulandı, arayüze
oyuncakların inşa dili verildi (kalın outline, sert gölge, basınca inen buton),
Fredoka eklendi.

Ama asıl hata çizim döngüsündeydi ve üç turdur kaçırıyordum: `GROUND_AT = 0.83`
yüzünden **gökyüzü şeridin %100'ünü kaplıyordu**, ahşap sadece ayakların
altındaydı. Her oyuncak açık gökyüzünde duruyordu. Boyutu düzeltmek şikâyeti
değiştirmedi çünkü sorun boyut değildi.

Yön için sanat yönetmeni ajanına devredildi. Dönem araştırması iki şey verdi:
1950'lerde **tin litho yarış pistleri gerçekten üretilmiş** (Automatic Toy Co.
"Speedway"), ve tin litho'nun tarif edilebilir bir dili var (üç-dört plaka,
register kayması, halftone nokta). Pist artık pirinç plaka üstüne basılmış
dişliler — kurmalı oyuncaklar, kurma mekanizmasının içinde yarışıyor.

**Yöntem dersi:** ilk sekiz konsept *nesne fotoğrafı* olarak çıktı çünkü nesneyi
tarif edip **çekimi** tarif etmemiştim. Kadraj bloğu eklenince tek denemede
düzeldi. `scripts/prompts/LANE_SHOT.md`'de kalıcı.

### 4. Wind-Up → loadout + item

Faz bir butonu doğru sürede basılı tutmayı ölçüyordu: refleks testi, karar değil,
ve her yarışın önünde duruyordu.

Yerine: yarış öncesi **iki item seçimi**, yarış sırasında **zamanlama**.

Taktik Mod'un yapamadığını yapabilmesinin sebebi tek bir kural:

> Bir item yalnızca henüz açığa çıkmamış bir tick'e konabilir, ve item uygulamak
> rastgelelik tüketmemelidir.

İkisi sağlanınca yeniden simülasyon, oyuncunun gördüğü kareleri birebir yeniden
üretiyor. Motorun duraklatılabilir olmasına gerek yok — rakip araştırmasının
"parça parça çözücü" önerisinin pahalı yarısı gereksizmiş.

Bu iddia **testle** duruyor, tartışmayla değil.

## Bulunan gerçek hatalar

1. **Yarış ekranı doğrudan bağlantıyla tamamen boş geliyordu.** Replay ucu grid
   taşımıyor, giriş ekranı onu şart koşuyor, faz hiç `racing`'e geçmiyordu.
2. **Botlar aynı arketipi seçebiliyordu** — dört şeritli yarışta aynı oyuncak iki
   kez. Ve seçim `Math.random()` ile yapılıyordu, yani aynı tohum aynı yarışı
   vermiyordu.
3. **Açık doğrulayıcı 123 satır geride kalmıştı** ve README'si iki marka önceki
   oyunu anlatıyordu. Sunucudan farklı sonuç veren bir doğrulayıcı, adalet
   iddiasını kanıtsız bırakmaz — yanlış yapar. `tools/check-verifier.sh` artık
   `npm run verify` içinde bayt bayt karşılaştırıyor.
4. **Günlük ücretsiz yarış sessizce ölmüştü** — format yeniden adlandırılınca
   `format === "standard"` kontrolü bir daha doğru olamazdı.
5. **İki görünmez konuşma balonu** — beyaz üstüne krem. İkisi de sadece ekrana
   bakınca bulundu.
6. **"View Quests" butonu var olmayan bir rotaya gidiyordu** ve her zaman 404'e
   düşürüyordu.
7. **QA'nın rate-limit bypass'ı hiç kurulmamıştı** — süit kendi limitine takılıp
   anlamsız 429 raporu üretiyordu. Kurulunca %78 → %97.

## Kendi hatalarım

- **Yarış ekranını üç tur boyunca görmeden değiştirdim.** Her ekran görüntüsünde
  cüzdan modalı üstünü karartıyordu; tahminle düzeltip "oldu" diye sundum. Asıl
  hata buydu, tek tek renk seçimleri değil.
- **Bu oturumdaki bütün ayarları yanlış stat aralığında ölçtüm** ve fark etmem
  bir tur sürdü.
- Toplu renk değişimi **iki görünmez metin** yarattı.
- 1000 satırlık JSX dosyasında regex'le ameliyat denedim, üç kez kırdım.

## Açık kalemler — karar bekliyor

1. **Mint stat tabanı.** Mint ~10 veriyor, tavanlar 15/22-35. Taze yarışçı bütün
   sayıların ayarlandığı aralığın altında başlıyor.
2. **Passive'ler.** Motorda altı dal var, `theme.ts`'te etiketleri var, ama
   hiçbir şey atamıyor — 114 yarışçının hiçbirinde yok, hiç tetiklenmemiş.
3. **Ücretsiz yarışçılara arketip atanmıyor**, hepsi Tinbot çiziliyor.
4. **Kontrat redeploy'u** — tetikleyici başvuru tarihi.
5. **Cüzdan bağlı tam oyun denemesi** hâlâ yapılmadı.

## Harcanan

Meshy: 1110 → **1026** kredi (17 görsel: oda, raf güvertesi, finiş bayrağı, 16
konsept taraması).
