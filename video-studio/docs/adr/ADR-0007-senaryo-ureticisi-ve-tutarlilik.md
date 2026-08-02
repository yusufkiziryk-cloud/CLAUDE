# ADR-0007: Senaryo üretici stratejisi ve deterministik tutarlılık denetimi

- Durum: Kabul edildi (Faz 3)
- Tarih: 2026-08-02

## Bağlam

Faz 3 brief → senaryo → sahne → storyboard zinciri gerektirir. Kullanıcının LLM
anahtarı olmayabilir; anahtar yokken "AI üretiyormuş gibi" davranmak yasaktır.

## Kararlar

1. **İki senaryo üreticisi, tek arayüz** (`ScriptGenerator`):
   - `OpenAIScriptGenerator` (OPENAI_API_KEY varsa): `POST /v1/chat/completions`,
     `response_format: json_object` (resmî OpenAPI spec'ten doğrulandı); yanıt Zod ile
     doğrulanır, bozuk yanıt açık hata üretir.
   - `TemplateScriptGenerator` (anahtar yoksa): kural tabanlı, brief alanlarını taslağa
     yerleştirir. `generator="template"` olarak kaydedilir ve arayüzde
     **"Şablon taslağı — LLM değil"** rozetiyle gösterilmek zorundadır.
2. **Sahne planlama deterministiktir**: süre tahsisi anlatım kelime sayısıyla orantılı
   (TR ~2,3 kelime/sn), min 3 sn/sahne; her sahneye storyboard prompt taslağı yazılır.
3. **Tutarlılık denetçisi LLM'siz çalışır**: toplam süre sapması, tanımsız karakter,
   kilitli prompt parçası eksikliği, aynı mekânda saat sıçraması, anlatım hızı ve
   **rızasız gerçek kişi** kontrolleri.
4. **Rıza politikası koddadır**: `isRealPerson=true` + `consentConfirmed=false` kartın
   geçtiği sahne için storyboard üretimi API katmanında 403 ile ENGELLENİR; arayüz
   düğmeyi gizlemekle yetinmez.
5. **Kilitli parça enjeksiyonu**: storyboard isteğinde, sahnede geçen karakterlerin
   kilitli prompt parçaları prompta otomatik eklenir (görsel tutarlılık).
6. Sahne ↔ üretim bağlantısı Faz 3'te istemci güdümlüdür (iş bitince UI
   `storyboardAssetId`'yi PATCH'ler); sunucu tarafı bağlama Faz 5'te webhook/worker
   kancasıyla yapılacak (bilinen borç).

## Sonuçlar

- Artı: Anahtarsız kurulumda bile akışın tamamı dürüst etiketlerle çalışır ve test edilir
- Artı: Rıza/deepfake politikası bypass edilemez (sunucu tarafı kontrol + testli)
- Eksi: Şablon taslağı yaratıcı değildir; bu bilinçli bir "honest fallback"tır
- Eksi: Animatic (storyboard + geçici ses + zamanlama) Faz 3'te başlangıç düzeyinde
  değil; Faz 6 ses altyapısıyla birlikte ele alınacak
