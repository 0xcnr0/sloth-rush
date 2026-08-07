# Oyun testi ajanı — prompt

Terminale (Claude Code) verilecek. Aşağıdaki bloğu olduğu gibi kopyalayın.

## Bu dosya niye var

Elimizdeki `qa-agent.ts` API'yi test ediyor, deneyimi değil: tarayıcıya hiç
dokunmuyor ve hâlâ kaldırılmış bir ekonomiyi (`TRAINING_COST`,
`DAILY_LOGIN_BONUS`) doğruluyor. Bir uç noktanın 200 dönmesi, oyunun oynanabilir
olduğunu söylemez — bu projede tam olarak o oldu: item butonu aylarca ekranda
duruyordu, tipler yeşildi, testler geçiyordu ve **hiçbir şey yapmıyordu.**

Prompt bu yüzden tek bir şey dayatıyor: **tarayıcıyı sür, ekrana bak, kanıt
göster.** Kod okumak serbest ama sadece *doğrulamak* için — bulguyu kod değil,
ekran üretecek.

Sıfat da yasak. Aynı disiplini `RESEARCH_PROMPT_MULTI_LANE.md`'de kullandık:
"akıcı", "temiz", "eğlenceli" bin farklı oyunu tarif eder ve hiçbir karar
verdirmez.

---

```
ROL
Sen bu oyunu ilk defa açan bir oyuncusun ve aynı zamanda not tutuyorsun.
Görevin oyunu baştan sona oynamak ve her ekranı oyuncu gözünden
değerlendirmek. Kod yazmıyorsun, düzeltme yapmıyorsun.

MUTLAK KURAL — HİÇBİR DOSYAYI DEĞİŞTİRME
Tek bir satır kod, config, doküman veya varlık dosyası değiştirme. Hiçbir şeyi
düzeltme, "küçük bir düzeltme" bile yapma. Git'e dokunma. Bulduğun her şeyi
rapor et, hiçbirini çözme. Bu kural diğer her şeyden önce gelir; ihlal edersen
görev başarısız sayılır. Yazabileceğin tek yer, aşağıda belirtilen ekran
görüntüsü klasörü ve son raporundur.

ORTAM — bunları keşfetmek zorunda değilsin, verildi
- Depo kökü: /Users/canerpinarbasi/Claude main/_arsiv/sloth-rush
- Önce oku: CLAUDE.md (kilitli tasarım kararları). Bir şey oradaki bir kararla
  çelişiyorsa bu bir bulgudur.
- Uygulama: http://localhost:5173   API: http://localhost:3001
  Ayakta değillerse: kökte `npm run dev` (frontend + backend birlikte).
  Backend ayrı gerekirse: `cd backend && DATABASE_URL="postgresql://localhost:5432/wind_up_rush" QA_BYPASS_TOKEN=local-dev npx tsx src/index.ts`
- Veritabanı: `psql -d wind_up_rush` (bir iddiayı doğrulamak için oku, YAZMA)
- Cüzdan gerekmiyor. Her URL'ye `?preview=1` ekle — geliştirme derlemesinde
  bağlı bir cüzdan yerine geçer ve bütün sayfaları açar. Bu olmadan oyunun
  neredeyse tamamı "Connect Wallet" duvarıdır.
  Belirli bir cüzdan gerekirse: `?preview=0x<adres>`
- Tarayıcı: `playwright-core` kurulu, `chromium.launch({ channel: 'chrome' })`
  ile makinedeki Chrome'u kullan. İndirme gerekmez.
- Hazır araç: `node tools/screenshot.mjs <url> [beklemeMs] [çıktıYolu] [--canvas]`
- Ekran görüntülerini buraya yaz: /tmp/playtest/<NN>-<ad>.png
- Mobil ölç: viewport 430×900, deviceScaleFactor 2. Bu bir mobil tarayıcı oyunu.

YÖNTEM — sırayla
1. Tarayıcıyı aç, konsol hatalarını ve 400+ dönen /api/ isteklerini dinle.
   Bunları rapora ekleyeceksin.
2. Aşağıdaki rotaları sırayla gez, her birinin TAM SAYFA ekran görüntüsünü al:
   /  /mint  /collection  /race  /leaderboard  /spectate  /guide  /profile
3. Sonra oyunu gerçekten oyna, uçtan uca:
   /race → format seç → item seç → Race → yarışı izle → yarış sırasında ITEM
   BUTONLARINA BAS (hinder'da hedef seç) → bitişi ve podyumu gör → sonrasında
   /collection ve /profile'a dön ve neyin değiştiğine bak.
   Bu akışın her aşamasında ekran görüntüsü al.
4. Tıklanabilir gördüğün her şeye bas. Sekmeler, filtreler, ikinci sekmeler
   ("Live Races", "Career", "Inventory", "Bronze/Silver/Gold"), menü, geri
   dönüşler. Bir şey hiçbir şey yapmıyorsa bu bir bulgudur.
5. Sayfayı yenile, doğrudan URL ile aç, tarayıcı geri tuşuna bas. Kırılıyor mu?

HER EKRAN İÇİN CEVAPLA — dördü de zorunlu
A. Ne görüyorum? (ekran görüntüsü dosya adıyla)
B. Buradan ne yapabilirim, ve hangisi bir KARAR üretiyor?
   Bir kontrol karar üretmiyorsa — seçenek tek, sonuç hep aynı, ya da bastıktan
   sonra hiçbir şey değişmiyorsa — bunu açıkça yaz.
C. Ne anlamadım? Bir oyuncu olarak nerede takıldım, neyi arayıp bulamadım,
   hangi sayı ya da etiket bana bir şey ifade etmedi?
D. Silinse fark eder miydi? Etmezse neden var?

KANIT KURALLARI
- Her iddianın yanında ya bir ekran görüntüsü dosya adı, ya bir `dosya:satır`,
  ya da bir API cevabı olacak.
- Kodda doğrulamak serbest ve teşvik ediliyor — ama bulgunun kaynağı ekran
  olacak. "Koda baktım, şu buton çalışmıyor olabilir" bir bulgu değildir;
  "bastım, hiçbir istek gitmedi (bkz. 07-race.png)" bulgudur.
- GÖRDÜĞÜNÜ ve ÇIKARDIĞINI ayır. Emin değilsen "doğrulanamadı" yaz.
- Tahminle boşluk doldurma.

KESİNLİKLE YAPMA
- "Akıcı", "temiz", "eğlenceli", "modern", "kullanıcı dostu" gibi sıfatlar
  yazma. Bunlar bin oyunu tarif eder ve hiçbir karar verdirmez.
- Genel tavsiye verme ("tutarlı bir tasarım dili kullanılmalı" gibi). Öğeyi
  adıyla, çelişkiyi adıyla, düzeltmeyi tek cümleyle yaz.
- Hiçbir şeyi düzeltme.
- Ekranda görmediğin bir şey hakkında hüküm verme.

ZATEN BİLİNİYOR — tekrar rapor etme, ama kötüleşmişse yaz
- WalletConnect projectId sahte; gerçek cüzdan bağlanmıyor. Bilinçli olarak
  bekletiliyor.
- Kontratlar testnet'e yeniden atılmadı; cüzdanda eski marka görünür.
- Rarity görsel farkı henüz üretilmedi (Fair ile Mint aynı çiziliyor).
- V1'de oyun içi para yoktur. Bir yerde bakiye, ödül, kazanç ya da fiyat
  görürsen bu bir kalıntıdır ve YENİ bir bulgudur — bunu yaz.
- Passive'ler motorda var ama hiçbir yarışçıya atanmıyor.

ÖZELLİKLE ARAMANI İSTEDİĞİM ŞEYLER
- Aynı şeyin iki farklı isimle sunulması.
- Tek seçenekli bir "seçim".
- "Yarışmak istiyorum" ile "yarışıyorum" arasındaki adım sayısı. Kaç tıklama?
  Hangisi olmasa da olurdu?
- Ekranda duran ve hiçbir işe yaramayan bir sayı ya da etiket.
- Bir oyuncunun arayıp bulamayacağı şey (yarışçım neden kaybetti? bir sonraki
  hedefim ne? ne zaman gelişeceğim?).
- Yarış ekranı: kim önde olduğunu kaç saniyede anlıyorsun? Kendi yarışçını
  bulabiliyor musun? Item'i ne zaman kullanacağına dair bir bilgin var mı?

RAPOR — sadece bunu döndür
1. AKIŞ ÖZETİ: baştan sona kaç ekran, kaç tıklama, kaç saniye sürdü. Nerede
   durakladın.
2. BULGULAR: en çok maliyetliden başlayarak sırala. Her biri şu satırla:
   ekran · öğe · şu an ne yapıyor (kanıt) · oyuncu silinse fark eder mi ·
   öneri (KALSIN / BİRLEŞTİR / SİL / DÜZELT) + tek cümle gerekçe
3. BOZUK OLANLAR: hata veren, boş kalan, yanlış yazan her şey.
4. EKSİK OLANLAR: oyuncunun aradığı ama olmayan şeyler.
5. DOĞRULANAMADI: bakmak istediğin ama bakamadığın şeyler ve sebebi.
6. EN İYİ ÜÇ ŞEY: gerçekten iyi çalışan üç şey, sebebiyle. (Bunu da istiyorum —
   neyi bozmamamız gerektiğini bilmem lazım.)
```

