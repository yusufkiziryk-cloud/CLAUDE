# Resmî Kriter Tabloları ve Hesap Kuralları

> Kaynaklar: **HYP Tarama ve Takip Kılavuzu (14.04.2026), Bölüm 1** ve
> **Aile Hekimliği Tarama ve Takip Katsayısına İlişkin Yönerge** (30/6/2021
> tarihli 1091 sayılı yönergeyi yürürlükten kaldıran metin; kopyası
> `kaynak/yonerge-tarama-takip-katsayisi.pdf`). Bu dosya `src/hyp-katsayi.js`
> motorunun davranış sözleşmesidir; ikisi birlikte güncellenir.
> Motorun tablo tutarlılık testi: aktif 18 AH kriterinin üst katsayı çarpımı
> 1,500000, alt katsayı çarpımı 0,900000; ASÇ üst çarpımı 1,2000.

## 1. Aile hekimliği birimi (AHB) — Kılavuz Tablo 1 ve 3

| Kriter | Tür | Asgari % | Azami % | Asgari altı | Asgari | Azami ve üstü |
|---|---|---|---|---|---|---|
| Hipertansiyon | Tarama | 40 | 90 | 0,993999 | 1 | 1,023440 |
| Hipertansiyon | Takip | 50 | 90 | 0,996994 | 1 | 1,011652 |
| Hipertansiyon | Sonuç | 40 | 90 | 1 | 1 | 1 |
| Diyabet | Tarama | 40 | 90 | 0,993999 | 1 | 1,023440 |
| Diyabet | Takip | 50 | 90 | 0,996994 | 1 | 1,011652 |
| Diyabet | Sonuç | 40 | 90 | 1 | 1 | 1 |
| Obezite | Tarama | 40 | 90 | 0,996994 | 1 | 1,011652 |
| Obezite | Takip | 50 | 90 | 0,993997 | 1 | 1,023440 |
| Obezite | Sonuç | 40 | 90 | 1 | 1 | 1 |
| Serviks kanseri | Tarama | 50 | 90 | 0,991010 | 1 | 1,035365 |
| Kolorektal kanser | Tarama | 50 | 90 | 0,991010 | 1 | 1,035365 |
| Meme kanseri | Tarama | 40 | 90 | 0,991010 | 1 | 1,035365 |
| Kardiyovasküler risk | Tarama | 40 | 90 | 0,993999 | 1 | 1,023440 |
| Kardiyovasküler risk | Takip | 50 | 90 | 0,996994 | 1 | 1,011652 |
| Kardiyovasküler risk | Sonuç | 40 | 90 | 1 | 1 | 1 |
| Çok yönlü yaşlı sağlığı değ. | Takip | 50 | 90 | 0,993997 | 1 | 1,023440 |
| Koroner arter hastalığı | Takip | 40 | 85 | 0,993997 | 1 | 1,023440 |
| İnme | Takip | 40 | 85 | 0,993997 | 1 | 1,023440 |
| Kronik böbrek hastalığı | Takip | 40 | 85 | 0,993997 | 1 | 1,023440 |
| KOAH | Takip | 40 | 85 | 0,993997 | 1 | 1,023440 |
| Astım | Takip | 40 | 85 | 0,993997 | 1 | 1,023440 |
| Otizm | Tarama | 40 | 90 | 0,993997 | 1 | 1,023440 |
| Süreç yönetimi | — | 50 | 80 | 1 | 1 | 1 |

