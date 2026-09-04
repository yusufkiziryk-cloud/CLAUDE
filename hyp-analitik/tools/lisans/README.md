# Lisans Anahtarı Üretimi

Uygulama tamamen istemci tarafında çalıştığı için lisans, **satıcının özel
anahtarıyla imzalanmış** bir metindir; uygulama yalnızca açık anahtarı taşır.

1. **Bir kez:** `node tools/lisans/anahtar-uret.js uretim`
   - `tools/lisans/.gizli/uretim.ozel.pem` → özel anahtar. Yedekleyin, paylaşmayın (git dışıdır).
   - `tools/lisans/uretim.acik.json` → açık anahtar. `hyp-analitik.html` içindeki
     `LISANS_ACIK_ANAHTAR` sabitine yapıştırın (dev anahtarının yerine).
2. **Her satışta:**
   `node tools/lisans/lisans-uret.js --plan SAAS_STANDARD --ad "Dr. Ayşe Yılmaz" --eposta ayse@example.com --bitis 2027-09-04 --cihaz 3`
   Çıkan `HYPA1...` metnini müşteriye iletin; müşteri uygulamada **Lisans** düğmesinden yapıştırır.
3. Planlar: `DEMO`, `OFFLINE_INDIVIDUAL`, `SAAS_STANDARD`, `HYBRID_PRO`, `INSTITUTIONAL`
   (`config/planlar.json` ile aynı). Bitiş tarihi geçince uygulama DEMO'ya döner.

> Depodaki `dev.acik.json` yalnızca geliştirme/önizleme derlemeleri içindir;
> özel anahtarı depoya konmaz (depo herkese açık). Kendi anahtarınızı üretip
> `node tools/derle.js --kid uretim` ile derleyin. Uygulama dev anahtarıyla
> derlendiğinde "GELİŞTİRME ANAHTARI" uyarısı gösterir.
