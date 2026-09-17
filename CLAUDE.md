# CLAUDE.md

Bu depo birden fazla bağımsız projeyi barındırır. Her projenin kendi kuralları
kendi dizinindedir — ilgili dizinde çalışmadan önce o dosyayı oku.

| Dizin | Proje | Kurallar |
|---|---|---|
| `crypto-bot/` | Kişisel kripto alım-satım botu (Python, Freqtrade, dry-run) | [`crypto-bot/CLAUDE.md`](crypto-bot/CLAUDE.md) |
| `lifetrack/`, `lifetrack-mobile/` | LifeTrack uygulaması (React/Vite, Expo) | — |
| `telegram-agents/` | Telegram ajanları (Node) | — |

## crypto-bot için kritik sınır

Bot **canlı işlem yapmaz**. Depoda canlıya geçiren komut, bayrak, zamanlayıcı
veya düğme yoktur ve eklenmemelidir. Ayrıntı:
[`crypto-bot/docs/LIVE_READINESS.md`](crypto-bot/docs/LIVE_READINESS.md).
