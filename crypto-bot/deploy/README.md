# Kapı D — host, watchdog, dead-man, yedek

Bu dizin, botu kendi makinenizde **kalıcı olarak** çalıştırmak için gereken
systemd birimlerini ve kurulum adımlarını içerir.

**Bu kurulum canlı işlem açmaz.** `kripto-bot.service` botu `safe-run.py`
üzerinden dry-run olarak başlatır; canlı bir varyantı yoktur ve eklenmemelidir.
Zaten şu an ihtiyacınız olan şey de bu: 4–8 haftalık gözlem süresi.

Adımlar sırayla. Her adımın sonunda **nasıl doğrulayacağınız** yazıyor —
"kurdum" ile "çalıştığını gördüm" farklı şeyler.

---

## D1 · Host

Gerekli: **kapanmayan** bir Linux makinesi. Küçük bir VPS yeter (1 vCPU / 1 GB
bu iş için fazlasıyla).

Uygun **değil**:
- Kapağı kapanan / uyuyan dizüstü
- Uyku moduna geçen masaüstü
- Konteyner platformlarındaki geçici/ephemeral örnekler

*Neden bu kadar katı:* Hyperliquid spot'ta borsa tarafı stop yok. Süreç
ölürse pozisyonun koruması da ölür. Makinenin ayakta kalması, stratejinin bir
parçası.

```bash
# makinede, root olarak
sudo adduser --system --group --home /opt/kripto-bot kripto
sudo mkdir -p /opt/kripto-bot /etc/kripto
sudo chown kripto:kripto /opt/kripto-bot
```

> Bot **kendi kullanıcısıyla** çalışır, root ile değil. Sırlar ileride
> yalnızca o kullanıcının okuyabileceği yerde durur.

### Kurulum

```bash
sudo -u kripto -s
cd /opt/kripto-bot
git clone -b claude/new-session-uqw4yn \
    https://github.com/yusufkiziryk-cloud/CLAUDE .tmp
mv .tmp/crypto-bot/* .tmp/crypto-bot/.[!.]* . && rm -rf .tmp

python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m pytest -m "not network"      # 330 test geçmeli
.venv/bin/python scripts/collect-data.py          # ilk veri
exit
```

**Doğrulama:** testler geçti ve `reports/data_manifest.json` oluştu.

---

## D2 · Watchdog

```bash
sudo cp /opt/kripto-bot/deploy/*.service /opt/kripto-bot/deploy/*.timer \
        /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now kripto-bot.service
sudo systemctl enable --now kripto-watchdog.service
```

```bash
sudo systemctl status kripto-bot kripto-watchdog
sudo journalctl -u kripto-watchdog -f
```

Birkaç dakika içinde dokuz kontrolün de yeşile dönmesi gerekir. İlk döngüde
`ENTRY_PAUSED` görmek normaldir — henüz veri ve heartbeat yok; kendiliğinden
`READY`'ye geçer.

### ⚠ D2 tatbikatı — bu adımı atlamayın

Kurmak yetmez; **bozulduğunda haberiniz olduğunu** görmelisiniz.

```bash
sudo systemctl stop kripto-bot          # botu kasten öldür
sleep 360                                # ~6 dakika bekle
sudo journalctl -u kripto-watchdog -n 20
```

Görmeniz gereken: `loop_heartbeat` **CRITICAL**, öneri `OPERATOR_REQUIRED`.

```bash
sudo systemctl start kripto-bot          # geri aç
```

**Doğrulama:** Watchdog durmuş botu yakaladı. Yakalamadıysa devam etmeyin.

---

## D3 · Dead-man (makine dışı)

Aynı makinedeki watchdog, **makinenin kendisi öldüğünde haber veremez** —
onunla birlikte ölür. Bunun için makine dışında bir servis gerekir.

**Servisi siz seçersiniz.** Bu depo hiçbir servis başlatmaz, satın almaz,
önermez. Aradığınız şey şu tanıma uyan herhangi bir "heartbeat / dead-man
switch" servisi: ona düzenli ping atarsınız, **ping kesilince** sizi uyarır.
Ücretsiz seçenekleri var; kendi sunucunuzda da çalıştırabilirsiniz.

