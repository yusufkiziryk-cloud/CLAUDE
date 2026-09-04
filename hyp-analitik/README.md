# HYP Analitik

Aile hekimliği **HYP tarama ve takip katsayısı** karar destek ürünü: resmî
kılavuz tablolarıyla hesap, SİNA'dan veri aktarımı, "kaç işlem daha" aksiyon
önerisi, hekim–ASÇ ekip analizi, dönem trendi, lisanslı planlar.

## Kullanım

- `hyp-analitik.html` → tarayıcıda açın; kurulum ve internet gerekmez.
- `eklenti/` → Chrome'a paketlenmemiş yükleyin; SİNA Pozitif Performans
  ekranında "HYP Analitik'e aktar" düğmesi çıkar (bkz. `eklenti/README.md`).
- `site/index.html` → tanıtım sayfası; GitHub Pages'te yayınlanabilir.

## Geliştirme

```bash
node --test                  # motor (13) + lisans (4) testleri
node tools/derle.js          # app/sablon.html + src/* → hyp-analitik.html
node tools/derle.js --artifact /tmp/onizleme.html   # sarmalayıcısız önizleme
node tools/lisans/anahtar-uret.js uretim            # satıcı anahtar çifti (bir kez)
node tools/lisans/lisans-uret.js --plan SAAS_STANDARD --ad "Dr. X" --bitis 2027-09-04 --kid uretim
```

- Hesap kuralları ve kaynaklar: `bilgi-tabani/kriter-tablolari-resmi.md`
- Ürün tasarımı (iş modeli, mimari, yol haritası): `docs/urun-tasarimi.md`
- Çalışma kuralları: `CLAUDE.md`

> Bilgilendirme amaçlıdır; resmî hesap için Bakanlık sistemleri esastır.
> Kişi/hasta verisi işlenmez; veriler kullanıcının cihazında kalır.
