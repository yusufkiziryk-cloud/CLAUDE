# KAMU MAAŞ / HYP — PROJECT KNOWLEDGE BİRLEŞİK DOSYA

- Oluşturma tarihi: 2026-09-04
- Kaynak: Claude Project Knowledge klasörü (18 dosya, içerik değiştirilmeden birleştirildi)
- Bilgi tabanında bulunmayan dosyalar: 01_CLAUDE_CODE_MASTER_PROMPT.md, 12_MEVZUAT_GUNCELLEME_PROMPTU.md, 15_CLAUDE_CALISMA_TALIMATI.md

## İçindekiler

1. `00_OKU_BENI.md` — 45 satır, 3115 bayt
2. `00_PROJEYE_NASIL_YUKLENECEK.md` — 17 satır, 1184 bayt
3. `02_MEVZUAT_ENVANTERI.md` — 107 satır, 5548 bayt
4. `03_PERSONEL_REJIMLERI.md` — 80 satır, 2543 bayt
5. `04_MAAS_ODEME_KALEMLERI.md` — 151 satır, 4552 bayt
6. `05_VERGI_SGK_KESINTI_MOTORU.md` — 93 satır, 3618 bayt
7. `06_KURAL_MOTORU_SURUMLEME.md` — 96 satır, 2366 bayt
8. `07_HESAPLAMA_SIRASI_VE_FORMUL_PRESIPLERI.md` — 65 satır, 2091 bayt
9. `08_OZEL_MODULLER_VE_HIZMET_KOLLARI.md` — 52 satır, 1796 bayt
10. `09_VERI_MODELI_VE_RULE_SCHEMA.md` — 74 satır, 1472 bayt
11. `10_KVKK_GUVENLIK_DENETIM.md` — 55 satır, 1359 bayt
12. `11_TEST_KABUL_KRITERLERI.md` — 88 satır, 2298 bayt
13. `13_KAYNAKLAR_VE_KITAPLAR.md` — 70 satır, 3875 bayt
14. `14_HUKUKI_RISK_VE_SINIRLAR.md` — 51 satır, 2094 bayt
15. `16_MEVZUAT_KONTROL_CHECKLIST.md` — 40 satır, 1141 bayt
16. `17_2026_GUNCEL_KONTROL_PARAMETRELERI.md` — 84 satır, 4092 bayt
17. `18_RESMI_KAYNAK_INDIRME_MANIFESTOSU.md` — 81 satır, 2607 bayt
18. `PROJECT_KNOWLEDGE_MASTER.md` — 1286 satır, 42813 bayt


---

<!-- ══════════════════ DOSYA 1/18: 00_OKU_BENI.md ══════════════════ -->

# 📄 DOSYA 1/18: `00_OKU_BENI.md`

# KAMU MAAŞ VE BORDRO MOTORU — CLAUDE CODE CONTEXT PACK

**Sürüm:** 2026-08-27

Bu paket, Türkiye'de kamu görevlilerinin maaş ve bordro hesaplarının mevzuata dayalı, tarih-sürümlü, açıklanabilir ve test edilebilir biçimde hesaplanacağı bir yazılım projesini Claude Code ile geliştirmek için hazırlanmıştır.

## En önemli tasarım kararı

Bu proje tek formüllü bir “657 maaş hesaplayıcısı” değildir. Kamu personelinin mali hakları farklı personel kanunları, KHK'lar, sosyal güvenlik rejimleri, vergi kuralları, toplu sözleşmeler, hizmet kolu hükümleri, kurum/ünvan özel düzenlemeleri ve dönemsel katsayılarla belirlenir. Bu nedenle sistemin çekirdeği **tarih-sürümlü mevzuat/kural motoru** olacaktır.

## Paketin kullanım sırası

1. `01_CLAUDE_CODE_MASTER_PROMPT.md` dosyasını Claude Code'a ana görev olarak verin.
2. Bu klasördeki tüm diğer `.md` dosyalarını proje context/reference dokümanı olarak okutun.
3. Claude'dan önce `docs/MEVZUAT_ENVANTERI_GERCEK.md`, `docs/KURAL_CELISKI_RAPORU.md` ve `rules/` altındaki makine-okunur kural dosyalarını üretmesini isteyin.
4. Daha sonra hesap motoru, testler, veri içe aktarma ve arayüz geliştirilsin.
5. Üretim öncesinde kurumdan alınan anonimleştirilmiş KPHYS/e-Bordro bordrolarıyla regresyon testi yapılmadan “kesin bordro” modu açılmasın.

## Kapsam

Çekirdek hedef: memur ve diğer kamu görevlilerinin aylık/ücret, zam-tazminat, sosyal yardım, ek ödeme, vergi, SGK/emekli keseneği ve diğer bordro kalemlerini hesaplamak.

**İşçi statüsündeki 4/D personel varsayılan kapsam dışıdır.** İstenirse 4857 + toplu iş sözleşmeleri için ayrı `WORKER_4D` modülü eklenebilir. Memur/kamu görevlisi ile işçi bordrosunu tek formüle sıkıştırmayın.

## Hukuki güvenlik ilkesi

- Hiçbir “oran”, “katsayı”, “gösterge”, “tavan” veya “istisna” kod içine sihirli sayı olarak gömülmemelidir.
- Her kural `effective_from`, `effective_to`, `source`, `article`, `RG_date`, `RG_no` alanlarıyla saklanmalıdır.
- Kuralın resmi kaynağı doğrulanamıyorsa sistem hesap üretmek yerine **“MEVZUAT DOĞRULAMASI GEREKİYOR”** durumuna geçmelidir.
- Mevzuat değişikliği geçmiş dönem bordrolarını bozmamalıdır; tarihsel hesap yeniden üretilebilir olmalıdır.

## 2026 kontrol parametreleri — yalnızca regresyon başlangıç referansı

Bunları Claude resmi belgeyle tekrar doğrulamadan üretim kuralı kabul etmesin:

- 01.07.2026–31.12.2026 aylık katsayısı: `1.575512`
- taban aylık katsayısı: `25.794915`
- yan ödeme katsayısı: `0.499649`
- 2026 ücret gelir vergisi tarifesi: %15 / %20 / %27 / %35 / %40; ücretler için dönemsel eşikler ayrıca `05_VERGI_SGK_KESINTI_MOTORU.md` içindedir.

## Hedef çıktı

Sistem, kullanıcıya sadece “net maaş” göstermemeli; her sonuç için şu zinciri verebilmelidir:

`Girdi -> Personel rejimi -> Dönem -> Uygulanan mevzuat -> Hakediş kalemleri -> Matrahlar -> Kesintiler -> İstisnalar -> Net ödeme -> İşveren maliyeti -> Muhasebe/denetim izi`


---

<!-- ══════════════════ DOSYA 2/18: 00_PROJEYE_NASIL_YUKLENECEK.md ══════════════════ -->

# 📄 DOSYA 2/18: `00_PROJEYE_NASIL_YUKLENECEK.md`

# Claude Project Knowledge — Yükleme Talimatı

Bu klasör, **657 + Aile Hekimliği + HYP + Kamu Maaş/Bordro** projesinin Project Knowledge katmanıdır.

## Önerilen kullanım

