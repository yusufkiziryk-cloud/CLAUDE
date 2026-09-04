# CLAUDE.md — HYP Analitik

> claude.ai'daki "HASTALIK YÖNETİM PLATFORMU" projesinin Claude Code ayağı.
> HYP Analitik üzerinde çalışan her oturum önce bunu, sonra
> `docs/urun-tasarimi.md` ve `bilgi-tabani/` klasörünü okur.

## PROJE KİMLİĞİ

**HYP Analitik, ticari bir üründür.** Aile hekimliği birimleri (aile hekimi +
aile sağlığı çalışanı) için HYP tarama-takip katsayısını resmî kurallarla
hesaplar, SİNA'dan veri alır ve "kaç işlem daha, ne kazandırır" aksiyon
önerisi verir. Gelir modeli `config/planlar.json` (deneme → yıllık bireysel /
online / hibrit → kurumsal); lisanslar satıcı anahtarıyla imzalanır.

- **Kullanıcı:** aile hekimi ve ASÇ; kurumsal planda ASM / ilçe sağlık müdürlüğü.
- **Dil:** Türkçe (arayüz, belgeler, commit mesajları, kullanıcıyla iletişim).
- **Doğruluk kaynağı:** HYP Tarama ve Takip Kılavuzu 14.04.2026 Bölüm 1 +
  Tarama ve Takip Katsayısı Yönergesi → `bilgi-tabani/kriter-tablolari-resmi.md`.
  Bordro tarafı için kamu maaş bilgi tabanı → `bilgi-tabani/kamu-maas/README.md`
  (claude.ai "657 ve AİLE HEKİMLİĞİ MAAŞ HESAPLAMA" projesinin aktarımı).
- **Maaş modülü:** katsayının aylık nete etkisini gösteren bordro
  **simülasyonu**; yalnızca aile hekimliği dilimi (hekim + ASÇ) uygulanır,
  sonuç her zaman "TAHMİNİ / SİMÜLASYON" etiketlidir, resmî bordro değildir.
- **Veri ilkesi:** kişi/hasta verisi yok; SİNA verisi yalnızca kullanıcının
  cihazında okunur, satıcı sunucusuna asla gitmez. Bu ilke ürün sözüdür.
- **İlgili sistemler:** SİNA (Pozitif Performans ekranı; okuma mekanizması
  `bilgi-tabani/sina-okuma-mekanizmasi.md`), hyp.saglik.gov.tr, rakipler
  (`docs/urun-tasarimi.md` §2).

## Depo düzeni

```
hyp-analitik/
├── CLAUDE.md                  # bu dosya
├── README.md                  # hızlı başlangıç
├── hyp-analitik.html          # DERLENMİŞ tek dosya uygulama (elle düzenlenmez)
├── app/sablon.html            # uygulama şablonu (UI + uygulama mantığı)
├── src/hyp-katsayi.js         # katsayı motoru — tek gerçek kaynak
├── src/bordro-motoru.js       # bordro motoru (fail-closed, açıklama zinciri)
├── src/lisans.js              # lisans doğrulama (ECDSA P-256, WebCrypto)
├── kurallar/2026-kurallar.json# tarih-sürümlü kural verisi (oran/tarife/katsayı)
├── test/                      # node --test (motor 13, lisans 4, bordro 8)
├── tools/derle.js             # şablon + motorlar + kurallar + lisans → hyp-analitik.html
├── tools/lisans/              # anahtar-uret.js, lisans-uret.js, dev.acik.json
├── eklenti/                   # Chrome MV3: SİNA Pozitif Performans → JSON
├── site/                      # tanıtım + gizlilik (GitHub Pages'e uygun)
├── config/planlar.json        # plan/paket tanımları
├── docs/urun-tasarimi.md      # iş modeli, mimari, yol haritası, hukuk
└── bilgi-tabani/              # resmî tablolar, yönerge, SİNA analizi, kaynaklar
    └── kamu-maas/             # 657 + aile hekimliği maaş bilgi tabanı (18 dosya)
```

## Çalışma kuralları

1. **Motorlar tek kaynaktır, HTML derlenir.** Katsayı kuralı değişikliği:
   `bilgi-tabani/kriter-tablolari-resmi.md` → `src/hyp-katsayi.js` →
   `test/` → `node tools/derle.js`. Bordro kuralı değişikliği:
   `bilgi-tabani/kamu-maas/` → `kurallar/2026-kurallar.json` (gerekirse
   `src/bordro-motoru.js`) → `test/` → derleme. `hyp-analitik.html` elle
   düzenlenmez.
2. **Testler yeşil kalır:** `node --test` (proje kökünde, 25 test). Tablo
   tutarlılık testi (üst çarpım 1,5 / alt 0,9 / ASÇ 1,2), yönerge örnekleri ve
   gelir vergisi tarifesi kontrol değerleri sabittir.
3. **Doğrulanmamış kural kodlanmaz.** Teşvik oranı, "Sonuç" ve "Süreç
   yönetimi" katsayıları, aile hekimliği ödeme kalemlerinin mevzuattan
   türetilmesi kaynak gelmeden aktif edilmez. Bordro parametreleri yalnızca
   `kurallar/` içinde, durum etiketiyle (VERIFIED / PROVISIONAL /
   RESEARCH_REQUIRED / CONFLICT / RETIRED) tutulur.
4. **Kesin dil yok:** "resmî hesap değildir; Bakanlık sistemleri esastır"
   notu her çıktıda kalır. Bakanlık ile ilişkilendirme izlenimi verilmez.
5. **Bağımlılık eklenmez** (uygulama, motor, eklenti). Tek dosya + çevrimdışı
   çalışma ürün kararıdır.
6. **Gizli anahtar commit'lenmez.** `tools/lisans/.gizli/` yalnızca dev
   anahtarı içerir; üretim anahtarı satıcının makinesinde kalır.
7. **Eklenti seçicileri** `eklenti/icerik-sina.js` başındaki `SECICILER`
   bloğunda tutulur; SİNA değişince yalnızca orası güncellenir.
8. **Ticari kararlar** (fiyat, plan sınırları, marka adı) kullanıcıya aittir;
   öneri yapılır, `planlar.json` değiştirilmez.
9. **Sihirli sayı yok.** Oran, katsayı, gösterge, tavan, istisna kod içine
   gömülmez; `kurallar/*.json` içinde yürürlük aralığı, kaynak adresi ve
   (VERIFIED için) sha256 ile tutulur. Bilgi önceliği: resmî yürürlükteki
   mevzuat > tarihli HMB/SGK/GİB düzenlemeleri > toplu sözleşme/hakem kurulu
   > resmî kılavuzlar > yardımcı açıklamalar > ikincil kaynaklar.
10. **Fail-closed bordro.** PROVISIONAL / RESEARCH_REQUIRED kural sessiz
    kullanılmaz: sonuç "TAHMİNİ / SİMÜLASYON" etiketlenir, eksik parametre
    uygulanmaz ve uyarı verilir; CONFLICT / RETIRED kural, belirsiz rejim veya
    tarih dışı tarife hesabı kilitler. Çıktı uyarısı sabittir: "Bu hesaplama
    karar destek ve kontrol amaçlıdır; kurumun resmî bordro/tahakkuk kaydının
    yerine geçmez."
11. **Bordro verisi gizlidir.** Gerçek bordro, ad, T.C. kimlik no, IBAN
    depoya commit'lenmez, loglanmaz, dış AI API'sine gönderilmez; testlerde
    yalnızca anonim/kurgusal tutarlar kullanılır.
