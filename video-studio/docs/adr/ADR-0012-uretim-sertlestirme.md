# ADR-0012: Üretim sertleştirmesi — limitler, bütçe, veri saklama, erişilebilirlik

- Durum: Kabul edildi (Faz 8)
- Tarih: 2026-08-02

## Kararlar

1. **İstek sınırı süreç içi sabit penceredir**: @fastify/rate-limit yerine
   ~20 satırlık kendi onRequest kancamızı kullanıyoruz, çünkü eklenti yalnızca
   kendisinden SONRA kaydedilen rotaları sınırlar ve buildServer'daki eşzamanlı
   rota kaydı bu sıralamayı kırılgan yapar. Kanca deterministiktir, hata zarfı
   döner ve testlerde `rateLimitPerMin: false` ile kapatılır. Yatay ölçeklemede
   paylaşımlı sayaç (Redis) gerektiği docs/SECURITY.md'de kayıtlıdır.
2. **CORS tek origin'e daraltıldı**: `WEB_ORIGIN` env'i buildServer'a inen
   `corsOrigin` oldu; verilmezse (test/dev) eski serbest davranış korunur.
   `/files/*` medyası farklı origin'den yüklendiğinden helmet'in
   `cross-origin-resource-policy` başlığı bilinçli olarak `cross-origin`dir.
3. **HTTP hataları 500'e düşürülmez**: Fastify'nin statusCode taşıyan 4xx
   hataları (413 gövde sınırı gibi) hata zarfına çevrilerek aynı kodla döner;
   yalnızca gerçekten beklenmeyenler 500 olur.
4. **Bütçe kapısı API katmanındadır**: `Project.budgetUsd` (migration 0006)
   doluysa, POST /generations gerçekleşen harcama (actualCostUsd) + aktif
   işlerin tahmini + yeni isteğin tahminini toplar; bütçe aşılıyorsa iş HİÇ
   kuyruğa alınmadan 402 BUDGET_EXCEEDED döner. Tahminler isExact=false
   olabildiğinden bu bir "kesin muhasebe" değil koruma bariyeridir.
5. **Veri saklama bilinçli olarak opt-in**: `DATA_RETENTION_DAYS` tanımsızsa
   hiçbir şey silinmez. Doluysa günlük süpürücü yalnızca BİTMİŞ işleri ve
   sahne/timeline'da REFERANSLANMAYAN sonuç varlıklarını siler — projenin
   yaratıcı durumu (storyboard'lar, kurgudaki klipler) saklama süresinden
   etkilenmez. Render dosya silme yolu dizin dışına çıkamaz (testli).
6. **Erişilebilirlik kapısı axe-core ile**: ana sayfa, yeni proje ve proje
   stüdyosu WCAG 2.1 A/AA taramasından geçirildi; bulunan gerçek ihlaller
   düzeltildi (zinc-500 metin kontrastı → zinc-400; tablist içindeki tab-olmayan
   düğmeler dışarı alındı). Tarama canlı E2E'nin parçasıdır.
7. **İmzasız masaüstü yapısı belgelendi**: kod imzalama sertifikası
   olmadığından paketleme rehberi (docs/RELEASE.md) imzasız NSIS yapısını ve
   sertifika edinilince izlenecek yolu açıkça yazar; sahte bir "imzalı" izlenimi
   verilmez.

## Bilinen sınırlar

- Kimlik doğrulama/yetkilendirme yok (tek kullanıcılı geliştirme modu);
  internete açılmadan önce zorunlu — docs/SECURITY.md'de ayrıntılı.
- Rate limit ve idempotency önbelleği süreç içi; çok kopyalı dağıtımda Redis'e
  taşınmalı.
- Performans smoke basit ardışık ölçümdür (p95 < 2 ms boş depo ile); yük testi
  (eşzamanlılık, büyük projeler) V1 kapsamındadır.
