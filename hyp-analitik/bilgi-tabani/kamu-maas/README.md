# Kamu Maaş Bilgi Tabanı (657 + Aile Hekimliği)

> Kaynak: claude.ai projesi **"657 ve AİLE HEKİMLİĞİ MAAŞ HESAPLAMA"** — Project
> Knowledge (18 dosya), birleşik dosya olarak 04.09.2026'da aktarıldı.
> `KAMU_MAAS_HYP_PROJECT_KNOWLEDGE_BIRLESIK.md` orijinaldir (aynen korunur);
> `NN-*.md` dosyaları ondan programatik olarak bölünmüştür ve her birinin
> başında köken satırı vardır. 01, 12 ve 15 numaralı dosyalar kaynak projede
> yoktur.

## Dizin

| Dosya | Başlık | HYP Analitik'te karşılığı |
|---|---|---|
| `00-oku-beni.md` | Context pack: amaç, bilgi önceliği, katı kurallar | `../../CLAUDE.md` çalışma kuralları 9–11 |
| `00-projeye-nasil-yuklenecek.md` | Yükleme talimatı, bilgi önceliği sırası | `kurallar/2026-kurallar.json` → `_bilgiOnceligi` |
| `02-mevzuat-envanteri.md` | Mevzuat envanteri | Kural kaynak listesi (hash'ler henüz yok) |
| `03-personel-rejimleri.md` | Personel rejimleri ve routing | Yalnızca aile hekimliği (5258) dilimi + sosyal güvenlik rejimi (5510 4/c, 5434) |
| `04-maas-odeme-kalemleri.md` | Ödeme kalemleri kataloğu, vergi profilleri | Kalem profili kutucukları (GV / damga / PEK); ek md.40 kuralı |
| `05-vergi-sgk-kesinti-motoru.md` | Vergi, SGK, emekli keseneği, kesinti motoru | `src/bordro-motoru.js` (kesinti sırası §7) |
| `06-kural-motoru-surumleme.md` | Kural motoru, sürümleme, kaynak izi | `kurallar/*.json` şeması, `kuralSec()` |
| `07-hesaplama-sirasi-ve-formul-presipleri.md` | Hesap sırası ve formül prensipleri | `bordroHesapla()` adımları 1–5 |
| `08-ozel-moduller-ve-hizmet-kollari.md` | Özel modüller ve hizmet kolları | Hekim / ASÇ varsayılan kalem listeleri |
| `09-veri-modeli-ve-rule-schema.md` | Veri modeli ve rule schema | Kural JSON alanları (rule_id, version, status, effective_from/to, source) |
| `10-kvkk-guvenlik-denetim.md` | KVKK, güvenlik, denetim | Veri cihazda kalır; gerçek bordro ve kişisel veri depoya girmez |
| `11-test-kabul-kriterleri.md` | Test ve kabul kriterleri | `test/bordro-motoru.test.js` |
| `13-kaynaklar-ve-kitaplar.md` | Resmî kaynaklar ve kitaplar | — |
| `14-hukuki-risk-ve-sinirlar.md` | Hukuki riskler, sınırlar, fail-closed (§9) | KİLİTLİ / TAHMİNİ davranışı, çıktı uyarısı |
| `16-mevzuat-kontrol-checklist.md` | Mevzuat kontrol listesi | — |
| `17-2026-guncel-kontrol-parametreleri.md` | 2026 güncel kontrol parametreleri | Kural değerleri (HMB katsayıları, GV tarifesi, SGK oranları) |
| `18-resmi-kaynak-indirme-manifestosu.md` | Resmî kaynak indirme manifestosu | VERIFIED için sha256 süreci |
| `99-project-knowledge-master.md` | Master (tüm dosyaların birleşimi) | — |

## Kapsam: bilgi tabanının hangi dilimi uygulandı?

Bilgi tabanı genel bir kamu maaş motorunu tarif eder (657, 4/B, 4924,
akademik, hâkim-savcı, TSK, sağlık kolları…). HYP Analitik bunun yalnızca
**aile hekimliği dilimini** uygular:

- **Uygulanan:** genel kesinti motoru (sosyal güvenlik kişi/işveren payı,
  GVK 63 prim indirimi, kümülatif ücret tarifesi, damga vergisi, diğer
  kesintiler, net ve işveren maliyeti), tarih-sürümlü kural seçimi,
  fail-closed kilitleme, TAHMİNİ/SİMÜLASYON etiketi, açıklama zinciri, kalem
  profili (vergi/damga/PEK niteliği kalem adından çıkarılmaz, kullanıcı
  işaretler), tarama-takip katsayısının yalnızca katsayıya tabi kaleme
  (kayıtlı kişi ödemesi) uygulanması, hamlelerin aylık net karşılığı.
- **Uygulanmayan:** 657 gösterge / ek gösterge / taban aylık / yan ödeme /
  tazminat hesabı, kıdem, aile-çocuk yardımı, ek ders, nöbet, fiili hizmet
  zammı, sendika ödeneği, toplu sözleşme ikramiyesi, 5434'te %100 artış
  farkı ve kurumca karşılanan GSS, ilave işveren primi. Bilgi tabanı bunları
  anlatır; kural verisi ve kaynak hash'i olmadığı için kodlanmadı.
- **Aile hekimliği ödeme kalemlerinin mevzuattan türetilmesi** (kayıtlı kişi
  ödemesi, sosyoekonomik gelişmişlik ödemesi, ASM gider, gezici hizmet,
  tetkik-sarf) kodlanmadı: Aile Hekimliği Sözleşme ve Ödeme Yönetmeliği'nin
  yürürlükteki metni depoda yok. Kullanıcı brüt kalem tutarlarını kendi
  bordrosundan girer.

## Kural durumları ve VERIFIED için gerekenler

`kurallar/2026-kurallar.json` içindeki tüm kurallar **PROVISIONAL** (resmî
kaynak görüldü, hash yok) veya **RESEARCH_REQUIRED** (parametre yok)
durumundadır. Bu durumdaki kural üretim bordrosunda sessiz kullanılamaz;
motor sonucu TAHMİNİ etiketler, eksik parametreyi uygulamaz ve uyarı verir
(14 §9). VERIFIED'a geçiş için:

1. Kaynak belgeyi 18 numaralı manifestodaki resmî adresten indir,
   `sha256sum` al, kuralın `source.sha256` alanına yaz, `verified_at`
   tarihini güncelle, `status` alanını `VERIFIED` yap.
2. 2026 asgari ücret gelir vergisi ve damga vergisi istisna tutarlarını
   (GVK 23/18, 319 Seri No.lu Tebliğ) `ASGARI_UCRET_GV_ISTISNASI`
   parametrelerine gir.
3. Damga vergisi oranını (binde 7,59) yılın Damga Vergisi Genel Tebliği ile
   doğrula.
4. Anonim örnek bordro (hekim + ASÇ) ile motor çıktısını kalem kalem kontrol
   et; farklar `test/bordro-motoru.test.js` içine test olarak eklenir (11).

## Bağlayıcı kurallar (özet)

- Oran, katsayı, gösterge, tavan, istisna kod içine sihirli sayı olarak
  gömülmez; `kurallar/` içinde tarih-sürümlü ve kaynaklı tutulur (06).
- Bilgi önceliği: resmî yürürlükteki mevzuat > tarihli HMB/SGK/GİB
  düzenlemeleri > toplu sözleşme / hakem kurulu kararları > resmî kılavuzlar
  > yardımcı açıklamalar > ikincil kaynaklar. Çelişkide varsayım yapılmaz,
  kural CONFLICT işaretlenir ve motor kilitlenir (00).
- Her çıktıda: "Bu hesaplama karar destek ve kontrol amaçlıdır; kurumun
  resmî bordro/tahakkuk kaydının yerine geçmez." (14)
- Gerçek bordro ve kişisel veri (ad, T.C. kimlik no, IBAN) depoya
  commit'lenmez, loglanmaz, dış AI API'sine gönderilmez (10).
