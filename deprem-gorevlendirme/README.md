# Deprem Görevlendirme Takip Sistemi

Şanlıurfa İl Sağlık Müdürlüğü bünyesindeki **aile hekimleri** ve **aile sağlığı çalışanlarının**, deprem/afet görevlendirmesine uygunluk durumlarını her ay kolayca beyan edebildiği; yöneticilerin uygun personel arasından **otomatik veya manuel görevlendirme** yapıp **Excel / Word / PDF** çıktıları alabildiği, sade ve mobil uyumlu web uygulaması.

## Özellikler

**Personel tarafı**
- T.C. kimlik no / sicil no + şifre veya telefon + doğrulama kodu ile giriş
- İlk girişte şifre oluşturma (kayıtlı telefon doğrulamasıyla)
- Ana ekranda kimlik/görev yeri bilgileri, son beyan tarihi ve bu ayın beyan durumu
- **"Durumumda değişiklik yok"** ile önceki ayın beyanını tek tuşla bu aya aktarma (10–15 sn)
- Değişiklik varsa 7 soruluk kısa form + isteğe bağlı açıklama (300 karakter) + zorunlu doğruluk onayı
- Geçmiş beyanlar, görevlendirme durumu ve profil ekranları
- Bildirimler: "beyan vermediniz", "son 1 gün", "beyanınız kaydedildi", "asıl/yedek seçildiniz"

**Otomatik uygunluk değerlendirmesi**
- Cevaplara göre otomatik gruplama: *Uygun / Uygun Değil / Yönetici Değerlendirmesi Gerekli / İzinli-Raporlu / Beyan Vermedi*
- Kurallar yönetici ekranından değiştirilebilir (her sorunun "Evet" cevabının etkisi seçilir)

**Yönetici tarafı**
- Özet kartlı dashboard (toplam, beyan veren/vermeyen, uygun, değerlendirme bekleyen, görevlendirilen, yedek…)
- Ay/yıl, ilçe, ASM, birim, unvan, uygunluk, beyan ve görev geçmişi filtreleri
- **Otomatik görevlendirme**: sayılar ve ilçeler belirlenir; sistem yalnızca "Uygun" havuzundan, az görevlendirilene ve son görevi eski olana öncelik vererek, arka arkaya seçim yapmadan, ASM limiti ve ilçe dengesiyle seçer
- Taslak önizleme: kişi ekle/çıkar, asıl↔yedek değiştir (manuel değişiklikler kayıt altına alınır), listeyi onayla
- Excel ile toplu personel yükleme (mükerrer kayıt engelli: mevcut güncellenir, yeni eklenir)
- Beyan vermeyenler ekranı: Excel listesi, SMS telefon listesi, e-posta listesi, toplu hatırlatma
- Excel (9 tür), Word (4 tür), PDF (4 tür) çıktıları — tümünde kurum adı, başlık, ay/yıl, oluşturma tarihi, sayfa numarası, onay alanı ve logo alanı
- Ayarlar: uygunluk kuralları, aylık beyan dönemi (başlangıç/bitiş günü), hatırlatma metni

**Güvenlik ve kişisel veri**
- Şifreler bcrypt ile saklanır; oturum HttpOnly imzalı çerezle (JWT) yürütülür
- Rol bazlı yetkilendirme: personel yalnızca kendi kaydını görür; ilçe yöneticisi yalnızca kendi ilçesini görür
- T.C. kimlik numarası her yerde kısmi (maskeli) gösterilir
- Sağlık tanısı/rapor istenmez; görevlendirme listelerinde ve çıktılarında sağlık bilgisi bulunmaz
- Tüm kritik işlemler denetim kaydına (audit log) yazılır
- SMS/e-posta için kuyruk tabloları hazırdır (ilk sürümde gerçek gönderim yoktur; entegrasyon eklenebilir)

## Teknoloji