1. Claude projesinde **Add knowledge** alanını açın.
2. Öncelikle `PROJECT_KNOWLEDGE_MASTER.md` dosyasını yükleyin.
3. Claude proje başına dosya sayısı/indeksleme sınırı nedeniyle tek dosya tercih edilmiyorsa bu klasördeki 02–18 numaralı `.md` dosyalarını ayrı ayrı yükleyin.
4. `01_CLAUDE_CODE_MASTER_PROMPT.md` Project Knowledge'a yüklenmemiştir; ana geliştirme talimatı Custom Instructions veya yeni sohbet başlangıç promptu olarak kullanılmalıdır.
5. Aynı içeriği hem MASTER hem de ayrı dosyalarla yüklemek zorunlu değildir. Gereksiz tekrar bağlam kalitesini düşürebilir.

## Bilgi önceliği

Resmî ve yürürlükteki mevzuat > tarihli HMB/SGK/GİB resmî düzenleme ve genelgeleri > toplu sözleşme/hakem kurulu kararları > resmî kılavuzlar > yardımcı açıklamalar > kitap ve ikincil kaynaklar.

Mevzuat çelişkilerinde sistem sessizce varsayım yapmamalı; yürürlük tarihi, personel rejimi ve ödeme dönemi üzerinden kural seçmelidir.


---

<!-- ══════════════════ DOSYA 3/18: 02_MEVZUAT_ENVANTERI.md ══════════════════ -->

# 📄 DOSYA 3/18: `02_MEVZUAT_ENVANTERI.md`

# MEVZUAT ENVANTERİ — KAMU MAAŞ / BORDRO

Bu dosya “başlangıç kapsam kataloğudur”; üretimde resmi konsolide metin ve yürürlük tarihleri yeniden doğrulanmalıdır.

## A. Çekirdek personel ve mali hak mevzuatı

| Düzenleme | Ana rol | Motor |
|---|---|---|
| 657 sayılı Devlet Memurları Kanunu | Aylık, derece/kademe, gösterge, zam/tazminat, sosyal haklar, ödeme usulleri | `DMK_657` |
| 375 sayılı KHK | Taban aylığı, kıdem, görev/temsil, yabancı dil, ek ödeme, ek 40 ilave ödeme ve diğer mali haklar | `GENERAL_375` |
| 631 sayılı KHK | Kamu görevlilerinin mali/sosyal haklarında çeşitli düzenlemeler | `GENERAL_631` |
| 4688 sayılı Kanun | Kamu görevlileri sendikaları ve toplu sözleşme | `COLLECTIVE` |
| 2025/1 Kamu Görevlileri Hakem Kurulu Kararı | 2026–2027 genel mali/sosyal hükümler | `COLLECTIVE_2026_2027` |
| 8. Dönem Hizmet Kolları Toplu Sözleşmesi | Hizmet koluna özel ödemeler/haklar | `SERVICE_BRANCH_2026_2027` |
| 2006/10344 sayılı BKK ve ekleri (Zam ve Tazminatlar) | 657 m.152 uygulamasında puan/oran/cetveller | `ALLOWANCE_COMP` |
| Sözleşmeli Personel Çalıştırılmasına İlişkin Esaslar | 657/4-B sözleşmeli ücret ve uygulama | `CONTRACT_4B` |

## B. Sosyal güvenlik / kesenek

- 5510 sayılı Sosyal Sigortalar ve Genel Sağlık Sigortası Kanunu
- 5434 sayılı T.C. Emekli Sandığı Kanunu — 5510 geçici 4 kapsamı için
- Sosyal Sigorta İşlemleri Yönetmeliği ve SGK 4/c uygulama düzenlemeleri
- Fiili hizmet süresi zammı hükümleri
- SGK resmi 4/c prime esas kazanç ve oran açıklamaları

## C. Vergi

- 193 sayılı Gelir Vergisi Kanunu — özellikle ücret, indirim, istisna, tarife ve tevkifat hükümleri
- 319 Seri No.lu Gelir Vergisi Genel Tebliği — asgari ücret istisnası uygulaması
- Her yıl için gelir vergisi tarifesini güncelleyen ilgili tebliğ (2026: 332 Seri No.lu Tebliğ)
- 488 sayılı Damga Vergisi Kanunu ve ekli (1) sayılı tablo
- Yıllık Damga Vergisi Genel Tebliğleri

## D. Kamu mali yönetimi, tahakkuk ve ödeme belgeleri

- 5018 sayılı Kamu Mali Yönetimi ve Kontrol Kanunu
- Merkezi Yönetim Harcama Belgeleri Yönetmeliği
- Merkezi Yönetim Muhasebe Yönetmeliği
- Genel Yönetim Muhasebe Yönetmeliği
- Kamu Zararlarının Tahsiline İlişkin Usul ve Esaslar
- HMB KPHYS / HYS uygulama kılavuzları ve duyuruları
- Kamu Elektronik Bordro (e-Bordro) uygulama düzenlemeleri

## E. Dönemsel katsayı ve tavanlar

Her Ocak ve Temmuz için HMB “Mali ve Sosyal Haklara İlişkin Genelge” ayrı rule version olmalı.

2026 kontrol:

| Dönem | Aylık | Taban aylık | Yan ödeme |
|---|---:|---:|---:|
| 01.01.2026–30.06.2026 | 1.387871 | 22.722793 | 0.440141 |
| 01.07.2026–31.12.2026 | 1.575512 | 25.794915 | 0.499649 |

Bu değerler ilgili resmi genelgeden SHA-256 kaydıyla yeniden doğrulanmalı.

## F. Özel personel rejimleri

- 2914 sayılı Yükseköğretim Personel Kanunu
- 2547 sayılı Yükseköğretim Kanunu — ek ders/döner sermaye/akademik özel ödemelerle ilgili hükümler
- 2802 sayılı Hâkimler ve Savcılar Kanunu
- 926 sayılı Türk Silahlı Kuvvetleri Personel Kanunu
- 3269 sayılı Uzman Erbaş Kanunu
- 3466 sayılı Uzman Jandarma Kanunu
- 4678 sayılı sözleşmeli subay/astsubay mevzuatı
- 399 sayılı KHK — KİT personel rejimi
- 4924 sayılı Eleman Temininde Güçlük Çekilen Yerlerde Sözleşmeli Sağlık Personeli Kanunu
- 5258 sayılı Aile Hekimliği Kanunu
- Aile Hekimliği Sözleşme ve Ödeme Yönetmeliği
- Sağlık Bakanlığı Ek Ödeme Yönetmeliği
- 209 sayılı Sağlık Bakanlığına Bağlı Sağlık Kurumları ile Esenlendirme Tesislerine Verilecek Döner Sermaye Hakkında Kanunun ilgili hükümleri
- 663 sayılı KHK/Kanunlaşan ilgili hükümler — sağlık sözleşmeli/ek ödeme alanları için geçerli maddeler
- Mahalli idare sözleşmeli personeline ilişkin 5393 sayılı Belediye Kanunu m.49 ve dönemsel HMB genelgeleri
- Sosyal denge tazminatı açısından 4688 ve ilgili yerel yönetim hükümleri

## G. Sosyal yardım / yan hak ikincil mevzuatı

Claude resmi kaynaklardan güncel metinleri bulup kapsama göre kodlasın:

- Devlet Memurları Yiyecek Yardımı Yönetmeliği
- Memurlara Yapılacak Giyecek Yardımı Yönetmeliği
- Aile yardımı/çocuk yardımı için 657 ve toplu sözleşme hükümleri
- Yabancı dil tazminatı için 375 KHK ve ilgili esaslar
- Fazla çalışma, nöbet, ek ders ve özel hizmet alanlarına ait kanun/karar/toplu sözleşme düzenlemeleri

## H. Kapsam dışında fakat karıştırılmaması gereken mevzuat

