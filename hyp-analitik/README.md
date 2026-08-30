# HYP Analitik

Aile hekimliği **HYP tarama ve takip katsayısı** analiz aracı. Aylık
hedef/yapılan verilerinden kriter katsayılarını, devir zincirini, tavan
uygulamasını ve maaş çarpanını 01.06.2025 tarihli Yönerge kurallarıyla
hesaplar.

## Kullanım

`hyp-analitik.html` dosyasını tarayıcıda açın — kurulum yok, internet
gerekmez. Veriler cihazda (tarayıcı depolamasında) kalır; JSON yedekleme ve
geri yükleme uygulama içindedir.

## Geliştirme

```bash
node --test test/hyp-katsayi.test.js   # motor testleri (10 test)
```

- Hesap motoru: `src/hyp-katsayi.js` (bağımlılıksız ES module)
- Kural sözleşmesi: `bilgi-tabani/katsayi-hesabi-asc.md`
- Proje kimliği ve çalışma kuralları: `CLAUDE.md`

> Bu araç bilgilendirme amaçlıdır; resmî hesap için ilgili Yönerge ve resmî
> sistemler esastır.
