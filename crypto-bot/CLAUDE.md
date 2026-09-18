# CLAUDE.md - kripto bot

Kısa kurallar. Ayrıntı `docs/` altındadır; ilgili göreve başlamadan o belgeyi
oku. Bu dosyayı büyütme.

## Değişmez sınırlar

- **Canlı işlem açma.** `dry_run: false` içeren etkin yapılandırma, canlı
  emir veya "küçük deneme işlemi" üretme/çalıştırma. Canlıya geçiren araç,
  zamanlayıcı, Telegram komutu veya düğme yazma.
- **Gerçek sır isteme, okuma, kopyalama veya loglama.** Ana cüzdan özel
  anahtarı ve kurtarma kelimeleri kesinlikle yasak. `.env.example` boş kalır.
- **Para hareketi kodu yazma:** çekim, transfer, yatırma, köprü, swap router
  onayı, staking, borçlanma, vault yönetimi, yeni API yetkisi tanımlama.
- Yalnızca spot, long-only, kaldıraçsız, tek borsa, tek hesap, tek yazar.
- Kaldıraç, vadeli, short, martingale, grid, zarardaki pozisyona ekleme,
  MEV/sandviç, üçüncü kişi hesapları kapsam dışı.
- Mevcut dosyaları silme, git geçmişini yeniden yazma, sunucu satın alma,
  ücretli hizmet açma.
- LLM doğrudan al/sat, pozisyon büyüklüğü veya risk artırımı kararı vermez.

## Dürüstlük kuralları

- Her çıktıyı `IMPLEMENTED` / `VERIFIED` / `FAILED` / `BLOCKED` / `NOT_RUN`
  durumuyla ve kanıtıyla raporla.
- Kanıt yoksa `INSUFFICIENT_EVIDENCE`, strateji başarısızsa `REJECTED` yaz.
  Başarısızlığı gizleme, eşiği sonradan gevşetme.
- Çalıştırılmamış testi "geçti" sayma. İşlem üretmeyen analiz geçmiş değildir.
- Haftalar süren gözlemi bir oturumda bitmiş gibi gösterme.
- Uydurma API, CLI bayrağı, config alanı veya Docker etiketi kullanma.
  Doğrulayamıyorsan `UNVERIFIED` yaz.

## Komutlar

```bash
.venv/bin/python -m pytest -m "not network"        # hızlı test (301)
.venv/bin/python -m pytest                         # + kamu uç testleri
.venv/bin/python scripts/collect-data.py           # veri topla (artımlı)
.venv/bin/python scripts/watchdog.py --state user_data/dryrun/risk_state.sqlite
.venv/bin/python scripts/weekly-report.py --weeks 1
.venv/bin/python scripts/dashboard.py              # reports/dashboard.html
.venv/bin/python scripts/safe-run.py trade   --config config/config.dry.json
.venv/bin/python scripts/safe-run.py backtesting --config config/config.dry.json \
    --strategy BaselineTrend4h --timerange 20250901-20260901 --enable-protections
```

TLS sonlandıran vekil arkasında: sona `--config config/proxy-overlay.json`.
`scripts/safe-run.py` tek giriş noktasıdır ve canlıyı reddeder.

## Mimari özeti

Sinyal (`user_data/strategies/`) → Risk (`src/kripto/risk/`) → Yürütme
(freqtrade). Risk katmanı sinyali **veto edebilir**; sinyal katmanı risk
limitlerini **değiştiremez**.

Freqtrade trade/fill/PnL sahibidir. Risk deposu yalnızca dönem tabanları,
kilitler, stop sayacı ve bekleyen giriş rezervasyonlarını tutar — ikinci bir
pozisyon defteri değildir.

Durumlar: `READY`, `ENTRY_PAUSED`, `RECONCILING`, `RECOVERY_REQUIRED`,
`STOPPED`. **Yalnızca `STOPPED` çıkış yönetimini durdurur.** Giriş kilidi
stop yönetimini asla kapatmaz.