- 4857 İş Kanunu / 4-D işçi bordroları — ayrı modül olmadan bu motora dahil edilmemeli.
- Harcırah 6245 — maaş değildir; ayrı “personel ödemesi” modülü yapılabilir ama net maaş çekirdeğine karıştırılmamalı.
- Emekli aylığı hesapları — çalışan maaş bordrosundan ayrı ürün/modül olmalı.

## I. Resmi kaynak başlangıç adresleri

- https://www.mevzuat.gov.tr/
- https://www.resmigazete.gov.tr/
- https://www.hmb.gov.tr/personel-kanunlari-kanun-hukmunde-kararnameleri
- https://kmyd.hmb.gov.tr/
- https://muhasebat.hmb.gov.tr/
- https://btgm.hmb.gov.tr/uygulamalar
- https://www.sgk.gov.tr/
- https://www.gib.gov.tr/
- https://www.csgb.gov.tr/cgm/mevzuat/
- https://khgmekodemedb.saglik.gov.tr/

## Kural

Bu envanter “tamamlandı” etiketi alabilmesi için her başlığın resmi kaynağı, yürürlük dönemi, ilgili madde/bentleri ve en az bir otomatik testle eşleştirilmiş olması gerekir.


---

<!-- ══════════════════ DOSYA 4/18: 03_PERSONEL_REJIMLERI.md ══════════════════ -->

# 📄 DOSYA 4/18: `03_PERSONEL_REJIMLERI.md`

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


---

<!-- ══════════════════ DOSYA 5/18: 04_MAAS_ODEME_KALEMLERI.md ══════════════════ -->

# 📄 DOSYA 5/18: `04_MAAS_ODEME_KALEMLERI.md`

# MAAŞ / BORDRO ÖDEME KALEMLERİ KATALOĞU

Bu liste, veritabanında “pay item catalog” olarak modellenmelidir. Her kalemin vergi/prim/damga durumu **adıyla tahmin edilmemeli**, kaynaklı `tax_profile` üzerinden belirlenmelidir.

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

Bir kalem için bu metadata tamamlanmamışsa, motor “0 TL” deyip sessiz geçmesin; `UNRESOLVED_PAY_ITEM` uyarısı versin.


---

<!-- ══════════════════ DOSYA 6/18: 05_VERGI_SGK_KESINTI_MOTORU.md ══════════════════ -->

# 📄 DOSYA 6/18: `05_VERGI_SGK_KESINTI_MOTORU.md`

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


---

<!-- ══════════════════ DOSYA 7/18: 06_KURAL_MOTORU_SURUMLEME.md ══════════════════ -->

# 📄 DOSYA 7/18: `06_KURAL_MOTORU_SURUMLEME.md`

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


---

<!-- ══════════════════ DOSYA 8/18: 07_HESAPLAMA_SIRASI_VE_FORMUL_PRESIPLERI.md ══════════════════ -->

# 📄 DOSYA 8/18: `07_HESAPLAMA_SIRASI_VE_FORMUL_PRESIPLERI.md`

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


---

<!-- ══════════════════ DOSYA 9/18: 08_OZEL_MODULLER_VE_HIZMET_KOLLARI.md ══════════════════ -->

# 📄 DOSYA 9/18: `08_OZEL_MODULLER_VE_HIZMET_KOLLARI.md`

# ÖZEL MODÜLLER, KURUMLAR VE HİZMET KOLLARI

## 2026–2027 toplu sözleşme dönemi

Sistem “genel hüküm” ile “hizmet kolu hükmü”nü ayırmalıdır. Çalışma ve Sosyal Güvenlik Bakanlığının 8. Dönem toplu sözleşme/hakem kurulu belgeleri ayrı kaynak sürümü olarak tutulmalıdır.

`service_branch` zorunlu/opsiyonel seçim olmalı. Kullanıcı hizmet kolunu bilmiyorsa kurum eşleştirme tablosundan öneri üret; kesin değilse onay iste.

## Sağlık ve sosyal hizmetler

Alt adapter'lar:

- 657 sağlık personeli
- 4/B sağlık personeli
- 4924
- aile hekimliği 5258
- Sağlık Bakanlığı Ek Ödeme Yönetmeliği
- nöbet/icap
- döner sermaye
- HYP

Bunları tek “sağlık zammı” formülüne birleştirme.

## Eğitim

- öğretim yılına hazırlık ödeneği
- ek ders
- nöbet/egzersiz/özel öğretim gibi alanlar varsa mevzuat bazlı alt kalemler
- hizmet kolu toplu sözleşme hükümleri

## Üniversite

2914 ana aylık motoru + 2547 ek ders/döner + akademik teşvik + geliştirme/üniversite/yükseköğretim tazminatları ayrı pay item'lardır.

## Yerel yönetimler

- 657 memur çekirdeği
- sosyal denge tazminatı
- mahalli idare sözleşmeli personel tavan/ücretleri
- yerel toplu sözleşme kapsam şartları

## Adalet / yargı

2802 ve özel yüksek hakimlik/görev tazminatı hükümleri için ayrı adapter gereklidir. 657 formülünü doğrudan kullanma.

## TSK ve güvenlik

926/3269/3466/4678 için rütbe/ünvan/cetvel tabanlı özel motor gerekir. Sadece ortak 375 KHK kalemlerini inherit et; özel hizmet tazminatlarını 657 tablosuna zorla bağlama.

## KİT

399 KHK personelinde ücret/ikramiye/başarı vb. mekanizma özel rejimdir. Kurum/pozisyon cetvelleri ve dönemsel tavanlar olmadan “tam destek” işaretleme.


---

<!-- ══════════════════ DOSYA 10/18: 09_VERI_MODELI_VE_RULE_SCHEMA.md ══════════════════ -->

# 📄 DOSYA 10/18: `09_VERI_MODELI_VE_RULE_SCHEMA.md`

# VERİ MODELİ VE RULE SCHEMA

## Ana tablolar

- `people` — minimum kişisel veri
- `employment_periods`
- `positions`
- `titles`
- `institutions`
- `service_branches`
- `pay_periods`
- `coefficient_versions`
- `legal_sources`
- `rule_versions`
- `pay_item_catalog`
- `pay_item_entitlements`
- `payroll_runs`
- `payroll_lines`
- `tax_ledgers`
- `minimum_wage_exemption_ledgers`
- `social_security_ledgers`
- `deduction_orders`
- `retro_adjustments`
- `collective_agreement_rules`
- `validation_issues`
- `golden_master_cases`
- `audit_events`

## payroll_line örneği

```json
{
  "pay_item_id": "GENERAL_BASE_MONTHLY",
  "gross_raw": "0.000000000000",
  "gross_payable": "0.00",
  "income_tax_base_delta": "0.00",
  "stamp_tax_base_delta": "0.00",
  "sgk_pec_delta": "0.00",
  "pension_5434_base_delta": "0.00",
  "employee_deduction": "0.00",
  "employer_cost_delta": "0.00",
  "rule_ids": [],
  "explanation": []
}
```

## Zorunlu tarihsel alanlar

Her bordro run'ında:

- `calculation_period`
- `calculated_at`
- `rule_snapshot_hash`
- `source_manifest_hash`
- `software_version`

saklanmalı.

## Snapshot

Mevzuat veri tabanı güncellendiğinde eski bordronun sonucu değişmemeli. Bordronun kullandığı rule version ID'leri immutable tutulmalı.

## Override

Manuel override yalnız yetkili rol ile:

- eski değer
- yeni değer
- gerekçe
- kullanıcı
- tarih/saat
- dayanak belge

kaydıyla yapılmalı. Override sonucu raporda görünür olmalıdır.


