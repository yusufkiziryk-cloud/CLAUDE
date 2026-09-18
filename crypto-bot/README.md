# Kişisel Kripto Botu (dry-run)

Tek kişilik, tek hesaplı, **yalnızca spot ve long** çalışan kişisel bir işlem
botu. Freqtrade 2026.8 üzerine kurulu; risk katmanı ayrı ve saf Python.

> **Bu bot canlı işlem yapmaz.** Depoda canlıya geçiren hiçbir komut, bayrak,
> zamanlayıcı veya düğme yoktur. `scripts/safe-run.py`, etkin yapılandırma
> anahtarsız bir dry-run değilse başlamayı reddeder. Canlıya geçiş, insanın
> kendi sermaye kararıyla elle yaptığı ayrı bir işlemdir — bkz.
> [docs/LIVE_READINESS.md](docs/LIVE_READINESS.md).

## Mevcut durum, açıkça

| Soru | Cevap |
|---|---|
| Yazılım çalışıyor mu? | Evet. 301 test geçiyor; backtest ve dry-run uçtan uca koşuyor. |
| Strateji kârlı mı? | **Hayır, kanıt yok.** Son 12 ayda -%5.33, 12 işlem. Karar: `INSUFFICIENT_EVIDENCE`. |
| Canlıya hazır mı? | **Hayır.** 6 ayrı canlı engeli var. |
| Gerçek para riski var mı? | Yok. Anahtar yok, emir yok, fon hareketi kodu yok. |

## Kurulum

```bash
cd crypto-bot
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m pytest -m "not network"   # ~4 saniye
```

Python 3.11 veya üzeri gerekir. Freqtrade sürümü bilerek sabitlenmiştir:
güvenlik kontrollerimiz freqtrade'in iç davranışlarını okur, sürüm sessizce
değişirse gerçek bir kontrol işlevsiz hale gelebilir.
`tests/test_capabilities.py` bunu yakalar.

## Veri toplama

Hyperliquid'de `freqtrade download-data` **çalışmaz** (`ohlcv_has_history`
`False`). Kendi toplayıcımızı kullanın:

```bash
.venv/bin/python scripts/collect-data.py                  # 4h, 1h, 5m
.venv/bin/python scripts/collect-data.py --timeframes 4h  # artımlı yenileme
```

Tekrar çalıştırmak güvenlidir: kayıtlar `(borsa, market_id, timeframe,
open_time)` üzerinden birleştirilir, dosya atomik yazılır, aynı mum iki kez
eklenmez. Yalnızca kamuya açık uçlar okunur; anahtar gerekmez.

Ölçülen kapsam (17 Eylül 2026):

| Çift | 4h | 1h | 5m |
|---|---|---|---|
| BTC/USDC | 3552 mum / 592 gün | ~5002 / 208 gün | ~5027 / **17 gün** |
| ETH/USDC | 3243 mum / 540 gün | ~5002 / 208 gün | ~5023 / **17 gün** |
| SOL/USDC | 2974 mum / 496 gün | ~5002 / 208 gün | ~5021 / **17 gün** |

**4h'de bir yıldan fazla geçmiş olması 5m'de de olduğu anlamına gelmez.**
5m yalnızca 17 gün olduğu için mum-içi gerçekleşme doğrulaması sınırlıdır.

## Çalıştırma

```bash
# dry-run (gerçek emir yok, anahtar yok)
.venv/bin/python scripts/safe-run.py trade --config config/config.dry.json

# backtest
.venv/bin/python scripts/safe-run.py backtesting \
    --config config/config.dry.json --strategy BaselineTrend4h \
    --timerange 20250901-20260901 --enable-protections
```

TLS'i sonlandıran bir vekil sunucunun arkasındaysanız sona
`--config config/proxy-overlay.json` ekleyin. TLS doğrulaması kapatılmaz.

`scripts/safe-run.py` tek desteklenen giriş noktasıdır. Dosya, ortam
değişkeni ve CLI birleştikten **sonraki** yapılandırmayı freqtrade'in kendi
birleştiricisiyle hesaplar ve anahtarsız dry-run değilse reddeder.

## Kalıcı kurulum

Botu kendi makinenizde 7/24 çalıştırmak için:
[`deploy/README.md`](deploy/README.md) — systemd birimleri, watchdog, makine
dışı dead-man heartbeat ve doğrulanan yedek. Kurulum dry-run'dır; canlı bir
varyantı yoktur.

## Panel (tek dosya HTML)

```bash
.venv/bin/python scripts/dashboard.py     # reports/dashboard.html
```

Tarayıcıda açın. **Sunucu değil, dosya** — port açmaz, anahtar tutmaz, dışarı
bir şey göndermez. Her şeyi diskteki mevcut çıktılardan okur: freqtrade'in
yazdığı backtest arşivi, risk durumundaki kayıtlı giriş kararları ve veri
manifesti. Kaynak yoksa uydurmaz, "yok" yazar.

İçerik: equity eğrisi (al-tut ve nakit ile karşılaştırmalı), giriş kararları ve
ret nedenleri, veri kapsamı, 12 işlemin tamamı, sağlık kontrolleri ve canlıya
geçişi engelleyen 6 madde.

## Haftalık rapor

```bash
.venv/bin/python scripts/weekly-report.py --weeks 1
```

`reports/weekly/` altına Markdown + JSON yazar. Dışarı hiçbir şey gönderilmez,
anahtar kullanılmaz.

İçerik: gerçekleşmiş PnL, tüm ücretler, equity/düşüş, benchmarklar, **her giriş
kararı ve ret nedeni**, risk kilitleri, veri boşlukları, kesintiler ve ilgili
çalışma yolunun modelleyemediği şeyler.

Üç şeyi bilerek yapmaz:

