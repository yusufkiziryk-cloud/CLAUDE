> Kaynak: claude.ai projesi "657 ve AİLE HEKİMLİĞİ MAAŞ HESAPLAMA" — Project Knowledge dosyası `14_HUKUKI_RISK_VE_SINIRLAR.md` (birleşik dosya DOSYA 14/18, 04.09.2026). İçerik aynen korunmuştur; birleşik orijinal: `KAMU_MAAS_HYP_PROJECT_KNOWLEDGE_BIRLESIK.md`.

# HUKUKİ RİSKLER, SINIRLAR VE FAIL-CLOSED KURALLARI

## 1. “Tüm memurlar” iddiası

Sistem tüm rejimler tamamlanmadan kendisini “Türkiye'deki bütün kamu görevlilerinin kesin maaşını hesaplar” diye sunmamalıdır. UI'da `SUPPORTED_REGIMES` ekranı olmalı.

## 2. Hukuki görüş değil hesaplama

Uygulama mevzuata dayalı hesaplama ve karar izi sunar. Yoruma açık uyuşmazlıklarda otomatik hukuki hüküm vermek yerine dayanakları ve ihtilafı gösterir.

## 3. Resmi bordro yerine geçme

Kurumun KPHYS/tahakkuk süreciyle doğrulanmamış sürümde çıktıda:

> “Bu hesaplama karar destek ve kontrol amaçlıdır; kurumun resmi bordro/tahakkuk kaydının yerine geçmez.”

uyarısı bulunmalıdır.

## 4. Yürürlük ve geriye yürüme

Yayım tarihi, yürürlük tarihi ve ödeme dönemi ayrı alanlardır. Mevzuat geriye yürürlük/geriye dönük fark öngörüyorsa açık rule gerekir.

## 5. Özel/genel hüküm

Bir ödeme hem 657/375 hem özel personel kanunuyla ilişkiliyse çifte ödeme veya yanlış dışlama riski vardır. Eligibility motoru “aynı hukuki amacı karşılayan ödeme” çakışmalarını kontrol etmelidir.

## 6. Vergi ve prim profili

Bir pay item'ın vergi/SGK niteliği başka bir pay item'a isim benzerliğiyle kopyalanamaz. İstisna hükmü açıkça kaynağa bağlanmalıdır.

## 7. Yuvarlama

KPHYS ile 0,01 TL fark bile çoklu personelde büyür. Yuvarlama kuralları testlenmeli ve hangi adımda yapıldığı açıklanmalıdır.

## 8. Kullanıcı override

Kural override “kolaylık” özelliği değil denetimli istisnadır. Kayıtsız manuel katsayı değişikliği yasak olmalıdır.

## 9. Fail closed

Aşağıdaki hallerde bordro sonucu kilitlenir:

- personel rejimi belirsiz
- sosyal güvenlik rejimi belirsiz ve sonucu etkiliyor
- dönem katsayısı bulunamadı
- vergi tarifesi bulunamadı
- gerekli cetvel/unvan eşlemesi bulunamadı
- iki aktif kural aynı koşulda çelişiyor
- rule source doğrulanmamış

Sistem tahmini sonuç verecekse “TAHMİNİ/SİMÜLASYON” olarak belirgin etiketlesin.