---

<!-- ══════════════════ DOSYA 11/18: 10_KVKK_GUVENLIK_DENETIM.md ══════════════════ -->

# 📄 DOSYA 11/18: `10_KVKK_GUVENLIK_DENETIM.md`

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


---

<!-- ══════════════════ DOSYA 12/18: 11_TEST_KABUL_KRITERLERI.md ══════════════════ -->

# 📄 DOSYA 12/18: `11_TEST_KABUL_KRITERLERI.md`

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


---

<!-- ══════════════════ DOSYA 13/18: 13_KAYNAKLAR_VE_KITAPLAR.md ══════════════════ -->

# 📄 DOSYA 13/18: `13_KAYNAKLAR_VE_KITAPLAR.md`

# RESMİ KAYNAKLAR VE ÖNERİLEN KİTAPLAR

## 1. Birincil kaynaklar — bunlar kitaplardan daha önemlidir

### Hazine ve Maliye Bakanlığı
- Personel kanunları/KHK envanteri: https://www.hmb.gov.tr/personel-kanunlari-kanun-hukmunde-kararnameleri
- Kamu Mali Yönetim ve Dönüşüm GM: https://kmyd.hmb.gov.tr/
- Muhasebat/KPHYS: https://muhasebat.hmb.gov.tr/
- KPHYS uygulama tanımı: https://btgm.hmb.gov.tr/uygulamalar
- Memur maaş işlemleri SSS: https://muhasebat.hmb.gov.tr/memur-maas-islemleri-sikca-sorulan-sorular
- KPHYS eğitim/kılavuzları: https://muhasebat.hmb.gov.tr/duyuru/kamu-personel-harcamalari-yonetim-sistemi-kphys-egitimi

### Mevzuat / Resmi Gazete
- https://www.mevzuat.gov.tr/
- https://www.resmigazete.gov.tr/

### SGK
- 4/c prim ve prime ilişkin işlemler: https://www.sgk.gov.tr/Content/Post/51eb246d-88b5-4356-ba97-3af847ec4ded/4c-Kapsamindaki-Sigortalilarin-Prim-ve-Prime-Iliskin-Islemleri-2026-01-12-12-07-35
- 5434–5510 ayrımı: https://www.sgk.gov.tr/Content/Post/52a2428a-9603-4aa1-bbeb-7746432953b6/5434-sayili-Kanun-ile-5510-sayili-Kanun-2022-08-18-11-26-15

### GİB
- Gelir Vergisi Kanunu / m.103 güncel tarife: https://gib.gov.tr/
- 2026 Gelir Vergisi Tarifesi: GİB'in 332 Seri No.lu Tebliğ ve 2026 tarife PDF'si
- 2026 Ücret Geliri Rehberi: GİB resmi rehberi
- Damga Vergisi Kanunu ve yıllık tebliğler: GİB mevzuat bölümü

### Toplu sözleşme
- ÇSGB mevzuat/toplu sözleşme sayfası: https://www.csgb.gov.tr/cgm/mevzuat/
- 2025/1 Kamu Görevlileri Hakem Kurulu Kararı
- 2026–2027 8. Dönem hizmet kolları toplu sözleşme metinleri

### Sağlık özel
- Sağlık Bakanlığı ek ödeme mevzuatı: https://khgmekodemedb.saglik.gov.tr/
- Aile hekimliği mevzuatı: Sağlık Bakanlığı resmi mevzuat sayfaları

## 2. Kitap önerileri

### Birinci tercih — madde bazlı uygulama
**Mustafa Dönmez — Açıklamalı–İçtihatlı Devlet Memurları Kanunu**  
12. Baskı, Mayıs 2025, yaklaşık 1009 sayfa. 657'nin madde bazlı açıklaması, idari görüş ve yargı kararları için iyi başvuru kitabı. Yazılıma “normatif kaynak” diye kopyalanmamalı; resmi metni yorumlamak için ikincil kaynak olarak kullanılmalı.

### İkinci tercih — daha sistematik kamu görevlileri hukuku
**Çınar Can Evren & İsmail Uçar — Kamu Görevlileri Hukuku**  
5. Baskı, Eylül 2025. Daha kompakt; personel rejiminin hukuk mantığını oturtmak için uygun.

### Ek kaynak
**Selman Sacit Boz, Abidin Kadir İnce, Gizem Elif Büyükyıldırım, Enis Acar — Kamu Personel Hukuku**  
Uygulama/yargı kararı perspektifi sağlar; baskısı daha eski olduğundan güncel mali tutarlar için kullanılmamalı.

### 5018 için
5018 şerh/uygulama kitapları yararlı olabilir; ancak maaş hesap motorunun matematiğini bunlardan çıkarmayın. HMB'nin güncel harcama/muhasebe düzenlemeleri ve KPHYS kılavuzları daha yüksek önceliklidir. Eski 5018 kitapları yalnız süreç ve sorumluluk çerçevesi için yardımcıdır.

### Ücretsiz kurumsal kaynak
TBMM/Sayıştay/HMB tarafından yayımlanmış **Kamu Mali Yönetimi El Kitabı** ve KPHYS eğitim dökümanları pratik uygulama açısından birçok ticari kitaptan daha değerlidir; güncellik kontrolü yapılmalıdır.

## 3. Yardımcı karşılaştırma kaynakları — normatif değildir

- Türkiye Belediyeler Birliği'nin memur maaş hesaplama aracı dönemsel smoke-test için kullanılabilir.
- Mutemet odaklı özel hesaplama siteleri çeşitli edge-case fikirleri verebilir; **resmi mevzuatın yerine geçmez** ve test “oracle”ı olarak tek başına kullanılmamalıdır.

## Kaynak kullanım etiketi

Her kaynak için:

- `PRIMARY_BINDING` — resmi mevzuat
- `PRIMARY_GUIDANCE` — HMB/SGK/GİB resmi kılavuz
- `SECONDARY_COMMENTARY` — kitap/makale
- `VALIDATION_ONLY` — bordro/yardımcı hesaplayıcı

etiketi kullan.


---

<!-- ══════════════════ DOSYA 14/18: 14_HUKUKI_RISK_VE_SINIRLAR.md ══════════════════ -->

# 📄 DOSYA 14/18: `14_HUKUKI_RISK_VE_SINIRLAR.md`

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


---

<!-- ══════════════════ DOSYA 15/18: 16_MEVZUAT_KONTROL_CHECKLIST.md ══════════════════ -->

# 📄 DOSYA 15/18: `16_MEVZUAT_KONTROL_CHECKLIST.md`

# MEVZUAT KONTROL CHECKLIST

Claude her üretim sürümünde aşağıdaki kontrolü doldursun.

## Dönemsel
- [ ] HMB aylık katsayısı doğrulandı
- [ ] HMB taban aylık katsayısı doğrulandı
- [ ] HMB yan ödeme katsayısı doğrulandı
- [ ] 399/4B/mahalli idare gibi tavanlar gereken rejimlerde doğrulandı
- [ ] yıllık GVK tarifesi doğrulandı
- [ ] asgari ücret istisnası parametreleri doğrulandı
- [ ] damga vergisi oran/istisnaları doğrulandı
- [ ] toplu sözleşme/hakem kurulu dönemi doğrulandı

## Çekirdek
- [ ] 657 ilgili maddeler
- [ ] 375 KHK ilgili maddeler
- [ ] 2006/10344 cetvelleri
- [ ] 4688/toplu sözleşme
- [ ] 5510 4/c
- [ ] 5434 geçiş
- [ ] 193 GVK
- [ ] 488 DVK

