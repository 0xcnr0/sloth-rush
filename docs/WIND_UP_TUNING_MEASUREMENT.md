# Wind-Up Ayar Ölçümü — §13'ün Cevabı

**Tarih:** 2026-08-06
**Dal:** `windup-tuning-sweep`
**Araç:** `tools/windup-tuning-sweep.ts` — `npm run sweep:windup`
**Hiçbir sayı değiştirilmedi.** `windUp.ts` commit'li değerleriyle duruyor (`git diff` boş).

---

## Kısa cevap

**Mevcut hücre (pole 0.12, ceza 0.015) beş test koşulunun hepsinde ayakta kalıyor.** Aynı istatistikli bir yarışta paylar `temiz 24 / sınırda 44 / kırmızı 33`. Hiçbiri %50'yi geçmiyor, hiçbiri %20'nin altına düşmüyor.

Ama ölçüm §13'ün sormadığı üç şeyi de gösterdi ve ikisi karardan önce konuşulmalı — aşağıda.

---

## Nasıl ölçüldü

Her hücrede 4 yarışçılık gerçek bir alan: **temiz + sınırda + kırmızı + 1 bot.** Bot, oyunun kendi `botTension()` fonksiyonunu orta beceriyle kullanıyor.

Stratejiler oyuncunun **görebildiği banda** göre nişan alıyor, gerçek eşiğe göre değil — eşik her yarışta ±%4 kayıyor ve oyuncuya gösterilmiyor (§9). Yani "sınıra kur" gerçekten de zamanın yarısında sınırın üstüne düşüyor. Bu belirsizlik mekaniğin kendisi, temizlenecek gürültü değil.

| Strateji | Nişan |
|---|---|
| temiz kur | bant merkezi − 15 |
| sınırda kur | bant merkezi |
| kırmızıya kur | 97 |

Izgara: pole avantajı {0, .04, .08, .12, .16, .20, .28, .40} × aşırı kurma cezası {0, .005, .01, .015, .02, .03, .045, .07} = 64 hücre.

Beş koşul, her hücrede 1500–2000 yarış:

| Koşul | Ne |
|---|---|
| mirror j0 | Aynı istatistik, kusursuz zamanlama |
| mirror j3 | Aynı istatistik, insan hatası σ=3 |
| mirror j6 | Aynı istatistik, insan hatası σ=6 |
| league s2 | Lig eşleşmesi, istatistik σ=2 |
| wide s6 | Açık eşleşme, istatistik σ=10–35 arası σ=6 |

**Eleme kuralı (§13):** bir strateji oyuncu galibiyetlerinin %50'sini geçerse hücre elenir. Üç eşit strateji %33'te oturur.

> §13 "%50" diyor ama hangi paydaya göre olduğunu söylemiyor. Ham galibiyet oranına uygularsam bar erişilemez olur: dördüncü yarışçı tek bir stratejiyi yapısal olarak ~%40'ın altında tutar. Oyuncu galibiyetleri payına uyguladım — üç eşit strateji orada %33'tedir ve %50 "şansın 1.5 katı" demektir.
>
> **Ek kural (benim, §13'te yok):** bir strateji %20'nin altına düşerse "kimse seçmez" sayıp eledim. §13 üç stratejinin de *yaşayabilir* olmasını istiyor; hiçbiri baskın değilken biri ölü olabilir.

---

## Izgara — mirror j3 (ana koşul)

Hücreler `temiz/sınırda/kırmızı`, oyuncu galibiyetlerinin yüzdesi.
`*` = üçü de yaşıyor · `.` = baskın yok ama biri aç kalmış (<%20) · boş = biri %50'yi geçmiş

```
pole \ ceza     0.000     0.005     0.010     0.015     0.020     0.030     0.045     0.070
0.00         32/37/31* 35/40/25* 36/41/22* 37/42/20* 38/43/19. 40/44/16. 43/47/11. 45/49/5.
0.04         27/38/35* 29/41/30* 31/43/26* 32/44/24* 32/45/23* 34/46/20. 38/49/13. 41/52/6
0.08         22/36/42* 24/40/36* 26/43/32* 27/44/29* 28/46/27* 29/47/24* 33/51/16  37/55/8
0.12         19/35/45. 21/39/40* 23/42/35* 24/44/33* 25/45/30* 27/46/27* 31/52/17  35/56/9
0.16         18/33/49. 19/38/43. 20/41/39* 22/43/35* 23/44/32* 25/46/29* 29/51/20  33/56/10
0.20         16/33/51  17/37/46. 19/41/41. 20/42/38. 21/44/34* 23/45/32* 27/51/22  32/57/11
0.28         14/30/56  15/35/51  16/38/46. 17/40/42. 19/43/39. 21/44/34* 25/50/25  30/57/13
0.40         13/27/60  14/31/55  15/35/50  16/38/46. 18/40/42. 20/43/37* 24/48/28* 29/57/14
```

**Beş koşulun hepsinde ayakta kalan: 64 hücrenin 25'i.** (§13'ün tek kuralıyla, açlık kuralı olmadan: 41.)

