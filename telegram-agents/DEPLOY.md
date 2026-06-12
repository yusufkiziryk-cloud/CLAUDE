# Botu 7/24 Calistirma (Dagitim Rehberi)

Bot "long polling" ile calisir; acik kalan herhangi bir sunucuda surekli calisabilir.
Asagida iki kolay yontem var. **Her ikisinde de token/anahtari dosyaya degil, host'un
"Environment Variables" (ortam degiskenleri) bolumune girersin** — bu daha guvenlidir.

Gerekli iki degisken:

| Degisken | Aciklama |
|----------|----------|
| `TELEGRAM_BOT_TOKEN` | BotFather'dan alinan token |
| `ANTHROPIC_API_KEY` | console.anthropic.com'dan alinan anahtar |

Opsiyonel: `CLAUDE_MODEL` (varsayilan `claude-opus-4-8`), `CLAUDE_EFFORT` (`low`/`medium`/`high`/`max`).

---

## Secenek A: Railway (en hizli)

1. https://railway.app -> GitHub ile giris yap.
2. **New Project -> Deploy from GitHub repo** -> bu repoyu sec.
3. **Root Directory** olarak `telegram-agents` ayarla (Settings icinden).
4. **Variables** sekmesine `TELEGRAM_BOT_TOKEN` ve `ANTHROPIC_API_KEY` ekle.
5. Railway, Dockerfile'i otomatik algilar ve dagitir. Loglarda "Bot calisiyor" gorunce hazirdir.

## Secenek B: Render

1. https://render.com -> **New -> Background Worker** (Web Service degil!).
2. Repoyu bagla, **Root Directory** = `telegram-agents`.
3. Runtime: **Docker** (Dockerfile otomatik bulunur).
4. **Environment** bolumune iki degiskeni ekle.
5. Deploy. (Background Worker secmek onemli: bu botun acik bir HTTP portu yok.)

## Secenek C: Kendi sunucun (VPS / Docker)

```bash
# repoyu cek, klasore gir
cd telegram-agents

# imaji olustur
docker build -t telegram-agents .

# calistir (degiskenleri komuta ver)
docker run -d --name telegram-agents --restart unless-stopped \
  -e TELEGRAM_BOT_TOKEN="123456:ABC..." \
  -e ANTHROPIC_API_KEY="sk-ant-..." \
  telegram-agents

# loglari izle
docker logs -f telegram-agents
```

`--restart unless-stopped` sayesinde sunucu yeniden baslasa bile bot otomatik kalkar.

---

## Notlar

- Botu ayni anda **tek bir yerde** calistir. Iki kopya ayni token ile polling yaparsa
  Telegram `409 Conflict` hatasi verir.
- Konusma gecmisi bellekte tutulur; konteyner yeniden baslayinca sifirlanir. Kalici
  istiyorsan basit bir veritabani eklenebilir (yardimci olabilirim).
- `.env` ve `node_modules` imaja dahil edilmez (`.dockerignore`).