## Özel rejim — aktif olanlar
- [ ] 2914/2547
- [ ] 2802
- [ ] 926
- [ ] 3269/3466/4678
- [ ] 399 KHK
- [ ] 4924
- [ ] 5258 + Aile Hekimliği Ödeme Yönetmeliği
- [ ] Sağlık Bakanlığı Ek Ödeme Yönetmeliği
- [ ] 5393/49 mahalli idare sözleşmeli

## Tahakkuk/denetim
- [ ] 5018
- [ ] Merkezi Yönetim Harcama Belgeleri Yönetmeliği
- [ ] KPHYS güncel kılavuz/duyuru
- [ ] anonim e-Bordro golden master testleri


---

<!-- ══════════════════ DOSYA 16/18: 17_2026_GUNCEL_KONTROL_PARAMETRELERI.md ══════════════════ -->

# 📄 DOSYA 16/18: `17_2026_GUNCEL_KONTROL_PARAMETRELERI.md`

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


---

<!-- ══════════════════ DOSYA 17/18: 18_RESMI_KAYNAK_INDIRME_MANIFESTOSU.md ══════════════════ -->

# 📄 DOSYA 17/18: `18_RESMI_KAYNAK_INDIRME_MANIFESTOSU.md`

# RESMİ KAYNAK İNDİRME / CONTEXT MANİFESTOSU

Claude Code proje başlamadan `legal_sources/raw/` altında mümkün olan resmi kaynakları yerel kopya olarak toplasın ve SHA-256 oluştursun. URL erişilemiyorsa kullanıcıya dosya adıyla eksik kaynak listesi versin.

## Zorunlu çekirdek

1. 657 sayılı Devlet Memurları Kanunu — mevzuat.gov.tr konsolide metin
2. 375 sayılı KHK — mevzuat.gov.tr konsolide metin
3. 631 sayılı KHK — ilgili hükümler
4. 5510 sayılı Kanun
5. 5434 sayılı Kanun — geçiş hükümleri için
6. 193 sayılı Gelir Vergisi Kanunu
7. 488 sayılı Damga Vergisi Kanunu + (1) sayılı tablo
8. 4688 sayılı Kanun
9. 5018 sayılı Kanun
10. 2006/10344 sayılı Zam ve Tazminatlar Kararı ve güncel cetvelleri
11. Sözleşmeli Personel Çalıştırılmasına İlişkin Esaslar
12. Merkezi Yönetim Harcama Belgeleri Yönetmeliği

## 2026 dönem dosyaları

13. HMB 2026 Ocak Mali ve Sosyal Haklar Genelgesi
14. HMB 2026 Temmuz Mali ve Sosyal Haklar Genelgesi
15. GİB 332 Seri No.lu Gelir Vergisi Genel Tebliği
16. GİB 2026 Ücret Geliri Rehberi
17. 2025/1 Kamu Görevlileri Hakem Kurulu Kararı
18. 8. Dönem 2026–2027 hizmet kolu toplu sözleşmeleri
19. SGK 4/c prime esas kazanç ve oranlar resmi açıklaması
20. SGK 5434–5510 ayrımı resmi açıklaması

## Özel rejimler — desteklenecekse zorunlu

21. 2914 + ilgili 2547 hükümleri
22. 2802
23. 926
24. 3269
25. 3466
26. 4678
27. 399 KHK
28. 4924
29. 5258
30. Aile Hekimliği Sözleşme ve Ödeme Yönetmeliği
31. Sağlık Bakanlığı Ek Ödeme Yönetmeliği
32. 209 sayılı Kanunun ilgili döner sermaye hükümleri
33. 5393 m.49 ve dönemsel mahalli idare sözleşmeli personel ücret genelgesi

## HMB/KPHYS uygulama belgeleri

- https://btgm.hmb.gov.tr/uygulamalar
- https://muhasebat.hmb.gov.tr/memur-maas-islemleri-sikca-sorulan-sorular
- https://muhasebat.hmb.gov.tr/duyuru/kamu-personel-harcamalari-yonetim-sistemi-kphys-egitimi

## Sağlık özel resmi giriş noktaları

- https://khgmekodemedb.saglik.gov.tr/
- Sağlık Bakanlığı resmi aile hekimliği mevzuat sayfaları

## Dosya adı standardı

`YYYY-MM-DD__KAYNAK_KURUM__MEVZUAT_NO__KISA_AD.pdf`

Örnek:

`2026-07-03__HMB__GENELGE_5__MALI_VE_SOSYAL_HAKLAR.pdf`

## Manifest alanları

```json
{
  "source_id": "HMB_2026_H2_COEFFICIENTS",
  "authority": "HMB",
  "official_url": "...",
  "local_path": "legal_sources/raw/...pdf",
  "sha256": "...",
  "retrieved_at": "2026-08-27T...+03:00",
  "publication_date": "2026-07-03",
  "effective_from": "2026-07-01",
  "effective_to": "2026-12-31",
  "verified": true
}
```


---

<!-- ══════════════════ DOSYA 18/18: PROJECT_KNOWLEDGE_MASTER.md ══════════════════ -->

# 📄 DOSYA 18/18: `PROJECT_KNOWLEDGE_MASTER.md`

# PROJECT KNOWLEDGE MASTER

## 657 + Aile Hekimliği + HYP + Kamu Maaş/Bordro Projesi

Bu belge Claude Project Knowledge için hazırlanmış birleşik referans metnidir. Amaç, uygulamanın mevzuat tabanlı, tarih/sürüm kontrollü, açıklanabilir ve HYP ile maaş modüllerini birbirinden ayıran bir mimariyle geliştirilmesini desteklemektir.

**Kural:** Bu belge bir resmî mevzuat metninin yerine geçmez. Hesaplamada yürürlükteki resmî kaynak ve tarih bazlı kural seti esas alınmalıdır.

---


---

# Kaynak Modül: 02_MEVZUAT_ENVANTERI.md

# MEVZUAT ENVANTERİ — KAMU MAAŞ / BORDRO

Bu dosya “başlangıç kapsam kataloğudur”; üretimde resmi konsolide metin ve yürürlük tarihleri yeniden doğrulanmalıdır.

## A. Çekirdek personel ve mali hak mevzuatı

| Düzenleme | Ana rol | Motor |
|---|---|---|
| 657 sayılı Devlet Memurları Kanunu | Aylık, derece/kademe, gösterge, zam/tazminat, sosyal haklar, ödeme usulleri | `DMK_657` |
| 375 sayılı KHK | Taban aylığı, kıdem, görev/temsil, yabancı dil, ek ödeme, ek 40 ilave ödeme ve diğer mali haklar | `GENERAL_375` |
| 631 sayılı KHK | Kamu görevlilerinin mali/sosyal haklarında çeşitli düzenlemeler | `GENERAL_631` |
| 4688 sayılı Kanun | Kamu görevlileri sendikaları ve toplu sözleşme | `COLLECTIVE` |
| 2025/1 Kamu Görevlileri Hakem Kurulu Kararı | 2026–2027 genel mali/sosyal hükümler | `COLLECTIVE_2026_2027` |
| 8. Dönem Hizmet Kolları Toplu Sözleşmesi | Hizmet koluna özel ödemeler/haklar | `SERVICE_BRANCH_2026_2027` |
| 2006/10344 sayılı BKK ve ekleri (Zam ve Tazminatlar) | 657 m.152 uygulamasında puan/oran/cetveller | `ALLOWANCE_COMP` |
| Sözleşmeli Personel Çalıştırılmasına İlişkin Esaslar | 657/4-B sözleşmeli ücret ve uygulama | `CONTRACT_4B` |