---

## Mevcut hücre nasıl duruyor

| Koşul | temiz | sınırda | kırmızı | Kırmızı kopma oranı | Sonuç |
|---|---|---|---|---|---|
| mirror j0 | 23 | 40 | 37 | %0 | geçer |
| mirror j3 | 24 | 44 | 33 | %17.8 | geçer |
| mirror j6 | 27 | 45 | 29 | %32.9 | geçer |
| league s2 | 30 | 37 | 32 | — | geçer |
| wide s6 | 33 | 35 | 32 | — | geçer |

Beş koşulda da geçiyor ve oyuncu hatasına karşı şaşırtıcı derecede dayanıklı: kırmızıya kuran oyuncunun kopma oranı %0'dan %33'e çıkarken payı sadece 37 → 29'a düşüyor.

---

## Yaşayan hücreler, en dengeliden başlayarak

Beş koşulun hepsinde ayakta kalan 25 hücrenin en dengeli 12'si (mirror j3 payları):

| pole | ceza | oran | temiz/sınırda/kırmızı | en kötü koşuldaki yayılma |
|---|---|---|---|---|
| 0.00 | 0.000 | — | 32/37/31 | 8.4 |
| 0.04 | 0.005 | 8.0 | 29/41/30 | 13.7 |
| 0.04 | 0.000 | — | 27/38/35 | 15.3 |
| 0.00 | 0.005 | 0.0 | 35/40/25 | 16.1 |
| 0.08 | 0.010 | 8.0 | 26/43/32 | 16.9 |
| 0.08 | 0.015 | 5.3 | 27/44/29 | 17.8 |
| 0.08 | 0.005 | 16.0 | 24/40/36 | 18.6 |
| 0.04 | 0.010 | 4.0 | 31/43/26 | 19.0 |
| 0.12 | 0.010 | 12.0 | 23/42/35 | 19.4 |
| **0.12** | **0.015** | **8.0** | **24/44/33** | **19.7** |
| 0.00 | 0.010 | 0.0 | 36/41/22 | 20.3 |
| 0.12 | 0.020 | 6.0 | 25/45/30 | 20.4 |

---

## Karardan önce konuşulması gereken üç şey

### 1. En dengeli hücre bir tuzak

Listenin başındaki `(0.00, 0.000)` en dar yayılmaya sahip — çünkü orada pole avantajı da ceza da yok, yani **gerilim hiçbir şey yapmıyor.** Üç strateji mükemmel dengeli çünkü üçü aynı şey. §2 fazın "bir karar" olmasını istiyor; o hücrede karar yok.

Yani "en dengeli hücreyi seç" yanlış bir optimizasyon. Doğru soru: *kötü seçmek ne kadara mal oluyor?*

