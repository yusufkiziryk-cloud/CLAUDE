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
├── src/hyp-katsayi.js         # hesap motoru — tek gerçek kaynak
├── src/lisans.js              # lisans doğrulama (ECDSA P-256, WebCrypto)
├── test/                      # node --test (motor 13, lisans 4)
├── tools/derle.js             # şablon + motor + lisans → hyp-analitik.html
├── tools/lisans/              # anahtar-uret.js, lisans-uret.js, dev.acik.json
├── eklenti/                   # Chrome MV3: SİNA Pozitif Performans → JSON
├── site/                      # tanıtım + gizlilik (GitHub Pages'e uygun)
├── config/planlar.json        # plan/paket tanımları
├── docs/urun-tasarimi.md      # iş modeli, mimari, yol haritası, hukuk
└── bilgi-tabani/              # resmî tablolar, yönerge, SİNA analizi, kaynaklar
```

## Çalışma kuralları

1. **Motor tek kaynaktır, HTML derlenir.** Kural/tablo değişikliği:
   `bilgi-tabani/kriter-tablolari-resmi.md` → `src/hyp-katsayi.js` →
   `test/` → `node tools/derle.js`. `hyp-analitik.html` elle düzenlenmez.
2. **Testler yeşil kalır:** `node --test` (proje kökünde). Tablo tutarlılık testi
   (üst çarpım 1,5 / alt 0,9 / ASÇ 1,2) ve yönerge örnekleri sabittir.
3. **Doğrulanmamış kural kodlanmaz.** Teşvik oranı, bordro hesabı, "Sonuç"
   ve "Süreç yönetimi" katsayıları kaynak gelmeden aktif edilmez.
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
