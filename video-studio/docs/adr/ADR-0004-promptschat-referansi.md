# ADR-0004: prompts.chat mimari referansı ve attribution

- Durum: Kabul edildi (Faz 1)
- Tarih: 2026-08-02

## Bağlam

`https://github.com/f/prompts.chat` (kod: MIT; prompt içerikleri: CC0) mimari referans
olarak incelendi. Kod kopyalanmadı; yalnızca yaklaşımlar uyarlandı.

## Alınan fikirler → bizdeki karşılığı

| prompts.chat                          | video-studio                                                    |
| ------------------------------------- | --------------------------------------------------------------- |
| Modalite başına type-safe builder     | `@studio/prompt-engine` `createVideoPrompt` + Zod domain modeli |
| Özne/ortam/kamera/ışık alan ayrımı    | `VideoPromptSchema` (subject/scene/camera/lighting/style)       |
| Çoklu değişken formatı normalizasyonu | `variables.ts` (`${}`, `{{}}`, `[[]]`)                          |
| Yerel (API'siz) kalite denetimi       | `quality.ts` (çelişki, uzunluk, temporal taşma)                 |

## Bilinçli genişletmeler (prompts.chat'te yok)

Saniye bazlı temporal plan, referans girdiler/maskeler, çıktı ayarları (seed/fps/oran),
sağlayıcı capability'sine göre doğrulama ve derleme, prompt sürümleme, maliyet ve
güvenlik metadata'sı.

## Attribution

Bu belge attribution kaydıdır. Kaynak kod kopyalanmadığı için MIT bildirimi taşıma
zorunluluğu doğmamıştır; fikri esin kaynağı burada belgelenmiştir.
