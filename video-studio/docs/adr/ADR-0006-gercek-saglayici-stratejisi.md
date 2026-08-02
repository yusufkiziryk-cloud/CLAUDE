# ADR-0006: İlk gerçek sağlayıcılar — fal.ai + OpenAI, anahtar-korumalı kayıt

- Durum: Kabul edildi (Faz 2)
- Tarih: 2026-08-02

## Bağlam

Faz 2 "en az bir toplayıcı ve bir doğrudan sağlayıcı" gerektirir. Kullanıcının elinde
henüz API anahtarı olmayabilir; anahtar yokken sahte başarı üretmek yasaktır.

## Kararlar

1. **fal.ai** (toplayıcı): kuyruk API'si resmî fal-js istemci kaynak kodundan doğrulandı
   (`POST https://queue.fal.run/{model_id}`, `Authorization: Key`, durumlar
   `IN_QUEUE/IN_PROGRESS/COMPLETED`, `?fal_webhook=`, `PUT .../cancel`).
   Model kataloğu yapılandırma verisidir; ilk model `fal-ai/minimax/video-01`
   (girdi şeması resmî API örneğiyle doğrulanan tek alan: `prompt` — başka alan
   GÖNDERİLMEZ). Sonuç ayrıştırma savunmacıdır: bilinen medya alanı yoksa
   anlaşılır hata fırlatılır, uydurma başarı yoktur.
2. **OpenAI** (doğrudan): `v1/images/generations` (gpt-image-1) ve `v1/audio/speech`
   (gpt-4o-mini-tts) resmî OpenAPI spec'inden doğrulandı. Uçlar eşzamanlı olduğundan
   adaptör submit anında çağrıyı yapar, getStatus hemen succeeded döner.
3. **Anahtar-korumalı kayıt**: anahtarı olmayan sağlayıcı registry'ye HİÇ kaydolmaz;
   arayüzde görünmez, `/estimate` "PROVIDER_NOT_CONFIGURED" + eksik anahtar mesajı döner.
   Mock her zaman açıktır. Sahte "demo başarı" üretilmez.
4. **Fiyatlar kesin değildir**: tüm gerçek tahminler `isExact=false` + kaynak + tarih taşır;
   arayüz "(yaklaşık)" ibaresi gösterir.
5. **Testler ağsızdır**: her iki adaptör, resmî sözleşmelere göre yazılmış fixture
   fetch'leriyle ortak contract suite'ten geçer. Gerçek anahtarla duman testi,
   kullanıcı anahtar sağladığında yapılacaktır (bilinen eksik).
6. **params kanalı**: `CanonicalGenerationRequest.params` eklendi; modele özgü ayarlar
   (kalite/ses/hız) manifest beyanına karşı doğrulanır, beyan edilmemiş anahtar
   `unsupported` sayılır.

## Sonuçlar

- Artı: Anahtar eklemek `.env` değişikliğinden ibaret; kod değişikliği gerekmez
- Artı: Çekirdek hâlâ sağlayıcı adı bilmiyor (yalnızca `registerConfiguredProviders` kompozisyon noktası)
- Eksi: fal model kataloğu (süre/çözünürlük/fiyat) kısmen elle doğrulama gerektirir;
  fal.ai model sayfaları bot korumalı olduğundan otomatik çekilemedi
- Eksi: OpenAI sonucu süreç belleğinde tutulur; redis modunda süreç yeniden başlarsa
  RESULT_LOST hatasıyla güvenli biçimde başarısız olur (Faz 5'te kalıcılaştırılacak)
