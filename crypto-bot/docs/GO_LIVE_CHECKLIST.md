# Canlıya geçiş kontrol listesi

**Bu belge bir onay değildir.** Kontrol listesidir ve tamamını *siz* elle
uygularsınız. Bot bu adımların hiçbirini kendi başına yapmaz, yapamaz.

Bu depo canlı işlem yapacak şekilde kurulmadı: `scripts/safe-run.py` etkin
yapılandırma anahtarsız bir dry-run değilse başlamayı reddeder ve canlıya
geçiren hiçbir komut, bayrak, zamanlayıcı veya düğme içermez.

Son durum: **2026-09-18** · sürüm `baseline-dryrun-v1`

---

## 0. Önce durun: şu an dördü açık

Aşağıdakilerden **herhangi biri** doğruyken devam etmeyin. Bugün dördü doğru.

| | Durum | Neden durdurucu |
|---|---|---|
| ❌ | Strateji **para kaybediyor** — profit factor 0,13, işlem başına -4,44 USDC | Canlıya almak, kaybetmek için ücret ödemektir |
| ❌ | **12 kapalı işlem** (alt sınır 50), tek rejim, dokunulmamış holdout yok | Kaybın şansa mı yoksa negatif beklentiye mi ait olduğu ayrılamıyor |
| ❌ | Gözlem süresinin **0 / 28 günü** tamamlandı | Operasyonel davranış hiç görülmedi |
| ❌ | Hyperliquid spot'ta **borsa tarafı stop yok** | Süreç ölürse pozisyon tamamen korumasız |

İlk üçü zamanla ve veriyle çözülebilir. Dördüncüsü çözülemez — ya yazılı
olarak kabul edersiniz (**F4**), ya native spot stop destekleyen bir borsaya
geçersiniz.

---

## Kapı A — Kanıt

Hepsi geçmeden diğer kapılara bakmanın anlamı yok.

- [ ] **A1.** Dokunulmamış bir dönemde **en az 50 kapalı işlem** birikti.
  *Nasıl doğrularsınız:* `scripts/weekly-report.py` çıktısında karar
  `INSUFFICIENT_EVIDENCE` olmaktan çıktı.
  *Neden:* 50 bir inceleme alt sınırıdır, bilimsel yeterlilik garantisi değil.

- [ ] **A2.** O dönem **en az bir yükseliş trendi** içeriyor.
  *Nasıl:* Dönem grafiğine bakın; sadece düşüş varsa trend takibi kendi var
  olma sebebi olan rejimde hiç gözlenmemiş demektir.

- [ ] **A3.** Beş eşiğin **beşi de** geçti: net getiri pozitif, profit factor
  ≥ 1,10, maks. düşüş ≤ %10, **2× maliyet senaryosunda da** pozitif, ≥ 50 işlem.
  *Neden:* `docs/RESEARCH_PLAN.md`'de sonuçlara bakılmadan sabitlendi.
  **Eşiği sonradan gevşetmek, eşiği kaldırmaktır.**

- [ ] **A4.** Sonucu **tek bir çift veya birkaç sıra dışı işlem taşımıyor**.
  *Nasıl:* Haftalık rapordaki çift bazında dağılıma bakın.

- [ ] **A5.** Kanıtı gördükten **sonra** stratejiyi değiştirmediniz.
  *Neden:* Değiştirdiyseniz o dönem artık geliştirme verisidir ve A1 sıfırlanır.

> **Not — bugünkü durum:** A1–A5'in hiçbiri geçmiş değil. Eldeki tek
> değerlendirme `INSUFFICIENT_EVIDENCE` ve beş eşiğin dördü başarısız.

---

## Kapı B — Borsa ve varlık

- [ ] **B1.** İşlem göreceğiniz varlığın **gerçekte ne olduğunu** biliyorsunuz.
  *Bilmeniz gereken:* `BTC/USDC` (market id `@142`) aslında **UBTC** —
  Unit köprüsü ihraçlı bir sarmalayıcı. ETH ve SOL de öyle, **üçü de aynı
  ihraççıdan**. ccxt bu farkı isimlendirmede gizliyor.
  *Sonuç:* Fiyat riskinin üstüne tek bir köprü karşı taraf riski biniyor ve
  üç varlık bunu paylaşıyor. Politika bu yüzden onları tek risk kümesi sayar.

