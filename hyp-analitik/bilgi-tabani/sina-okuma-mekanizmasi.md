# SİNA'dan Veri Okuma Mekanizması — "HYP & SINA Asistanı" Eklenti Analizi

> Kaynak: Chrome Web Store'daki "HYP & SINA Asistanı" v1.3.2 (Uzm. Dr. Abdullah
> Altaş, 18.08.2026) paketinin kod incelemesi (30.08.2026). Eklenti açık kaynak
> DEĞİLDİR (GitHub deposunda yalnızca README + gizlilik politikası var, lisans
> yok). Buradaki bilgiler **hangi ekranın, hangi alanların nasıl okunduğunu**
> anlamak içindir; kod kopyalanmaz, kendi uygulamamız sıfırdan yazılır.

## 1. Mimari (bizim için de geçerli olan model)

- Manifest V3 Chrome eklentisi; izinler yalnızca `storage` + `scripting`,
  host izni yalnızca `hyp.saglik.gov.tr` ve `sina.saglik.gov.tr`.
- **API yok, sunucu yok, şifre saklanmaz.** Kullanıcı SİNA'ya kendisi giriş
  yapar (Ortak Giriş Noktası, 2FA); içerik betiği (content script) açık
  sayfadaki tabloyu DOM'dan okur. Veriler `chrome.storage.local`'de kalır.
- Aynı model "Aile Hekimi Asistanı" Android uygulamasında WebView ile kurulmuş.
  Sıradan bir web sayfası (bizim `hyp-analitik.html`) bunu **yapamaz**
  (same-origin engeli); eklenti ya da yerel uygulama şart.

## 2. SİNA'da okunan ekran ve alanlar

| Öğe | Değer |
|---|---|
| Vitrin | `https://sina.saglik.gov.tr/showcases` |
| Pozitif Performans **Hekim (AHB)** | vitrin `SC-DBBEMXEEDFCCEAB`, alt ekran `SCI-2N8Y5C2ADDC1FCD` |
| Pozitif Performans **ASÇ** | vitrin `SC-0320Z42B2FCOK70`, alt ekran `SCI-0N184E437ACA419` |
| Otizm (OSB) taraması | `SCI-4N2O921XV9IX02M` (dönem seçici farklı; veriler elle girilir) |
| Yıl / Ay filtreleri | `[data-sh-id="sh-Yıl-widgetSelectfilter"]`, `[data-sh-id="sh-Ay-widgetSelectfilter"]` (Vuetify `.v-field` + `.v-overlay__content .v-list-item`) |
| Hekim ekranı tanıma | `.v-toolbar-title` metni `Pozitif Performans Hekim Ekranı` |
| ASÇ ekranı tanıma | bir `span` metni `Gerçekleşme Tablosu ASÇ` |
| Tablo | `.ReactVirtualized__Grid.ReactVirtualized__List` → `.ReactVirtualized__Grid__innerScrollContainer` içindeki `tr` satırları |
| Satır sayısı | sayfadaki "N satır" / "of N rows" metni |

**Satır sütun sırası (hem hekim hem ASÇ):**
`[0] Birim (ÇKYS)`, `[1] Takip parametresi`, `[2] GEREKEN`, `[3] YAPILAN`,
`[4] DEVREDEN`. Hekim satırlarında ≥ 8 sütun bulunur; ASÇ satırlarında
"TEKİL" içeren parametreler atlanır.

**Kritik bilgi:** SİNA, **devreden sayıyı hazır veriyor**. Aylık devir
zincirini tekrar hesaplamak yalnızca simülasyon/gelecek ay tahmini için
gerekir; gerçekleşen ay için SİNA'nın DEVREDEN sütunu esas alınmalıdır.

## 3. Okuma akışı

1. Sayfa yüklenince (`document_idle`) her 1 sn'de ekran kontrolü; uygun
   ekranda tabloya "HYP Katsayı Hesapla" düğmesi enjekte edilir.
