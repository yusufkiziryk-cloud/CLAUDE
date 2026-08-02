# ADR-0009: Nesne depolama soyutlaması ve işçi süreç ayrımı

- Durum: Kabul edildi (Faz 5)
- Tarih: 2026-08-02

## Kararlar

1. **ObjectStore arayüzü**: `LocalDiskObjectStore` (geliştirme/masaüstü, `DATA_DIR/objects`)
   ve `S3ObjectStore` (MinIO/AWS, path-style). Varlık URI'leri istemciye her zaman
   API'nin `/files/*` servisi üzerinden verilir; istemci depolama teknolojisini bilmez.
   Anahtar doğrulaması path traversal'ı reddeder (testli).
2. **Üretim çıktıları artık data URI değil**: işlemci artifact'ları depoya yazar
   (sağlayıcı URL'leri süre+boyut sınırlı indirilir: 120 sn / 200 MB). Sahne
   storyboard bağlama artık SUNUCU tarafındadır (işlemci başarıda sahneyi günceller).
3. **Medya yükleme**: multipart tek istek (200 MB sınır, MIME allowlist — uzantıya
   güvenilmez). Parçalı/devam ettirilebilir yükleme bilinçli ertelendi (V1 yol
   haritası; tus benzeri protokol değerlendirilecek).
4. **Render işleri de kuyruğa taşındı**: `RenderQueue` (memory / BullMQ-redis);
   redis modunda apps/worker hem üretim hem render kuyruklarını tüketir (render
   eşzamanlılığı 1 — CPU yoğun). BullMQ retry/backoff üretimde 3, render'da 2 deneme.
5. **İptal durum-tabanlıdır**: cancel ucu işi 'cancelled' yapar; ffmpeg'i çalıştıran
   süreç durumu saniyede bir yoklar ve süreci öldürür. Bu, API ile worker'ın ayrı
   süreç olduğu modda da çalışır (paylaşılan veritabanı üzerinden).
6. **Crash recovery**: API ve worker açılışta 'running' kalmış üretim/render işlerini
   `PROCESS_RESTARTED` koduyla retryable-failed işaretler (canlı doğrulandı).
7. **Gözlemlenebilirlik**: Fastify/pino yapılandırılmış log, `authorization`/`cookie`/
   `x-api-key` başlıkları redakte; her istek `req.id` correlation taşır ve hata
   zarflarında döner.
8. **redis + disk deposu kombinasyonu** yalnızca aynı makinede (aynı `DATA_DIR`)
   doğrudur; açılışta uyarı basılır. Dağıtık kurulumda `OBJECT_STORE=s3` gerekir.

## Doğrulama

- S3ObjectStore sahte S3 sunucusuyla contract testi; disk sürücüsü + traversal testleri
- Upload/serve/415/iptal/kurtarma API testleri; işlemci→depo→sahne bağlama testi
- **Tam yığın canlı smoke (bu ortamda)**: PostgreSQL 16 + Redis 7 + 4 migration +
  API ve worker AYRI süreçler — üretim worker'da işlendi, varlık /files'tan servis
  edildi, render worker'da koştu (MP4 ftyp), crash recovery 'running' işi kurtardı,
  Playwright E2E (upload dahil) geçti.
