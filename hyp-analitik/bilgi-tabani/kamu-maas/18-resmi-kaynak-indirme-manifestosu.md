> Kaynak: claude.ai projesi "657 ve AİLE HEKİMLİĞİ MAAŞ HESAPLAMA" — Project Knowledge dosyası `18_RESMI_KAYNAK_INDIRME_MANIFESTOSU.md` (birleşik dosya DOSYA 17/18, 04.09.2026). İçerik aynen korunmuştur; birleşik orijinal: `KAMU_MAAS_HYP_PROJECT_KNOWLEDGE_BIRLESIK.md`.

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
