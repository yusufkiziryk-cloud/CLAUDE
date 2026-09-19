> Kaynak: claude.ai projesi "657 ve AİLE HEKİMLİĞİ MAAŞ HESAPLAMA" — Project Knowledge dosyası `06_KURAL_MOTORU_SURUMLEME.md` (birleşik dosya DOSYA 7/18, 04.09.2026). İçerik aynen korunmuştur; birleşik orijinal: `KAMU_MAAS_HYP_PROJECT_KNOWLEDGE_BIRLESIK.md`.

# KURAL MOTORU, SÜRÜMLEME VE KAYNAK İZİ

## Temel prensip

Maaş hesaplaması “formül koleksiyonu” değil, **zaman boyutlu hukuk kuralları grafiği** olmalıdır.

## Rule schema

Her kural en az:

```yaml
rule_id: TAX_2026_WAGE_TARIFF
version: 1
status: VERIFIED
effective_from: 2026-01-01
effective_to: 2026-12-31
jurisdiction: TR
applies_to:
  employment_regimes: ['*']
  social_security_regimes: ['*']
  institutions: ['*']
  service_branches: ['*']
condition: null
formula: null
parameters: {}
source:
  authority: GELIR_IDARESI_BASKANLIGI
  document_name: 332 Seri No.lu Gelir Vergisi Genel Tebliği
  rg_date: null
  rg_no: null
  article: null
  official_url: null
  sha256: null
verified_at: 2026-08-27
notes: null
```

## Status

- `VERIFIED`: resmi kaynak + madde + dönem doğrulandı
- `PROVISIONAL`: resmi kaynak görüldü ama formül/istisna tam ayrıştırılmadı
- `CONFLICT`: iki kaynak arasında yorum/versiyon farkı var
- `RESEARCH_REQUIRED`: mevzuat eksik
- `RETIRED`: artık yürürlükte değil, tarihsel bordro için saklanıyor

`PROVISIONAL/CONFLICT/RESEARCH_REQUIRED` kural üretim bordrosunda sessiz kullanılamaz.

## Source manifest

`rules/source_manifest.json`:

- source_id
- authority
- title
- document_type
- law_number
- rg_date
- rg_no
- effective_from
- effective_to
- source_url
- local_file
- sha256
- retrieved_at
- supersedes
- superseded_by
- notes

## Dönem seçimi

`calculation_date` → kural versiyonunu seçer. “Sistemdeki en yeni rule dosyası” seçilmez.

## Mevzuat güncellemesi

Yeni belge geldiğinde:

1. SHA-256 hesapla.
2. Önceki kaynakla diff çıkar.
3. Değişen madde/bentleri belirle.
4. Etkilenen rule_id'leri listele.
5. Etkilenen personel rejimlerini çıkar.
6. Yürürlük tarihini belirle.
7. Eski kuralı silme; `effective_to` ver.
8. Yeni kuralı yeni version ile ekle.
9. Regresyon testlerini iki dönem için çalıştır.
10. `MEVZUAT_DEGISIKLIK_ETKI_RAPORU.md` üret.

## Çakışma örnekleri

- Toplu sözleşme ile genel kanun uygulaması arasında ek mali hak
- özel personel kanununun 657'ye göre farklı hükmü
- HMB genelgesindeki katsayı değişimi
- vergi tebliğinin yıl değişimi
- SGK geçiş rejimi ile 5510 yeni rejim matrah farklılığı

Çakışma çözümünün gerekçesi kayıt altına alınmalı; kullanıcıya yalnız sonuç gösterilmemeli.