"Sonuç" kriterleri ve "Süreç yönetimi" (Yönerge md.8: son bir yılda kişilerin
kayıtlı AHB'ye başvurusunun tüm sağlık kuruluşlarına başvurusuna oranı) bugün
katsayı 1 ile tanımlıdır; motorda `aktif: false` olarak tutulur, Bakanlık
katsayı verdiğinde yalnızca tablo güncellenir.

## 2. Aile sağlığı çalışanı (ASÇ) — Kılavuz Tablo 2 ve 4

| Kriter | Asgari % | Azami % | Asgari altı | Asgari | Arası | Azami ve üstü |
|---|---|---|---|---|---|---|
| Vital bulgular (tarama-takip) | **40** | 90 | 0,93 | 1 | 1 → 1,06 | **1,0611** |
| Çok yönlü yaşlı sağlığı değ. (tarama-takip) | **40** | 90 | 0,97 | 1 | 1 → 1,13 | **1,1309** |

Motor, ara bölgede 1'den azami değere (1,0611 / 1,1309) doğrusal gider; böylece
%90'da süreklilik korunur. 1,0611 × 1,1309 = 1,2000: ASÇ azami katsayısı.
Not: 01.06.2025 tarihli ASÇ bilgilendirme belgesindeki %50 eşiği ve 1,06/1,13
değerleri bu tabloyla **güncellenmiştir**.

## 3. Hesap kuralları — Yönerge

- **Başarı oranı (md.4/b):** aylık yapılan + varsa önceki dönemden %100 üzeri
  devreden sayı toplamının, o ay gereken sayıya oranı.
- **Kriter katsayısı (md.7/2):** asgari altı → alt katsayı; asgari → 1;
  asgari–azami arası doğrusal; azami ve üstü → üst katsayı.
- **Tarama ve takip katsayısı (md.7/3):** tüm kriter katsayılarının çarpımı.
- **ASÇ maaşı (md.7/3):** (a) ASÇ < 1 → ASÇ'nin katsayısı; (b) ASÇ ≥ 1 ve
  birimin %75'inden küçük → ASÇ'nin katsayısı; (c) ASÇ ≥ 1 ve birimin
  %75'ine eşit/büyük → birim ile ASÇ'den büyük olanı.
- **Büyük birim (md.7/4):** kayıtlı kişi 4000 (entegre/zorunlu düşük nüfus:
  2400) üzerinde veya tutuklu-hükümlü kayıtlı 2000 üzerinde ise, asgari
  oranı geçen kriterin katsayısı 1 uygulanır.
- **Tavan (md.7/5):** ≤4000 normal birimde 4000/nüfus; ≤2400 entegre/zorunlu
  düşük nüfusta 2400/nüfus; tutuklu-hükümlü >1700 → 1,176471, 1500–1700 →
  1,333334. (Üst katsayıların çarpımı 1,5 olduğundan katsayı zaten 1,5'i aşamaz.)
- **Muafiyetler:** maaşa esas puan < 1000 → 1 (md.7/6); yeni birimde 18. ayın
  sonuna kadar (6. ayda 500 nüfus şartı, ilk 2000 puan) → 1 (md.7/7); hedef
  nüfus listesi 0 kişi → o kriter 1 (md.7/8).
- **Devir (md.7/9):** %100'ü aşan sayılar en fazla 2 ay ileri devreder; o ay
  gerekenin en az %10'u yapılmışsa kullanılır; kullanılan sayı sonraki aya
  devreden sayıdan düşülür.
- **%10 yapılamadıysa (md.7/10):** devreden sayı azami oranın altındaysa alt
  katsayı; üstündeyse devrin ilk ayı 1, sonraki devir aylarında %10
  yapılmadıysa alt katsayı, yapıldıysa başarı oranına göre katsayı.
- **SİNA–HYP farkı (md.5/5):** itiraz yok; takip eden ayın 2. gününe kadar
  yazilimdestek.saglik.gov.tr üzerinden teknik başvuru.

## 4. Yönerge'de OLMAYAN ve motorda kodlanmayan konular

- Kronik hastalık tarama **teşvik oranı** (%40 / %70 eşikleri): başka bir
  düzenlemeye aittir; belge gelmeden motora girmez.
- Hekim ve ASÇ **maaş bordrosu** hesabı (Sözleşme ve Ödeme Yönetmeliği):
  ayrı modül, ayrı kaynak.