- **Bitmemiş gözlemi bitmiş göstermez.** Gerekli gün sayısının altında karar
  `OBSERVATION_IN_PROGRESS` olur.
- **Geçen süreyi kanıt saymaz.** Gün sayısı dolsa bile en az 50 kapanmış işlem
  yoksa `INSUFFICIENT_EVIDENCE` döner.
- **Tanımsız oranı iyi oran diye göstermez.** Kaybeden işlem yokken profit
  factor "undefined" yazar, mükemmel skor değil.

İşlemsiz bir hafta boş rapor değil bir sonuçtur; ret nedenleri tablosu onu
açıklar.

> **Dikkat:** freqtrade backtest sonuçlarını bir gün önbellekler ve strateji
> dosyası değişmediyse sessizce yeniden kullanır. `safe-run.py` bu yüzden
> `--cache none` geçer. Kanıt üreten çalıştırmalarda cache'e güvenmeyin.

## İzleme (watchdog)

```bash
.venv/bin/python scripts/watchdog.py --state user_data/dryrun/risk_state.sqlite
.venv/bin/python scripts/watchdog.py --state ... --interval 60   # sürekli izle
```

Çıkış kodu: `0` sağlıklı, `1` uyarı, `2` kritik.

Gözlemci state dosyasını **salt okunur** açar (SQLite `mode=ro`), yani yazması
yapısal olarak imkânsızdır. Anahtar taşımaz, emir göndermez.

**Süreç canlılığına bakmaz.** Bir süreç ayakta olup döngüsü donmuş olabilir;
kontroller botun geride bıraktığı kanıtın yaşını ölçer: döngü heartbeat'i, veri
tazeliği, order book yaşı, son uzlaştırma, saat sapması, API hata oranı,
bekleyen emir yaşı, disk ve bildirim sağlığı.

Hiçbir kontrol çıkış yönetimini durduramaz — en güçlü öneri **girişleri**
durdurmak veya operatör çağırmaktır.

**Yapamadığı şey:** aynı makinedeki watchdog, makinenin kendisi öldüğünde haber
veremez — onunla birlikte ölür. Bunun için makine dışına heartbeat gönderen bir
"dead-man" servisi gerekir; bu depo öyle bir servis başlatmaz veya satın almaz.

## Durdurma — üç ayrı şey

| Amaç | Yapılacak | Açık pozisyonlara etkisi |
|---|---|---|
| Yeni risk alma | risk durumunu `ENTRY_PAUSED` yap | stop ve çıkışlar **çalışmaya devam eder** |
| Pozisyonları kapat | borsada elle | pozisyonlar kapanır |
| Süreci kapat | Ctrl-C | **bot içi stop da durur** |

**Süreci kapatmak risk durdurmak değildir.** Hyperliquid spot'ta borsa
tarafında stop olmadığı için, kapatılan bir botun ardında kalan açık
pozisyonun hiçbir koruması kalmaz.

## Bilinen sınırlar

1. **Hyperliquid spot'ta borsa tarafı stop yok.** Doğrulandı:
   `Hyperliquid._ft_has["stoploss_on_exchange"]` spot için `False` (futures
   için `True`). Stop bot sürecinin içinde yaşar. Watchdog veya VPS bunun
   eşdeğeri değildir.
2. **İşlem gören varlıklar native değil.** `BTC/USDC` (`@142`) aslında
   **UBTC** (Unit Bitcoin) — köprü ihraçlı bir sarmalayıcı. ETH ve SOL de
   öyle, ve üçü de **aynı ihraççıdan**. Bu yüzden tek risk kümesi sayılırlar.
   ccxt bu farkı isimlendirmede gizliyor.
3. **Stratejinin pozitif beklentisi kanıtlanmadı.** 12 işlem, tek rejim,
   dokunulmamış holdout yok.
4. **Toplam gözlenen çalışma süresi dakikalarla ölçülüyor**, gereken 4-8 hafta.
   Taşıma ve dosya sistemi hata enjeksiyonu (T17/T18) yapılmadı; dry-run'da
   borsa tarafı uzlaştırma yapısal olarak test edilemiyor.
5. **Docker bu ortamda hiç ayağa kaldırılmadı** (daemon yok).

## Belgeler

| Dosya | İçerik |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | sorumluluk ayrımı, durum geçişleri |
| [docs/CAPABILITIES.md](docs/CAPABILITIES.md) | kaynaklı borsa/motor yetenek matrisi |
| [docs/RISK_POLICY.md](docs/RISK_POLICY.md) | formüller, limitler, rezervasyonlar |
| [docs/RESEARCH_PLAN.md](docs/RESEARCH_PLAN.md) | deney bütçesi ve kabul eşikleri |
| [reports/faz4/RESEARCH_REPORT.md](reports/faz4/RESEARCH_REPORT.md) | **dürüst sonuç raporu** |
| [docs/TEST_MATRIX.md](docs/TEST_MATRIX.md) | gereksinim ↔ test eşlemesi ve açık boşluklar |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | başlat/durdur, restart, kesinti, anahtar iptali |
| [docs/LIVE_READINESS.md](docs/LIVE_READINESS.md) | canlı engelleri |
| [docs/GO_LIVE_CHECKLIST.md](docs/GO_LIVE_CHECKLIST.md) | **elle uygulanacak canlıya geçiş kontrol listesi** |
| [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md) | son durum ve sıradaki adım |

## Kapsam dışı

Kaldıraç, vadeli işlem, short, martingale, grid, zarardaki pozisyona ekleme,
MEV/sandviç, üçüncü kişi hesapları, kâr paylaşımı, para çekme/transfer/
köprüleme/staking kodu, LLM'in doğrudan al-sat kararı vermesi ve sistemin
kendi kodunu güncellemesi.
