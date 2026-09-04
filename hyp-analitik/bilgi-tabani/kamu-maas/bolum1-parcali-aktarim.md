> Kaynak: claude.ai projesi "657 ve AİLE HEKİMLİĞİ MAAŞ HESAPLAMA" — Project
> Knowledge, Bölüm 1/4 aktarımı (04.09.2026). Kopyalama kod bloklarının
> gövdelerini almadığı için bu dosya PARÇALIDIR; tam dosyalar geldiğinde
> ilgili numaralı dosyalarla değiştirilecek. Bilgi tabanında 18 dosya var
> (~88 KB); 01_CLAUDE_CODE_MASTER_PROMPT, 12_MEVZUAT_GUNCELLEME_PROMPTU ve
> 15_CLAUDE_CALISMA_TALIMATI bilgi tabanında YÜKLÜ DEĞİL.

## Gelen parçalar (dosya başlıkları ve ulaşan içerik)

- `00_OKU_BENI.md` — içerik gelmedi
- `00_PROJEYE_NASIL_YUKLENECEK.md` — içerik gelmedi (bkz. `00-yukleme-talimati.md`, muhtemelen aynı dosya)
- `02_MEVZUAT_ENVANTERI.md` — içerik gelmedi
- `03_PERSONEL_REJIMLERI.md` — kısmen geldi (aşağıda)
- 05–07 arası dosyaların başlıkları gelmedi; içeriklerinden parçalar aşağıda
- `08_OZEL_MODULLER_VE_HIZMET_KOLLARI.md` — içerik gelmedi
- `09_VERI_MODELI_VE_RULE_SCHEMA.md` — kısmen geldi (aşağıda)

## 03_PERSONEL_REJIMLERI.md (parça)

### Minimum rejim matrisi

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

### Kural birleştirme sırası

1. GENERAL_PUBLIC_OFFICIAL
2. seçili dönem katsayıları
3. sosyal güvenlik rejimi
4. istihdam rejimi
5. kurum türü
6. hizmet sınıfı
7. ünvan
8. hizmet kolu toplu sözleşme hükümleri
9. kurum/yer özel hükümleri
10. kişiye bağlı haklar/istisnalar

Çakışmada otomatik son-yazan-kazan yaklaşımı kullanma; her override için
legal_priority ve reason zorunlu olsun.

### Sosyal güvenlik rejimi ayrı tutulmalı

employment_regime=DMK_657 olması kişinin 5434 veya 5510-4/c olduğunu tek
başına belirlemez. İlk kamu hizmet tarihi ve geçmiş 5434 iştirakçiliği gibi
bilgiye göre social_security_regime çözülür. Önerilen kodlar:
PENSION_5434_TRANSITION, SGK_5510_4C, SPECIAL_REVIEW_REQUIRED.

### Unvan kataloğu

Unvanı serbest metinle doğrudan formüle bağlama. Merkezi title_catalog kur:
canonical title, kurum, sınıf, derece aralığı, ek gösterge cetveli referansı,
özel hizmet tazminatı grubu, ek ödeme grubu, makam/görev/temsil uygunluğu,
toplu sözleşme özel hakları, özel kanun adapter'ı. Benzer unvan adları
"fuzzy match" ile otomatik kesinleştirilmesin; düşük güven durumunda
kullanıcı onayı alınsın.

## Başlığı gelmeyen dosyalardan parçalar (muhtemelen 05–07)

- Bir kalem için metadata tamamlanmamışsa, motor "0 TL" deyip sessiz
  geçmesin; UNRESOLVED_PAY_ITEM uyarısı versin.
- Sıra yalnız görsel sunum değildir; bazı kalemlerin vergi matrahına etkisi
  nedeniyle hesap sırası kural motoruyla belirlenmelidir.

### 8. İcra/nafaka/BES/sendika

Bu modüller çekirdek maaş formülünden ayrılmalı. Her biri: yasal dayanak,
başlangıç/bitiş, sabit/oransal tutar, öncelik, üst sınır, haczedilemez kalem
profilleri, aynı ayda kalan bakiye bilgisiyle çalışmalıdır. İcra kesintisi
gibi yüksek riskli alanlarda hukuki kural tam doğrulanmadan otomatik karar
üretme.

### Kural durumu (Status)

- VERIFIED: resmi kaynak + madde + dönem doğrulandı
- PROVISIONAL: resmi kaynak görüldü ama formül/istisna tam ayrıştırılmadı
- CONFLICT: iki kaynak arasında yorum/versiyon farkı var
- RESEARCH_REQUIRED: mevzuat eksik
- RETIRED: artık yürürlükte değil, tarihsel bordro için saklanıyor

PROVISIONAL/CONFLICT/RESEARCH_REQUIRED kural üretim bordrosunda sessiz
kullanılamaz.

### Source manifest (`rules/source_manifest.json`)

source_id, authority, title, document_type, law_number, rg_date, rg_no,
effective_from, effective_to, source_url, local_file, sha256, retrieved_at,
supersedes, superseded_by, notes.

### Dönem seçimi

calculation_date → kural versiyonunu seçer. "Sistemdeki en yeni rule dosyası"
seçilmez.

### Mevzuat güncellemesi (yeni belge geldiğinde)

1. SHA-256 hesapla.
2. Önceki kaynakla diff çıkar.
3. Değişen madde/bentleri belirle.
4. Etkilenen rule_id'leri listele.
5. Etkilenen personel rejimlerini çıkar.
6. Yürürlük tarihini belirle.
7. Eski kuralı silme; effective_to ver.
8. Yeni kuralı yeni version ile ekle.
9. Regresyon testlerini iki dönem için çalıştır.
10. MEVZUAT_DEGISIKLIK_ETKI_RAPORU.md üret.

### Çakışma örnekleri

- Toplu sözleşme ile genel kanun uygulaması arasında ek mali hak
- Özel personel kanununun 657'ye göre farklı hükmü
- HMB genelgesindeki katsayı değişimi
- Vergi tebliğinin yıl değişimi
- SGK geçiş rejimi ile 5510 yeni rejim matrah farklılığı

Çakışma çözümünün gerekçesi kayıt altına alınmalı; kullanıcıya yalnız sonuç
gösterilmemeli.

## 09_VERI_MODELI_VE_RULE_SCHEMA.md (parça)

### Zorunlu tarihsel alanlar

Her bordro run'ında: calculation_period, calculated_at, rule_snapshot_hash,
source_manifest_hash, software_version saklanmalı.

### Snapshot

Mevzuat veri tabanı güncellendiğinde eski bordronun sonucu değişmemeli.
Bordronun kullandığı rule version ID'leri immutable tutulmalı.

### Override

Manuel override yalnız yetkili rol ile: eski değer, yeni değer, gerekçe,
kullanıcı, tarih/saat, dayanak belge kaydıyla yapılmalı. Override sonucu
raporda görünür olmalıdır.