| Katman | Teknoloji |
|---|---|
| Frontend + Backend | Next.js 14 (App Router) + React 18 + TypeScript |
| Tasarım | Tailwind CSS (mobil uyumlu) |
| Veritabanı | SQLite (better-sqlite3) — tek dosya, kurulum gerektirmez |
| Çıktılar | ExcelJS (Excel), docx (Word), PDFKit + DejaVu fontu (PDF, Türkçe karakter desteği) |

## Hızlı Başlangıç

Gereksinim: **Node.js 18.18+ (önerilen 20 veya 22)**

```bash
npm install          # bağımlılıkları kur
cp .env.example .env # ortam değişkenleri (SESSION_SECRET'ı mutlaka değiştirin)
npm run seed         # demo verisini yükle (118 personel + beyanlar + örnek görevlendirme)
npm run build        # üretim derlemesi
npm start            # http://localhost:3000
```

Geliştirme için: `npm run dev`

Uygulama çalışırken örnek çıktı dosyalarını yeniden üretmek için: `npm run ornekler`

## Demo Hesaplar

| Rol | Kimlik (TC veya Sicil) | Şifre |
|---|---|---|
| İl Yöneticisi | `11111111111` veya `Y0001` | `admin123` |
| İlçe Yöneticisi (Haliliye) | `22222222222` veya `Y0002` | `ilce123` |
| Aile Hekimi | `10000000001` veya `S1001` | `demo123` |
| Aile Sağlığı Çalışanı | `10000000002` veya `S2001` | `demo123` |

Telefonla girişi denemek için: personelin kayıtlı telefonunu girin (ör. `05001112233`); `DEMO_MODE=1` iken doğrulama kodu ekranda gösterilir.

## Docker ile Kurulum

```bash
docker compose up -d --build
# İlk kurulumda demo verisi yüklemek için:
docker exec deprem-gorevlendirme node scripts/seed.js
```

Uygulama http://localhost:3000 adresinde çalışır. Veritabanı `uygulama-veri` adlı kalıcı Docker biriminde tutulur.

## Windows Kurulumu

Ayrıntılı adımlar için **[KURULUM-WINDOWS.md](KURULUM-WINDOWS.md)** dosyasına bakın. Özet: Node.js kurun → `kurulum.bat` çalıştırın → `baslat.bat` ile başlatın.

## Klasör Yapısı

```
├── src/app              # Sayfalar ve API uçları (personel: /panel, yönetici: /yonetim)
├── src/lib              # Veritabanı, oturum, uygunluk, görevlendirme, Excel/Word/PDF üretimi
├── src/components       # Ortak arayüz bileşenleri
├── schema.sql           # Veritabanı şeması (uygulama + seed ortak kullanır)
├── scripts/seed.js      # Demo veri yükleyici
├── scripts/ornek-ciktilar.js # Örnek çıktı üretici
├── ornekler/            # Örnek Excel/Word/PDF çıktıları ve personel şablonu
├── data/uygulama.db     # SQLite veritabanı (çalışma anında oluşur)
└── fonts/               # PDF çıktılarında kullanılan DejaVu fontları
```

## Aylık İşleyiş

1. Yönetici (isterse) ay için beyan başlangıç/bitiş günlerini ayarlar.
2. Personel ay başında girer; önceki ayın cevapları hazır gelir. Değişiklik yoksa tek tuşla onaylar, varsa yalnızca değişen alanları günceller.
3. Sistem uygunluk gruplarını otomatik oluşturur; geçmiş ayların kayıtları silinmez.
4. Yönetici beyan vermeyenlere hatırlatma listeleri oluşturur.
5. Yönetici otomatik görevlendirme çalıştırır, önizlemede düzenler, onaylar; personele bildirim düşer.
6. Excel/Word/PDF çıktıları alınır ve resmî yazıya eklenir.

## HTTPS Notu

Uygulama HTTP üzerinde çalışır; kurum içi yayında HTTPS için IIS / Nginx ters vekil (reverse proxy) arkasına alınması önerilir. Ters vekil arkasında `HTTP_ONLY=1` ortam değişkeni **kaldırılmalı** ve HTTPS sonlandırması vekilde yapılmalıdır.

## Lisans / Kullanım

Kurum içi kullanım için geliştirilmiştir.