URL'yi aldıktan sonra — **depoya koymayın**:

```bash
sudo install -d -m 750 -o kripto -g kripto /etc/kripto
printf '%s' 'https://SERVISINIZ/ping/TOKEN' | sudo tee /etc/kripto/deadman.url >/dev/null
sudo chmod 600 /etc/kripto/deadman.url
sudo chown kripto:kripto /etc/kripto/deadman.url

sudo systemctl enable --now kripto-deadman.service
sudo journalctl -u kripto-deadman -f
```

### Buradaki tasarım kararı

Ping **sağlık durumuna bağlı** gönderilir:

| Durum | Ping | Sonuç |
|---|---|---|
| Tüm kontroller geçti | gider | servis sessiz kalır |
| Bir kontrol **CRITICAL** | **gitmez** | servis sizi uyarır |
| Makine öldü | gitmez | servis sizi uyarır |

Koşulsuz ping atan bir heartbeat, zamanlayıcıyı izler — botu değil. Döngü
donmuşken de "yaşıyorum" demeye devam eder. Burada **sessizlik** alarmdır.

### ⚠ D3 tatbikatı

```bash
sudo systemctl stop kripto-bot kripto-deadman
```

Seçtiğiniz servisin uyarı süresi kadar bekleyin. **Uyarı size gerçekten
ulaşmalı** — telefonunuza, e-postanıza, nereye ayarladıysanız.

```bash
sudo systemctl start kripto-bot kripto-deadman
```

**Doğrulama:** Uyarıyı aldınız. Almadıysanız bildirim ayarınız çalışmıyor
demektir; bu, kurulumun tamamının değerini sıfırlar.

---

## D4 · Saat

```bash
sudo timedatectl set-ntp true
timedatectl status          # "System clock synchronized: yes"
```

**Doğrulama:** Watchdog çıktısında `clock_skew` yeşil ve sapma birkaç saniyenin
altında.

*Neden önemli:* Saat kayarsa mum sınırları ve emir zaman damgaları güvenilmez
olur. Kontrol, sapmayı **örneğin alındığı andaki** yerel saatle karşılaştırır;
örneğin yaşıyla karıştırmaz.

---

## D5 · Disk

```bash
df -h /opt/kripto-bot
```

Birkaç GB yeter. Watchdog `storage` kontrolü eşiğin altına inince
**girişleri durdurur** — çünkü kayıt güvenilir değilse yeni risk alınmamalı.

Eşik `config/policy.yaml` → `operations.min_free_disk_mb` (varsayılan 200 MB).

---

## D6 · Yedek

Zamanlayıcıyı açın:

```bash
sudo systemctl enable --now kripto-backup.timer
sudo systemctl enable --now kripto-weekly-report.timer
systemctl list-timers 'kripto-*'
```

Her gece 03:30 UTC'de yedek alınır ve **geri yüklenerek doğrulanır**.

### ⚠ D6 tatbikatı — yedeği bir kez gerçekten geri yükleyin

```bash
sudo -u kripto /opt/kripto-bot/.venv/bin/python \
     /opt/kripto-bot/scripts/backup.py --verify
```

Beklenen çıktı, her veritabanı için `restored OK  integrity=ok` ve satır
sayılarının kaynakla aynı olması.

Geri yükleme betiği yedeği geçici bir dizine açar, `PRAGMA integrity_check`
çalıştırır, hash'i ve satır sayılarını kaynakla karşılaştırır. **Bozuk bir
yedeği tespit edebildiğini de test ediyoruz** — `tests/test_ops_deployment.py`
kasten bozulmuş bir yedeğin doğrulamadan geçemediğini gösteriyor.

Gerçek bir felaket tatbikatı yapmak isterseniz (önerilir):

```bash
sudo systemctl stop kripto-bot
sudo -u kripto cp -a /opt/kripto-bot/user_data/dryrun /tmp/dryrun.bak
sudo -u kripto cp /opt/kripto-bot/backups/<TARIH>/*.sqlite \
                  /opt/kripto-bot/user_data/dryrun/
sudo systemctl start kripto-bot
sudo journalctl -u kripto-bot -n 30    # RECONCILING -> READY görmelisiniz
```