2. Tablo **sanallaştırılmış** (ReactVirtualized): tüm satırlar DOM'da değildir.
   Eklenti önce sayfa `zoom`'unu küçültüp satırların hepsini görünür kılmayı
   dener; olmazsa 300 px adımlarla kaydırıp `tr`'leri `transform: translateY`
   değerine göre biriktirir (10 sn zaman sınırı, 3 deneme).
3. Satırlar birim (ÇKYS) koduna göre gruplanır; birden çok birim varsa seçim
   ekranı açılır.
4. Parametre adı Türkçe-normalize edilerek (İ/ı/ş/ğ/ü/ö/ç → ascii, küçük harf)
   kanonik listeye eşlenir: tam eşleşme → alias tablosu → kısmi eşleşme.
5. Sonuç `chrome.storage.local` anahtarlarına yazılır (`hyp_katsayi_hekim`,
   `hyp_katsayi_asc`); analiz sayfası ve HYP portal betiği buradan okur.
6. HYP portalında (`hyp.saglik.gov.tr`) ayrıca **yalnızca "yapılan"** sayıları
   `.performance-statistics-value` kutularından canlı çekilir; gereken ve
   devreden SİNA'dan gelir. Kanser taramaları HYP'den çekilemez.

## 4. Eklentideki katsayı tabloları (Yönerge ile doğrulanacak)

Hesap formülü bizimkiyle aynı: oran < minP → minK; oran ≥ maxP → maxK; arada
doğrusal. Devir dahil etme şartı: `devreden > 0 && yapılan ≥ gereken × 0,10`
→ oran = (yapılan + devreden) / gereken.

**Doğrulama bulgusu:** hekim tablosundaki 18 kriterin maxK çarpımı **tam
1,500000**, minK çarpımı **tam 0,900000** (Yönerge tavanı 1,5 ve %10 kesinti
tasarımıyla birebir). Bu, değerlerin resmî tablodan hassas aktarıldığını
gösterir; yine de birincil kaynak Yönerge'dir.

### 4a. ASÇ

| Kriter | minP | maxP | minK | maxK |
|---|---|---|---|---|
| VİTAL BULGU ASÇ | **40** (?) | 90 | 0,930000 | **1,061100** |
| YAŞLI SAĞLIĞI İZLEMİ ASÇ | 50 | 90 | 0,970000 | **1,130900** |

- 1,0611 × 1,1309 = **1,2000** → ASÇ azami katsayısı tam 1,2. Bizim
  belgemizdeki 1,06 / 1,13 yuvarlanmış değerlerdir (çarpım 1,1978).
  **Motor güncellemesi adayı** (Yönerge teyidi sonrası).
- **Çelişki:** Vital Bulgular alt eşiği eklentide %40, `ASÇ HYP Katsayı
  Hesabı 01.06.2025` belgesinde %50 (tablo 45% → 0,930, 50% → 1,000). Hangisi
  doğruysa motor ona göre kalır/değişir. **Yönerge metniyle çözülecek.**

### 4b. Hekim (18 kriter)

