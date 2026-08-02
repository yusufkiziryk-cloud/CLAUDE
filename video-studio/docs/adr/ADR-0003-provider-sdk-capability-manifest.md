# ADR-0003: Provider SDK — capability manifest + adaptör sözleşmesi

- Durum: Kabul edildi (Faz 1)
- Tarih: 2026-08-02

## Bağlam

"Mümkün olan tüm sağlayıcılar" hedefi, sağlayıcıya özel davranışın çekirdeğe
sızmasıyla sürdürülemez hale gelir. Çekirdek sistem sağlayıcı adı bilmemelidir.

## Karar

1. Her adaptör `MediaProviderAdapter` sözleşmesini uygular:
   `manifest / validate / estimate / compile / submit / getStatus / cancel? /
normalizeResult / verifyWebhook?`.
2. Yetenekler (`textToVideo`, `lipSync`, ...) ve model seçenekleri (süre, çözünürlük,
   fiyat, limit) **manifest verisi** olarak beyan edilir; UI formları manifestten türetilir.
3. Desteklenmeyen parametre sessizce yutulmaz: `validate` sonucu `unsupported` türünde
   issue döndürmek zorundadır (contract test ile zorlanır).
4. Her adaptör `@studio/test-utils` içindeki ortak contract suite'ten geçmek zorundadır
   (determinizm, idempotent submit, gizli anahtar sızmaması, mock bayrağı tutarlılığı).
5. Mock sağlayıcı birinci sınıf vatandaştır: `manifest.mock=true` ve tüm çıktılarında
   `provenance.mock=true`; arayüzde MOCK/DEMO etiketi zorunludur.

## Sonuçlar

- Artı: Yeni sağlayıcı eklemek = adaptör + contract testi; çekirdek değişmez
- Artı: Fiyat/limit verisi `asOf` + `source` ile damgalanır, tahmin kesinmiş gibi gösterilmez
- Eksi: Manifest şeması geniş; gerçek sağlayıcı çeşitliliğinde (Faz 2+) revizyon beklenir
