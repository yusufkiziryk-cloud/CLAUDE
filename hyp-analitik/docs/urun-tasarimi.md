# HYP Analitik — Ticari Ürün Tasarımı

> Sürüm 1 · 04.09.2026 · Bu belge işin "neden, kime, nasıl para" tarafını
> tanımlar. Teknik kurallar için `bilgi-tabani/`, çalışma kuralları için
> `CLAUDE.md`.

## 1. Ürün ve değer önerisi

**HYP Analitik**, aile hekimliği birimlerinin (aile hekimi + aile sağlığı
çalışanı) HYP tarama-takip katsayısını resmî kurallarla hesaplayan, SİNA'dan
tek tıkla veri alan ve "bu ay hangi kriterde kaç işlem daha yapılırsa maaş ne
kadar artar" sorusuna cevap veren bir karar destek aracıdır.

Müşterinin ödediği para şunu satın alır:

| Değer | Nasıl sağlanıyor |
|---|---|
| **Doğruluk** | Kılavuz 14.04.2026 tabloları + Yönerge kuralları; 17 birim testi; tablo çarpım kontrolü (1,5 / 0,9 / 1,2) |
| **Zaman** | Chrome eklentisi SİNA Pozitif Performans ekranını okur; elle giriş kalkar |
| **Aksiyon** | "Öncelikli hamleler": aynı emekle en çok katsayı kazandıran kriterler, asgari/azami için kaç işlem kaldığı |
| **Ekip görünürlüğü** | Hekim–ASÇ %75 kuralı analizi, ASÇ maaş çarpanı, dönem trendi |
| **Güven** | Veri cihazda kalır; hasta verisi yok; çevrimdışı çalışır; "resmî hesap değildir" şeffaflığı |

## 2. Pazar ve rakipler

- Hedef kitle: Türkiye'de sözleşmeli aile hekimleri ve aile sağlığı
  çalışanları (on binlerce birim; her birimde en az 1 hekim + 1 ASÇ), ikinci
  halka ASM yönetimleri ve ilçe sağlık müdürlükleri (kurumsal plan).
- Rakipler ve konumları:
  - hyphesaplama.com.tr (Çamlıca), ahekplus.com, hyphesapla.com,
    drhesaplayici.com — web hesaplayıcılar; elle giriş.
  - "Aile Hekimi Asistanı" (Android, reklamlı, SİNA'yı WebView'de açıp okur).
  - "HYP & SINA Asistanı" (ücretsiz Chrome eklentisi, bireysel hekim; 423
    kullanıcı, Ağustos 2026).
- Konumlama: **doğruluk + otomasyon + aksiyon önerisi** üçlüsü; rakiplerin
  hiçbiri hem resmî tablo güncelliğini hem SİNA aktarımını hem de "kaç işlem
  daha" önerisini birlikte vermiyor. Ücretsiz rakiplere karşı satış argümanı:
  bir ay içinde kazandıracağı 0,01'lik katsayı farkı bile yıllık ücreti öder
  (örnek: brüt ödeme 150.000 ₺ ise 0,01 katsayı = 1.500 ₺/ay).

## 3. Gelir modeli (config/planlar.json)

| Plan | Ne satılıyor | Sınır | Öneri |
|---|---|---|---|
| DEMO | Deneme; 3 dönem, filigranlı çıktı, CSV yok | ücretsiz | Dönüşüm hunisinin girişi |
| OFFLINE_INDIVIDUAL | Tek dosya HTML + yıllık lisans anahtarı; internet gerekmez | yıllık | Kurumsal ağ kısıtı olan ASM'ler |
| SAAS_STANDARD | Barındırılan web sürümü, 3 cihaz | yıllık | Ana ürün |
| HYBRID_PRO | SaaS + çevrimdışı dosya, 5 cihaz | yıllık | Hekim + ASÇ birlikte kullanan birimler |
| INSTITUTIONAL | Çoklu birim/kullanıcı, 10 cihaz, toplu lisans | özel teklif | ASM / ilçe sağlık müdürlüğü |

Fiyatlandırma ilkesi: bireysel yıllık ücret, hedef kullanıcının **tek bir
0,01 katsayı iyileşmesinin bir aylık getirisinin altında** kalmalı; kurumsal
fiyat birim başına düşen bireysel ücretin yarısı civarında. Fiyatlar
`planlar.json`'da `null`; siz doldurduğunuzda site ve uygulama otomatik
gösterir.

## 4. Mimari

```
[Kullanıcı tarayıcısı]
  ├─ hyp-analitik.html  (tek dosya; motor + lisans doğrulama + UI; veri localStorage)
  ├─ eklenti/           (SİNA Pozitif Performans → JSON; panoya kopyalar)
  └─ lisans anahtarı    (satıcı özel anahtarıyla imzalı; uygulama açık anahtarla doğrular)

[Satıcı]
  ├─ tools/lisans/      (anahtar üretimi: anahtar-uret.js, lisans-uret.js)
  ├─ site/              (GitHub Pages: tanıtım, planlar, gizlilik)
  └─ Faz 2: küçük API   (hesap, ödeme webhook'u → otomatik lisans, cihaz sayacı)
```

