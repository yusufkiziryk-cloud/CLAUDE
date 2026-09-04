> Kaynak: claude.ai projesi "657 ve AİLE HEKİMLİĞİ MAAŞ HESAPLAMA" — Project Knowledge dosyası `05_VERGI_SGK_KESINTI_MOTORU.md` (birleşik dosya DOSYA 6/18, 04.09.2026). İçerik aynen korunmuştur; birleşik orijinal: `KAMU_MAAS_HYP_PROJECT_KNOWLEDGE_BIRLESIK.md`.

# VERGİ, SGK, EMEKLİ KESENEĞİ VE KESİNTİ MOTORU

## 1. Gelir vergisi — 2026 regresyon verisi

2026 ücret gelirleri için tarife başlangıç referansı:

| Kümülatif matrah | Uygulama |
|---|---|
| 190.000 TL'ye kadar | %15 |
| 190.000–400.000 TL | ilk 190.000 için 28.500 TL + fazlası %20 |
| 400.000–1.500.000 TL (ücret) | ilk 400.000 için 70.500 TL + fazlası %27 |
| 1.500.000–5.300.000 TL (ücret) | ilk 1.500.000 için 367.500 TL + fazlası %35 |
| 5.300.000 TL üzeri (ücret) | ilk 5.300.000 için 1.697.500 TL + fazlası %40 |

Kaynak sınıfı: GİB / 332 Seri No.lu Gelir Vergisi Genel Tebliği. Her yıl ayrı `tax_schedule` oluştur.

## 2. Kümülatif matrah

Vergi motoru stateless olmamalı. Bir personelin takvim yılı içindeki önceki ücret vergi matrahı bordro girdisidir.

Zorunlu alanlar:

- `prior_cumulative_income_tax_base`
- `current_taxable_pay_items[]`
- `legal_deductions_before_tax[]`
- `exempt_pay_items[]`
- `minimum_wage_exemption_used_for_month`

Bir ayda birden fazla bordro/ek ödeme varsa istisna “iki kez” kullandırılmamalıdır.

## 3. Asgari ücret gelir vergisi istisnası

GVK 23/18 ve ilgili tebliğ uygulamasını ayrı fonksiyon yap. Maaşla aynı dönemde ücret sayılan prim, ikramiye, mesai, döner sermaye, ek ders vb. ödemeler varsa aynı aya ait istisna havuzunun bir kez kullanılması gerekir. Bordrolar ayrı çalıştırılsa bile aylık “exemption ledger” ortak olmalıdır.

## 4. Damga vergisi

Her ödeme kaleminde `stamp_tax_profile` kullan. Genel ücret/hizmet ödemeleri oranı dönemsel Damga Vergisi mevzuatından yüklenmeli; damgadan istisna edilen özel kalemler ayrıca işaretlenmelidir.

**375 KHK ek 40 ilave ödeme** için güncel resmi hüküm/özelge doğrulamasına göre gelir vergisi ve sigorta/prim istisnası ile yalnız damga vergisi etkisi ayrı profile konulmalıdır. Bu profil başka ek ödemelere kopyalanmamalıdır.

## 5. 5510 4/c — 2026 kontrol referansı

SGK resmi açıklamasından doğrulanan başlangıç referansları:

- MYÖ toplam %21 = kişi %9 + işveren %12
- GSS toplam %12,5 = kişi %5 + işveren %7,5
- Fiili hizmet süresi zammı olan işlerde ilave işveren oranı ayrıca uygulanabilir.

Prime esas kazanç unsurları personel rejimine göre kaynaklı listeyle oluşturulmalı; “tüm brüt maaş” otomatik PEK kabul edilmemelidir.

## 6. 5434 geçiş rejimi — kontrol referansı

SGK resmi açıklamasına göre çekirdek:

- şahıs emekli keseneği: %16
- kurum karşılığı: %20
- derece/kademe/ek gösterge/kıdem yükselişinde ilgili ilk ay için %100 artış farkı kuralları
- kurumca karşılanan GSS: ilgili resmi kurala göre

Emekli keseneğine esas aylık ile gelir vergisi matrahı aynı kavram değildir. Ayrı ledger tutulmalıdır.

## 7. Kesinti sırası

Kesintileri tek bir “toplam kesinti” içinde hesaplama. Minimum ledger:

```text
BRUT_HAKEDIS
- SGK/EMEKLI_KESENEGI_KISI
- GELIR_VERGISI
- DAMGA_VERGISI
- SENDIKA
- BES
- ICRA/NAFAKA
- KISI_BORCU/MAHSUP
+ vergiden bağımsız net düzeltmeler (varsa)
= NET_ODENECEK
```

Sıra yalnız görsel sunum değildir; bazı kalemlerin vergi matrahına etkisi nedeniyle hesap sırası kural motoruyla belirlenmelidir.

## 8. İcra/nafaka/BES/sendika

Bu modüller çekirdek maaş formülünden ayrılmalı. Her biri:

- yasal dayanak
- başlangıç/bitiş
- sabit/oransal tutar
- öncelik
- üst sınır
- haczedilemez kalem profilleri
- aynı ayda kalan bakiye

bilgisiyle çalışmalıdır. İcra kesintisi gibi yüksek riskli alanlarda hukuki kural tam doğrulanmadan otomatik karar üretme.
