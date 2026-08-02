# Güvenlik Notları ve Gözden Geçirme (Faz 8)

Bu belge Faz 8'de yapılan güvenlik gözden geçirmesinin sonucunu, alınan
önlemleri ve bilinen sınırları kaydeder.

## Alınan önlemler

| Alan                    | Önlem                                                                                                                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gizli değerler          | Anahtarlar yalnızca `.env`te; koda/loga/istemci paketine asla yazılmaz. Pino log'ları `authorization`, `cookie`, `x-api-key` başlıklarını `[GİZLİ]` ile maskeler. Anahtarı olmayan sağlayıcı hiç kaydedilmez.        |
| CORS                    | `WEB_ORIGIN` env'i ile tek origin'e daraltılır (varsayılan `http://localhost:3000`). Origin uyuşmazlığı canlı testte doğrulandı.                                                                                     |
| İstek sınırı            | IP başına dakikalık sabit pencere (`RATE_LIMIT_PER_MIN`, varsayılan 300). 429 + `retry-after` + hata zarfı döner. Süreç içi sayaçtır: çok kopyalı dağıtımda paylaşımlı depoya (ör. Redis) taşınmalıdır.              |
| Gövde/yükleme limitleri | JSON gövdesi 2 MiB (413), dosya yükleme `UPLOAD_MAX_MB` (varsayılan 200 MiB), tek dosya, MIME allowlist (PNG/JPEG/MP4/WebM/MP3/WAV).                                                                                 |
| Güvenlik başlıkları     | @fastify/helmet: `x-content-type-options: nosniff`, `x-frame-options` vb. `/files/*` medyası farklı origin'deki web arayüzünce okunmalı → `cross-origin-resource-policy: cross-origin`.                              |
| Path traversal          | Nesne anahtarları `assertValidKey` (regex + `..` reddi) ve `normalize`+önek denetiminden geçer; `/files/..%2F...` 404 döner (testli). Retention süpürücüsündeki render dosya silme de dizin dışına çıkamaz (testli). |
| Komut enjeksiyonu       | FFmpeg YALNIZCA argüman dizisiyle `spawn` edilir; kabuk dizgesi birleştirme yoktur. drawtext metinleri kaçışlanır.                                                                                                   |
| Bütçe                   | `Project.budgetUsd` doluysa: gerçekleşen harcama + aktif işlerin tahmini + yeni istek tahmini bütçeyi aşarsa 402 `BUDGET_EXCEEDED` (iş kuyruğa hiç alınmaz).                                                         |
| Rıza/deepfake           | `lipSync`/`avatarVideo` istekleri `params.consentConfirmed=true` olmadan 403 `CONSENT_REQUIRED`. Gerçek kişi bible kartı rıza onayı olmadan storyboard'a giremez. Ses klonlama tüm adaptörlerde kapalı.              |
| Veri saklama (KVKK)     | `DATA_RETENTION_DAYS` doluysa bitmiş işler + referanssız sonuç varlıkları + render çıktıları süre sonunda günlük süpürmeyle silinir. Sahne/timeline'da kullanılan varlıklar korunur. Tanımsızsa hiçbir şey silinmez. |
| Artefakt indirme        | Üretim işlemcisi sağlayıcıdan dönen artefakt URL'lerini boyut sınırıyla indirir; sınırsız bellek tüketimi engellenir.                                                                                                |
| İdempotency             | Aynı `idempotencyKey` ikinci kez ücret/iş oluşturmaz (adaptörlerde ve API'de).                                                                                                                                       |

## Bilinen sınırlar (üretime çıkmadan yapılmalı)

1. **Kimlik doğrulama YOK** — API tek kullanıcılı geliştirme modundadır
   (`DEV_USER_EMAIL`). İnternete açmadan önce gerçek auth (ör. OIDC) ve
   yetkilendirme katmanı eklenmelidir. `API_HOST` varsayılanı bilinçli olarak
   `127.0.0.1`'dir.
2. **Rate limit süreç içidir** — yatay ölçeklemede Redis tabanlı sayaç gerekir.
3. **`/files/*` erişim denetimi yok** — anahtarı bilen herkes dosyayı okuyabilir
   (anahtarlar tahmin edilemez kimlikler içerir; yine de auth ile birlikte
   imzalı URL'lere geçilmelidir).
4. **Sağlayıcı anahtarları süreç env'indedir** — gizli değer yöneticisi (Vault,
   SOPS, bulut KMS) önerilir.
5. **Bağımlılık taraması** el ile yapılır (`pnpm audit`); CI'a eklenmesi önerilir.
