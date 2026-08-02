# Masaüstü Kabuğu (Tauri 2) — Faz 1

Bu paket, web arayüzünü (apps/web) yerel bir pencerede açan Windows masaüstü kabuğudur.
Faz 1'de kabuk minimaldir; yerel FFmpeg render (Faz 4) ve güvenli anahtar kasası
(Windows Credential Manager) sonraki fazlarda Tauri komutları olarak eklenecektir.

## Gereksinimler

- Rust (stable) — https://rustup.rs
- Windows: WebView2 Runtime (Windows 11'de hazır gelir)
- Linux'ta geliştirme için: `webkit2gtk-4.1`, `gtk3`, `libayatana-appindicator` sistem paketleri

> Not: Bu kabuk, bulut geliştirme konteynerinde webkit2gtk/gtk sistem paketleri
> bulunmadığı için orada derlenememiştir; yerel makinede derlenmesi beklenir.

## Geliştirme

```bash
# 1) API'yi başlatın (kök dizinden)
pnpm --filter @studio/api dev

# 2) Masaüstü kabuğunu başlatın (web dev sunucusunu kendisi açar)
pnpm --filter @studio/desktop dev
```

## Paketleme (imzasız geliştirme paketi)

```bash
# İkonları bir kez üretin (kaynak: 1024x1024 PNG/SVG)
pnpm --filter @studio/desktop exec tauri icon <ikon-dosyası>

# tauri.conf.json'da "bundle.active": true yapın, sonra:
pnpm --filter @studio/desktop tauri:build
```

Kod imzalama ve otomatik güncelleme Faz 8 kapsamındadır.
