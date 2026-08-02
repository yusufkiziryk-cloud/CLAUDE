# ADR-0008: Timeline mimarisi ve FFmpeg render hattı

- Durum: Kabul edildi (Faz 4)
- Tarih: 2026-08-02

## Kararlar

1. **Timeline veri modeli UI'dan bağımsızdır** (`@studio/domain` şemaları +
   `@studio/timeline-engine` saf komut fonksiyonları). Her komut yeni bir Sequence
   döndürür; çakışma/geçersizlik anlaşılır hata fırlatır ve durum bozulmaz.
2. **Undo/redo snapshot tabanlıdır**: komutlar saf olduğundan geçmiş, durum
   yığınından ibarettir (100 adım sınırı). Ters-komut karmaşıklığına gerek kalmaz.
3. **Düzenleme istemci güdümlüdür**: web, timeline-engine'i tarayıcıda çalıştırır
   (izomorfik TS); sunucu PUT'ta Zod ile yeniden doğrular. MVP'de proje başına tek
   ana sequence vardır.
4. **Render graph → argüman dizisi**: `@studio/media-engine` sequence'ten FFmpeg
   `filter_complex` grafiği üretir; komut ASLA shell string olarak birleştirilmez,
   `spawn("ffmpeg", args)` ile çalıştırılır. drawtext metinleri filtre-kaçışından
   geçirilir (komut enjeksiyonu testli).
5. **Faz 4 render kapsamı (bilinçli MVP)**: tek video track (görsel/video klipler,
   overlay zinciri), çok klipli ses miksajı (adelay+amix+volume), drawtext altyazı;
   video kliplerin kendi sesi sessize alınır; geçiş efektleri yoktur. Çok video
   track, geçişler ve keyframe'ler V1.
6. **Render API süreci içinde asenkron çalışır** (Faz 4); ayrı render worker ve
   kuyruk dayanıklılığı Faz 5'te. İlerleme ffmpeg stderr `time=` çıktısından okunur.
   Çıktılar `data/renders/` altında saklanır ve path-traversal korumalı uçtan
   servis edilir.
7. **Mock çıktıları PNG'ye geçti**: saf-TS PNG kodlayıcı (zlib) ile üretilen yer
   tutucular FFmpeg hattıyla uçtan uca uyumludur; MOCK/DEMO etiketi arayüzde
   provenance.mock ile korunur.
8. Uzak (http) medya render'ı bilinçli reddedilir; Faz 5'te SSRF allowlist'li
   indirme gelecek.

## Doğrulama

- 12 timeline-engine testi (serialization, çakışma, split matematiği, undo/redo)
- media-engine testleri + GERÇEK FFmpeg smoke testi (PNG+drawtext → MP4, ffprobe
  süre kontrolü)
- API entegrasyonunda gerçek render testi (202 → succeeded → MP4 `ftyp` imzası)
- Playwright canlı E2E: varlık→timeline→böl/undo→kaydet→render→oynatıcı→kalıcılık
