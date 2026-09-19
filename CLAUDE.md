# CLAUDE.md — Depo Haritası

Bu depo birden çok bağımsız çalışma içerir; her klasör kendi bağlamını taşır.

| Klasör | Çalışma | Bağlam dosyası |
|---|---|---|
| `hyp-analitik/` | **HYP Analitik** — aile hekimliği HYP tarama-takip katsayısı karar destek ürünü (ticari; motor + tek dosya uygulama + Chrome eklentisi + lisans altyapısı + site). claude.ai'daki "HASTALIK YÖNETİM PLATFORMU" projesinin Claude Code ayağı. | `hyp-analitik/CLAUDE.md` (önce onu oku) |
| `lifetrack/`, `lifetrack-mobile/`, `lifetrack-app*.html` | LifeTrack — kişisel kayıt/günlük uygulaması (web + mobil + tek dosya sürümleri) | — |
| `index.html` | Hesap makinesi (bağımsız küçük uygulama) | — |

Genel kurallar:
- Dil Türkçedir (arayüz, belgeler, kullanıcıyla iletişim).
- HYP Analitik üzerinde çalışırken `hyp-analitik/CLAUDE.md` içindeki çalışma
  kuralları bağlayıcıdır (motor tek kaynak + derleme, testler, doğrulanmamış
  kural kodlanmaz, gizli anahtar commit'lenmez).
