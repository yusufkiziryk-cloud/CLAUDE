# ADR-0001: Monorepo — pnpm workspaces + Turborepo

- Durum: Kabul edildi (Faz 1)
- Tarih: 2026-08-02

## Bağlam

Web, masaüstü, API ve worker aynı domain modelini, prompt motorunu ve provider SDK'sını
paylaşmak zorunda. Aynı özelliğin iki ayrı iş mantığı yazılması yasaklanmıştır.

## Karar

Tek monorepo: `pnpm` workspaces + Turborepo görev orkestrasyonu. Tüm iş mantığı
`packages/*` altında platform-bağımsız TypeScript (strict, NodeNext ESM) paketlerinde;
`apps/*` yalnızca ince kabuklar ve platform adaptörleri içerir.

## Sonuçlar

- Artı: Tek `pnpm install`, önbellekli `turbo run build/test/lint/typecheck`
- Artı: Paketler arası tip güvenliği workspace protokolüyle garanti
- Eksi: ESM + NodeNext, göreli importlarda `.js` uzantısı disiplinini gerektirir
- Mevcut LifeTrack projesi kökte kalır; video stüdyosu `video-studio/` altında tamamen izoledir