Emir durumları (`src/kripto/orders/lifecycle.py`): gönderim, kabul, dolum ve
iptal **dört ayrı gözlemdir**. Timeout bir başarısızlık değil `UNKNOWN`'dır
ve sorgu ile çözülene kadar yeniden göndermeyi engeller. İptal *isteği* hiçbir
şeyi serbest bırakmaz; yalnızca **doğrulanmış** iptal bırakır.

Watchdog (`src/kripto/ops/`): **süreç canlılığına bakmaz.** Botun geride
bıraktığı kanıtın yaşına bakar. Gözlemci state dosyasını `mode=ro` ile açar,
yani yazması **yapısal olarak** imkânsızdır; anahtar taşımaz, emir göndermez.
Hiçbir kontrol çıkış yönetimini durduramaz — en güçlü öneri girişleri
durdurmak veya operatör çağırmaktır.

Tamamlanmış bir 4h mumu meşru olarak **4-8 saat yaşındadır**; mum tazeliği düz
yaş eşiğiyle değil, beklenen son **kapanmış** mumla karşılaştırılır. Order book
bayatlığı **ayrı bir saattir**. İkisine tek eşik vermek ya sürekli yanlış
alarm ya da kör nokta üretir.

Saat sapması, örneğin **alındığı andaki** yerel saatle karşılaştırılır. Şimdiki
zamanla karşılaştırmak sapmayı değil örneğin yaşını ölçer (0.1s sapma 93s
görünmüştü).

Tek yazar: `store.acquire_writer_lock()`. Bu kilit yalnızca **bu makinedeki**
ikinci süreci engeller; başka bir hosttan aynı hesaba bağlanmayı engelleyemez.
V1 bu yüzden tek host ile sınırlıdır.

## Dikkat edilecek doğrulanmış davranışlar

- Hyperliquid **spot**'ta `stoploss_on_exchange` **yok** (futures'ta var).
  Stop bot içindedir → `LIVE_BLOCKER`.
- `BTC/USDC` (`@142`) aslında **UBTC** — köprü ihraçlı. ETH/SOL de öyle,
  aynı ihraççıdan. Tek risk kümesi.
- `custom_stake_amount` istisnada `proposed_stake`'e düşer (fail-open).
  Bu callback'ten **asla istisna kaçmamalı**; her hata yolu `0` döndürür.
- `validate_stake_amount` miktarı minimuma ulaşmak için **%30'a kadar
  büyütebilir** → `confirm_trade_entry` nihai fiyat × miktarı yeniden
  doğrular.
- `confirm_trade_exit` çıkışı **asla veto etmez** (stop çıkışını engelleyebilir).
- custom stop `self.stoploss`'tan geniş olamaz; `-0.15` sert tavandır.
- `freqtrade download-data` bu borsada çalışmaz → `scripts/collect-data.py`.
- `lookahead-analysis` `dry_run_wallet`'ı 1e9 yapar → gerçek risk politikasını
  test etmez. Durumlu stratejide yanlış pozitif verir.
- **Freqtrade backtest sonuçlarını bir gün boyunca ÖNBELLEKLER** ve strateji
  dosyası değişmediyse sessizce yeniden kullanır — tam sonuç tablosunu basar,
  hiçbir uyarı vermez. Cache anahtarı strateji dosyasının DIŞINDAKİ
  değişiklikleri (risk katmanı, politika, veri) görmez. `safe-run.py` bu
  yüzden `backtesting`/`lookahead-analysis`/`recursive-analysis` için
  varsayılan olarak `--cache none` geçer. Kanıt üreten hiçbir çalıştırmada
  cache'e güvenme.

## Belgeler

`docs/ARCHITECTURE.md` · `docs/CAPABILITIES.md` · `docs/RISK_POLICY.md` ·
`docs/RESEARCH_PLAN.md` · `docs/TEST_MATRIX.md` · `docs/RUNBOOK.md` ·
`docs/LIVE_READINESS.md` · `docs/GO_LIVE_CHECKLIST.md` · `docs/PROJECT_STATE.md` ·
`reports/faz4/RESEARCH_REPORT.md`

Bir faz bitince `docs/PROJECT_STATE.md` dosyasını güncelle: son doğrulanmış
durum, test sonuçları, değişen varsayımlar, açık riskler, kesin sıradaki adım.
