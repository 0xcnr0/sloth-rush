# Araştırma prompt'u — çok şeritli yatay yarış oyunları

Grok / Gemini / ChatGPT gibi araçlara verilecek. Aşağıdaki bloğu olduğu gibi
kopyalayın.

Neden bu kadar kısıtlı yazıldı: aynı araştırmayı ben yaptığımda dönen cevapların
çoğu **"parlak ve eğlenceli görseller"** türü genel sıfatlardı. Bu cümleler bin
farklı oyunu tarif eder ve hiçbir karar verdirmez. Prompt bu yüzden sıfat
yasaklıyor, sayı ve link istiyor.

---

```
ROL
Sen bir oyun sanat yönetmeni araştırmacısısın. Görevin, belirli bir yarış
formatını kullanan oyunları bulmak ve PİSTLERİNİN görsel çözümlerini
belgelemek. Estetik yorum değil, ölçülebilir gözlem istiyorum.

ARADIĞIM FORMAT — dört maddenin HEPSİ aynı anda doğru olmalı
1. Aynı anda ekranda 2 veya daha fazla yarışçı var (hayalet/isim etiketi değil,
   gerçekten çizilmiş rakipler)
2. Yarışçılar ayrı yatay şeritlerde, üst üste dizili
3. Kamera yandan (profilden), tepeden veya arkadan değil
4. Hareket yatay: soldan sağa ya da sağdan sola

BUNLAR DEĞİL — bulursan listeye alma, ama "eledim" diye ayrı not düş
- Tek araçlı yandan kaydırmalı oyunlar (Hill Climb Racing, Moto X3M, Bike Race).
  Rakip yoksa ya da sadece hayalet/isim etiketiyse format eşleşmiyor.
- Tepeden bakış (Micro Machines, ZED Run, Tiny Racer)
- 3B kovalayan/omuz üstü kamera (Photo Finish Horse Racing, Umamusume,
  Mario Kart, Asphalt)
- Şerit değiştirerek trafikten kaçma oyunları (Subway Surfers, Crazy Taxi:
  City Rush, Lane Car). Şeritteki diğer araçlar rakip değil, engel.
- Yarış olmayanlar (platform, koşu, dövüş)

HER OYUN İÇİN ŞU ALANLARI DOLDUR
Tahmin etme. Bir alanı doğrulayamıyorsan "bilinmiyor" yaz, uydurma.

| Alan | Açıklama |
|---|---|
| Oyun adı | |
| Geliştirici / yıl / platform | |
| Popülerlik | İndirme sayısı, oynanma sayısı veya puan — KAYNAK LİNKİYLE |
| EKRAN GÖRÜNTÜSÜ LİNKİ | Mağaza sayfası, wiki galerisi veya YouTube oynanış videosu (videoysa zaman damgası ver, örn. 1:24). Bu alan zorunlu. |
| Aynı anda kaç şerit | 2, 3, 4, 6, 8… |
| Yarışçının kapladığı alan | Yarışçı, ekran yüksekliğinin yaklaşık yüzde kaçı? (%10 / %25 / %40 gibi) |
| Şeritte başka ne var | Yarışçı dışında ne çiziliyor: çizgi, engel, seyirci, dekor, hiçbir şey… |
| Pist neyin üstünde | Asfalt, toprak, çim, tahta, kum, kar, halı, masa, uzay… |
| Arka plan katman sayısı | Kaç ayrı derinlik katmanı var (paralaks) |
| “Kim önde” nasıl okunuyor | Sadece konumdan mı, yoksa sıra numarası / mesafe barı / mini harita da var mı |
| Ölçek nasıl veriliyor | Yarışçının boyutunu anlatan tanıdık bir nesne var mı (Micro Machines’teki kalemtıraş gibi)? Yoksa "yok" yaz. |
| Arayüz ekranın ne kadarı | Kontroller ve göstergeler ekranın yüzde kaçını kaplıyor |

ÖZELLİKLE İSTEDİĞİM: FARKLI PİST TİPLERİ
Bir oyunda birden fazla pist teması varsa HEPSİNİ ayrı ayrı yaz. Asıl merak
ettiğim, aynı yatay-şerit formatının kaç farklı zeminde çözülebildiği.

KAPSAM
En az 12 oyun bul. Sadece büyük isimler değil, şuralara da bak:
- itch.io, Newgrounds, Poki, Y8, CrazyGames, Kongregate arşivleri
- Flash dönemi oyunları (2005-2015) — bu format o dönemde yaygındı
- Japon / Kore / Çin mobil oyunları
- Kripto / NFT yarış oyunları
- Yazarak yarışma oyunları (Nitro Type gibi)
- At, köpek, deve, salyangoz, kaplumbağa yarışı oyunları
- Bahis/simülasyon oyunlarının yarış ekranları
- Konsol/arcade klasikleri (Track & Field ekolü)

KESİNLİKLE YAPMA
- "Renkli ve eğlenceli görseller", "canlı grafikler", "şirin sanat tarzı" gibi
  genel sıfatlar yazma. Bunlar bin oyunu tarif eder, hiçbir işe yaramaz.
- Linki olmayan iddiada bulunma.
- Görmediğin bir oyunun görselini tarif etme. Ekran görüntüsüne
  ulaşamadıysan "görsel doğrulanamadı" yaz ve yine de listede tut.
- Oyunu formata uydurmak için zorlama. Emin değilsen "şüpheli" işaretle.

SONUÇ BÖLÜMÜ — tablodan sonra şunları yaz
1. Bu formatta en başarılı 3 oyun hangisi, ve başarılarının görsel sebebi ne?
2. 4 veya daha fazla şeridi aynı anda gösteren oyun bulabildin mi? Bulduysan
   yarışçıları ne kadar büyük? Bulamadıysan bunu AÇIKÇA yaz — yokluğu da bir
   bilgi.
3. Bu formatı deneyip görsel olarak başarısız olmuş örnekler var mı? Neden
   başarısız?
4. Şerit sayısı ile yarışçı boyutu arasında gözlemlediğin bir ilişki var mı?
5. Bu formatın en yaygın olduğu tür/dönem hangisi?

BAĞLAM — neyle karşılaştırdığımı bilmen için
Yaptığımız oyun: kurmalı teneke oyuncakların yarıştığı, mobil tarayıcıda
çalışan bir oyun. Şu an 4 yatay şerit, yandan bakış, soldan sağa. Yarışçılar
2D sprite. Sorun: yarışçılar ekranın ~%10'unu kaplıyor, şeritlerin geri kalanı
boş kalıyor ve pist bir şema gibi okunuyor. Şerit sayısını azaltmayı
tartışıyoruz. Bu araştırma o kararı verecek.
```

---

## Sonuç geldiğinde

Cevapları buraya ya da sohbete yapıştırın. Bakacağım şeyler:

- **Şerit sayısı / yarışçı boyutu ilişkisi** — hipotezim: az şerit = büyük
  yarışçı, ve başarılı örneklerin hepsi az şeritli. Araştırma bunu çürütürse
  4 şerit kalabilir.
- **4+ şeritli başarılı örnek var mı** — varsa nasıl çözmüşler, doğrudan
  kopyalanabilir.
- **Farklı pist tipleri** — bizim "hangi zemin" sorumuzun cevabı buradan çıkar.
