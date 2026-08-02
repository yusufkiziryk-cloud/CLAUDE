# Paketleme ve Yayınlama Rehberi (Faz 8)

## 1. Web + API (sunucu dağıtımı)

```bash
pnpm install --frozen-lockfile
pnpm turbo run build            # tüm paketler + Next.js production build

# API (Node 20+)
NODE_ENV=production node apps/api/dist/main.js

# Web (Next.js)
pnpm --filter @studio/web start   # veya bir Node süreç yöneticisi altında
```

Üretim ortam değişkenleri (`.env.example` şablonuna göre):

- `STORAGE_DRIVER=prisma` + `DATABASE_URL` (PostgreSQL; `pnpm --filter @studio/shared db:migrate`)
- `QUEUE_DRIVER=redis` + `REDIS_URL` ve **ayrı worker süreci**: `node apps/worker/dist/main.js`
- `OBJECT_STORE=s3` + S3/MinIO değerleri (çok makineli kurulumda zorunlu)
- `WEB_ORIGIN`, `RATE_LIMIT_PER_MIN`, `UPLOAD_MAX_MB`, `DATA_RETENTION_DAYS`
- Sağlayıcı anahtarları (BYOK): `FAL_API_KEY`, `OPENAI_API_KEY`,
  `REPLICATE_API_TOKEN`, `ELEVENLABS_API_KEY`

Altyapı için `docker-compose.yml` (PostgreSQL + Redis + MinIO) hazırdır.
FFmpeg, API/worker makinesinde kurulu olmalıdır (`ffmpeg -version`).

> UYARI: API'de henüz kimlik doğrulama yoktur (bkz. docs/SECURITY.md).
> `API_HOST` varsayılanı 127.0.0.1'dir; ters proxy + auth olmadan dışa açmayın.

## 2. Windows masaüstü (Tauri 2)

```bash
cd apps/desktop
pnpm tauri build        # Windows'ta: NSIS kurulum paketi üretir
```

- Yapı **imzasızdır**: kod imzalama sertifikası (EV/OV) edinildiğinde
  `tauri.conf.json > bundle > windows > certificateThumbprint` ile imzalanır;
  imzasız kurulumda SmartScreen uyarısı normaldir.
- Otomatik güncelleme (tauri-updater) imzalama anahtarı gerektirdiğinden V1'e
  bırakılmıştır.
- Masaüstü kabuğu yerel API'ye bağlanır; FFmpeg'in kullanıcı makinesinde
  bulunması gerekir (kurulum belgesinde belirtin).

## 3. Sürüm kontrol listesi

1. `pnpm turbo run lint typecheck test build` — tümü yeşil olmalı.
2. `pnpm audit` — kritik açık yok.
3. Migration'lar uygulandı (`db:migrate`), `.env` üretim değerleriyle dolu.
4. Canlı smoke: proje oluştur → üretim → timeline → MP4 dışa aktarma.
5. Yedekleme: PostgreSQL dump + nesne deposu (S3 sürümleme önerilir).
