# Bilgi Tabanı

Bu klasör, claude.ai'daki **"HASTALIK YÖNETİM PLATFORMU"** projesinin bilgi
tabanının (27 dosya + özel talimatlar) Claude Code tarafındaki karşılığıdır.
Claude Code oturumları claude.ai proje bilgisine doğrudan erişemez; kalıcı
bilgi **bu depoda** yaşar. Buraya eklenen her dosya, bu depoyla açılan her
Claude Code oturumunda otomatik olarak kullanılabilir olur.

## Şu an burada olanlar

| Dosya | İçerik | Kaynak |
|---|---|---|
| `kriter-tablolari-resmi.md` | **Resmî kriter tabloları + Yönerge kuralları (motorun sözleşmesi)** | Kılavuz 14.04.2026 Bölüm 1; Yönerge (`kaynak/`) |
| `sina-okuma-mekanizmasi.md` | SİNA Pozitif Performans ekranının nasıl okunduğu | "HYP & SINA Asistanı" eklenti analizi |
| `katsayi-hesabi-asc.md` | ASÇ bilgilendirme belgesi özeti (devir örnekleri; eşikler güncellendi) | `kaynak/asc-hyp-katsayi-hesabi-01.06.2025.pdf` |
| `kaynak/` | Yönerge PDF'i ve ASÇ belgesi (birincil kaynaklar) | Kullanıcı yüklemesi (04.09.2026) |
| `kaynak-belgeler.md` | Google Drive'daki HYP kaynak belge envanteri | Drive taraması (30.08.2026) |
| `../config/planlar.json` | Ürün plan/paket tanımları | Drive: `planlar.json` (27.08.2026) |

## claude.ai projesindeki 27 dosya nasıl aktarılır?

claude.ai proje bilgisi dışarıdan okunamadığı için aktarım tek seferlik ve
elle yapılır — üç yoldan biri yeterli:

1. **Sohbete yapıştır:** Bu depoyla açılmış bir Claude Code oturumunda dosya
   içeriklerini mesaj olarak gönderin; "bilgi tabanına ekle" demeniz yeterli.
   Dosyalar `NN-konu-adi.md` düzeniyle buraya kaydedilir.
2. **Drive'a koy:** Dosyaları Drive'da tek bir klasöre yükleyin (ör.
   `HYP/PROJE-BILGISI`), Claude Code'a klasörü söyleyin; kalanı o çeker.
3. **Doğrudan commit:** Dosyaları bilgisayardan bu klasöre kopyalayıp
   `git add && git commit && git push` ile gönderin.

Aynı şekilde claude.ai projesindeki **özel talimatların** ("# PROJE KİMLİĞİ"
ile başlayan metin) tam hâli `../CLAUDE.md` içindeki işaretli bölüme
yapıştırılmalıdır; iki taraf böylece aynı kimlikle çalışır.

## Adlandırma düzeni

- `NN-konu-adi.md` — sıra numarası + kısa konu (ör. `01-proje-kimligi.md`,
  `05-hekim-katsayi-kriterleri.md`)
- Kaynağı belli olsun: her dosyanın başına `> Kaynak: ...` satırı.
- PDF/PPTX gibi ikili kaynaklar buraya **damıtılmış Markdown** olarak girer;
  orijinaller Drive'da kalır (bkz. `kaynak-belgeler.md`).
