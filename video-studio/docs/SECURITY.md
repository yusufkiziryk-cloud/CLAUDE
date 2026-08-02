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

## Kimlik doğrulama (V1)

`AUTH_PASSWORD` env'i doluysa API parola korumalıdır: `POST /auth/login`
(timing-safe karşılaştırma) 12 saatlik oturum token'ı döner; tüm uçlar
`Authorization: Bearer <token>` ister. Muaf: `/health`, `/auth/login`,
`GET /files/*`, `GET /renders/*` (medya etiketleri başlık gönderemez). Web
arayüzü `/giris` sayfasıyla oturum açar, 401'de otomatik yönlendirilir.
Tanımsızsa API kimliksiz geliştirme modundadır (açılışta uyarı basılır).

## Bilinen sınırlar (üretime çıkmadan değerlendirin)

1. **Tek parola = tek kullanıcı** — rol/izin modeli yok; oturumlar süreç içi
   (yeniden başlatmada düşer); web token'ı localStorage'dadır (XSS'e karşı
   httpOnly çerezden zayıf). Çok kullanıcılı/İnternete açık senaryoda OIDC +
   httpOnly çerez katmanına geçilmelidir. `API_HOST` varsayılanı bilinçli
   olarak `127.0.0.1`'dir.
2. **Rate limit ve oturumlar süreç içidir** — yatay ölçeklemede Redis tabanlı
   sayaç/oturum deposu gerekir.
3. **`GET /files/*` erişim denetiminden muaftır** — anahtarı bilen okuyabilir
   (anahtarlar tahmin edilemez kimlikler içerir); imzalı URL'ler yol haritasında.
4. **Sağlayıcı anahtarları süreç env'indedir** — gizli değer yöneticisi (Vault,
   SOPS, bulut KMS) önerilir.
5. **Bağımlılık taraması CI'dadır** (`pnpm audit --audit-level high`); bilinen
   high bulgular pnpm overrides ile yamalandı.
