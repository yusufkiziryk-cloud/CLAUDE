> Kaynak: claude.ai projesi "657 ve AİLE HEKİMLİĞİ MAAŞ HESAPLAMA" — Project Knowledge dosyası `00_OKU_BENI.md` (birleşik dosya DOSYA 1/18, 04.09.2026). İçerik aynen korunmuştur; birleşik orijinal: `KAMU_MAAS_HYP_PROJECT_KNOWLEDGE_BIRLESIK.md`.

# KAMU MAAŞ VE BORDRO MOTORU — CLAUDE CODE CONTEXT PACK

**Sürüm:** 2026-08-27

Bu paket, Türkiye'de kamu görevlilerinin maaş ve bordro hesaplarının mevzuata dayalı, tarih-sürümlü, açıklanabilir ve test edilebilir biçimde hesaplanacağı bir yazılım projesini Claude Code ile geliştirmek için hazırlanmıştır.

## En önemli tasarım kararı

Bu proje tek formüllü bir “657 maaş hesaplayıcısı” değildir. Kamu personelinin mali hakları farklı personel kanunları, KHK'lar, sosyal güvenlik rejimleri, vergi kuralları, toplu sözleşmeler, hizmet kolu hükümleri, kurum/ünvan özel düzenlemeleri ve dönemsel katsayılarla belirlenir. Bu nedenle sistemin çekirdeği **tarih-sürümlü mevzuat/kural motoru** olacaktır.

## Paketin kullanım sırası

1. `01_CLAUDE_CODE_MASTER_PROMPT.md` dosyasını Claude Code'a ana görev olarak verin.
2. Bu klasördeki tüm diğer `.md` dosyalarını proje context/reference dokümanı olarak okutun.
3. Claude'dan önce `docs/MEVZUAT_ENVANTERI_GERCEK.md`, `docs/KURAL_CELISKI_RAPORU.md` ve `rules/` altındaki makine-okunur kural dosyalarını üretmesini isteyin.
4. Daha sonra hesap motoru, testler, veri içe aktarma ve arayüz geliştirilsin.
5. Üretim öncesinde kurumdan alınan anonimleştirilmiş KPHYS/e-Bordro bordrolarıyla regresyon testi yapılmadan “kesin bordro” modu açılmasın.

## Kapsam

Çekirdek hedef: memur ve diğer kamu görevlilerinin aylık/ücret, zam-tazminat, sosyal yardım, ek ödeme, vergi, SGK/emekli keseneği ve diğer bordro kalemlerini hesaplamak.

**İşçi statüsündeki 4/D personel varsayılan kapsam dışıdır.** İstenirse 4857 + toplu iş sözleşmeleri için ayrı `WORKER_4D` modülü eklenebilir. Memur/kamu görevlisi ile işçi bordrosunu tek formüle sıkıştırmayın.

## Hukuki güvenlik ilkesi

- Hiçbir “oran”, “katsayı”, “gösterge”, “tavan” veya “istisna” kod içine sihirli sayı olarak gömülmemelidir.
- Her kural `effective_from`, `effective_to`, `source`, `article`, `RG_date`, `RG_no` alanlarıyla saklanmalıdır.
- Kuralın resmi kaynağı doğrulanamıyorsa sistem hesap üretmek yerine **“MEVZUAT DOĞRULAMASI GEREKİYOR”** durumuna geçmelidir.
- Mevzuat değişikliği geçmiş dönem bordrolarını bozmamalıdır; tarihsel hesap yeniden üretilebilir olmalıdır.

## 2026 kontrol parametreleri — yalnızca regresyon başlangıç referansı

Bunları Claude resmi belgeyle tekrar doğrulamadan üretim kuralı kabul etmesin:

- 01.07.2026–31.12.2026 aylık katsayısı: `1.575512`
- taban aylık katsayısı: `25.794915`
- yan ödeme katsayısı: `0.499649`
- 2026 ücret gelir vergisi tarifesi: %15 / %20 / %27 / %35 / %40; ücretler için dönemsel eşikler ayrıca `05_VERGI_SGK_KESINTI_MOTORU.md` içindedir.

## Hedef çıktı

Sistem, kullanıcıya sadece “net maaş” göstermemeli; her sonuç için şu zinciri verebilmelidir:

`Girdi -> Personel rejimi -> Dönem -> Uygulanan mevzuat -> Hakediş kalemleri -> Matrahlar -> Kesintiler -> İstisnalar -> Net ödeme -> İşveren maliyeti -> Muhasebe/denetim izi`