- [ ] **B2.** Köprü ihraççısı hakkında **kendi araştırmanızı** yaptınız.
  *Neden:* Bu depo köprünün güvenli olduğuna dair hiçbir iddiada bulunmuyor.

- [ ] **B3.** Borsanın hizmet şartlarını ve coğrafi erişim kurallarını
  **resmî kaynaktan** okudunuz ve durumunuza uyduğunu teyit ettiniz.
  *Neden:* Erişim kısıtını aşma yöntemi bu belgede yok ve olmayacak.

- [ ] **B4.** Spot/perp karışıklığı yok: whitelist'te `BTC/USDC` var,
  `BTC/USDC:USDC` (perpetual) **yok**, `trading_mode` `spot`.

---

## Kapı C — Anahtar ve hesap

- [ ] **C1.** Hyperliquid'in kendi arayüzünden **ayrı bir API cüzdanı** (agent
  wallet) oluşturdunuz. Ana cüzdan özel anahtarını **kullanmadınız**.

- [ ] **C2.** Bu API cüzdanının **gerçekten çekim yapamadığını borsa tarafında**
  doğruladınız.
  *Neden:* Şu an bu `UNVERIFIED`. Freqtrade dokümanı "bu anahtar çekim yapamaz"
  diyor; yazılımdaki bir ayar, borsada uygulanmış bir yetki kısıtı değildir.
  *Ayrıca:* Çekim yapamamak, kötü işlemlerle zarar veremeyeceği anlamına gelmez.

- [ ] **C3.** `walletAddress` = **ana cüzdan adresi**, `privateKey` = **API
  cüzdanı** anahtarı. Ters yazarsanız bakiye boş görünür.
  *Uyarı:* Boş bakiyeyi asla "yeni hesap" diye yorumlamayın.

- [ ] **C4.** Bot için **ayrılmış bir hesap/alt hesap** kullanıyorsunuz ve bot
  çalışırken aynı hesapta **elle işlem yapmayacaksınız**.
  *Neden:* Bot hesabın tek sahibi olduğunu varsayar; tanımadığı bir pozisyon
  görürse girişleri durdurup sizi çağırır.

- [ ] **C5.** Anahtar **bu depoda değil**, sürüm kontrolünde değil, ve bu
  oturumun çalıştığı hiçbir ortam değişkeninde değil.
  *Nerede olmalı:* Yalnızca botu çalıştıran sürecin okuyabildiği, sizin
  yönettiğiniz bir sır deposunda.

- [ ] **C6.** Seed phrase'i hiçbir yere yazmadınız, kopyalamadınız,
  göndermediniz. Donanım cüzdanınızın mnemonic'ini kullanmadınız.

---

## Kapı D — Altyapı

> **Adım adım kurulum:** [`../deploy/README.md`](../deploy/README.md)
> — systemd birimleri, dead-man kurulumu ve her maddenin tatbikatı orada.

- [ ] **D1.** **Ayakta kalan** bir makine var — kapağı kapanan dizüstü değil.
  *Neden:* Borsa tarafı stop olmadığı için, süreç öldüğünde pozisyonun
  koruması da ölür.

- [ ] **D2.** Watchdog **ayrı bir süreç olarak** çalışıyor ve size gerçekten
  ulaşıyor.
  ```bash
  python scripts/watchdog.py --state user_data/live/risk_state.sqlite --interval 60
  ```
  *Nasıl doğrularsınız:* Botu kasten durdurun; watchdog `loop_heartbeat`
  kritik vermeli ve **haberiniz olmalı**.

- [ ] **D3.** **Makine dışına** heartbeat gönderen bir dead-man servisi var.
  *Neden:* Aynı makinedeki watchdog, makinenin öldüğünü haber veremez —
  onunla birlikte ölür. Bu depo böyle bir servis başlatmaz, satın almaz.
  *Kabul edilebilir alternatif:* Yok. Bu maddeyi atlarsanız, host çökmesi
  sessizdir ve korumasız pozisyon taşırsınız.

