# ADR-0013: V1 dalgası — kimlik doğrulama, ducking, hizalı altyazı, dinamik katalog

- Durum: Kabul edildi (V1)
- Tarih: 2026-08-02

## Kararlar

1. **Parola + taşıyıcı token kimlik doğrulaması**: `AUTH_PASSWORD` env'i doluysa
   `POST /auth/login` (timingSafeEqual karşılaştırma) 12 saatlik süreç içi oturum
   token'ı üretir; tüm uçlar `Authorization: Bearer` ister. Muaf uçlar: `/health`,
   `/auth/login`, `GET /files/*` ve `GET /renders/*` (medya `<img>/<audio>/<video>`
   etiketleriyle başlıksız yüklenir; anahtarlar tahmin edilemez). Web istemcisi
   token'ı localStorage'da tutar ve 401'de `/giris`e yönlendirir — tek kullanıcılı
   yerel araç için pragmatik; çok kullanıcılı senaryoda OIDC gerekir (SECURITY.md).
   Tanımsızsa mevcut kimliksiz geliştirme modu değişmeden kalır.
2. **Auth denetimi preHandler'dadır, onRequest değil**: onRequest'te dönen 401,
   CORS eklentisinin kancasından ÖNCE gittiğinden tarayıcıda "ağ hatası" olarak
   gizleniyordu (canlı E2E'de yakalandı). preHandler CORS başlıkları eklendikten
   sonra koşar. Rate-limit kancası onRequest'te kalır (erken kesmek için) ama 429
   yanıtına izinli origin başlığını elle ekler.
3. **Ducking track bayrağıdır, sezgisel değil**: `TimelineTrack.duck` (varsayılan
   false; Zod default'u eski JSON verileri migration'sız doldurur). Render'da
   duck=true kliplerin sesi, duck=false ses kliplerinin (anlatım) çaldığı
   aralıklarda `volume='if(between(...))':eval=frame` ile %30'a iner; aralıklar
   klip-yerel zamana çevrilir çünkü volume adelay'den önce uygulanır. Hangi
   track'in müzik olduğunu sistem TAHMİN ETMEZ; kullanıcı işaretler ("kıs 🎚").
4. **Sesten hizalı altyazı transkripsiyon ucunu kullanır**: altyazı panelindeki
   "🎧 Sesten Üret (STT)" projedeki bir ses varlığını `POST /assets/:id/transcribe`
   ile çözümler ve zaman damgalı cue'ları editöre yükler. Mock motor sonuçları
   MOCK/DEMO rozetiyle işaretlenir; senaryodan üretimden farkı arayüzde açıktır.
5. **Dinamik katalog iki mekanizmayla**: ElevenLabs manifesti resmî
   `GET /v1/voices` ucundan hesabın ses listesini çeker (spec doğrulandı; erişim
   yoksa statik hazır seslere düşer — sahte katalog üretilmez). Replicate'e
   `REPLICATE_MODELS` env'i ile kullanıcı tanımlı modeller eklenir: süre listesi
   boş (denetlenmez), fiyat 0 + "elle doğrulayın" — bilinmeyen alan uydurulmaz.
6. **Bağımlılık denetimi CI kapısıdır**: `pnpm audit --audit-level high` CI'da
   koşar; mevcut high bulguları (next→sharp/postcss geçişli) pnpm overrides ile
   yamalı sürümlere sabitlendi (audit temiz).

## Bilinen sınırlar

- Oturumlar süreç içi: API yeniden başlayınca token'lar düşer (yeniden giriş).
- Tek parola = tek kullanıcı; rol/izin modeli yok.
- localStorage token'ı XSS'e karşı httpOnly çerezden zayıftır; CSP'li tek origin
  dağıtımda kabul edilebilir, çok kullanıcılıda OIDC + httpOnly çereze geçilmeli.
- Ducking sabit %30 çarpanlıdır; eşik/atak-bırakma süreleri (sidechaincompress)
  V2 adayıdır.