| pole | ceza | en kötü stratejinin payı | %33'e göre bedel |
|---|---|---|---|
| 0.00 | 0.000 | 31 | 2.6 → **karar yok** |
| 0.04 | 0.005 | 29 | 4.6 |
| 0.08 | 0.010 | 26 | 7.5 |
| **0.12** | **0.015** | **24** | **9.4** |
| 0.16 | 0.020 | 23 | 10.2 |
| 0.28 | 0.030 | 21 | 12.1 |

Mevcut hücre burada iyi bir yerde duruyor: yanlış strateji seçmek ~9 puana mal oluyor — hissedilir ama ezici değil.

### 2. Motorda pole avantajından bağımsız bir pozisyon yanlılığı var

Dört **birebir aynı** yarışçıyı sıfır pole bonusuyla 4000 kez koşturdum:

```
poleBonus=0.00  ->  P1 26.2%   P2 26.0%   P3 24.3%   P4 23.5%
poleBonus=0.12  ->  P1 40.6%   P2 26.7%   P3 18.6%   P4 14.2%
```

Sıfır bonusta bile P1 ile P4 arasında **2.7 puan** fark var. Sebep `engine.ts:388`: her tick'te hız varyansı `rng()` ile çekiliyor ve `state` dizisi grid sırasında kurulu, yani öndeki yarışçı akıştan hep önce çekiyor. Küçük ama gerçek ve istatistiksel olarak anlamlı (4000 yarışta ~4 standart hata).

Sonucu: "pole avantajı sıfır" aslında sıfır değil. Izgaranın en üst satırı temiz bir kontrol grubu değil. Ayrı bir iş kalemi — kararı etkilemiyor ama bilinmeli.

### 3. İstatistik farkı mekaniği yutuyor

Gerçekçi karışık kadroda (σ=6) **bütün hücreler** ~33/35/31'e düzleşiyor. Lig eşleşmesinde (σ=2) bile büyük ölçüde düzleşiyor. Mekanik sadece ayna eşleşmesinde net ayrışıyor.

Bu, ayarın yanlış olduğu anlamına gelmiyor — stratejiyle istatistik ilişkisiz olduğu için fark ortalamada yıkanıyor. Ama şunu söylüyor: **canlı oyunda Wind-Up fazının sonuca etkisi bu ızgaranın gösterdiğinden belirgin biçimde zayıf olacak.** Faz, yarışı kazandıran şey değil; eşit rakipler arasında farkı açan şey.

Ayar kararı ayna eşleşmesi verisine göre verilmeli — kontrollü deney o.

---

## Ayrıca not

- **"Sınırda kur" hemen her hücrede en iyi strateji** (%40–48). Hiçbir yaşayan hücrede %50'yi geçmiyor, yani §13'e göre baskın değil — ama gerçek seçim pratikte *temiz mi kırmızı mı* arasında. Bu tasarım olarak doğru olabilir ("sınıra kur" sezgisel olarak da en iyi cevap olmalı); sadece bilinçli bir kabul olsun.
- **Oran deseni:** yaşayan hücrelerin çoğu pole ≈ 4–12 × ceza bandında. Mevcut hücre tam 8.0. Oran düştükçe temiz, yükseldikçe kırmızı öne çıkıyor; temiz ile kırmızı yaklaşık oran 4'te eşitleniyor.
- **Oyuncu hatası ayarı belirlemiyor.** j0/j3/j6 neredeyse aynı cevabı veriyor. Ayar, oyuncu becerisine karşı dayanıklı.
- `poleAccelerationTicks` (40 tick = 4 sn) sabit tutuldu, süpürülmedi.

---

## Yeniden üretmek için

```bash
npm run sweep:windup -- --races 2000 --jitter 3
npm run sweep:windup -- --races 2000 --jitter 3 --stats varied --statsigma 2
npm run sweep:windup -- --races 1500 --jitter 0 --csv /tmp/j0.csv
```

Aynı `--seed` aynı sonucu verir.
