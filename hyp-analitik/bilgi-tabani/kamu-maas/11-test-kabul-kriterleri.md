> Kaynak: claude.ai projesi "657 ve AİLE HEKİMLİĞİ MAAŞ HESAPLAMA" — Project Knowledge dosyası `11_TEST_KABUL_KRITERLERI.md` (birleşik dosya DOSYA 12/18, 04.09.2026). İçerik aynen korunmuştur; birleşik orijinal: `KAMU_MAAS_HYP_PROJECT_KNOWLEDGE_BIRLESIK.md`.

# TEST VE KABUL KRİTERLERİ

## A. Çekirdek hesap testleri

- Gösterge aylığı doğru mu?
- Ek gösterge doğru mu?
- Taban/kıdem doğru mu?
- Zam ve tazminat cetvelleri doğru rule version ile mi geliyor?
- 375 ek 9 / ek 40 doğru uygunluk ve vergi profiliyle mi çalışıyor?
- Aile/çocuk yardımında uygunluk tarihleri doğru mu?
- Makam/temsil/görev/yabancı dil uygunluğu doğru mu?

## B. Vergi testleri

- 2026 beş dilim geçiş sınırları
- bir dilimin tam sınırında kuruş farkı
- bir ay içinde iki farklı ücret ödemesi
- kümülatif matrah geçişi
- asgari ücret istisnasının ayda yalnız bir kez kullanılması
- engellilik indirimi varsa dönemsel tutar
- vergi dışı kalemin matraha girmemesi
- damga vergisi istisnalı/istisnasız kalem

## C. SGK/5434

- 5510 4/c kişi %9 MYÖ + %5 GSS testleri
- işveren %12 + %7,5 maliyet testi
- PEK'e giren/girmeyen kalem
- 5434 %16 kişi / %20 kurum
- derece/kademe artışında %100 artış farkı senaryosu
- sosyal güvenlik rejimi belirsizse hesap bloklanıyor mu?

## D. Dönem/fark

- Ocak katsayı değişikliği
- Temmuz katsayı değişikliği
- 14 günlük fark
- ay ortası göreve başlama/ayrılma
- terfi farkı
- ek gösterge farkı
- toplu sözleşme geriye dönük farkı

## E. Özel rejim

Her `FULL` veya `ADAPTER` rejim için en az:

- normal vaka
- minimum ödeme
- özel tazminat vaka
- vergi dilimi geçişi
- rejime özgü istisna
- yanlış rejim seçimi uyarısı

## F. Golden master

Kurumdan alınan tamamen anonimleştirilmiş KPHYS/e-Bordro örnekleriyle en az 50 vaka:

- 657 normal memur
- 657 farklı derece/kademe/ek gösterge
- 5434 ve 5510 ayrımı
- 4/B
- akademik
- sağlık
- fark bordrosu
- aile/çocuk
- vergi dilimi geçişi

Hedef: kuruş bazında eşleşme. Fark varsa neden kategorize edilmeden kabul yok.

## G. Güvenlik

- loglarda T.C./isim/IBAN yok
- dış ağ çağrısı yok (yerel mod)
- kaynak dosya değişmiyor
- formula injection engelli
- yetkisiz rule update engelli
- audit kaydı oluşuyor

## H. Kabul şartı

“Destekleniyor” etiketi ancak:

1. resmi mevzuat kaynak manifestosunda doğrulanmış,
2. formülleri test edilmiş,
3. en az bir golden-master vakası geçmiş,
4. açıklanabilirlik panelinde madde/dayanak gösterilmiş

ise verilir.