## B. Sosyal güvenlik / kesenek

- 5510 sayılı Sosyal Sigortalar ve Genel Sağlık Sigortası Kanunu
- 5434 sayılı T.C. Emekli Sandığı Kanunu — 5510 geçici 4 kapsamı için
- Sosyal Sigorta İşlemleri Yönetmeliği ve SGK 4/c uygulama düzenlemeleri
- Fiili hizmet süresi zammı hükümleri
- SGK resmi 4/c prime esas kazanç ve oran açıklamaları

## C. Vergi

- 193 sayılı Gelir Vergisi Kanunu — özellikle ücret, indirim, istisna, tarife ve tevkifat hükümleri
- 319 Seri No.lu Gelir Vergisi Genel Tebliği — asgari ücret istisnası uygulaması
- Her yıl için gelir vergisi tarifesini güncelleyen ilgili tebliğ (2026: 332 Seri No.lu Tebliğ)
- 488 sayılı Damga Vergisi Kanunu ve ekli (1) sayılı tablo
- Yıllık Damga Vergisi Genel Tebliğleri

## D. Kamu mali yönetimi, tahakkuk ve ödeme belgeleri

- 5018 sayılı Kamu Mali Yönetimi ve Kontrol Kanunu
- Merkezi Yönetim Harcama Belgeleri Yönetmeliği
- Merkezi Yönetim Muhasebe Yönetmeliği
- Genel Yönetim Muhasebe Yönetmeliği
- Kamu Zararlarının Tahsiline İlişkin Usul ve Esaslar
- HMB KPHYS / HYS uygulama kılavuzları ve duyuruları
- Kamu Elektronik Bordro (e-Bordro) uygulama düzenlemeleri

## E. Dönemsel katsayı ve tavanlar

Her Ocak ve Temmuz için HMB “Mali ve Sosyal Haklara İlişkin Genelge” ayrı rule version olmalı.

2026 kontrol:

| Dönem | Aylık | Taban aylık | Yan ödeme |
|---|---:|---:|---:|
| 01.01.2026–30.06.2026 | 1.387871 | 22.722793 | 0.440141 |
| 01.07.2026–31.12.2026 | 1.575512 | 25.794915 | 0.499649 |

Bu değerler ilgili resmi genelgeden SHA-256 kaydıyla yeniden doğrulanmalı.

## F. Özel personel rejimleri

- 2914 sayılı Yükseköğretim Personel Kanunu
- 2547 sayılı Yükseköğretim Kanunu — ek ders/döner sermaye/akademik özel ödemelerle ilgili hükümler
- 2802 sayılı Hâkimler ve Savcılar Kanunu
- 926 sayılı Türk Silahlı Kuvvetleri Personel Kanunu
- 3269 sayılı Uzman Erbaş Kanunu
- 3466 sayılı Uzman Jandarma Kanunu
- 4678 sayılı sözleşmeli subay/astsubay mevzuatı
- 399 sayılı KHK — KİT personel rejimi
- 4924 sayılı Eleman Temininde Güçlük Çekilen Yerlerde Sözleşmeli Sağlık Personeli Kanunu
- 5258 sayılı Aile Hekimliği Kanunu
- Aile Hekimliği Sözleşme ve Ödeme Yönetmeliği
- Sağlık Bakanlığı Ek Ödeme Yönetmeliği
- 209 sayılı Sağlık Bakanlığına Bağlı Sağlık Kurumları ile Esenlendirme Tesislerine Verilecek Döner Sermaye Hakkında Kanunun ilgili hükümleri
- 663 sayılı KHK/Kanunlaşan ilgili hükümler — sağlık sözleşmeli/ek ödeme alanları için geçerli maddeler
- Mahalli idare sözleşmeli personeline ilişkin 5393 sayılı Belediye Kanunu m.49 ve dönemsel HMB genelgeleri
- Sosyal denge tazminatı açısından 4688 ve ilgili yerel yönetim hükümleri

## G. Sosyal yardım / yan hak ikincil mevzuatı

Claude resmi kaynaklardan güncel metinleri bulup kapsama göre kodlasın:

- Devlet Memurları Yiyecek Yardımı Yönetmeliği
- Memurlara Yapılacak Giyecek Yardımı Yönetmeliği
- Aile yardımı/çocuk yardımı için 657 ve toplu sözleşme hükümleri
- Yabancı dil tazminatı için 375 KHK ve ilgili esaslar
- Fazla çalışma, nöbet, ek ders ve özel hizmet alanlarına ait kanun/karar/toplu sözleşme düzenlemeleri

## H. Kapsam dışında fakat karıştırılmaması gereken mevzuat

- 4857 İş Kanunu / 4-D işçi bordroları — ayrı modül olmadan bu motora dahil edilmemeli.
- Harcırah 6245 — maaş değildir; ayrı “personel ödemesi” modülü yapılabilir ama net maaş çekirdeğine karıştırılmamalı.
- Emekli aylığı hesapları — çalışan maaş bordrosundan ayrı ürün/modül olmalı.

## I. Resmi kaynak başlangıç adresleri

- https://www.mevzuat.gov.tr/
- https://www.resmigazete.gov.tr/
- https://www.hmb.gov.tr/personel-kanunlari-kanun-hukmunde-kararnameleri
- https://kmyd.hmb.gov.tr/
- https://muhasebat.hmb.gov.tr/
- https://btgm.hmb.gov.tr/uygulamalar
- https://www.sgk.gov.tr/
- https://www.gib.gov.tr/
- https://www.csgb.gov.tr/cgm/mevzuat/
- https://khgmekodemedb.saglik.gov.tr/

## Kural

Bu envanter “tamamlandı” etiketi alabilmesi için her başlığın resmi kaynağı, yürürlük dönemi, ilgili madde/bentleri ve en az bir otomatik testle eşleştirilmiş olması gerekir.


---

# Kaynak Modül: 03_PERSONEL_REJIMLERI.md

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


---

# Kaynak Modül: 04_MAAS_ODEME_KALEMLERI.md

# MAAŞ / BORDRO ÖDEME KALEMLERİ KATALOĞU

Bu liste, veritabanında “pay item catalog” olarak modellenmelidir. Her kalemin vergi/prim/damga durumu **adıyla tahmin edilmemeli**, kaynaklı `tax_profile` üzerinden belirlenmelidir.

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

Bir kalem için bu metadata tamamlanmamışsa, motor “0 TL” deyip sessiz geçmesin; `UNRESOLVED_PAY_ITEM` uyarısı versin.


---

# Kaynak Modül: 05_VERGI_SGK_KESINTI_MOTORU.md

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


---

# Kaynak Modül: 06_KURAL_MOTORU_SURUMLEME.md

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


---

# Kaynak Modül: 07_HESAPLAMA_SIRASI_VE_FORMUL_PRESIPLERI.md

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


---

# Kaynak Modül: 08_OZEL_MODULLER_VE_HIZMET_KOLLARI.md

# ÖZEL MODÜLLER, KURUMLAR VE HİZMET KOLLARI

## 2026–2027 toplu sözleşme dönemi

Sistem “genel hüküm” ile “hizmet kolu hükmü”nü ayırmalıdır. Çalışma ve Sosyal Güvenlik Bakanlığının 8. Dönem toplu sözleşme/hakem kurulu belgeleri ayrı kaynak sürümü olarak tutulmalıdır.

`service_branch` zorunlu/opsiyonel seçim olmalı. Kullanıcı hizmet kolunu bilmiyorsa kurum eşleştirme tablosundan öneri üret; kesin değilse onay iste.

