> Kaynak: claude.ai projesi "657 ve AİLE HEKİMLİĞİ MAAŞ HESAPLAMA" — Project Knowledge dosyası `10_KVKK_GUVENLIK_DENETIM.md` (birleşik dosya DOSYA 11/18, 04.09.2026). İçerik aynen korunmuştur; birleşik orijinal: `KAMU_MAAS_HYP_PROJECT_KNOWLEDGE_BIRLESIK.md`.

# KVKK, GÜVENLİK VE DENETİM

Maaş/bordro sistemi yüksek hassasiyetli özlük ve mali veri işler. Varsayılan mimari “privacy by design” olmalıdır.

## Veri minimizasyonu

Hesap için T.C. no gerekmiyorsa saklama. `person_id` için kurum içi anonim UUID kullan.

## Varsayılan yasaklar

- kişisel veriyi dış AI API'sine gönderme
- gerçek bordroyu Git'e commit etme
- gerçek isim/T.C./IBAN'ı loglama
- açık metin parola
- public analytics/telemetry
- bulut OCR
- Excel makrosu çalıştırma
- yüklenen dosyadan kod çalıştırma

## Güvenli dosya işleme

- MIME/file signature kontrolü
- boyut sınırı
- zip bomb kontrolü
- path traversal engeli
- şifreli/bozuk dosyada kontrollü hata
- formula injection önlemi
- kaynak dosya read-only
- export'ta maskeleme

## Audit

Şunlar audit event olmalı:

- bordro hesaplama
- kural değişikliği
- mevzuat kaynağı değiştirme
- personel rejimi override
- vergi matrahı override
- kesinti ekleme/silme
- bordro export
- golden-master farkı kabul etme

Audit log ödeme tutarının kendisini içermek zorunda değildir; gerekirse hash/record id kullan.

## Rollere örnek

- Sistem yöneticisi
- Mevzuat yöneticisi
- Mutemet / bordro uzmanı
- Veri giriş
- Denetçi
- Salt okunur yönetici

Mevzuat kuralı değiştirme ile bordro hesaplama yetkisini mümkünse ayrıştır.
