# ADR-0010: Ses hattı, animatic ve altyazı mimarisi

- Durum: Kabul edildi (Faz 6)
- Tarih: 2026-08-02

## Kararlar

1. **TTS mevcut üretim hattını kullanır**: seslendirme ayrı bir sistem değil,
   `textToSpeech` yetenekli bir üretim işidir (kuyruk, idempotency, provenance,
   nesne deposu aynen geçerli). `POST /scenes/:id/narration` sahnenin anlatım
   metnini prompt'a koyar; işlemci başarıda `narrationAssetId`'yi sahneye bağlar
   (storyboard bağlama ile aynı sunucu tarafı mekanizma).
2. **Mock TTS gerçek WAV üretir**: saf-TS PCM kodlayıcı, kelime ritminde bip
   desenleri (süre ~2,3 kelime/sn'den türetilir). Konuşma sentezi DEĞİLDİR ve
   provenance.mock=true taşır; ama çıktı gerçek, çalınabilir ve FFmpeg-uyumlu
   olduğundan animatic/render akışı anahtarsız uçtan uca test edilir. Mock müzik
   modeli aynı yaklaşımla arpej döngüsü üretir.
3. **Animatic = sahnelerden türetilen sequence**: `POST /projects/:id/sequence/from-scenes`
   storyboard görsellerini, anlatıcı ses kliplerini ve sahne başlıklarını sahne
   sürelerine göre art arda dizer. Eksik storyboard/ses SESSİZCE YUTULMAZ; uyarı
   listesi döner. Mevcut sequence'in kimliği korunur (render geçmişi bozulmaz).
4. **Altyazılar senaryodan türetilir (Faz 6)**: `@studio/captions` cümle bölme +
   kelime orantılı zamanlama ile deterministik cue üretir; arayüz bunun ses dökümü
   OLMADIĞINI açıkça söyler. SRT/VTT round-trip kayıpsızdır; bozuk bloklar uyarıyla
   atlanır. Altyazılar timeline metin track'ine tek geri-alınabilir adımda uygulanır
   ve drawtext ile MP4'e gömülür (burn-in).
5. **Transkripsiyon (STT) doğrudan servistir**: uzun kuyruk gerektirmeyecek kadar
   hızlı olduğundan üretim hattına sokulmadı. `OpenAITranscriber` resmî spec'e göre
   (`/v1/audio/transcriptions`, whisper-1, verbose_json segments); anahtarsızda
   `MockTranscriber` açıkça "[MOCK]" etiketli metin döner (engine alanı arayüze taşınır).
6. **Lip-sync/avatar rıza politikası API katmanındadır**: `lipSync`/`avatarVideo`
   yetenekli istekler `params.consentConfirmed=true` olmadan 403 CONSENT_REQUIRED
   ile reddedilir (adaptörden bağımsız, gelecekteki gerçek adaptörler için de
   geçerli). Gerçek avatar sağlayıcı adaptörleri, erişilebilir/doğrulanabilir API
   sözleşmesi bulunduğunda V1 dalgasında eklenecek.

## Bilinen sınırlar

- Ducking (konuşma sırasında müziği kısma) ve SSML henüz yok (V1).
- Altyazılar STT'den değil senaryodan; gerçek ses hizalaması Whisper segmentleriyle
  V1'de bağlanacak (transcribe ucu cue'ları zaten döndürüyor).
- Ses klonlama bilinçli olarak kapsam dışı (izin + sağlayıcı koşulları katmanı şart).
