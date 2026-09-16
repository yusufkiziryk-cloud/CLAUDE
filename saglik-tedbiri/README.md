# Sağlık Tedbiri — Yazışma ve Takip

5395 sayılı Çocuk Koruma Kanunu'nun 5/1-d maddesi kapsamında verilen **sağlık tedbiri**
kararlarının takibi ve bu kararlarla ilgili resmî yazışmaların hazırlanması için
tek dosyalık, **tamamen çevrimdışı** çalışan bir araç.

## Kullanım

`index.html` dosyasına çift tıklayın — kurulum, sunucu, internet gerekmez.
Tarayıcıda açılır ve çalışmaya başlar.

İlk açılışta **Ayarlar** sekmesinden kurum bilgilerini doldurun (yazı başlığı, sayı kökü,
imza sahibi). Bu bilgiler üretilen bütün yazılarda kullanılır.

## Ne yapar

**Panel** — aktif dosya sayısı, raporu geciken ve yaklaşan dosyalar, rapor takvimi,
son üretilen yazıların listesi.

**Dosyalar** — her tedbir kararı için bir kayıt: çocuk ve veli bilgileri, mahkeme/esas/karar
bilgileri, tedbir türü, ilgili sağlık kuruluşu, durum (aktif / beklemede / sonlandırıldı).
Arama ve duruma göre filtreleme yapılabilir.

**Yazışma Oluştur** — dosya ve yazı türü seçilir, varsa ek alanlar (randevu tarihi, dönem,
gerekçe) doldurulur; resmî yazı formatında A4 çıktı üretilir. Yazdırılabilir (PDF'e de basılır),
metni panoya kopyalanabilir, "deftere işlenerek" evrak sayısı verilebilir.

Hazır yazı türleri:

| # | Yazı | Muhatap |
|---|------|---------|
| 1 | Tedbirin uygulanmaya başlandığı bildirimi | Mahkeme |
| 2 | Tedbirin uygulanması talimatı | Sağlık kuruluşu |
| 3 | Randevu daveti | Veli / vasi |
| 4 | Dönemsel uygulama (izleme) raporu | Mahkeme |
| 5 | Tedbirin uygulanamadığı bildirimi | Mahkeme |
| 6 | Nakil / adres değişikliği | Diğer il sağlık müdürlüğü |
| 7 | Tedbirin kaldırılması talebi | Mahkeme |

**Ayarlar** — kurum bilgileri, evrak sayısı sayacı, rapor periyodu (varsayılan 3 ay),
JSON yedek alma / geri yükleme, tüm verileri silme.

## Otomatik takip mantığı

Sıradaki rapor tarihi = **son gönderilen rapor tarihi** (yoksa tebliğ tarihi, o da yoksa
karar tarihi) **+ rapor periyodu**. Dönemsel rapor "deftere işlendiğinde" dosyanın son
rapor tarihi bugüne çekilir, takvim kendiliğinden ilerler. Kaldırma talebi yazıldığında
dosya "beklemede" durumuna geçer; mahkeme kararı gelince elle "sonlandırıldı" yapılır.

## Veri ve gizlilik

- Veriler **yalnızca** açtığınız tarayıcının yerel deposunda (`localStorage`) tutulur.
  Hiçbir sunucuya, buluta veya üçüncü tarafa veri gönderilmez; araç ağ isteği yapmaz.
- Bu nedenle **tarayıcı verilerini temizlemek kayıtları siler**. Ayarlar sekmesinden
  düzenli olarak JSON yedeği alın.
- Kayıtlar çocuklara ait **özel nitelikli kişisel sağlık verisi** içerir. Yedek dosyası
  şifresizdir — kurum politikanıza uygun şekilde saklayın, paylaşılan bilgisayarlarda
  kullanmayın.

## Sorumluluk

Üretilen metinler **taslaktır**. Gönderilmeden önce mevzuata, kurum yazışma usulüne ve
dosyanın somut durumuna göre kontrol edilmelidir. Araç hukukî görüş vermez.
