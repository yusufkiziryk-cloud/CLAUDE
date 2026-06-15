# LAN Kamera & Dosya Paylaşımı

Aynı Wi-Fi ağındaki **iki cihaz** arasında, bir cihazın kamerasını canlı
izlemeni ve dosyalarına erişmeni sağlayan, **bağımlılıksız** (sadece Node.js
yerleşik modülleri) küçük bir uygulama.

- 📡 **Host** cihaz: kamerasını ve seçtiği dosyaları paylaşır.
- 👁️ **Guest** cihaz: kamerayı izler, paylaşılan dosyaları indirir.
- 📤 Her iki cihaz da birbirine dosya gönderebilir.
- 🔒 Kamera/dosya erişimi her cihazda **açıkça izin** ister; yayın ekranda görünür.
  (Gizli/arka planda çalışan bir araç değildir — yalnızca rızalı, kendi
  cihazların arası kullanım içindir.)

## Nasıl çalışır?

Sunucu yalnızca **sinyalleşme** (WebRTC el sıkışması) ve statik dosyaları
sunar. Görüntü ve dosyalar cihazdan cihaza **doğrudan** (peer-to-peer) gider;
aynı ağdayken sunucu üzerinden veri akmaz, bağlantı yereldir ve hızlıdır.

## Çalıştırma

```bash
cd lan-camera-share
node server.js
```

İlk çalıştırmada `certs/` altında kendinden imzalı bir HTTPS sertifikası üretilir
(kamera erişimi için güvenli bağlam — HTTPS — şarttır). Konsolda şunun gibi
adresler görürsün:

```
https://192.168.1.34:8443
https://localhost:8443
```

> Sunucuyu, iki telefonla **aynı Wi-Fi ağına** bağlı bir bilgisayarda (veya
> Termux gibi bir ortamda telefonda) çalıştır.

## Kullanım

1. Her iki telefonun tarayıcısında yukarıdaki `https://<ip>:8443` adresini aç.
2. İlk açılışta kendinden imzalı sertifika uyarısını **"Gelişmiş → Yine de devam et"**
   ile onayla.
3. Kamerayı verecek telefonda **"Bu cihazı paylaş"** seç → bir **oda kodu** üretilir.
   - "Kopyala" / "Paylaş…" ile bağlantıyı diğer telefona gönderebilirsin
     (bağlantı oda kodunu içerir).
4. Diğer telefonda **"Bir cihaza bağlan"** seç, aynı oda kodunu gir, **Bağlan**.
5. İzleyen taraf yayını görür. Host "Paylaşılacak dosya seç" ile dosya sunar;
   karşı taraf listeden **İndir** der. İki taraf da "Karşı cihaza dosya gönder"
   ile dosya iletebilir.

## Ortam değişkenleri

| Değişken | Varsayılan | Açıklama |
|----------|-----------|----------|
| `PORT`   | `8443`    | HTTPS portu |
| `HOST`   | `0.0.0.0` | Dinlenecek arayüz |

## Notlar / sınırlamalar

- Cihazın IP adresi değişirse sertifika SAN'ı eski kalır; `certs/` klasörünü
  silip sunucuyu yeniden başlat (yeni sertifika üretilir).
- Tarayıcı `getUserMedia` yalnızca güvenli bağlamda (HTTPS/localhost) kamera verir;
  bu yüzden HTTP yerine HTTPS kullanılır.
- Aynı ağda olmayan cihazlar için STUN yedeği eklidir ama farklı ağlar arası
  bağlantı için ek bir TURN sunucusu gerekebilir (bu araç ağ-içi kullanım odaklıdır).
- Tasarım gereği **rızalı** kullanım içindir: kurulu olduğu cihazda kamera/dosya
  erişimi izinle açılır ve aktif yayın ekranda görünür.
