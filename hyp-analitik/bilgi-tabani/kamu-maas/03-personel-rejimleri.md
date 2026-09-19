> Kaynak: claude.ai projesi "657 ve AİLE HEKİMLİĞİ MAAŞ HESAPLAMA" — Project Knowledge dosyası `03_PERSONEL_REJIMLERI.md` (birleşik dosya DOSYA 4/18, 04.09.2026). İçerik aynen korunmuştur; birleşik orijinal: `KAMU_MAAS_HYP_PROJECT_KNOWLEDGE_BIRLESIK.md`.

# PERSONEL REJİMLERİ VE ROUTING TASARIMI

## Neden gerekli?

Aynı “memur” kelimesi altında farklı ödeme algoritmaları vardır. Hesap motoru önce personele uygulanacak hukuki rejimi çözmeli, sonra genel ve özel kuralları birleştirmelidir.

## Ana routing alanları

```yaml
person:
  employment_regime: DMK_657
  social_security_regime: AUTO_REVIEW
  institution_type: MINISTRY
  institution_code: null
  service_branch: HEALTH_AND_SOCIAL_SERVICES
  title_code: null
  service_class: HEALTH_SERVICES
  degree: null
  step: null
  additional_indicator: null
  public_service_first_start_date: null
  current_position_start_date: null
  calculation_date: null
```

## Minimum rejim matrisi

| Kod | Hukuki temel | İlk sürüm hedefi |
|---|---|---|
| DMK_657 | 657 + 375 + 2006/10344 + toplu sözleşme | FULL |
| CONTRACT_657_4B | 657/4-B + Sözleşmeli Personel Esasları + 375/toplu sözleşme | FULL |
| ACADEMIC_2914 | 2914 + 2547 + 375 | FULL/PARTIAL, kalem bazlı |
| JUDICIARY_2802 | 2802 + 375 | ADAPTER |
| TSK_926 | 926 + 375 | ADAPTER |
| KHK_399 | 399 KHK | ADAPTER |
| HEALTH_CONTRACT_4924 | 4924 + sağlık özel mevzuatı | ADAPTER |
| FAMILY_MEDICINE_5258 | 5258 + ödeme yönetmeliği + HYP vb. | ADAPTER |
| MUNICIPAL_CONTRACT | 5393/49 + HMB genelgeleri | ADAPTER |

## Kural birleştirme sırası

1. `GENERAL_PUBLIC_OFFICIAL`
2. seçili dönem katsayıları
3. sosyal güvenlik rejimi
4. istihdam rejimi
5. kurum türü
6. hizmet sınıfı
7. ünvan
8. hizmet kolu toplu sözleşme hükümleri
9. kurum/yer özel hükümleri
10. kişiye bağlı haklar/istisnalar

Çakışmada otomatik son-yazan-kazan yaklaşımı kullanma; her override için `legal_priority` ve `reason` zorunlu olsun.

## Sosyal güvenlik rejimi ayrı tutulmalı

`employment_regime=DMK_657` olması kişinin 5434 veya 5510-4/c olduğunu tek başına belirlemez. İlk kamu hizmet tarihi ve geçmiş 5434 iştirakçiliği gibi bilgiye göre `social_security_regime` çözülür.

Önerilen kodlar:

- `PENSION_5434_TRANSITION`
- `SGK_5510_4C`
- `SPECIAL_REVIEW_REQUIRED`

## Unvan kataloğu

Unvanı serbest metinle doğrudan formüle bağlama. Merkezi `title_catalog` kur:

- canonical title
- kurum
- sınıf
- derece aralığı
- ek gösterge cetveli referansı
- özel hizmet tazminatı grubu
- ek ödeme grubu
- makam/görev/temsil uygunluğu
- toplu sözleşme özel hakları
- özel kanun adapter'ı

Benzer unvan adları “fuzzy match” ile otomatik kesinleştirilmesin; düşük güven durumunda kullanıcı onayı alınsın.
