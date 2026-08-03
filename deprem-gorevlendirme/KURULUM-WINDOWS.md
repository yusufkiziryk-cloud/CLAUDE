# Windows Kurulum Talimatı

Bu belge, uygulamanın **Windows 10/11 bilgisayarda veya Windows Server üzerinde** kurulumunu adım adım anlatır. Teknik bilgi gerektirmez.

## 1. Node.js Kurulumu

1. https://nodejs.org adresine gidin.
2. **LTS** sürümünü (20 veya 22) indirin ve kurun (Next → Next → Finish).
3. Kurulumu doğrulamak için **Komut İstemi**'ni açın (Başlat → `cmd`) ve şunu yazın:
   ```
   node --version
   ```
   `v20.x` veya `v22.x` benzeri bir sürüm görmelisiniz.

## 2. Uygulama Dosyalarını Kopyalama

1. `deprem-gorevlendirme` klasörünü bilgisayarda kalıcı bir yere kopyalayın, örneğin:
   `C:\deprem-gorevlendirme`

## 3. Kurulum (tek seferlik)

1. Klasörün içindeki **`kurulum.bat`** dosyasına çift tıklayın.
2. Bu betik sırasıyla:
   - Bağımlılıkları indirir (`npm install`)
   - `.env` ayar dosyasını oluşturur
   - Demo verisini yükler (`npm run seed`)
   - Uygulamayı derler (`npm run build`)
3. İşlem birkaç dakika sürebilir. "KURULUM TAMAMLANDI" mesajını bekleyin.

> **Önemli (güvenlik):** Kurulumdan sonra `.env` dosyasını Not Defteri ile açıp
> `SESSION_SECRET=` satırındaki değeri rastgele, uzun bir metinle değiştirin.
> Gerçek kullanım öncesi `DEMO_MODE=1` satırını `DEMO_MODE=0` yapın.

## 4. Uygulamayı Başlatma

1. **`baslat.bat`** dosyasına çift tıklayın.
2. Pencerede `Ready` yazısını gördükten sonra tarayıcıdan şu adrese girin:
   - Aynı bilgisayarda: **http://localhost:3000**
   - Ağdaki diğer bilgisayar/telefonlardan: **http://SUNUCU-IP:3000** (ör. `http://192.168.1.20:3000`)
3. Pencereyi kapatmak uygulamayı durdurur. Sunucuda sürekli çalışması için pencere açık kalmalıdır (veya bkz. bölüm 7).

## 5. Demo Hesaplarla Deneme

| Rol | Kimlik | Şifre |
|---|---|---|
| İl Yöneticisi | `11111111111` | `admin123` |
| İlçe Yöneticisi | `22222222222` | `ilce123` |
| Aile Hekimi | `10000000001` | `demo123` |
| Aile Sağlığı Çalışanı | `10000000002` | `demo123` |

## 6. Gerçek Personel Listesini Yükleme

1. İl yöneticisi olarak giriş yapın.
2. **Excel Yükleme** ekranından boş şablonu indirin.
3. Şablonu kurumunuzun personel listesiyle doldurun (örnek satırları silin).
4. Aynı ekrandan dosyayı yükleyin. Aynı kişi ikinci kez yüklenirse bilgileri güncellenir, mükerrer kayıt oluşmaz.
5. Demo verilerini temizlemek için: uygulamayı durdurun, `data\uygulama.db` dosyasını silin, uygulamayı başlatın (boş veritabanı oluşur) ve yalnızca gerçek listeyi yükleyin. İlk yönetici hesabı için `npm run seed` yerine tek seferlik olarak seed betiğini kullanabilir veya bize başvurabilirsiniz — pratik yol: önce seed çalıştırıp demo personelleri Excel'den gelen gerçek liste ile pasife çekmektir.

## 7. Ağda Sürekli Çalıştırma (Windows Server önerisi)

- **Basit yol:** Sunucuda `baslat.bat`'ı açık bırakın (oturum kapatılmamalıdır).
- **Kalıcı servis:** `npm install -g pm2` ve `pm2 start npm --name deprem -- start` ile uygulamayı arka planda servis gibi çalıştırabilirsiniz (`pm2 save` + `pm2-startup` ile açılışta başlatma).
- **Güvenlik duvarı:** Diğer bilgisayarların erişebilmesi için Windows Güvenlik Duvarı'nda **3000** numaralı TCP bağlantı noktasına gelen erişime izin verin.
- **HTTPS:** Kurum genelinde kullanım için IIS veya Nginx ters vekil arkasına alıp HTTPS sertifikası bağlamanız önerilir.

## 8. Yedekleme

Tüm veriler tek dosyadadır: **`data\uygulama.db`**
Bu dosyayı düzenli olarak (uygulama kapalıyken) güvenli bir yere kopyalamanız yeterlidir.

## Sık Karşılaşılan Sorunlar

| Sorun | Çözüm |
|---|---|
| `node` tanınmıyor | Node.js kurulumundan sonra bilgisayarı yeniden başlatın. |
| 3000 portu kullanımda | `baslat.bat` içindeki `set PORT=3000` satırını `3001` yapın. |
| Telefonlardan erişilemiyor | Sunucu IP'sini doğru yazdığınızdan ve güvenlik duvarı iznini verdiğinizden emin olun. |
| Şifre unutuldu (personel) | Yeni sürüme kadar: yönetici veritabanından ilgili kaydın `password_hash` alanını boşaltır, personel "İlk Giriş" ile yeni şifre oluşturur. |
