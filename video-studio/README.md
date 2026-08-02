# 🎬 AI Video Üretim ve Kurgu Stüdyosu

Türkçe öncelikli, web + Windows masaüstü hedefli yapay zekâ video üretim ve kurgu
stüdyosu. **Şu an Faz 2 tamamlandı**: çift yönlü (form ↔ serbest metin) prompt editörü,
şablonlar, sürüm geçmişi + diff, JSON/YAML/TXT dışa aktarma, üretim öncesi canlı
doğrulama + maliyet tahmini ve ilk gerçek sağlayıcı adaptörleri (fal.ai, OpenAI —
anahtar `.env`e eklenince otomatik etkinleşir; anahtarsız yalnızca MOCK görünür).

> Faz planı ve mimari için: [`../docs/video-studio/FAZ0-KESIF-VE-TASARIM.md`](../docs/video-studio/FAZ0-KESIF-VE-TASARIM.md)
> Mimari kararlar için: [`docs/adr/`](docs/adr/)

## Hızlı başlangıç (harici servis GEREKMEZ)

```bash
cd video-studio
pnpm install
pnpm turbo run build          # paketleri derler (shared, prompt-engine, ...)

# Terminal 1 — API (memory depolama + süreç içi kuyruk)
pnpm --filter @studio/api dev

# Terminal 2 — Web arayüzü
pnpm --filter @studio/web dev
# → http://localhost:3000
```

Varsayılan modda veriler süreç belleğindedir (geliştirme). Kalıcı mod için:

```bash
docker compose up -d                       # PostgreSQL + Redis + MinIO
cp .env.example .env                       # STORAGE_DRIVER=prisma, QUEUE_DRIVER=redis yapın
pnpm --filter @studio/shared db:migrate    # migration'ları uygular
pnpm --filter @studio/api dev              # API
pnpm --filter @studio/worker dev           # ayrı üretim işçisi
pnpm --filter @studio/web dev              # arayüz
```

## Test / kalite kapıları

```bash
pnpm turbo run lint typecheck test build   # tamamı CI'da da koşar
```

## Yapı

| Yol                         | İçerik                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `packages/domain`           | Zod domain şemaları (Project, VideoPrompt, GenerationJob, Asset, Provenance)          |
| `packages/prompt-engine`    | Type-safe prompt builder, deterministik derleyici, yerel kalite denetimi, değişkenler |
| `packages/provider-sdk`     | `MediaProviderAdapter` sözleşmesi, capability manifest, registry, hata zarfı          |
| `packages/providers/mock`   | MOCK/DEMO sağlayıcı — gerçek üretim yapmaz, akış testine yarar                        |
| `packages/providers/fal`    | fal.ai kuyruk API adaptörü (FAL_API_KEY gerektirir)                                   |
| `packages/providers/openai` | OpenAI görsel (gpt-image-1) + TTS (gpt-4o-mini-tts) adaptörü (OPENAI_API_KEY)         |
| `packages/shared`           | Depolama sürücüleri (memory/prisma), üretim işlemcisi, Prisma şeması                  |
| `packages/test-utils`       | Sağlayıcı contract test kiti + fixture'lar                                            |
| `packages/ui`               | Ortak React bileşenleri (Tailwind)                                                    |
| `apps/api`                  | Fastify API — projeler, prompt sürümleri, üretim işleri, varlıklar                    |
| `apps/worker`               | BullMQ üretim işçisi (redis modu)                                                     |
| `apps/web`                  | Next.js arayüz — proje sihirbazı, prompt stüdyosu, üretim laboratuvarı, galeri        |
| `apps/desktop`              | Tauri 2 Windows kabuğu (bkz. `apps/desktop/README.md`)                                |

## Önemli ilkeler

- **Mock ≠ gerçek**: mock çıktılar her yerde `MOCK/DEMO` etiketi ve `provenance.mock=true` taşır.
- **Desteklenmeyen parametre sessizce yutulmaz**: adaptör `validate` aşamasında `unsupported` bildirir, API 422 döner.
- **İdempotency**: aynı `idempotencyKey` ile ikinci üretim isteği yeni iş (ve yeni maliyet) oluşturmaz.
- **Provenance**: her üretilmiş varlık sağlayıcı/model/parametre/maliyet kökeniyle kaydedilir.
- **Gizli değer commit edilmez**: `.env.example` şablondur; gerçek anahtarlar `.env`te kalır.
