# 🦶 Refleks — Premium Refleksoloji Uygulaması

**Refleks**, App Store ve Google Play için tasarlanmış, yapay zeka destekli, premium wellness mobil uygulamasıdır. Ayak, el ve kulak refleksolojisi konularında rehberlik sağlar.

---

## ✨ Uygulama Özellikleri

| Özellik | Açıklama |
|---------|----------|
| 🗺 **İnteraktif Ayak Haritası** | Tıklanabilir SVG ayak haritası, glow efekti, sağ/sol değiştirme |
| 🤖 **AI Asistan (Refleks)** | Lokal pattern-matching + opsiyonel Claude API entegrasyonu |
| ⏱ **Rehberli Seanslar** | Adım adım refleksoloji seansları, countdown timer ring |
| 📊 **Wellness Takibi** | Günlük mood/stres/uyku kaydı, 7 günlük bar chart, seri takibi |
| 👂 **Kulak Refleksolojisi** | Auriculoterapi bölgesi listesi ve detay sayfaları |
| 🌙 **Nefes Orb** | Animasyonlu nefes kılavuzu (inhale/hold/exhale) |
| 🎯 **Premium Modül** | Kilitlenen seanslar, ödeme sayfası, premium badge |
| ⚙️ **Ayarlar** | Dil (TR/EN), haptic, bildirim, API key, veri sıfırlama |

---

## 🛠 Teknoloji Stack

```
React Native + Expo SDK 51
TypeScript (strict mode)
Expo Router v3 (file-based navigation)
Zustand (state management)
React Native Reanimated 3 (animasyonlar)
React Native SVG (ayak haritası)
Expo Blur (glassmorphism efektleri)
Expo Haptics (premium titreşim)
Expo Linear Gradient (gradient background)
MMKV (ultra hızlı local storage)
date-fns (tarih işlemleri)
```

---

## 📁 Proje Yapısı

```
reflexapp/
├── app/                          # Expo Router sayfaları
│   ├── _layout.tsx               # Root layout (SplashScreen, navigation)
│   ├── index.tsx                 # Redirect (onboarding/home)
│   ├── (auth)/
│   │   ├── welcome.tsx           # 🌅 Karşılama ekranı (animasyonlu)
│   │   └── onboarding.tsx        # 4 adımlı onboarding
│   ├── (tabs)/
│   │   ├── _layout.tsx           # Tab bar (blur, emoji icons)
│   │   ├── index.tsx             # 🏠 Ana dashboard
│   │   ├── map.tsx               # 🦶 Refleks haritası
│   │   ├── ai.tsx                # 🤖 AI sohbet asistanı
│   │   ├── sessions.tsx          # ⏱ Seans listesi
│   │   └── progress.tsx          # 📊 İlerleme takibi
│   ├── zone/[id].tsx             # Bölge detay sayfası
│   ├── session/[sessionId].tsx   # Aktif seans ekranı
│   ├── settings.tsx              # ⚙️ Ayarlar
│   └── premium.tsx               # ✦ Premium abonelik
│
├── components/
│   ├── ui/
│   │   ├── GlassmorphicCard.tsx  # Glassmorphism kart
│   │   ├── GradientBackground.tsx # Gradient arka plan
│   │   ├── Button.tsx            # Animasyonlu buton (4 varyant)
│   │   └── BreathingOrb.tsx      # Nefes animasyon orb
│   ├── home/
│   │   └── WellnessScoreRing.tsx # Animasyonlu wellness skoru halka
│   ├── map/
│   │   ├── FootMapSVG.tsx        # İnteraktif SVG ayak haritası
│   │   └── ZoneDetailSheet.tsx   # Bottom sheet bölge detayı
│   ├── ai/
│   │   ├── ChatBubble.tsx        # Sohbet balonu (fade animasyon)
│   │   └── TypingIndicator.tsx   # "..." yükleme animasyonu
│   ├── session/
│   │   └── TimerRing.tsx         # Dairesel countdown timer
│   └── progress/
│       └── MoodPicker.tsx        # Emoji tabanlı mood seçici
│
├── stores/                       # Zustand state stores
│   ├── useUserStore.ts           # Kullanıcı profili (MMKV persist)
│   ├── useSessionStore.ts        # Aktif seans durumu
│   ├── useProgressStore.ts       # Günlük loglar, haftalık istatistikler
│   └── useAIStore.ts             # Sohbet geçmişi
│
├── services/
│   ├── aiService.ts              # Lokal AI + Anthropic API entegrasyonu
│   ├── hapticService.ts          # Titreşim fonksiyonları
│   └── notificationService.ts   # Bildirim zamanlaması
│
├── constants/
│   ├── colors.ts                 # Renk sistemi (dark/light mode)
│   ├── typography.ts             # Tipografi sistemi
│   ├── spacing.ts                # Boşluk, border radius, shadow
│   └── zones.ts                  # Refleksoloji bilgi tabanı (13 ayak + 5 kulak bölgesi)
│
├── types/
│   └── index.ts                  # Tüm TypeScript tipleri
│
├── package.json
├── app.json                      # Expo konfigürasyonu
├── tsconfig.json
└── babel.config.js
```