## Sağlık ve sosyal hizmetler

Alt adapter'lar:

- 657 sağlık personeli
- 4/B sağlık personeli
- 4924
- aile hekimliği 5258
- Sağlık Bakanlığı Ek Ödeme Yönetmeliği
- nöbet/icap
- döner sermaye
- HYP

Bunları tek “sağlık zammı” formülüne birleştirme.

## Eğitim

- öğretim yılına hazırlık ödeneği
- ek ders
- nöbet/egzersiz/özel öğretim gibi alanlar varsa mevzuat bazlı alt kalemler
- hizmet kolu toplu sözleşme hükümleri

## Üniversite

2914 ana aylık motoru + 2547 ek ders/döner + akademik teşvik + geliştirme/üniversite/yükseköğretim tazminatları ayrı pay item'lardır.

## Yerel yönetimler

- 657 memur çekirdeği
- sosyal denge tazminatı
- mahalli idare sözleşmeli personel tavan/ücretleri
- yerel toplu sözleşme kapsam şartları

## Adalet / yargı

2802 ve özel yüksek hakimlik/görev tazminatı hükümleri için ayrı adapter gereklidir. 657 formülünü doğrudan kullanma.

## TSK ve güvenlik

926/3269/3466/4678 için rütbe/ünvan/cetvel tabanlı özel motor gerekir. Sadece ortak 375 KHK kalemlerini inherit et; özel hizmet tazminatlarını 657 tablosuna zorla bağlama.

## KİT

399 KHK personelinde ücret/ikramiye/başarı vb. mekanizma özel rejimdir. Kurum/pozisyon cetvelleri ve dönemsel tavanlar olmadan “tam destek” işaretleme.


---

# Kaynak Modül: 09_VERI_MODELI_VE_RULE_SCHEMA.md

# VERİ MODELİ VE RULE SCHEMA

## Ana tablolar

- `people` — minimum kişisel veri
- `employment_periods`
- `positions`
- `titles`
- `institutions`
- `service_branches`
- `pay_periods`
- `coefficient_versions`
- `legal_sources`
- `rule_versions`
- `pay_item_catalog`
- `pay_item_entitlements`
- `payroll_runs`
- `payroll_lines`
- `tax_ledgers`
- `minimum_wage_exemption_ledgers`
- `social_security_ledgers`
- `deduction_orders`
- `retro_adjustments`
- `collective_agreement_rules`
- `validation_issues`
- `golden_master_cases`
- `audit_events`

## payroll_line örneği

```json
{
  "pay_item_id": "GENERAL_BASE_MONTHLY",
  "gross_raw": "0.000000000000",
  "gross_payable": "0.00",
  "income_tax_base_delta": "0.00",
  "stamp_tax_base_delta": "0.00",
  "sgk_pec_delta": "0.00",
  "pension_5434_base_delta": "0.00",
  "employee_deduction": "0.00",
  "employer_cost_delta": "0.00",
  "rule_ids": [],
  "explanation": []
}
```

## Zorunlu tarihsel alanlar

Her bordro run'ında:

- `calculation_period`
- `calculated_at`
- `rule_snapshot_hash`
- `source_manifest_hash`
- `software_version`

saklanmalı.

## Snapshot

Mevzuat veri tabanı güncellendiğinde eski bordronun sonucu değişmemeli. Bordronun kullandığı rule version ID'leri immutable tutulmalı.

## Override

Manuel override yalnız yetkili rol ile:

- eski değer
- yeni değer
- gerekçe
- kullanıcı
- tarih/saat
- dayanak belge

kaydıyla yapılmalı. Override sonucu raporda görünür olmalıdır.


---

# Kaynak Modül: 10_KVKK_GUVENLIK_DENETIM.md

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


---

# Kaynak Modül: 11_TEST_KABUL_KRITERLERI.md

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


---

# Kaynak Modül: 13_KAYNAKLAR_VE_KITAPLAR.md

# RESMİ KAYNAKLAR VE ÖNERİLEN KİTAPLAR

## 1. Birincil kaynaklar — bunlar kitaplardan daha önemlidir

### Hazine ve Maliye Bakanlığı
- Personel kanunları/KHK envanteri: https://www.hmb.gov.tr/personel-kanunlari-kanun-hukmunde-kararnameleri
- Kamu Mali Yönetim ve Dönüşüm GM: https://kmyd.hmb.gov.tr/
- Muhasebat/KPHYS: https://muhasebat.hmb.gov.tr/
- KPHYS uygulama tanımı: https://btgm.hmb.gov.tr/uygulamalar
- Memur maaş işlemleri SSS: https://muhasebat.hmb.gov.tr/memur-maas-islemleri-sikca-sorulan-sorular
- KPHYS eğitim/kılavuzları: https://muhasebat.hmb.gov.tr/duyuru/kamu-personel-harcamalari-yonetim-sistemi-kphys-egitimi

### Mevzuat / Resmi Gazete
- https://www.mevzuat.gov.tr/
- https://www.resmigazete.gov.tr/

### SGK
- 4/c prim ve prime ilişkin işlemler: https://www.sgk.gov.tr/Content/Post/51eb246d-88b5-4356-ba97-3af847ec4ded/4c-Kapsamindaki-Sigortalilarin-Prim-ve-Prime-Iliskin-Islemleri-2026-01-12-12-07-35
- 5434–5510 ayrımı: https://www.sgk.gov.tr/Content/Post/52a2428a-9603-4aa1-bbeb-7746432953b6/5434-sayili-Kanun-ile-5510-sayili-Kanun-2022-08-18-11-26-15

### GİB
- Gelir Vergisi Kanunu / m.103 güncel tarife: https://gib.gov.tr/
- 2026 Gelir Vergisi Tarifesi: GİB'in 332 Seri No.lu Tebliğ ve 2026 tarife PDF'si
- 2026 Ücret Geliri Rehberi: GİB resmi rehberi
- Damga Vergisi Kanunu ve yıllık tebliğler: GİB mevzuat bölümü

### Toplu sözleşme
- ÇSGB mevzuat/toplu sözleşme sayfası: https://www.csgb.gov.tr/cgm/mevzuat/
- 2025/1 Kamu Görevlileri Hakem Kurulu Kararı
- 2026–2027 8. Dönem hizmet kolları toplu sözleşme metinleri

### Sağlık özel
- Sağlık Bakanlığı ek ödeme mevzuatı: https://khgmekodemedb.saglik.gov.tr/
- Aile hekimliği mevzuatı: Sağlık Bakanlığı resmi mevzuat sayfaları

## 2. Kitap önerileri

### Birinci tercih — madde bazlı uygulama
**Mustafa Dönmez — Açıklamalı–İçtihatlı Devlet Memurları Kanunu**  
12. Baskı, Mayıs 2025, yaklaşık 1009 sayfa. 657'nin madde bazlı açıklaması, idari görüş ve yargı kararları için iyi başvuru kitabı. Yazılıma “normatif kaynak” diye kopyalanmamalı; resmi metni yorumlamak için ikincil kaynak olarak kullanılmalı.

### İkinci tercih — daha sistematik kamu görevlileri hukuku
**Çınar Can Evren & İsmail Uçar — Kamu Görevlileri Hukuku**  
5. Baskı, Eylül 2025. Daha kompakt; personel rejiminin hukuk mantığını oturtmak için uygun.

### Ek kaynak
**Selman Sacit Boz, Abidin Kadir İnce, Gizem Elif Büyükyıldırım, Enis Acar — Kamu Personel Hukuku**  
Uygulama/yargı kararı perspektifi sağlar; baskısı daha eski olduğundan güncel mali tutarlar için kullanılmamalı.

