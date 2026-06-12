# Telegram Ajanlari (Claude destekli)

Claude API ile calisan, **birden fazla ajan/kisilik** destekleyen bir Telegram botu.
Her ajan farkli bir role sahiptir (asistan, cevirmen, kod yardimcisi, metin yazari, ogretmen).
Kullanici buton ya da komutla ajan secer, sonra normal mesaj yazarak sohbet eder.

## Ozellikler

- 🧠 Genel Asistan, 🌍 Cevirmen, 💻 Kod Yardimcisi, ✍️ Metin Yazari, 📚 Ogretmen
- Buton (inline keyboard) ile kolay ajan secimi
- Her sohbet icin ayri konusma gecmisi
- Uzun yanitlar otomatik parcalanir (Telegram 4096 karakter limiti)
- Yeni ajan eklemek cok kolay (`agents.js`)

## Kurulum (adim adim)

### 1) Telegram bot token'i al (BotFather)

1. Telegram'da **@BotFather**'i ac.
2. `/newbot` yaz, botun adini ve kullanici adini gir.
3. BotFather sana bir **token** verir (orn. `123456:ABC-DEF...`). Bunu kopyala.

### 2) Anthropic (Claude) API anahtari al

1. https://console.anthropic.com adresine giris yap.
2. **API Keys** bolumunden yeni bir anahtar olustur ve kopyala.

### 3) Projeyi hazirla

```bash
cd telegram-agents
npm install
cp .env.example .env
```

Sonra `.env` dosyasini ac ve token/anahtarlari yapistir:

```
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
ANTHROPIC_API_KEY=sk-ant-...
```

### 4) Calistir

```bash
npm start
```

Terminalde `Bot calisiyor...` yazisini gorunce, Telegram'da botunu ac ve `/start` yaz.

## Komutlar

| Komut | Aciklama |
|-------|----------|
| `/start` | Karsilama ve ajan secim menusu |
| `/ajanlar` | Ajan listesini gosterir |
| `/kullan <ajan>` | Ajan secer (orn. `/kullan cevirmen`) |
| `/sifirla` | Mevcut sohbet gecmisini temizler |

Komut disindaki her mesaj, secili ajana gonderilir.

## Yeni ajan ekleme

`agents.js` dosyasindaki `agents` nesnesine yeni bir kayit ekle:

```js
seyahat: {
  name: "✈️ Seyahat Danismani",
  description: "Rota, butce ve gezi onerileri sunar.",
  system: "Sen deneyimli bir seyahat danismanisin. ...",
},
```

Kaydet ve botu yeniden baslat — yeni ajan otomatik olarak menude gorunur.

## Notlar

- Konusma gecmisi **bellekte** tutulur; surec yeniden baslayinca sifirlanir.
  Kalici olmasi icin basit bir veritabani (SQLite vb.) eklenebilir.
- Model ve dusunme derinligi `.env` icindeki `CLAUDE_MODEL` ve `CLAUDE_EFFORT`
  ile ayarlanabilir (`low`/`medium`/`high`/`max`).
- `.env` dosyasi `.gitignore` ile korunur — anahtarlarini asla commit'leme.