---

## 🚀 Kurulum ve Çalıştırma

### Gereksinimler
- Node.js 18+
- npm veya yarn
- Expo CLI
- iOS Simulator (Mac) veya Android Emulator

### Adımlar

```bash
# 1. Proje klasörüne girin
cd reflexapp

# 2. Bağımlılıkları yükleyin
npm install

# 3. Expo CLI yükleyin (yoksa)
npm install -g expo-cli

# 4. Uygulamayı başlatın
npx expo start

# Seçenekler:
# i → iOS Simulator
# a → Android Emulator
# w → Web tarayıcı
# QR kod → Expo Go uygulaması (fiziksel cihaz)
```

### Fiziksel Cihazda Test

```bash
# Expo Go uygulamasını App Store / Google Play'den indirin
npx expo start
# QR kodu Expo Go ile tarayın
```

---

## 📱 Build Alma

### Development Build

```bash
# iOS
npx expo run:ios

# Android
npx expo run:android
```

### Production Build (EAS)

```bash
# EAS CLI yükle
npm install -g eas-cli
eas login

# Build konfigürasyonu oluştur
eas build:configure

# Android APK
eas build --platform android --profile preview

# iOS IPA
eas build --platform ios

# Her ikisi
eas build --platform all
```

---

## 🤖 AI Asistan Konfigürasyonu

Uygulama iki AI modunda çalışır:

### 1. Lokal AI (Varsayılan)
- İnternet gerektirmez
- Pattern-matching tabanlı akıllı yanıtlar
- Türkçe/İngilizce tam destek
- Herhangi bir kurulum gerektirmez

### 2. Claude API (Premium)
Ayarlar ekranından API anahtarı girin:

```
⚙️ Ayarlar → AI Asistan → Anthropic API Anahtarı
```

API anahtarı: [console.anthropic.com](https://console.anthropic.com) adresinden alınabilir.

---

## 🗺 Refleksoloji Veri Tabanı

`constants/zones.ts` dosyası şunları içerir:

- **13 Ayak Bölgesi**: Beyin, Hipofiz, Sinüs, Boyun, Akciğer, Kalp, Mide, Karaciğer, Böbrek, Bağırsak, Omurga, Siyatik, Üreme Sistemi
- **5 Kulak Bölgesi**: Shen Men, Omurga, Göz, Mide, Sıfır Noktası
- **30+ Semptom Eşleştirmesi**: Semptomdan bölgeye otomatik yönlendirme
- **5 Seans**: Stres, Uyku, Enerji, Sindirim, Tam Vücut
- **Bilgi**: Her bölge için konum, faydalar, teknik, uyarılar (TR+EN)

---

## 🎨 Tasarım Sistemi

### Renk Paleti
- **Arka Plan**: `#0A1209` → `#1A2A1F` (koyu orman yeşili)
- **Birincil**: `#7C9885` (adaçayı yeşili)
- **Krem**: `#F5F0E8` (metin rengi)
- **Amber**: `#C49A6C` (premium rengi)

### Komponent Kütüphanesi
- `GlassmorphicCard` — Glassmorphism efektli kart
- `Button` — 4 varyant (primary, secondary, ghost, danger)
- `BreathingOrb` — Animasyonlu nefes kılavuzu
- `TimerRing` — SVG dairesel timer
- `WellnessScoreRing` — Animasyonlu skor halkası
- `MoodPicker` — Emoji tabanlı mod seçici

---

## ⚠️ Önemli Uyarı

> **Bu uygulama destekleyici rahatlama amaçlıdır.**
> Tıbbi tanı koymaz, ilaç önermez ve tıbbi tedavinin yerini almaz.
> Ciddi sağlık sorunları için lütfen bir sağlık profesyoneline başvurun.

---

## 📄 Lisans

MIT License — Eğitim ve kişisel kullanım amaçlıdır.

---

*🦶 Sağlıklı günler dileriz! — Refleks Ekibi*