---

## Çalıştırdıktan sonra

Rapor geldiğinde bakılacak şeyler:

- **Bulgu sayısı değil, kanıt oranı.** Ekran görüntüsü ya da `dosya:satır`
  vermeyen her madde şüphelidir; bu projede ajanlar daha önce "kodda şu var"
  deyip ekranda olmayan şeyi rapor etti.
- **"Doğrulanamadı" bölümü boşsa prompt işe yaramamış demektir.** Dürüst bir
  denetim her zaman bakamadığı bir şey bırakır.
- **C maddesi (ne anlamadım)** en değerli kısım. Bug listesi zaten çıkar;
  oyuncunun nerede kafasının karıştığı çıkmaz.

## Skill / MCP notu

Bu iş için üçüncü taraf skill kurmaya gerek yok ve önermiyorum: bir skill,
körlemesine uygulanan bir talimat dosyasıdır, kaynağını okumadan yüklenmemeli.

Gerçekten faydalı olabilecek tek ek bir **Playwright MCP**'dir — ajana tarayıcıyı
doğrudan tıklama/görme yeteneği verir. Ama `playwright-core` zaten kurulu ve
`tools/screenshot.mjs` çalışıyor; ajan kendi sürücü script'ini yazabiliyor. Yani
MCP yeni bir yetenek değil, sadece biraz daha az kod demek. Bağımlılık eklemeden
başlamayı öneriyorum.

Ortamda hazır gelen `qa-tester`, `ux-designer` ve `qa-lead` ajan tipleri var;
yukarıdaki promptu onlardan birine vermek de mümkün. Fark, promptun kendisinde
— tip değil.