**Doğrulama:** Bot yedekten dönen durumla normal başladı.

---

## D7 · Anahtar iptal tatbikatı

Bu adım **şimdi** gerekmez — dry-run'da anahtar yok. Ama canlıyı düşünüyorsanız
tatbikatı panik anında değil, sakinken yapın:

1. Hyperliquid arayüzünden bir API cüzdanı oluşturun
2. Hemen iptal edin
3. Yenisini oluşturun
4. Ne kadar sürdüğünü ve nereye tıkladığınızı not edin

*Neden:* Bu depoda anahtar oluşturan, döndüren veya iptal eden hiçbir kod yok
ve olmayacak. İptal borsada olur, burada değil.

---

## D8 · Tek yazar

Kilit otomatik çalışır; bilmeniz gereken **sınırı**:

`store.acquire_writer_lock()` yalnızca **bu makinedeki** ikinci süreci
engeller. Başka bir hosttan aynı hesaba bağlanmayı hiçbir şey engelleyemez —
ne bu kod, ne başka bir kod.

**Sonuç: V1 tek host ile sınırlıdır.** İkinci bir makinede "yedek olsun diye"
aynı hesapla çalıştırmayın.

Test edin:

```bash
sudo -u kripto /opt/kripto-bot/.venv/bin/python \
     /opt/kripto-bot/scripts/safe-run.py trade --config config/config.dry.json
```

Bot zaten çalışırken bu ikinci örnek **reddedilmeli**.

---

## Günlük kullanım

```bash
sudo systemctl status kripto-bot kripto-watchdog kripto-deadman
sudo journalctl -u kripto-bot -f

sudo -u kripto /opt/kripto-bot/.venv/bin/python \
     /opt/kripto-bot/scripts/watchdog.py \
     --state /opt/kripto-bot/user_data/dryrun/risk_state.sqlite

sudo -u kripto /opt/kripto-bot/.venv/bin/python \
     /opt/kripto-bot/scripts/weekly-report.py --weeks 1

sudo -u kripto /opt/kripto-bot/.venv/bin/python \
     /opt/kripto-bot/scripts/dashboard.py        # reports/dashboard.html
```

Veri toplama için haftada bir (5m verisi ileriye doğru birikir — şu an sadece
17 gün):

```bash
sudo -u kripto /opt/kripto-bot/.venv/bin/python \
     /opt/kripto-bot/scripts/collect-data.py
```

---

## Durdurma — üç ayrı şey, karıştırmayın

| Amaç | Komut | Açık pozisyona etkisi |
|---|---|---|
| Yeni risk alma | risk durumunu `ENTRY_PAUSED` yap | stop/çıkış **çalışmaya devam eder** |
| Pozisyonları kapat | borsada elle | pozisyon kapanır |
| Süreci kapat | `systemctl stop kripto-bot` | **bot içi stop da durur** |

Dry-run'da bu fark zararsız. Canlıda, açık pozisyon varken süreci kapatmak
pozisyonu korumasız bırakır.

---

## Kurulum kontrol listesi

- [ ] D1 · Kapanmayan makine, `kripto` kullanıcısı, testler geçiyor
- [ ] D2 · Watchdog çalışıyor **ve** botu kasten durdurup yakaladığını gördüm
- [ ] D3 · Dead-man kurulu **ve** uyarı gerçekten bana ulaştı
- [ ] D4 · NTP açık, `clock_skew` yeşil
- [ ] D5 · Disk yeterli
- [ ] D6 · Yedek zamanlayıcısı açık **ve** bir kez gerçekten geri yükledim
- [ ] D7 · (canlı için) anahtar iptal tatbikatı yapıldı
- [ ] D8 · Tek yazar sınırını biliyorum, ikinci host kullanmayacağım

Hepsi işaretliyse Kapı D geçildi. Sırada **A kapısı** var: 4–8 hafta çalıştırın,
haftalık raporu okuyun, ≥50 kapalı işlem birikmesini bekleyin.

Bu süre boyunca bot para kazanmayacak — dry-run. Kazandığı şey **kanıt**.
