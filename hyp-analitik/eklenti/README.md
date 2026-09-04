# HYP Analitik — SİNA Aktarıcı (Chrome eklentisi)

SİNA **Pozitif Performans** ekranındaki gereken / yapılan / devreden sayılarını
okuyup HYP Analitik'in içe aktarma biçiminde JSON üretir. Kullanıcı SİNA'ya
kendisi giriş yapar (2FA dahil); eklenti şifre saklamaz, hiçbir sunucuya veri
göndermez.

## Kurulum (geliştirici modu)

1. Chrome → `chrome://extensions` → sağ üstte **Geliştirici modu** açık.
2. **Paketlenmemiş öğe yükle** → bu `eklenti/` klasörünü seçin.
3. SİNA'da Pozitif Performans ekranını açın; sağ altta yeşil düğme belirir.

## Mağazaya yayın

Chrome Web Store geliştirici hesabı (tek seferlik ücret) → klasörü zip'leyip
yükleyin; gizlilik politikası olarak `site/gizlilik.html` adresini verin.
`simgeler/` klasörüne 16/48/128 px PNG simge ekleyip `manifest.json`'a
`icons` alanını girin.

## Bakım

SİNA arayüzü (Vuetify + ReactVirtualized) değiştiğinde yalnızca
`icerik-sina.js` başındaki `SECICILER` bloğu güncellenir. Okuma başarısız
olursa uygulama her zaman elle girişe izin verir.