| Kriter | minP | maxP | minK | maxK |
|---|---|---|---|---|
| Hipertansiyon taraması | 40 | 90 | 0,993999 | 1,023440 |
| Hipertansiyon izlem | 50 | 90 | 0,996994 | 1,011652 |
| Diyabet taraması | 40 | 90 | 0,993999 | 1,023440 |
| Diyabet izlemi | 50 | 90 | 0,996994 | 1,011652 |
| Obezite taraması | 40 | 90 | 0,996994 | 1,011652 |
| Obezite izlemi | 50 | 90 | 0,993997 | 1,023440 |
| KVR taraması | 40 | 90 | 0,993999 | 1,023440 |
| KVR izlemi | 50 | 90 | 0,996994 | 1,011652 |
| Yaşlı sağlığı izlemi | 50 | 90 | 0,993997 | 1,023440 |
| Koroner arter izlemi | 40 | 85 | 0,993997 | 1,023440 |
| İnme izlemi | 40 | 85 | 0,993997 | 1,023440 |
| Kronik böbrek izlemi | 40 | 85 | 0,993997 | 1,023440 |
| KOAH izlemi | 40 | 85 | 0,993997 | 1,023440 |
| Astım izlemi | 40 | 85 | 0,993997 | 1,023440 |
| Otizm (OSB) tarama | 40 | 90 | 0,993997 | 1,023440 |
| Kanser serviks taraması | 50 | 90 | 0,991010 | 1,035365 |
| Kanser kolorektal taraması | 50 | 90 | 0,991010 | 1,035365 |
| Kanser mamografi taraması | 40 | 90 | 0,991010 | 1,035365 |

HYP portal başlığı → kanonik ad eşlemesi (örn. "KARDİYOVASKÜLER RİSK TARAMA"
→ KVR TARAMASI, "OSB TARAMA" → OTİZM TARAMA, "OBEZİTE İZLEM (AİLE HEKİMİ)" →
OBEZİTE İZLEMİ) eklentinin `HYP_MAPPING` tablosundadır.

### 4c. Diğer kurallar (eklentideki uygulama)

- **Tavan:** normal → 4000/nüfus, düşük nüfus ve entegre → 2400/nüfus;
  `max(1; min(1,5; ·))` (eklenti 1'in altına indirmez); "0 Nüfus" → 1.
  Tutuklu-hükümlü tavanı yok (HSGM sayfasına yönlendiriyor).
- **ASÇ–hekim karşılaştırması:** ASÇ < 1 → kendi; ASÇ ≥ hekim → kendi; hekim
  > ASÇ ve ASÇ ≥ %75·hekim → hekimin katsayısı; ek uyarı: hekim ASÇ×4/3'ü
  aşarsa %75 şartı bozulur. Bizim `maasCarpani` ile uyumlu.
- **Teşvik (kronik hastalık tarama oranı):** HT + DM + Obezite + KVR
  taramalarında Σmin(gereken, yapılan+devreden) / Σgereken; eşikler **%40** ve
  **%70**. Bizim bilgi tabanında henüz yok — kaynak belge gerekli.

## 5. HYP Analitik için çıkarımlar

1. **İçe aktarma biçimi** `{parametre, gereken, yapilan, devreden}` olmalı;
   SİNA'nın devreden değeri varsa motorun devir zinciri yerine o kullanılır.
2. **Yol haritası:** (a) yapıştır/CSV içe aktarma (hemen, bağımlılıksız);
   (b) kendi Chrome eklentimiz: aynı seçicilerle Pozitif Performans tablosunu
   okuyup JSON'u HYP Analitik'e aktarır; (c) mobil WebView sürümü.
3. **Seçiciler kırılgandır:** SİNA'nın Vuetify/ReactVirtualized yapısı
   değiştiğinde okuma bozulur; eklenti bu yüzden zaman aşımı, yeniden deneme
   ve elle satır sayısı girişi içeriyor. Biz de "okunamadı → elle gir"
   geri dönüşünü baştan tasarlamalıyız.
4. **Uygunluk:** veri yalnızca kullanıcının cihazında işlenir; SİNA verisi
   sunucuya alınmaz (SİNA kullanım metni: içerik izinsiz kopyalanamaz,
   üçüncü kişilerle paylaşılamaz).
5. **Motor için bekleyen kararlar:** Vital alt eşiği (%40/%50), ASÇ üst
   katsayıları (1,0611/1,1309), hekim 18 kriter tablosu, teşvik eşikleri —
   hepsi Yönerge PDF'i (hsgm.saglik.gov.tr, bu ortamdan erişilemedi) ile
   doğrulandıktan sonra kodlanır.
