# BIST AI Komuta — APK Build Talimatı

## Gereksinimler
- Node.js 18+
- npm veya yarn
- Expo CLI
- EAS CLI (Expo Application Services)

---

## 1. Yerel Kurulum

```bash
cd bist-ai-komuta
npm install

# Expo CLI kurulumu (global)
npm install -g expo-cli

# EAS CLI kurulumu
npm install -g eas-cli
```

---

## 2. Expo Hesabı

```bash
# Expo hesabı oluşturun: https://expo.dev/signup
eas login
```

---

## 3. EAS Yapılandırma

```bash
eas build:configure
```
Bu komut `eas.json` dosyasını oluşturur (zaten mevcut).

---

## 4. APK Build (Preview — Direkt Install)

```bash
# .apk dosyası üretir (test cihazına direkt yüklenebilir)
eas build --platform android --profile preview
```

Build tamamlandığında Expo Dashboard'dan APK indirilebilir:
→ https://expo.dev

---

## 5. Production AAB Build (Play Store)

```bash
# .aab dosyası üretir (Google Play Store için)
eas build --platform android --profile production
```

---

## 6. Yerel Geliştirme (Expo Go ile)

```bash
npx expo start
```
Terminalde QR kodu çıkar → Expo Go app ile tara (Android/iOS).

---

## 7. Android Emulator ile Test

```bash
# Android Studio gerektirir
npx expo start --android
```

---

## Önemli Notlar

- `app.json` içindeki `android.package` benzersiz olmalı
- İlk build ~15-20 dakika sürer (EAS cloud build)
- Ücretsiz Expo planında aylık build limiti vardır
- Production için Keystore otomatik oluşturulur veya kendiniz sağlayabilirsiniz

---

## Sonraki Adımlar (Roadmap)

### Faz 2 — Gerçek Veri Entegrasyonu
- [ ] Finnhub API entegrasyonu (ücretsiz tier mevcut)
- [ ] Yahoo Finance API
- [ ] WebSocket ile anlık fiyat akışı
- [ ] React Query ile cache yönetimi

### Faz 3 — Kullanıcı & Cloud
- [ ] Firebase Auth (Google/email login)
- [ ] Firestore ile portföy senkronizasyonu
- [ ] Push notification (Expo Notifications)
- [ ] Expo SecureStore ile API key yönetimi

### Faz 4 — Gelişmiş Analiz
- [ ] Victory Native veya react-native-svg-charts ile grafikler
- [ ] KAP haber akışı scraper/parser
- [ ] Claude API entegrasyonu (gerçek AI analiz)
- [ ] TCMB ve TÜİK makro veri akışı

### Faz 5 — Monetizasyon
- [ ] RevenueCat ile in-app subscription
- [ ] Freemium model: 3 hisse ücretsiz, tümü premium
- [ ] Google Play Store yayını
