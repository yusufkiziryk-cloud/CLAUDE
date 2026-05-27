# 🏎️ Street City: Open World Mobile

> Android için optimize edilmiş açık dünya araba ve şehir oyunu  
> Telif özgür, tamamen özgün proje

---

## 📋 İçindekiler

1. [Proje Mimarisi](#proje-mimarisi)
2. [Klasör Yapısı](#klasör-yapısı)
3. [Sistem Gereksinimleri](#sistem-gereksinimleri)
4. [Kurulum Rehberi](#kurulum-rehberi)
5. [MVP Geliştirme Aşamaları](#mvp-geliştirme-aşamaları)
6. [Sahne Kurulumu](#sahne-kurulumu)
7. [Araç Sistemi](#araç-sistemi)
8. [APK Build Alma](#apk-build-alma)
9. [Performans Optimizasyonu](#performans-optimizasyonu)
10. [Hata Çözüm Rehberi](#hata-çözüm-rehberi)
11. [Test Checklist](#test-checklist)
12. [İkinci Aşama Geliştirme](#ikinci-aşama-geliştirme)

---

## 🏗️ Proje Mimarisi

```
GameManager (Merkez yönetici)
    ├── UIManager (Tüm UI yönetimi)
    ├── AudioManager (Tüm sesler)
    ├── SaveLoadSystem (Kayıt/Yükleme)
    ├── RaceManager (Yarış sistemi)
    │   ├── TimerSystem
    │   └── CheckpointTrigger[]
    ├── PoliceChaseSystem (Polis sistemi)
    ├── MissionManager (Görev sistemi)
    │   └── MissionTrigger[]
    ├── TrafficSystem (Trafik yönetimi)
    │   ├── SimpleTrafficCar[]
    │   └── SimplePedestrian[]
    └── MiniMapController
```

**Oyuncu Sistemi:**
```
PlayerCarController (Araç fiziği)
    └── MobileInputController (Dokunmatik kontroller)
        └── VehicleEnterExitSystem (Araça binme/inme)
```

**AI Sistemi:**
```
AICarController
    ├── Patrol Mode (Normal trafik)
    ├── Racing Mode (Yarış)
    └── Police Mode (Takip)
```

**Ekonomi Sistemi:**
```
MoneySystem (Para)
    └── GarageManager (Araç yükseltme ve renk)
```

---

## 📁 Klasör Yapısı

```
StreetCity/
├── Assets/
│   ├── Scripts/
│   │   ├── Player/
│   │   │   ├── PlayerCarController.cs      ← Araç fiziği
│   │   │   ├── MobileInputController.cs    ← Dokunmatik giriş
│   │   │   └── VehicleEnterExitSystem.cs   ← Araca binme/inme
│   │   ├── Race/
│   │   │   ├── RaceManager.cs              ← Yarış yönetimi
│   │   │   ├── TimerSystem.cs              ← Zamanlayıcı
│   │   │   └── CheckpointTrigger.cs        ← Checkpoint tetikleyici
│   │   ├── AI/
│   │   │   ├── AICarController.cs          ← AI araç sürüşü
│   │   │   └── PoliceChaseSystem.cs        ← Polis sistemi
│   │   ├── Mission/
│   │   │   └── MissionManager.cs           ← Görev sistemi
│   │   ├── Economy/
│   │   │   ├── MoneySystem.cs              ← Para sistemi
│   │   │   └── GarageManager.cs            ← Garaj sistemi
│   │   ├── World/
│   │   │   ├── MiniMapController.cs        ← Mini harita
│   │   │   ├── TrafficSystem.cs            ← Trafik sistemi
│   │   │   ├── TrafficLight.cs             ← Trafik ışığı
│   │   │   └── CityBuilder.cs              ← Şehir kurulum yardımcısı
│   │   ├── Audio/
│   │   │   └── AudioManager.cs             ← Ses yönetimi
│   │   ├── Core/
│   │   │   ├── GameManager.cs              ← Ana oyun yöneticisi
│   │   │   └── SaveLoadSystem.cs           ← Kayıt/yükleme
│   │   └── UI/
│   │       └── UIManager.cs                ← Arayüz yönetimi
│   ├── Scenes/
│   │   ├── MainMenu.unity
│   │   ├── GameScene.unity
│   │   └── SceneSetupGuide.txt
│   ├── Prefabs/
│   │   ├── Vehicles/
│   │   │   ├── Car_Red_Sport.prefab
│   │   │   ├── Car_Blue_Sedan.prefab
│   │   │   ├── Car_Yellow_Taxi.prefab
│   │   │   ├── Car_Black_SUV.prefab
│   │   │   ├── Car_Green_Race.prefab
│   │   │   └── Car_Police.prefab
│   │   ├── UI/
│   │   │   ├── Notification.prefab
│   │   │   └── MissionMarker.prefab
│   │   └── World/
│   │       ├── Building_A.prefab
│   │       ├── Building_B.prefab
│   │       ├── Tree_Pine.prefab
│   │       ├── StreetLamp.prefab
│   │       └── TrafficLight.prefab
│   ├── Materials/
│   │   ├── Vehicles/
│   │   │   └── CarBody_Mat.mat (Base material)
│   │   ├── World/
│   │   │   ├── Road_Mat.mat
│   │   │   ├── Sidewalk_Mat.mat
│   │   │   └── Grass_Mat.mat
│   │   └── UI/
│   │       └── ...
│   ├── UI/
│   │   ├── Sprites/ (buton ikonları)
│   │   └── MobileUIDesign.txt
│   ├── Audio/
│   │   ├── Engine/ (motor sesleri)
│   │   ├── Music/ (müzik parçaları)
│   │   └── SFX/ (ses efektleri)
│   ├── Vehicles/ (3D modeller - FBX/OBJ)
│   ├── Maps/ (terrain ve harita varlıkları)
│   └── Resources/ (runtime yüklenen varlıklar)
├── ProjectSettings/
│   └── ProjectSettings.txt (Ayarlar rehberi)
├── Packages/
│   └── manifest.json
└── README.md
```

---

## 💻 Sistem Gereksinimleri

**Geliştirme Ortamı:**
- Unity 2022.3 LTS (Önerilen) veya Unity 2021.3 LTS
- Android Build Support module (Unity Hub'dan yükle)
- Android SDK API 24+ ve NDK r21+
- Java JDK 11
- RAM: 8GB+ (16GB önerilen)

**Hedef Android Cihaz:**
- Android 7.0+ (API 24+)
- RAM: 2GB+
- GPU: Mali-T720 / Adreno 530 veya üstü
- CPU: Quad-core 1.5GHz+
- Depolama: 150MB+

---

## 🚀 Kurulum Rehberi

### 1. Unity'de Proje Açma

```
1. Unity Hub'u aç
2. Projects > Open > Bu klasörü seç (/StreetCity)
3. Unity 2022.3 LTS ile aç
4. Gerekli paketler otomatik yüklenir (Packages/manifest.json)
```

### 2. Android Build Support Kurulumu

```
Unity Hub > Installs > 2022.3 LTS yanındaki ⚙️
> Add Modules > Android Build Support
  ✓ Android SDK & NDK Tools
  ✓ OpenJDK
> Install
```

### 3. Proje Ayarlarını Yapılandır

`ProjectSettings/ProjectSettings.txt` dosyasındaki tüm ayarları Unity'de uygula.

### 4. Araç Prefab'larını Oluştur

Her araç için aşağıdaki yapıyı oluştur:

```
[Prefab: Car_Red_Sport]
├── CarRoot (Rigidbody, PlayerCarController)
│   ├── CarBody (MeshFilter, MeshRenderer - kırmızı materyal)
│   ├── CenterOfMass (empty, y:-0.5)
│   ├── Wheels
│   │   ├── WheelFL_Collider (WheelCollider)
│   │   ├── WheelFR_Collider (WheelCollider)
│   │   ├── WheelRL_Collider (WheelCollider)
│   │   ├── WheelRR_Collider (WheelCollider)
│   │   ├── WheelFL_Mesh (MeshFilter, MeshRenderer)
│   │   ├── WheelFR_Mesh
│   │   ├── WheelRL_Mesh
│   │   └── WheelRR_Mesh
│   └── BoxCollider (araç gövdesi çarpışma)
```

**WheelCollider Ayarları:**
```
Mass: 20
Radius: 0.35 (araç boyutuna göre)
Wheel Damping Rate: 0.25
Suspension Distance: 0.15
Force App Point Distance: 0

Spring: 35000
Damper: 4500
Target Position: 0.5

Forward Friction:
  Extremum Slip: 0.4
  Extremum Value: 1
  Asymptote Slip: 0.8
  Asymptote Value: 0.5
  Stiffness: 1.5

Sideways Friction:
  Extremum Slip: 0.2
  Extremum Value: 1
  Asymptote Slip: 0.5
  Asymptote Value: 0.75
  Stiffness: 2.0
```

---

## 🏎️ MVP Geliştirme Aşamaları

### AŞAMA 1: Temel Araç ve Dünya (Hafta 1)

- [ ] Unity projesi oluştur
- [ ] Android Build Support kur
- [ ] Player Settings'i ayarla
- [ ] Basit test sahnesi oluştur (düz zemin)
- [ ] İlk araç prefab'ını oluştur (box ile temsil et)
- [ ] PlayerCarController'ı kur
- [ ] WheelCollider'ları ayarla
- [ ] Temel araba sürüşünü test et (PC'de)

**Test Kriteri:** Araba gaz, fren, dönüş yapabilmeli.

### AŞAMA 2: Mobil Kontroller (Hafta 1-2)

- [ ] Canvas oluştur (Screen Space Overlay)
- [ ] Joystick UI'ı kur
- [ ] Gaz/Fren butonlarını ekle
- [ ] MobileInputController'ı bağla
- [ ] Android cihazda ilk test

**Test Kriteri:** Telefondan araç kontrol edilebilmeli.

### AŞAMA 3: Temel Şehir (Hafta 2)

- [ ] Terrain veya düz zemin oluştur (200x200)
- [ ] Yolları çiz (2-3 ana yol)
- [ ] Çarpışma duvarları ekle
- [ ] Basit binalar koy (box ile temsil)
- [ ] Kamera takip sistemini kur

**Test Kriteri:** Kasmadan şehirde dolaşılabilmeli.

### AŞAMA 4: Yarış Sistemi (Hafta 2-3)

- [ ] Checkpoint'leri yerleştir (4-6 adet)
- [ ] Start/Finish çizgisi kur
- [ ] RaceManager'ı bağla
- [ ] Geri sayım çalışıyor mu?
- [ ] AI rakipler ekle (3 adet)
- [ ] Yarış sonucu göster

**Test Kriteri:** Tam bir yarış oynanabilmeli.

### AŞAMA 5: APK Build (Hafta 3)

- [ ] Build Settings'i ayarla
- [ ] İmzalama keystore oluştur
- [ ] Test APK build al
- [ ] Cihaza yükle
- [ ] 30 FPS testini geç

**Test Kriteri:** APK kurulur ve oynanabilir.

---

## 🎮 Sahne Kurulumu

Detaylar için `Assets/Scenes/SceneSetupGuide.txt` dosyasına bak.

**Hızlı Başlangıç:**

1. `File > New Scene` ile boş sahne oluştur
2. `GameObject > 3D Object > Plane` ekle (Scale: 20, 1, 20)
3. `Assets/Scripts/Core/GameManager.cs` script'ini boş bir objeye ekle
4. Diğer Manager'ları ayrı GameObject'lere ekle
5. `Build Settings > Scenes in Build` listesine sahneyi ekle

---

## 🚗 5 Araç Yapılandırması

```
1. Car_Red_Sport (Kırmızı Spor)
   - maxSpeed: 140
   - acceleration: 1800
   - steerAngle: 32
   - Görünüm: Düşük, uzun gövde

2. Car_Blue_Sedan (Mavi Sedan)
   - maxSpeed: 110
   - acceleration: 1400
   - steerAngle: 28
   - Görünüm: Orta boy, 4 kapılı

3. Car_Yellow_Taxi (Sarı Taksi)
   - maxSpeed: 100
   - acceleration: 1200
   - steerAngle: 30
   - Görünüm: Sedan, taksi sarısı

4. Car_Black_SUV (Siyah SUV)
   - maxSpeed: 115
   - acceleration: 1500
   - steerAngle: 26
   - Görünüm: Yüksek, geniş gövde

5. Car_Green_Race (Yeşil Yarış)
   - maxSpeed: 160
   - acceleration: 2000
   - steerAngle: 35
   - Görünüm: Alçak, spoiler'lı
```

---

## 📱 APK Build Alma

### Adım 1: Keystore Oluştur

```
Unity > Edit > Project Settings > Player > Android > Publishing Settings
> Keystore Manager > Create New
  - Keystore Path: streetcity.keystore (proje dışı klasörde sakla!)
  - Password: [güçlü şifre]
  - Alias: streetcity_key
  - Alias Password: [güçlü şifre]
  - Validity: 25 years
```

### Adım 2: Build Settings

```
File > Build Settings
  Platform: Android
  ✓ Add Open Scenes (tüm sahneleri ekle)
  Texture Compression: ETC2
  Build System: Gradle
  Development Build: ✗ (final için)
```

### Adım 3: Player Settings

```
Edit > Project Settings > Player
  Package Name: com.yourcompany.streetcity
  Version: 1.0.0
  Bundle Version Code: 1
  Minimum API Level: 24
  Target API Level: 33
  Scripting Backend: IL2CPP
  ARM64: ✓
```

### Adım 4: Build

```
File > Build Settings > Build
> APK kayıt yeri seç
> Build başlar (5-15 dakika sürebilir)
> streetcity.apk oluşur
```

### Adım 5: Cihaza Yükleme

```bash
# USB ile bağla, USB Hata Ayıklama aç
adb install streetcity.apk

# veya APK'yı telefona kopyala
# Dosya Yöneticisi > APK'ya tıkla > Bilinmeyen Kaynaklara İzin Ver > Yükle
```

---

## ⚡ Performans Optimizasyonu

### 1. Object Pooling

```csharp
// TrafficSystem zaten object pooling kullanıyor
// Patlama/çarpışma efektleri için de kullan:
ObjectPool<ParticleSystem> particlePool;
```

### 2. LOD (Level of Detail)

```
Her bina için 3 LOD seviyesi:
LOD0 (yakın): Tam detay - mesafe < 30m
LOD1 (orta):  Yarı poligon - mesafe < 60m
LOD2 (uzak):  Minimum poligon - mesafe < 100m
Culled:       Görünmez - mesafe > 100m
```

### 3. Draw Call Optimizasyonu

```
- Static Batching: Statik nesneler için aktif et
- Dynamic Batching: Küçük hareketli nesneler için
- GPU Instancing: Tekrar eden nesneler (ağaçlar, lambalar)
- Shader: Mobile/Diffuse (ağır shader kullanma)
```

### 4. Texture Optimizasyonu

```
Tüm textureler için:
  Max Size: 512x512 (bina), 1024x1024 (araç)
  Format: ETC2 RGBA8 (Android için)
  Generate Mipmaps: ✓
  Compression: Normal Quality
```

### 5. Fizik Optimizasyonu

```csharp
// FixedUpdate rate'i düşür
Time.fixedDeltaTime = 0.02f; // 50Hz (varsayılan)
// Mobil için:
Time.fixedDeltaTime = 0.033f; // 30Hz

// Sleep threshold
Physics.sleepThreshold = 0.005f;
// Default Solver Iterations: 4 (6'dan düşür)
```

### 6. Camera Culling

```
Main Camera:
  Far Clip Plane: 200 (500'den düşür)
  Occlusion Culling: ✓ (Bake et!)

Bake Occlusion Culling:
  Window > Rendering > Occlusion Culling
  > Bake
```

### 7. Audio Optimizasyonu

```
Tüm ses klipleri için:
  Load Type: Compressed In Memory (uzun sesler)
             Decompress On Load (kısa SFX)
  Compression Format: Vorbis
  Quality: 50-70%
  Sample Rate: 22050Hz (44100'den düşür)
```

### 8. Script Optimizasyonu

```csharp
// Kötü - Her frame'de FindObject çağırma
void Update() {
    gameObject.Find("Player"); // ❌
}

// İyi - Cache et
private Transform player;
void Start() {
    player = GameObject.Find("Player").transform; // ✓
}

// Kötü - Her frame'de GetComponent
void Update() {
    GetComponent<Rigidbody>().velocity = ...; // ❌
}

// İyi - Başlangıçta cache et
private Rigidbody rb;
void Awake() { rb = GetComponent<Rigidbody>(); } // ✓
```

### 9. Target Frame Rate

```csharp
// Uygulama başlangıcında ayarla
void Awake() {
    Application.targetFrameRate = 60;
    QualitySettings.vSyncCount = 0;
    Screen.sleepTimeout = SleepTimeout.NeverSleep;
}
```

---

## 🐛 Hata Çözüm Rehberi

### Problem 1: Araç Zıplıyor / Titriyor

```
Çözüm:
✓ WheelCollider Spring değerini artır (35000 -> 45000)
✓ Damper değerini artır (4500 -> 5500)  
✓ CenterOfMass.y değerini düşür (-0.5 -> -0.8)
✓ Rigidbody.mass'ı artır (1200 -> 1500)
✓ Physics.defaultSolverIterations'ı artır (4 -> 6)
```

### Problem 2: Araba Yoldan Kayıyor

```
Çözüm:
✓ WheelCollider sidewaysFriction.stiffness değerini artır (2.0 -> 2.5)
✓ steerAngle değerini düşür (30 -> 25)
✓ Yüksek hızda direksiyon hassasiyetini azalt (zaten uygulandı)
✓ Grip upgrade sistemi kullan
```

### Problem 3: AI Araçlar Çarışıyor

```
Çözüm:
✓ avoidanceDistance değerini artır (8 -> 12)
✓ Waypoint spacing'i artır (her 20m yerine 30m)
✓ AI maxSpeed'i düşür (90 -> 70 km/h)
✓ Steering Lerp smoothing'i artır (5 -> 8)
```

### Problem 4: Dokunmatik Kontrol Gecikmeli

```
Çözüm:
✓ Input.touchCount yerine Input.touches array kullan
✓ Physics.Raycast yerine trigger collider kullan
✓ EventSystem > Pixel Drag Threshold'u düşür (10 -> 5)
```

### Problem 5: Build Alma Hatası - SDK Bulunamadı

```
Çözüm:
✓ Unity Hub > Installs > Unity 2022.3 > Modules > Android Build Support ekle
✓ Edit > Preferences > External Tools > Android SDK path'i kontrol et
✓ ANDROID_HOME environment variable'ı ayarla:
  Windows: C:\Users\[User]\AppData\Local\Android\Sdk
  Mac: ~/Library/Android/sdk
```

### Problem 6: APK Cihaza Kurulmuyor

```
Çözüm:
✓ Ayarlar > Güvenlik > Bilinmeyen Kaynaklar'ı aç
✓ Minimum API Level'ı düşür (24 -> 21)
✓ APK boyutu 100MB'ı geçiyor mu? -> Texture sıkıştırmayı artır
✓ adb install -r streetcity.apk (zorla yeniden yükle)
```

### Problem 7: Oyun Donuyor (Frame Drop)

```
Çözüm:
✓ Profiler ile bottleneck bul:
  Window > Analysis > Profiler > Android cihaza bağla
✓ Grafik kalitesini düşür (Low quality profile)
✓ TrafficSystem maxTotalCars'ı azalt (15 -> 8)
✓ Shadow distance'ı düşür veya gizle
✓ Far clip plane'i düşür (200 -> 150)
✓ Occlusion Culling'i aktifleştir
```

### Problem 8: Ses Çalışmıyor

```
Çözüm:
✓ AudioListener bileşeninin sahnede olduğunu kontrol et
✓ AudioClip'lerin Assets'e import edildiğini doğrula
✓ AudioManager.sfxClips listesine ses klibi ekle
✓ Android'de Audio izni manifest'e ekle (otomatik)
```

### Problem 9: Mini Harita Görünmüyor

```
Çözüm:
✓ Render Texture oluştur: Assets > Create > Render Texture (256x256)
✓ MiniMap Camera > Target Texture > Render Texture ata
✓ MiniMap RawImage > Texture > Aynı Render Texture ata
✓ MiniMap Camera'nın Layer'ını kontrol et
✓ Camera depth'i ayarla: Ana Kamera 0, MiniMap Kamera -1
```

### Problem 10: Kayıt Sistemi Çalışmıyor

```
Çözüm:
✓ Application.persistentDataPath erişilebilir mi?
  Debug.Log(Application.persistentDataPath);
✓ Android: /storage/emulated/0/Android/data/com.yourcompany.streetcity/files/
✓ Write Permission: External (SD Card) ayarla
✓ JsonUtility.FromJson hata atıyor mu? -> JSON formatını kontrol et
```

---

## ✅ Test Checklist

### Temel Fonksiyonlar
- [ ] Uygulama açılıyor
- [ ] Ana menü görünüyor
- [ ] "Oyuna Başla" butonu çalışıyor
- [ ] Oyun sahnesi yükleniyor
- [ ] Araç spawn oluyor

### Kontroller
- [ ] Joystick ile dönüş çalışıyor
- [ ] Gaz butonu hızlandırıyor
- [ ] Fren butonu durduruyor
- [ ] El freni drift yapıyor
- [ ] Nitro aktive oluyor
- [ ] Araca binme/inme çalışıyor

### Araç Fiziği
- [ ] Araç yoldan çıkmıyor (yeterli friction)
- [ ] Yüksek hızda kararlı
- [ ] Virajlarda mantıklı davranış
- [ ] Çarpışma sesi çıkıyor
- [ ] Nitro hız farkı hissediliyor

### Yarış Sistemi
- [ ] Yarış başlatılabiliyor
- [ ] Geri sayım çalışıyor (3-2-1-BAŞLA)
- [ ] Checkpoint geçişleri çalışıyor
- [ ] Süre göstergesi çalışıyor
- [ ] Pozisyon göstergesi çalışıyor
- [ ] AI rakipler yarışıyor
- [ ] Yarış sonucu gösteriliyor
- [ ] Ödül veriliyor

### Polis Sistemi
- [ ] Hız ihlalinde yıldız artıyor
- [ ] Çarpışmada yıldız artıyor
- [ ] Polis araçları spawn oluyor
- [ ] Polis takip ediyor
- [ ] Kaçınca yıldız düşüyor
- [ ] 3 yıldız durumu çalışıyor

### Görev Sistemi
- [ ] Görev noktaları görünüyor
- [ ] Görev başlatılabiliyor
- [ ] Süre dolunca başarısız oluyor
- [ ] Hedefe ulaşınca tamamlanıyor
- [ ] Ödül veriliyor

### Ekonomi
- [ ] Para kazanılıyor
- [ ] Garaj açılıyor
- [ ] Yükseltmeler çalışıyor
- [ ] Renk değiştirme çalışıyor
- [ ] Para yeterli değilse hata gösteriyor

### Performans
- [ ] Ana menüde 60 FPS
- [ ] Oyun içinde 30+ FPS (orta grafik)
- [ ] APK boyutu < 100MB
- [ ] Yükleme süresi < 10 saniye
- [ ] RAM kullanımı < 1.5GB
- [ ] Isınma sorunu yok (5 dakika test)

### Kayıt Sistemi
- [ ] Para kaydediliyor
- [ ] Yükseltmeler kaydediliyor
- [ ] Oyun kapanıp açılınca devam ediyor
- [ ] Garaj durumu korunuyor

### Kullanıcı Arayüzü
- [ ] Tüm butonlar çalışıyor
- [ ] Duraklama menüsü açılıyor
- [ ] Ayarlar uygulanıyor
- [ ] Mini harita görünüyor
- [ ] Geri tuşu (Android) duraklat
- [ ] Ekran dönmüyor (landscape fixed)

---

## 🔄 İkinci Aşama Geliştirme

MVP tamamlandıktan sonra eklenecekler:

### 2A: Detaylı Şehir
- [ ] Gerçek 3D binalar (low-poly modeller)
- [ ] Trafik ışıkları (TrafficLight.cs hazır)
- [ ] Benzinlik (para ile nitro doldur)
- [ ] Garaj binası (araçları satın al)
- [ ] Park alanları

### 2B: Gelişmiş Trafik
- [ ] TrafficSystem tamamen çalışır (hazır)
- [ ] Yayalar (SimplePedestrian hazır)
- [ ] Trafik ışıklarına göre durma
- [ ] Daha akıllı AI yol takibi

### 2C: Tam Görev Sistemi
- [ ] 10+ görev (MissionManager hazır)
- [ ] Görev zinciri (biri bitince diğeri açılır)
- [ ] Teslimat görevleri
- [ ] Zaman baskısı

### 2D: Ses Entegrasyonu
- [ ] Motor sesi (gerçek motor ses dosyaları)
- [ ] Müzik parçaları
- [ ] SFX paketi

### 2E: Görsel İyileştirmeler
- [ ] Particle efektleri (egzoz, fren dumanı)
- [ ] Araç ışıkları (ön far, arka stop)
- [ ] Refleksiyon probes
- [ ] Post-processing (hafif bloom)
- [ ] Day/Night cycle (opsiyonel)

---

## 📦 Ücretsiz Varlık Kaynakları

### 3D Modeller (Low-Poly)
- **Unity Asset Store:** "Low Poly Cars" (ücretsiz)
- **Kenney.nl:** kenney.nl/assets/car-kit (ücretsiz)
- **Sketchfab:** Creative Commons lisanslı araçlar
- **OpenGameArt.org:** Açık kaynak 3D modeller

### Sesler
- **Freesound.org:** Motor sesleri (Creative Commons)
- **Zapsplat.com:** SFX (ücretsiz kayıt)
- **OpenGameArt.org:** Oyun müzikleri

### UI Sprites
- **Kenney.nl:** kenney.nl/assets/game-icons (ücretsiz)
- **FlatIcon:** Ticari lisans kontrol et

---

## 🎯 Teknik Notlar

### WheelCollider Hakkında
Unity'nin WheelCollider'ı realtime fizik simülasyonu yapar.
Mobil'de performans için:
- FixedUpdate'i 30Hz'e düşür
- Sadece oyuncu aracında WheelCollider kullan
- Trafik araçlarında SimpleTrafficCar (kinematik) kullan

### Android İzinleri
Bu oyun için ek izin gerekmez.
Eğer online leaderboard eklenirse:
- INTERNET izni otomatik eklenir

### Ekran Oranları
- 16:9 (1920x1080) - Referans
- 18:9 (2160x1080) - Tam telefon ekranı
- 20:9 (2400x1080) - Yeni telefonlar
Canvas Scaler: Match Width or Height = 0.5 tüm oranları destekler.

### IL2CPP vs Mono
- Mono: Daha hızlı build, daha büyük APK
- IL2CPP: Yavaş build, daha küçük APK, daha hızlı runtime
Final build için IL2CPP kullan.

---

## 📬 İletişim & Lisans

Proje tamamen orijinal ve telif özgürdür.
GTA serisinin hiçbir içeriği kopyalanmamıştır.
Sadece "açık dünya şehir, araba sürme" oyun mekaniği konseptinden ilham alınmıştır.

**Oyun Adı:** Street City: Open World Mobile  
**Versiyon:** 1.0.0 MVP  
**Hedef Platform:** Android 7.0+  
**Engine:** Unity 2022.3 LTS  

---

*Oluşturulma: 2026 | Street City Development Team*
