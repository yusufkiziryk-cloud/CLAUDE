# ASÇ Tarama ve Takip Katsayısı — Kural Seti

> **Güncelleme (04.09.2026):** HYP Tarama ve Takip Kılavuzu 14.04.2026, her iki
> ASÇ kriteri için asgari başarı oranını **%40** ve üst katsayıları
> **1,0611 / 1,1309** (çarpım 1,2000) olarak belirler. Aşağıdaki %50 ve
> 1,06 / 1,13 değerleri bu belgenin yazıldığı tarihe aittir; geçerli değerler
> ve motor sözleşmesi için `kriter-tablolari-resmi.md` esastır. Devir örnekleri
> ve maaş karşılaştırma açıklamaları geçerliliğini korur.

> Kaynak: 01.06.2025 tarihli **Aile Hekimliği Tarama ve Takip Katsayısına İlişkin
> Yönerge** esas alınarak hazırlanan "ASÇ HYP Katsayı Hesabı 01.06.2025" dokümanı
> (Drive: `HYP/ASÇ HYP Katsayı Hesabı 01.06.2025.pdf`). Nihai bilgi için Yönerge
> geçerlidir. Bu dosya `src/hyp-katsayi.js` motorunun davranış sözleşmesidir;
> ikisi birlikte güncellenir.

## 1. Kriterler ve katsayı bantları

Aile sağlığı çalışanı (ASÇ) **2 kriterden** sorumludur. Aylık hedefler SİNA
uygulamasından öğrenilir. Asgari başarı %50, azami başarı %90.

| Kriter | %50 altı | %50 | %50–90 arası | %90 ve üzeri |
|---|---|---|---|---|
| Vital Bulgular | 0,93 | 1,00 | 1,00 → 1,06 doğrusal | 1,06 |
| Çok Yönlü Yaşlı Sağlığı Değerlendirmesi (ÇYYSD) | 0,97 | 1,00 | 1,00 → 1,13 doğrusal | 1,13 |

**Tarama ve takip katsayısı = iki kriter katsayısının çarpımı.**

Kontrol değerleri (yönerge tablosundan):
- Vital %85 × ÇYYSD %55 → **1,07**
- Hiç HYP yapılmazsa → 0,93 × 0,97 = **0,9021** (maaş ~%10 düşer)
- Her ikisi ≥%90 → 1,06 × 1,13 = **1,1978** (ASÇ'nin ulaşabileceği azami ~1,2)

## 2. Devir (aktarım) kuralları — Yönerge md.7/10

- %100'ü aşan tarama/takip sayıları **en fazla 2 ay ileriye** devreder
  (yapıldığı ay esas alınır; 2 aydan eski fazlalar yanar).
- Devreden sayı, ilgili ay hedefinin **en az %10'u yapılmışsa** başarı oranına
  eklenir; %10 yapılmadıysa o ay devir kullanılmaz.
- Mevcut ayın yapılanı önce kendi hedefine sayılır; kalan açık en eski uygun
  devirden kapatılır. Hedefi aşan kısım devri **tüketmez**, eski fazla kendi
  yaşında beklemeye devam eder.
- **İstisna (md.7/10-b):** %10 şartı sağlanamadı ama devreden sayı o ay
  hedefinin %90'ından fazlaysa, yalnızca **devrin ilk ayında** kriter
  katsayısı 1 kabul edilir.

Yönergedeki 4 aylık örnek (motor testinde birebir doğrulanır):

| Ay | Hedef | Yapılan | Devir kullanımı | Sonuç |
|---|---|---|---|---|
| 1 | 15 | 50 | — | %100, 35 devreder |
| 2 | 20 | 5 | +15 (1. aydan) | %100, 20 kalır |
| 3 | 10 | 2 | +8 (1. aydan) | %100, 12 kalır |
| 4 | 10 | 5 | 0 (kalanlar 2 aydan eski) | %50 |

## 3. Katsayının 1 olduğu (kesinti yapılmayan) durumlar

- Kriterin **hedef nüfus listesi 0 kişi** ise o kriterin katsayısı 1.
- **Maaşa esas puanı 1000'in altında** olan birim ve ASÇ için katsayı 1
  (puan, Aile Hekimliği Sözleşme ve Ödeme Yönetmeliği md.18; bordroda görünür).
- **Yeni birim muafiyeti:** hizmete başlangıçtan 18. ayın sonuna kadar
  (6. ayın sonuna kadar 500 nüfus şartıyla) ilk 2000 puana kadar ödeme alan
  birimlerde katsayı 1.

## 4. Tavan (maksimum katsayı)

- Normal birim: katsayı **min(1,5; 4000 / kesin kayıtlı nüfus)** değerini geçemez.
- Entegre ve zorunlu düşük nüfus birimleri: **2400 / nüfus** oranını geçemez.
- Tutuklu-hükümlü kayıtlı sayısı **1700 üzeri → 1,176471**; **1500–1700 → 1,333334**.
- Pratik sonuçlar: nüfus < 2666 → hekim tam yaparsa 1,5; nüfus > 3333 →
  hekim tam yapsa bile katsayı 1,2'nin altında kalır ve ASÇ da bu tavana takılır.

## 5. ASÇ maaş çarpanı — hekim karşılaştırması

1. ASÇ katsayısı **1'in altındaysa** maaş doğrudan bu katsayıyla çarpılır (düşer).
2. **1 ve üzerindeyse** hekimin katsayısıyla karşılaştırılır:
   - ASÇ katsayısı, hekim katsayısının **%75'ine eşit/üzerindeyse** → **yüksek olan** geçerli.
   - %75'in altındaysa → ASÇ'nin **kendi katsayısı** geçerli.
3. Avantajdan yararlanmak için ASÇ'nin en az **1,0** katsayıya ulaşması gerekir;
   nüfus > 3000 ve hekim tam yapıyorsa 1,0 yeterlidir, nüfus < 2666'da eşik 1,125'tir.

## 6. Motorla ilişkisi

- Motor (`src/hyp-katsayi.js`) v2'den itibaren hem aile hekimliği birimi (18
  aktif kriter) hem ASÇ kriterlerini `kriter-tablolari-resmi.md`'deki resmî
  değerlerle hesaplar; bu belgedeki %50 eşiği ve 1,06 / 1,13 değerleri
  kullanılmaz.
- Bu belgenin kalıcı katkısı: devir zincirinin 4 aylık işleyiş örneği (motor
  testinde birebir doğrulanır) ve ASÇ–hekim maaş karşılaştırmasının sahadaki
  yorumu (nüfusa göre %75 eşiği tablosu).
- md.7/10-b istisnasındaki "devrin ilk ayı" yorumu: fazlası bir önceki ayda
  oluşmuş devir mevcutsa istisna uygulanır (motor yorumudur; tereddütte Yönerge
  metnine bakılır).
