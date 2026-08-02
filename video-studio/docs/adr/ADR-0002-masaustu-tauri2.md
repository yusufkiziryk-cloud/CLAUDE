# ADR-0002: Masaüstü — Tauri 2 (Electron değil)

- Durum: Kabul edildi (Faz 1)
- Tarih: 2026-08-02

## Bağlam

Windows 10/11 masaüstü hedefi; yerel FFmpeg, dosya sistemi erişimi, güvenli anahtar
kasası ve küçük dağıtım paketi gereksinimi var.

## Karar

Tauri 2. Gerekçeler: ~10-20x küçük paket boyutu, Rust tarafında güvenli komut yüzeyi
(FFmpeg'i arg-array ile çağırma), Windows Credential Manager erişimi için olgun
keyring ekosistemi, WebView2 ile aynı React arayüzünün yeniden kullanımı.

Electron ancak Tauri'de aşılamayan somut bir engel ölçülür ve belgelenirse gündeme gelir.

## Sonuçlar

- Artı: Web ile %100 UI paylaşımı (kabuk yalnızca pencere + yerel komutlar)
- Eksi: Rust toolchain gereksinimi; bulut konteynerinde webkit2gtk olmadığından CI'da
  yalnızca Windows/yerel makinede derlenir (Faz 1'de kabuk iskelet olarak doğrulandı)
- Faz 4'te FFmpeg render, sonrasında anahtar kasası Tauri komutları olarak eklenecek
