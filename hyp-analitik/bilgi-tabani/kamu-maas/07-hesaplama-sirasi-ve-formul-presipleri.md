> Kaynak: claude.ai projesi "657 ve AİLE HEKİMLİĞİ MAAŞ HESAPLAMA" — Project Knowledge dosyası `07_HESAPLAMA_SIRASI_VE_FORMUL_PRESIPLERI.md` (birleşik dosya DOSYA 8/18, 04.09.2026). İçerik aynen korunmuştur; birleşik orijinal: `KAMU_MAAS_HYP_PROJECT_KNOWLEDGE_BIRLESIK.md`.

# HESAPLAMA SIRASI VE FORMÜL PRENSİPLERİ

## Çekirdek 657 kalemleri — kavramsal formüller

Resmi mevzuatla doğrulanmak şartıyla tipik yapı:

- `gosterge_ayligi = aylik_gosterge * aylik_katsayisi`
- `ek_gosterge_ayligi = ek_gosterge * aylik_katsayisi`
- `taban_ayligi = taban_aylik_gostergesi * taban_aylik_katsayisi`
- `kidem_ayligi = kidem_gostergesi * aylik_katsayisi`
- yan ödeme = ilgili puanların toplamı × yan ödeme katsayısı
- tazminat/ek ödeme = ilgili mevzuatın tanımladığı referans aylık/tutar × oran veya gösterge × katsayı

Bu formüller isim benzerliğinden türetilmemeli; her biri rule_id ile bağlı olmalı.

## Kıdem

Kıdem göstergesi ve hizmet yılı tavanı gibi detaylar 375 KHK/ilgili mevzuattan dönem bazlı doğrulanmalıdır. Hizmet yılı hesaplaması “bugün - işe giriş” şeklinde basitleştirilmemeli; sayılmayan/sayılan süre kuralları olabilir.

## Kıst maaş

Her kalem aynı şekilde kıstlanmaz. Pay item seviyesinde:

- `prorate_by_calendar_day`
- `prorate_by_payroll_day`
- `no_proration`
- `special_rule`

profili olmalı.

## Dönem ve 14 günlük fark

Kamu aylıklarının dönemsel peşin ödeme mantığı ve Ocak/Temmuz katsayı değişikliklerinde oluşan farklar için ayrı `pay_period` modeli kur. 14 günlük farkı mevcut aylığı “14/30 ile çarp” gibi evrensel formüle indirgeme; kalem bazlı ve KPHYS golden-master doğrulaması yap.

## Terfi

Derece/kademe veya ek göstergenin yürürlük tarihi bordro dönemini kesebilir. Fark motoru:

- eski parametre
- yeni parametre
- geçerlilik başlangıcı
- o dönemde fiilen ödenen
- hak edilen
- fark

üretir.

## Rounding

Her hesap nesnesi:

- raw Decimal
- legal rounding rule
- displayed amount

üçlüsünü saklasın. “Ekranda iki ondalık gösterildiği için hesapta da iki ondalık kullanma” hatası yapılmasın.

## Net ve işveren maliyeti

İki ayrı çıktı:

- `employee_net_pay`
- `employer_total_cost`

Kurum karşılığı/GSS/işveren primleri net maaş kesintisi değildir; işveren maliyetinde gösterilmelidir.