- [ ] **D4.** Saat senkronizasyonu çalışıyor (NTP).
  *Nasıl:* Watchdog'daki `clock_skew` yeşil.

- [ ] **D5.** Disk yeterli ve izleniyor.
  *Neden:* Kayıt güvenilir değilse yeni giriş alınmamalı; `storage` kontrolü
  bunu yapar ama diski sizin doldurmamanız gerekir.

- [ ] **D6.** **Yedek ve geri dönüş** denenmiş: trade veritabanı, risk durumu
  ve `policy.yaml` yedekleniyor; yedekten dönüşü **bir kez gerçekten yaptınız**.

- [ ] **D7.** **Anahtar iptal tatbikatı** yapıldı: API cüzdanını borsada iptal
  edip yenisini oluşturmayı, panik anında değil, sakinken bir kez denediniz.

- [ ] **D8.** Aynı hesaba **ikinci bir bot örneği** bağlanamayacağını biliyorsunuz
  — ve bunun sınırını da biliyorsunuz.
  *Sınır:* `acquire_writer_lock()` yalnızca **bu makinedeki** ikinci süreci
  engeller. Başka bir hosttan aynı hesaba bağlanmayı hiçbir şey engelleyemez.
  **V1 tek host ile sınırlıdır.**

---

## Kapı E — Mühendislik

- [ ] **E1.** `python -m pytest` tamamı geçiyor (bugün 301 + 4 ağ testi).

- [ ] **E2.** `docs/TEST_MATRIX.md`'de **PARTIAL kalan satırları okudunuz** ve
  her birinin ne demek olduğunu biliyorsunuz.
  *Bugün açık olanlar:* T17/T18 (taşıma ve dosya sistemi hata enjeksiyonu
  yapılmadı), T23 (otomatik uygunluk motoru yok), T26 (temiz oda betiği yok).

- [ ] **E3.** Docker yolunu **kendi makinenizde** bir kez ayağa kaldırdınız.
  *Neden:* Bu depoda `NOT_RUN` — geliştirme ortamında Docker daemon'u yoktu.

- [ ] **E4.** `config/policy.yaml` içindeki limitleri **satır satır okudunuz** ve
  her birinin sizin için doğru olduğuna karar verdiniz.
  *Uyarı:* Oradaki rakamlar dry-run başlangıç varsayımlarıdır. Kanıtlanmış
  optimum değildir ve size özel yatırım tavsiyesi değildir.

---

## Kapı F — Para ve kişisel karar

Bu kapıyı kimse sizin yerinize geçemez.

- [ ] **F1.** Riske atacağınız tutar, **tamamen kaybetmeyi göze alabileceğiniz**
  bir tutar.

- [ ] **F2.** Bu tutarı, bot için ayrılmış hesaba **kendi elinizle** taşıdınız.
  *Neden:* Bu depoda para hareketi yapan hiçbir kod yok ve olmayacak.

- [ ] **F3.** `policy.yaml` içindeki risk limitlerini **kendi kararınızla**
  onayladınız veya değiştirdiniz.

- [ ] **F4.** **Bot içi stop riskini yazılı olarak kabul ettiniz.**
  *Bu ne demek:* Hyperliquid spot'ta borsa tarafı stop olmadığı için, süreç
  veya makine öldüğünde açık pozisyonun hiçbir koruması kalmaz. Native stop
  da boşluklu fiyat hareketinde kaybı kesin sınırlamaz — ama "hiç yok"
  durumundan kesinlikle iyidir.
  *Nasıl:* Tarihli, açık bir not yazın: neyi kabul ettiğinizi, hangi tutarla,
  hangi tarihte. **Bu belge o istisnayı vermez.**

- [ ] **F5.** Vergi ve hukuki durumunuzu **kendi kaynaklarınızdan** araştırdınız.
  *Neden:* Bu depo ve bu belge vergi veya hukuk görüşü üretmez. Devir
  notundaki doğrulanmamış ifadeler kesin hüküm değildir.

---

## Kapı G — Mikro pilot (isteğe bağlı ama önerilir)

