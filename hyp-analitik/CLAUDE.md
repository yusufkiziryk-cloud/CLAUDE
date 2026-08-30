# CLAUDE.md — HYP Analitik

> Bu dosya, claude.ai'daki "HASTALIK YÖNETİM PLATFORMU" projesinin özel
> talimatlarının Claude Code karşılığıdır. HYP Analitik üzerinde çalışan her
> oturum önce bunu, sonra `bilgi-tabani/` klasörünü okur.

## PROJE KİMLİĞİ

**HYP Analitik**, Türkiye'deki aile hekimliği birimlerinin Sağlık Bakanlığı
**Hastalık Yönetim Platformu (HYP)** performansını izleyen bir analiz ve karar
destek çalışmasıdır. Çekirdek işlev: aylık tarama/takip verilerinden
**tarama ve takip katsayısını** (maaşı doğrudan etkileyen çarpan) doğru
hesaplamak, devir zincirini işletmek ve dönemsel performansı görünür kılmak.

- **Kullanıcı kitlesi:** aile sağlığı çalışanları (ASÇ) ve aile hekimleri.
- **Alan dili Türkçedir** — arayüz, belgeler, commit dışı her çıktı Türkçe.
- **Mevzuat hassasiyeti:** hesap kuralları 01.06.2025 tarihli Tarama ve Takip
  Katsayısı Yönergesi'ne dayanır. Kural değişikliği = önce
  `bilgi-tabani/katsayi-hesabi-asc.md`, sonra motor, sonra testler.
- **İlgili sistemler:** SİNA (hedeflerin kaynağı), hyphesaplama.com.tr
  (yaşayan referans sistem), `config/planlar.json` (ürünleşme plan kurgusu).

> ⚠️ claude.ai projesindeki özel talimatların tam metni ("# PROJE KİMLİĞİ …")
> buraya henüz yapıştırılmadı; eklendiğinde bu bölümle birleştirilir ve
> çelişkide claude.ai metni esas alınır. 27 bilgi dosyasının aktarımı için:
> `bilgi-tabani/README.md`.

## Depo düzeni

```
hyp-analitik/
├── CLAUDE.md              # bu dosya — proje kimliği
├── README.md              # hızlı başlangıç
├── hyp-analitik.html      # tek dosyalık uygulama (çevrimdışı çalışır)
├── src/hyp-katsayi.js     # saf hesap motoru (ES module, bağımlılıksız)
├── test/                  # node --test (motorun yönerge örnekleriyle kanıtı)
├── config/planlar.json    # plan/paket tanımları (public config)
└── bilgi-tabani/          # alan bilgisi (claude.ai proje bilgisinin aynası)
```

## Çalışma kuralları

1. **Motor tek gerçek kaynak.** Katsayı matematiği yalnızca
   `src/hyp-katsayi.js`'te yaşar; `hyp-analitik.html` içindeki kopya bloğu
   (`<!-- MOTOR:hyp-katsayi.js -->` işaretli) onunla eşitlenir. Motoru
   değiştiren her iş HTML'deki kopyayı da günceller.
2. **Test yeşil kalır.** `node --test test/hyp-katsayi.test.js` — yönergedeki
   örnek değerler (1,07 / 0,9021 / 1,198 / 4 aylık devir örneği) sabittir;
   bunları değiştiren bir "düzeltme" büyük olasılıkla hatadır.
3. **Doğrulanmamış kural kodlanmaz.** Hekim tarafı kriter bantları, entegre
   birim üst sınırı gibi belgesi elimizde olmayan kurallar tahminle yazılmaz;
   `bilgi-tabani/`ye kaynak eklenmeden motor genişletilmez.
4. **Kesin dil yok:** çıktılar bilgilendirme amaçlıdır; "maaşınız X olacak"
   değil "yönergeye göre hesaplanan çarpan" dili kullanılır ve her çıktıda
   "resmî hesap değildir, Yönerge esastır" notu korunur.
5. **Kişisel veri girmez.** Uygulama hasta/kişi verisi tutmaz; yalnızca
   sayısal hedef/yapılan toplamları işlenir. Bu sınır korunur.
6. **Bağımlılık eklenmez.** Tek dosyalık, çevrimdışı çalışan yapı ürün
   kararıdır (`planlar.json`daki offline_indirme özelliğinin temeli).