### 5018 için
5018 şerh/uygulama kitapları yararlı olabilir; ancak maaş hesap motorunun matematiğini bunlardan çıkarmayın. HMB'nin güncel harcama/muhasebe düzenlemeleri ve KPHYS kılavuzları daha yüksek önceliklidir. Eski 5018 kitapları yalnız süreç ve sorumluluk çerçevesi için yardımcıdır.

### Ücretsiz kurumsal kaynak
TBMM/Sayıştay/HMB tarafından yayımlanmış **Kamu Mali Yönetimi El Kitabı** ve KPHYS eğitim dökümanları pratik uygulama açısından birçok ticari kitaptan daha değerlidir; güncellik kontrolü yapılmalıdır.

## 3. Yardımcı karşılaştırma kaynakları — normatif değildir

- Türkiye Belediyeler Birliği'nin memur maaş hesaplama aracı dönemsel smoke-test için kullanılabilir.
- Mutemet odaklı özel hesaplama siteleri çeşitli edge-case fikirleri verebilir; **resmi mevzuatın yerine geçmez** ve test “oracle”ı olarak tek başına kullanılmamalıdır.

## Kaynak kullanım etiketi

Her kaynak için:

- `PRIMARY_BINDING` — resmi mevzuat
- `PRIMARY_GUIDANCE` — HMB/SGK/GİB resmi kılavuz
- `SECONDARY_COMMENTARY` — kitap/makale
- `VALIDATION_ONLY` — bordro/yardımcı hesaplayıcı

etiketi kullan.


---

# Kaynak Modül: 14_HUKUKI_RISK_VE_SINIRLAR.md

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


---

# Kaynak Modül: 16_MEVZUAT_KONTROL_CHECKLIST.md

# MEVZUAT KONTROL CHECKLIST

Claude her üretim sürümünde aşağıdaki kontrolü doldursun.

## Dönemsel
- [ ] HMB aylık katsayısı doğrulandı
- [ ] HMB taban aylık katsayısı doğrulandı
- [ ] HMB yan ödeme katsayısı doğrulandı
- [ ] 399/4B/mahalli idare gibi tavanlar gereken rejimlerde doğrulandı
- [ ] yıllık GVK tarifesi doğrulandı
- [ ] asgari ücret istisnası parametreleri doğrulandı
- [ ] damga vergisi oran/istisnaları doğrulandı
- [ ] toplu sözleşme/hakem kurulu dönemi doğrulandı

## Çekirdek
- [ ] 657 ilgili maddeler
- [ ] 375 KHK ilgili maddeler
- [ ] 2006/10344 cetvelleri
- [ ] 4688/toplu sözleşme
- [ ] 5510 4/c
- [ ] 5434 geçiş
- [ ] 193 GVK
- [ ] 488 DVK

## Özel rejim — aktif olanlar
- [ ] 2914/2547
- [ ] 2802
- [ ] 926
- [ ] 3269/3466/4678
- [ ] 399 KHK
- [ ] 4924
- [ ] 5258 + Aile Hekimliği Ödeme Yönetmeliği
- [ ] Sağlık Bakanlığı Ek Ödeme Yönetmeliği
- [ ] 5393/49 mahalli idare sözleşmeli

## Tahakkuk/denetim
- [ ] 5018
- [ ] Merkezi Yönetim Harcama Belgeleri Yönetmeliği
- [ ] KPHYS güncel kılavuz/duyuru
- [ ] anonim e-Bordro golden master testleri


---

# Kaynak Modül: 17_2026_GUNCEL_KONTROL_PARAMETRELERI.md

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


---

# Kaynak Modül: 18_RESMI_KAYNAK_INDIRME_MANIFESTOSU.md

# RESMİ KAYNAK İNDİRME / CONTEXT MANİFESTOSU

Claude Code proje başlamadan `legal_sources/raw/` altında mümkün olan resmi kaynakları yerel kopya olarak toplasın ve SHA-256 oluştursun. URL erişilemiyorsa kullanıcıya dosya adıyla eksik kaynak listesi versin.

## Zorunlu çekirdek

1. 657 sayılı Devlet Memurları Kanunu — mevzuat.gov.tr konsolide metin
2. 375 sayılı KHK — mevzuat.gov.tr konsolide metin
3. 631 sayılı KHK — ilgili hükümler
4. 5510 sayılı Kanun
5. 5434 sayılı Kanun — geçiş hükümleri için
6. 193 sayılı Gelir Vergisi Kanunu
7. 488 sayılı Damga Vergisi Kanunu + (1) sayılı tablo
8. 4688 sayılı Kanun
9. 5018 sayılı Kanun
10. 2006/10344 sayılı Zam ve Tazminatlar Kararı ve güncel cetvelleri
11. Sözleşmeli Personel Çalıştırılmasına İlişkin Esaslar
12. Merkezi Yönetim Harcama Belgeleri Yönetmeliği

## 2026 dönem dosyaları

13. HMB 2026 Ocak Mali ve Sosyal Haklar Genelgesi
14. HMB 2026 Temmuz Mali ve Sosyal Haklar Genelgesi
15. GİB 332 Seri No.lu Gelir Vergisi Genel Tebliği
16. GİB 2026 Ücret Geliri Rehberi
17. 2025/1 Kamu Görevlileri Hakem Kurulu Kararı
18. 8. Dönem 2026–2027 hizmet kolu toplu sözleşmeleri
19. SGK 4/c prime esas kazanç ve oranlar resmi açıklaması
20. SGK 5434–5510 ayrımı resmi açıklaması

## Özel rejimler — desteklenecekse zorunlu

21. 2914 + ilgili 2547 hükümleri
22. 2802
23. 926
24. 3269
25. 3466
26. 4678
27. 399 KHK
28. 4924
29. 5258
30. Aile Hekimliği Sözleşme ve Ödeme Yönetmeliği
31. Sağlık Bakanlığı Ek Ödeme Yönetmeliği
32. 209 sayılı Kanunun ilgili döner sermaye hükümleri
33. 5393 m.49 ve dönemsel mahalli idare sözleşmeli personel ücret genelgesi

## HMB/KPHYS uygulama belgeleri

- https://btgm.hmb.gov.tr/uygulamalar
- https://muhasebat.hmb.gov.tr/memur-maas-islemleri-sikca-sorulan-sorular
- https://muhasebat.hmb.gov.tr/duyuru/kamu-personel-harcamalari-yonetim-sistemi-kphys-egitimi

## Sağlık özel resmi giriş noktaları

- https://khgmekodemedb.saglik.gov.tr/
- Sağlık Bakanlığı resmi aile hekimliği mevzuat sayfaları

## Dosya adı standardı

`YYYY-MM-DD__KAYNAK_KURUM__MEVZUAT_NO__KISA_AD.pdf`

Örnek:

`2026-07-03__HMB__GENELGE_5__MALI_VE_SOSYAL_HAKLAR.pdf`

## Manifest alanları

```json
{
  "source_id": "HMB_2026_H2_COEFFICIENTS",
  "authority": "HMB",
  "official_url": "...",
  "local_path": "legal_sources/raw/...pdf",
  "sha256": "...",
  "retrieved_at": "2026-08-27T...+03:00",
  "publication_date": "2026-07-03",
  "effective_from": "2026-07-01",
  "effective_to": "2026-12-31",
  "verified": true
}
```


---

<!-- BİRLEŞİK DOSYA SONU — 18 dosya -->
