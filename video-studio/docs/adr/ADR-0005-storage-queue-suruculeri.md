# ADR-0005: Depolama ve kuyruk sürücü soyutlaması (memory | prisma / memory | redis)

- Durum: Kabul edildi (Faz 1)
- Tarih: 2026-08-02

## Bağlam

"Tek komutla geliştirme ortamı" kabul ölçütü ile "üretim ölçeğinde ayrı worker
süreçleri" hedefi aynı anda karşılanmalı. Ayrıca testler harici servis olmadan
koşabilmeli.

## Karar

- `StorageDriver` arayüzü: `memory` (süreç içi, geliştirme/test) ve `prisma`
  (PostgreSQL, docker compose) uygulamaları.
- `GenerationQueue` arayüzü: `memory` (API süreci içinde işleme) ve `redis`
  (BullMQ üretici + `apps/worker` tüketici).
- Sürücü seçimi `.env` ile: `STORAGE_DRIVER`, `QUEUE_DRIVER`. Geçersiz kombinasyon
  (`redis` kuyruk + `memory` depolama) açılışta reddedilir — ayrı süreçler durum
  paylaşamaz.
- `PrismaStorageDriver` yalnızca gerektiğinde dinamik import edilir; memory modu
  `@prisma/client` yüklemez.
- Her iki kuyruk modu da aynı `processGenerationJob` fonksiyonunu çalıştırır
  (`@studio/shared`); davranış farkı yalnızca taşıma katmanındadır.

## Sonuçlar

- Artı: Testler ve ilk kurulum sıfır harici bağımlılıkla çalışır (doğrulandı: 9 API
  integration testi memory sürücülerle geçiyor)
- Artı: Üretim yolu (redis+prisma) aynı işlemciyi kullandığından davranış sapması düşük
- Eksi: memory modda veri süreç ömrüyle sınırlıdır; arayüz bunu açıkça uyarır
- Prisma migration'ları `packages/shared/prisma/migrations` altında sürümlenir
