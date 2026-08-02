# 🚀 Bilgisayarınızda Çalıştırma Rehberi

Bu klasör, AI Video Stüdyosu'nun tamamıdır. Harici servis GEREKMEDEN
(veritabanı/Redis olmadan, mock modda) bilgisayarınızda çalışır.

## 1. Gereksinimler (bir kez kurulur)

| Gereksinim | Nasıl kurulur |
| --- | --- |
| **Node.js 20+** | https://nodejs.org (LTS sürümü) |
| **pnpm** | Node kurulduktan sonra terminalde: `corepack enable` |
| **FFmpeg** (yalnızca MP4 dışa aktarma için) | Windows: `winget install ffmpeg` · macOS: `brew install ffmpeg` · Linux: `sudo apt install ffmpeg` |

## 2. Başlatma

### Kolay yol

- **Windows**: bu klasördeki `basla.bat` dosyasına çift tıklayın.
- **macOS / Linux**: terminalde `./basla.sh`

Script bağımlılıkları kurar, paketleri derler ve API + web arayüzünü başlatır.
Ardından tarayıcıda **http://localhost:3000** adresini açın.

### El ile (aynı işlemler)

```bash
pnpm install
pnpm turbo run build
pnpm --filter @studio/api dev    # Terminal 1 — API (http://localhost:4000)
pnpm --filter @studio/web dev    # Terminal 2 — Arayüz (http://localhost:3000)
```

## 3. İsteğe bağlı ayarlar (.env)

`cp .env.example .env` (Windows: `copy .env.example .env`) yapıp düzenleyin:

- **Gerçek AI üretimi**: `FAL_API_KEY`, `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`,
  `ELEVENLABS_API_KEY` — anahtar girilmeyen sağlayıcı görünmez; anahtarsız modda
  her şey MOCK/DEMO etiketiyle çalışır (akışı denemek için yeterlidir).
- **Parola koruması**: `AUTH_PASSWORD=guclu-bir-parola` (min 8 karakter) —
  arayüz `/giris` sayfasıyla oturum ister. Boş bırakılırsa kimliksiz yerel mod.
- **Kalıcı veri** (varsayılan mod bellektedir, kapatınca silinir):
  `docker compose up -d` ile PostgreSQL+Redis+MinIO başlatın; `.env`te
  `STORAGE_DRIVER=prisma`, `QUEUE_DRIVER=redis` yapın;
  `pnpm --filter @studio/shared db:migrate` çalıştırın ve API'ye ek olarak
  `pnpm --filter @studio/worker dev` sürecini de açın.

## 4. Sık karşılaşılanlar

- **"pnpm bulunamadı"** → `corepack enable` çalıştırın (yönetici terminalinde).
- **3000/4000 portu dolu** → `.env`te `API_PORT` değiştirin; web için
  `pnpm --filter @studio/web dev -- -p 3001`.
- **MP4 dışa aktarma hata veriyor** → `ffmpeg -version` çalıştığından emin olun.
- Ayrıntılar: [README.md](README.md), üretim dağıtımı: [docs/RELEASE.md](docs/RELEASE.md),
  güvenlik notları: [docs/SECURITY.md](docs/SECURITY.md).
