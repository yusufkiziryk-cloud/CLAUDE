# ADR-0011: Çoklu sağlayıcı, karşılaştırma laboratuvarı ve model analitiği

- Durum: Kabul edildi (Faz 7)
- Tarih: 2026-08-02

## Kararlar

1. **Replicate adaptörü resmî OpenAPI spec'inden doğrulandı**: `api.replicate.com/openapi.json`
   temel alınarak `POST /models/{owner}/{name}/predictions` (Bearer token, gövde
   `{input: {prompt}}`) ve durum eşlemesi (starting→queued, processing→running,
   succeeded/failed/canceled/aborted) yazıldı. Model listesi (minimax/video-01)
   ve fiyat "elle doğrulayın" notuyla isExact=false taşır — Replicate model
   kataloğu dinamiktir, kod sabit fiyat vaat etmez.
2. **ElevenLabs adaptörü de resmî spec'ten**: `api.elevenlabs.io/openapi.json`
   → `POST /v1/text-to-speech/{voice_id}` (`xi-api-key` başlığı,
   `model_id=eleven_multilingual_v2`, `output_format` sorgu parametresi). Uç
   eşzamanlı olduğundan submit sonucu bellekte tutulur ve getStatus hemen
   succeeded döner; ses klonlama bilinçli olarak KAPALIDIR (rıza katmanı şart).
3. **Anahtarı olmayan sağlayıcı kaydedilmez**: `registerConfiguredProviders`
   dört anahtarı da (FAL/OPENAI/REPLICATE/ELEVENLABS) aynı kuralla ele alır —
   eksik anahtar günlükte açıkça bildirilir, sağlayıcı arayüzde hiç görünmez.
   "Görünüp de çalışmayan" sahte seçenek sunulmaz.
4. **Karşılaştırma modu ayrı bir sistem değildir**: aynı prompt sürümü N modele
   ayrı üretim işi olarak gönderilir (her biri kendi idempotency anahtarı, kendi
   maliyeti). Her isteğin parametreleri o modelin manifest varsayılanlarından
   derlenir; sonuç kartları durum/süre/gerçek maliyet/önizlemeyi yan yana gösterir.
   Böylece kuyruk, provenance ve analitik mevcut haliyle geçerli kalır.
5. **Analitik yalnızca gerçekleşen veriden hesaplanır**: `GET /projects/:id/analytics`
   model bazında toplam/başarılı/başarısız sayısı, başarı oranı (yalnızca BİTEN
   işler üzerinden), ortalama süre (yalnızca startedAt+finishedAt olan işlerden)
   ve toplam maliyet (yalnızca `actualCostUsd`) döner. Tahminî maliyet bu tabloya
   karıştırılmaz; veri yoksa null/— gösterilir, uydurulmaz.
6. **Manifest yenileme açık bir uçtur**: registry TTL önbelleği normal akışta
   geçerli; `POST /providers/refresh` önbelleği boşaltıp taze manifestleri döner.
   Arayüzdeki "Modelleri Yenile" düğmesi bunu çağırır (ör. sağlayıcının model
   kataloğu değiştiğinde sayfa yenilemeden güncellenir).

## Bilinen sınırlar

- Replicate model kataloğu koddaki varsayılan listeyle sınırlı; katalog keşfi
  (`GET /models` taraması) V1'de eklenebilir.
- ElevenLabs ses listesi üç hazır (premade) kimlikle sınırlı; `GET /v1/voices`
  ile dinamik listeleme V1'e bırakıldı.
- Analitikteki süre ölçümü kuyruk beklemesini içermez (startedAt işlemci
  başlangıcıdır); kuyruk gecikmesi ayrı bir metrik olarak V1'de eklenebilir.
- Karşılaştırma sonuçları oturum içi görünümdür (jobs listesinden türetilir);
  kalıcı "karşılaştırma raporu" kaydı yoktur.