- **Veri akışı:** SİNA → (kullanıcının oturumu, kullanıcının cihazı) →
  eklenti JSON → uygulama. Satıcı sunucusuna SİNA verisi hiç gitmez.
- **Motor tek kaynak:** `src/hyp-katsayi.js`; `node tools/derle.js` HTML'e
  gömer. Mevzuat değişince tablo + test + derleme.
- **Çevrimdışı plan** LifeTrack'teki şifreli tek dosya deneyiminin devamıdır;
  ileride dosya, lisans sahibinin adına AES ile mühürlenebilir.
- **Faz 2 backend** için Drive'daki "Finans Komuta Merkezi" iskeleti (FastAPI
  + JWT + Postgres + Docker + CI, 158 test) doğrudan şablon olarak kullanılır.

## 5. Hukuk ve uyum

- **KVKK:** uygulama kişi/hasta verisi işlemez; yalnızca ÇKYS birim kodu ve
  sayısal toplamlar. Yine de aydınlatma metni + çerez/depolama bildirimi
  sitede yayınlanır (`site/gizlilik.html`).
- **SİNA kullanım koşulları:** içerik izinsiz çoğaltılamaz, erişilen bilgi
  üçüncü kişilerle paylaşılamaz → okuma yalnızca kullanıcının cihazında,
  satıcıya veri aktarımı yok; bu ilke ürün sözünün parçasıdır.
- **Bakanlık ile ilişkisizlik:** her ekranda "resmî hesap değildir; Bakanlık
  sistemleri esastır" ibaresi. "HYP" bir Bakanlık program adıdır; ürün
  adında tanımlayıcı kullanım kabul edilebilir ama marka tescili için
  farklı bir ticari ad (ör. "KatsayıPro") düşünülmeli; logo/renkte Bakanlık
  kimliğine benzerlikten kaçınılır.
- **Ticari:** şahıs şirketi/e-fatura, mesafeli satış sözleşmesi, iade
  politikası (ör. 14 gün), ödeme aracı (iyzico, PayTR veya Shopier linki).
- **Lisans kırılabilirliği:** istemci tarafı doğrulama kırılabilir; bu pazar
  için kabul edilen risk. Caydırıcılar: lisansa ad/e-posta gömülü,
  çıktılarda lisans sahibi adı, yıllık yenileme.

## 6. Yol haritası

| Faz | Süre | İş | Çıktı |
|---|---|---|---|
| 0 (bu sürüm) | — | Motor v2, uygulama v2, eklenti, lisans altyapısı, site, belgeler | Depoda |
| 1 | 2–4 hafta | Eklentiyi gerçek SİNA'da doğrulama; 5–10 pilot kullanıcı; fiyat; ödeme linki; Web Store yayını; alan adı + GitHub Pages | İlk satış |
| 2 | 1–3 ay | Küçük API: hesap, ödeme webhook'u → otomatik lisans, cihaz sınırı; çoklu birim (kurumsal); Excel raporu; ay sonu "hedefe kalan" e-postası | SaaS |
| 3 | 3–6 ay | Mobil (Expo WebView, SİNA içinde okuma); Dr/ASÇ bordro modülü (Ödeme Yönetmeliği kaynağıyla); teşvik kuralı (kaynak gelince); il/ilçe kıyas | Platform |

## 7. Operasyon

- **Satış akışı:** site → ödeme → `lisans-uret.js` ile anahtar → e-posta/WhatsApp
  → kullanıcı "Lisans" düğmesinden yapıştırır. Faz 2'de otomatik.
- **Destek:** WhatsApp/e-posta; SSS sitede. En sık konu: SİNA arayüz
  değişikliğinde eklentinin okuyamaması → `SECICILER` güncellenir, sürüm çıkar.
- **Güncelleme:** mevzuat değişikliği → tablo/test/derleme → müşterilere
  yeni dosya (çevrimdışı) / otomatik (SaaS).
- **Ölçüm:** deneme→ücretli dönüşüm, yenileme oranı, eklenti aktif kullanıcı.

## 8. Riskler ve karşılıklar

| Risk | Karşılık |
|---|---|
| SİNA DOM değişimi | Seçiciler tek blokta; elle giriş her zaman açık; hızlı sürüm |
| Bakanlık resmî hesaplayıcı çıkarır | Değer aksiyon önerisi + ekip analizi + trendde; yalnız hesapta değil |
| Ücretsiz rakipler | Doğruluk kanıtı (testler, kaynak gösterimi) + zaman tasarrufu |
| Mevzuat değişimi | Tablolar veri olarak tutulur, günler içinde güncellenir |
| Marka/ad riski | "Bakanlık ile ilişkisi yoktur" ibaresi; tescil için ayrı ad |
