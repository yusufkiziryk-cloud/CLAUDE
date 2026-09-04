> Kaynak: claude.ai projesi "657 ve AİLE HEKİMLİĞİ MAAŞ HESAPLAMA" — Project Knowledge dosyası `17_2026_GUNCEL_KONTROL_PARAMETRELERI.md` (birleşik dosya DOSYA 16/18, 04.09.2026). İçerik aynen korunmuştur; birleşik orijinal: `KAMU_MAAS_HYP_PROJECT_KNOWLEDGE_BIRLESIK.md`.

# 2026 GÜNCEL KONTROL PARAMETRELERİ

**Doğrulama tarihi:** 27.08.2026

Bu dosya üretim koduna doğrudan kopyalanacak “hard-code tablosu” değildir. Claude Code, resmi kaynak dosyasını indirip/okuyup değerleri yeniden doğrulamalı ve hash'lemelidir.

## 1. HMB mali ve sosyal hak katsayıları

### 01.01.2026–30.06.2026
- aylık katsayısı: `1.387871`
- taban aylık katsayısı: `22.722793`
- yan ödeme katsayısı: `0.440141`

Resmi duyuru: https://www.hmb.gov.tr/duyuru/2026-yili-ocak-ayina-ait-mali-ve-sosyal-haklara-iliskin-genelge

### 01.07.2026–31.12.2026
- aylık katsayısı: `1.575512`
- taban aylık katsayısı: `25.794915`
- yan ödeme katsayısı: `0.499649`
- 399 KHK kapsamındaki sözleşmeli personel ücret tavanı: `86.231,60 TL`
- 7/15754 sayılı Karar kapsamındaki sözleşmeli personel ücret tavanı: `76.873,55 TL`

Resmi PDF: https://ms.hmb.gov.tr/uploads/2026/07/2026-Yili-Temmuz-Ayina-Ait-Mali-ve-Sosyal-Haklara-Iliskin-Genelge-9b5304ed658d77cb.pdf

## 2. 2026 ücret gelir vergisi tarifesi

GİB / 332 Seri No.lu Gelir Vergisi Genel Tebliği kontrol verisi:

- 190.000 TL'ye kadar `%15`
- 400.000 TL'nin 190.000 TL'si için 28.500 TL, fazlası `%20`
- ücret gelirlerinde 1.500.000 TL'nin 400.000 TL'si için 70.500 TL, fazlası `%27`
- ücret gelirlerinde 5.300.000 TL'nin 1.500.000 TL'si için 367.500 TL, fazlası `%35`
- ücret gelirlerinde 5.300.000 TL üzeri: ilk 5.300.000 TL için 1.697.500 TL, fazlası `%40`

Resmi tarife PDF: https://cdn.gib.gov.tr/api/gibportal-file/file/getFileResources?objectKey=arsiv%2Fyardim-kaynaklar%2Fyararli-bilgiler%2Fgelir-vergisi-tarifeleri%2Fgelir-vergisi-tarifesi-2026.pdf

## 3. Asgari ücret istisnası

GVK 23/18 uyarınca ücret gelirindeki istisna ay bazında uygulanır. Aynı dönemde maaş, prim, ikramiye, mesai, döner sermaye, ek ders gibi ücret sayılan birden fazla ödeme varsa istisna toplam ücret ödemeleri üzerinden **bir kez** kullanılmalıdır. Çoklu bordrolar için ortak aylık `minimum_wage_exemption_ledger` zorunludur.

GİB 2026 Ücret Geliri Rehberi: https://intvrg.gib.gov.tr/hazirbeyan/assets/pdf/DUYURU_UNIVERSAL_2026_2026_Ucret_Geliri.pdf

## 4. 5510 4/c kontrol oranları

İlk defa 5510/4-c kapsamında kamu görevlisi olanlarda SGK'nın resmi açıklamasındaki kontrol oranları:

- MYÖ: kişi `%9`, işveren `%12`
- GSS: kişi `%5`, işveren `%7,5`
- FHSZ uygulanıyorsa ilave işveren primi ayrı kuraldır.

Resmi SGK: https://www.sgk.gov.tr/Content/Post/51eb246d-88b5-4356-ba97-3af847ec4ded/4c-Kapsamindaki-Sigortalilarin-Prim-ve-Prime-Iliskin-Islemleri-2026-01-12-12-07-35

## 5. 5434 geçiş rejimi kontrol oranları

SGK resmi açıklaması kontrol referansı:

- şahıs keseneği `%16`
- kurum karşılığı `%20`
- artış farkı kuralı `%100` — ilgili yükselme durumlarında
- GSS kurum payı SGK'nın geçerli kuralına göre

5510'un yürürlüğe girmesinden önce iştirakçi olanların geçiş hükümleri ile ilk defa sonrasında kamu görevlisi olanların 5510/4-c rejimi ayrı çalıştırılmalıdır.

Resmi SGK ayrım açıklaması: https://www.sgk.gov.tr/Content/Post/52a2428a-9603-4aa1-bbeb-7746432953b6/5434-sayili-Kanun-ile-5510-sayili-Kanun-2022-08-18-11-26-15

## 6. 375 KHK ek 40 ilave ödeme

Kontrol kuralı: ek 40 kapsamındaki kamu görevlilerine `15.965 × memur aylık katsayısı` üzerinden ilave ödeme öngörülmektedir. Bu ödeme için vergi/prim istisna profili özel hükümle belirlenmiştir; başka pay item'lara genellenmemelidir.

GİB resmi özelge/mevzuat açıklaması: https://gib.gov.tr/mevzuat/kanun/438/ozelge/38831

## 7. 2026–2027 toplu sözleşme/hakem kurulu

ÇSGB resmi mevzuat sayfasında:
- 2025/1 sayılı Kamu Görevlileri Hakem Kurulu Kararı
- 2026–2027 8. Dönem hizmet kollarına yönelik toplu sözleşme metinleri

ayrı ayrı kaynak olarak tutulmalıdır.

Resmi sayfa: https://www.csgb.gov.tr/cgm/mevzuat/

## 8. Uyarı

Bu parametrelerden hiçbiri `constants.py` içine kalıcı gömülmemelidir. `effective_from/effective_to/source_hash` ile rule data olarak tutulmalıdır.