Dry-run gerçek emir davranışını kanıtlamaz. Dolum, kısmi dolum, iptal
doğrulaması ve ücret muhasebesi yalnızca gerçek emirle görülür.

- [ ] **G1.** Pilot boyutu **kaybı önemsiz** olacak kadar küçük, ve
  **sanal bakiyeden türetilmedi** — kendi kararınızla seçildi.

- [ ] **G2.** Pilotta doğrulayacağınız şeyler önceden yazıldı: emir kabulü,
  kısmi dolum, **doğrulanmış** iptal, ücretin hangi para biriminde alındığı,
  dust kalıp kalmadığı, `cloid` desteği.
  *Neden:* `cloid` desteği şu an `UNVERIFIED` ve kanıtlanamayan boşluk
  muhafazakâr tek-bekleyen-niyet modeli gerektirir.

- [ ] **G3.** Pilot sonuçlarını **önceden varsaymadınız**.

---

## Geçişin kendisi

Buraya kadarki her kutu işaretliyse, geçiş sizin bilinçli kararınızdır.

Bu depo o adımı **bilerek kolaylaştırmıyor**: `safe-run.py` canlıyı reddeder,
canlıya çeviren bir araç veya düğme yoktur ve eklenmemelidir. Yapılandırmanın
canlı hâli için freqtrade'in kendi dokümantasyonu esastır — bu belge onu
tekrarlamaz, çünkü buraya kadar gelebilen birinin zaten okumuş olması gerekir.

**Tek tavsiye:** ilk gün en küçük tutarla başlayın ve limitleri gevşetmeyin.

---

## İlk 48 saat — ne izlenir

| Ne | Nasıl | Beklenen |
|---|---|---|
| Bot durumu | log | `RECONCILING` → `READY`, takılı kalmamalı |
| Watchdog | `scripts/watchdog.py` | dokuz kontrol de yeşil, exit 0 |
| İlk emir | borsa arayüzü **ve** bot logu | ikisi aynı miktarı göstermeli |
| Ücret para birimi | borsa dolum kaydı | base mi quote mu — miktar hesabını etkiler |
| Stop metadata | `trade.get_custom_data` | her pozisyonun kayıtlı stopu olmalı |
| Uzlaştırma | log | her döngüde çalışmalı, `RECOVERY_REQUIRED` çıkmamalı |

---

## Durdurma koşulları

Aşağıdakilerden biri olursa **yeni giriş almayı durdurun** ve elle inceleyin:

- Bot tanımadığı bir pozisyon veya emir bildirdi
- `RECOVERY_REQUIRED` durumuna düştü
- Aynı niyet için iki emir göründü
- Gerçekleşen kayıp, modellenen riskin belirgin biçimde üstünde
- Watchdog kritik verdi ve nedeni anlaşılmadı
- Borsa bakiyesi ile bot kaydı uyuşmuyor

**Süreci kapatmak risk durdurmak değildir.** Açık pozisyon varken süreci
kapatırsanız bot içi stop da durur. Önce pozisyonu borsada elle kapatın,
ya da bu maruziyeti bilerek kabul edin.

---

## Bu belge ne değildir

- **Yatırım tavsiyesi değildir.** Buradaki hiçbir rakam size özel bir öneri değil.
- **Onay değildir.** Tüm kutular işaretlense bile bu belge "geç" demez.
- **Kâr sözü değildir.** Eldeki tek değerlendirme stratejinin para kaybettiğini
  söylüyor.
- **Vergi veya hukuk görüşü değildir.**
- **Tam bir liste olduğunun garantisi değildir.** Düşünemediğim bir şey
  olabilir; bu, düşünülmüş olanların listesidir.

İlgili belgeler: [`LIVE_READINESS.md`](LIVE_READINESS.md) (engellerin durumu) ·
[`RUNBOOK.md`](RUNBOOK.md) (operasyon) ·
[`RISK_POLICY.md`](RISK_POLICY.md) (limitler ve formül) ·
[`../reports/faz4/RESEARCH_REPORT.md`](../reports/faz4/RESEARCH_REPORT.md) (sonuç)
