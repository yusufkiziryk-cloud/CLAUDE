> Kaynak: claude.ai projesi "657 ve AİLE HEKİMLİĞİ MAAŞ HESAPLAMA" — Project
> Knowledge dosyası `04_MAAS_ODEME_KALEMLERI.md`. Kullanıcı tarafından
> 04.09.2026'da mesaj olarak aktarıldı; içerik aynen korunmuştur. Mesaj
> "effective_to: null" satırında bittiğinden dosyanın sonu eksik olabilir.

# MAAŞ / BORDRO ÖDEME KALEMLERİ KATALOĞU

Bu liste, veritabanında "pay item catalog" olarak modellenmelidir. Her kalemin vergi/prim/damga durumu **adıyla tahmin edilmemeli**, kaynaklı `tax_profile` üzerinden belirlenmelidir.

## 1. 657/375 çekirdek aylık kalemleri

- Gösterge aylığı
- Ek gösterge aylığı
- Taban aylığı
- Kıdem aylığı
- İş güçlüğü zammı
- İş riski zammı
- Temininde güçlük zammı
- Mali sorumluluk zammı
- Özel hizmet tazminatı
- Eğitim-öğretim hizmetleri tazminatı / rejimin öngördüğü diğer tazminat türleri
- Din hizmetleri tazminatı
- Emniyet hizmetleri tazminatı
- Mülki idare amirliği özel hizmet/tazminat unsurları
- Denetim/adalet vb. 657 m.152 cetvellerinden doğan tazminat alt türleri
- Makam tazminatı
- Temsil tazminatı
- Görev tazminatı
- Yabancı dil tazminatı
- 375 KHK ek 9 kapsamındaki ek ödeme
- 375 KHK ek 40 ilave ödeme

## 2. Aile ve sosyal nitelikli haklar

- Eş için aile yardımı
- Çocuk yardımı
- Engelli çocuk yönünden artırımlı hak varsa dönemsel toplu sözleşme/kural
- Doğum yardımı — maaş çekirdeğinden ayrı sosyal ödeme olarak etiketlenebilir
- Ölüm yardımı
- Giyecek yardımı
- Yiyecek yardımı / yemek katkısı
- Öğretim yılına hazırlık ödeneği
- Toplu sözleşme ikramiyesi / kamu görevlilerine ilişkin sendikal mali haklar — dönem ve üyelik şartlı
- Yerel yönetim sosyal denge tazminatı

## 3. Görev ve çalışma kaynaklı ek hakedişler

- Vekalet aylığı
- İkinci görev aylığı
- Fazla çalışma ücreti
- Ek ders ücreti
- Nöbet ücreti
- İcap nöbeti / branş-özel nöbet çeşitleri
- Ödül
- İkramiye
- Tazminat farkları
- Yurt dışı/dil/yer özel tazminatlar — ilgili özel mevzuatla

## 4. Akademik personel modülü

- Üniversite ödeneği
- Yükseköğretim tazminatı
- Akademik teşvik ödeneği
- Geliştirme ödeneği
- İdari görev ödeneği
- Eğitim-öğretim ödeneği
- Ek ders
- 2547/58 döner sermaye ek ödemeleri
- 375 genel kalemleri — kapsama göre

## 5. Sağlık modülü

- 375 KHK sabit/ek ödeme ilişkili kalemler — güncel mevzuatla isimlendirilerek
- Sağlık Bakanlığı Ek Ödeme Yönetmeliğine göre ek ödeme
- Teşvik/performans ek ödeme bileşenleri
- Nöbet/icap
- 4924 sözleşme ücreti ve ilgili ek unsurlar
- 5258 aile hekimliği ödeme bileşenleri
- Aile sağlığı çalışanı ödeme bileşenleri
- HYP katsayısına bağlı ödeme kalemleri — ayrı alt motor
- Döner sermaye / 209 ilişkili kalemler

## 6. 4/B sözleşmeli modül

- Brüt sözleşme ücreti
- Ek ödeme
- Aile/çocuk yardımı veya toplu sözleşme kaynaklı karşılıklar — dönemsel kapsam doğrulanarak
- Kurum/pozisyon özel ücret unsurları
- Fazla çalışma/nöbet vb. sadece açık yasal dayanak varsa

## 7. Özel rejim modülleri

### 2802
- Yüksek yargı/hakim-savcı mali hakları
- ilgili tazminat ve ek ödeme kalemleri

### 926 / askeri personel
- rütbe/gösterge bazlı aylıklar
- hizmet tazminatları
- operasyon/görev/özel görev kalemleri — yalnız resmi kaynakla

### 399 KHK
- sözleşme ücreti / temel ücret
- başarı/ikramiye ve KİT'e özgü kalemler — cetvel/kurum verileriyle

## 8. Fark ve düzeltme kalemleri

- 14 günlük katsayı farkı
- terfi farkı
- ek gösterge farkı
- ünvan/görev değişikliği farkı
- toplu sözleşme geriye dönük farkı
- eksik ödeme tamamlama
- fazla/yersiz ödeme mahsup/kişi borcu

## 9. Kesintiler

### Kanuni
- Gelir vergisi
- Damga vergisi
- 5510 4/c sigortalı payları
- 5434 emekli keseneği
- 5434 %100 artış farkı — oluştuğu durumda

### Şarta bağlı
- Sendika aidatı
- BES otomatik katılım kesintisi
- İcra/haciz kesintisi
- Nafaka
- Kefalet aidatı
- OYAK / İLKSAN veya özel kanunla kurulmuş sandık kesintileri — yalnız ilgili personelde
- Kişi borcu
- Kurum alacağı / yersiz ödeme mahsupları
- Diğer personel talebine bağlı kesintiler — yetki ve mevzuat doğrulamasıyla

## 10. Her kalem için zorunlu metadata

```yaml
pay_item:
  id: GENERAL_BASE_MONTHLY
  name: Gösterge Aylığı
  legal_basis: []
  eligible_regimes: []
  formula_id: null
  income_tax: RULE_REF
  stamp_tax: RULE_REF
  sgk_5510_pec: RULE_REF
  pension_5434_base: RULE_REF
  prorate: RULE_REF
  minimum_wage_exemption_pool: RULE_REF
  rounding: RULE_REF
  effective_from: null
  effective_to: null
```
