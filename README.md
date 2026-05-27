# 🦶 Refleks — Refleksoloji Ajanı

**Refleks**, Anthropic'in Claude yapay zeka modelini kullanan, Türkçe ve İngilizce destekli kapsamlı bir refleksoloji asistanıdır. Ayak, el ve kulak refleksolojisi hakkında rehberlik sağlar.

---

## 📋 İçindekiler

- [Özellikler](#özellikler)
- [Kurulum](#kurulum)
- [Kullanım](#kullanım)
- [Proje Yapısı](#proje-yapısı)
- [Araçlar](#araçlar)
- [Önemli Uyarı](#önemli-uyarı)

---

## ✨ Özellikler

- 🦶 **Ayak Refleksolojisi** — Taban bölgeleri ve ilgili organlar
- 🤲 **El Refleksolojisi** — El ve parmak bölgeleri
- 👂 **Kulak Refleksolojisi (Auriculoterapi)** — Kulak haritası
- 🔍 **Semptom Eşleştirme** — Semptomlara göre bölge önerileri
- 📖 **Teknik Rehberler** — Adım adım masaj teknikleri
- ⚠️ **Güvenlik Bilgisi** — Kontrendikasyonlar ve uyarılar
- 🌐 **İkidilli** — Türkçe ve İngilizce tam destek
- 💬 **Sohbet Arayüzü** — Çok turlu konuşma geçmişi
- ⚡ **Gerçek Zamanlı Akış** — Anlık yanıtlar
- 🧠 **Adaptif Düşünce** — Claude Opus 4.7 ile gelişmiş akıl yürütme
- 💾 **İstem Önbelleği** — Büyük bilgi tabanı için maliyet optimizasyonu

---

## 🚀 Kurulum

### Gereksinimler

- Python 3.11 veya üzeri
- Anthropic API anahtarı ([console.anthropic.com](https://console.anthropic.com))

### Adımlar

```bash
# 1. Depoyu klonlayın
git clone <repo-url>
cd CLAUDE

# 2. (İsteğe bağlı) Sanal ortam oluşturun
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# 3. Bağımlılıkları yükleyin
pip install -r requirements.txt

# 4. API anahtarınızı ayarlayın
export ANTHROPIC_API_KEY='sk-ant-...'
```

---

## 💬 Kullanım

```bash
python main.py
```

### Örnek Sorular

```
Siz 👤 : Baş ağrısı için hangi refleksoloji noktaları var?
Siz 👤 : Kalp bölgesi ayakta nerede?
Siz 👤 : Stres için refleksoloji uygulama rehberi ver
Siz 👤 : Tüm ayak bölgelerini listele
Siz 👤 : Baş parmak yürüyüşü tekniğini açıkla
Siz 👤 : Refleksoloji hamilelikte güvenli mi?
Siz 👤 : Which zones help with back pain?
Siz 👤 : Show me ear reflexology zones
```

### Komutlar

| Komut | Açıklama |
|-------|----------|
| `çıkış` / `exit` | Programı kapat |
| `/reset` / `/yenile` | Konuşma geçmişini temizle |
| `/help` / `/yardım` | Yardım menüsünü göster |

---

## 📁 Proje Yapısı

```
CLAUDE/
├── main.py          # CLI giriş noktası ve interaktif döngü
├── agent.py         # Anthropic SDK entegrasyonu ve ajan mantığı
├── tools.py         # Araç tanımlamaları ve işleyici fonksiyonlar
├── knowledge.py     # Refleksoloji bilgi tabanı (bölgeler, teknikler)
├── requirements.txt # Python bağımlılıkları
└── README.md        # Bu dosya
```

### Dosya Açıklamaları

#### `knowledge.py` — Bilgi Tabanı
Refleksolojinin tüm veri yapılarını içerir:
- **`FOOT_ZONES`** — 14 ayak refleksoloji bölgesi
- **`HAND_ZONES`** — 4 el refleksoloji bölgesi
- **`EAR_ZONES`** — 5 kulak refleksoloji bölgesi
- **`SYMPTOM_MAP`** — Semptomdan bölgeye eşleştirme haritası
- **`GENERAL_TECHNIQUES`** — 5 temel teknik açıklaması
- **`SAFETY_INFO`** — Kontrendikasyonlar ve yasal uyarılar

#### `tools.py` — Araçlar
Claude'un kullanabileceği araç tanımlamaları ve Python işleyicileri:
- `lookup_zone` — Bölge ID'siyle ayrıntılı bilgi getir
- `find_zones_by_symptom` — Semptomlara göre bölge bul
- `get_technique_guide` — Teknik talimatları getir
- `get_safety_info` — Güvenlik bilgisi
- `list_all_zones` — Bölge listesi

#### `agent.py` — Ajan Mantığı
- `ReflexologyAgent` sınıfı
- Anthropic SDK ile streaming API çağrıları
- Çok turlu araç kullanımı döngüsü
- İstem önbelleği (prompt caching)
- Konuşma geçmişi yönetimi

#### `main.py` — CLI Arayüzü
- İnteraktif sohbet döngüsü
- Hoş geldiniz mesajı
- API anahtarı doğrulama
- Hata yönetimi

---

## 🔧 Araçlar

### `lookup_zone`
```
Giriş: zone_id (str), language ("tr"|"en")
Çıkış: Bölge adı, konumu, ilgili organ, faydalar, teknik, uyarı
```

### `find_zones_by_symptom`
```
Giriş: symptom (str), language ("tr"|"en")
Çıkış: Eşleşen bölgelerin listesi
Örnek semptomlar: "baş ağrısı", "stres", "bel ağrısı", "sindirim"
```

### `get_technique_guide`
```
Giriş: technique_name ("thumb_walking"|"finger_walking"|"rotation"|"pinching"|"holding"|"all")
Çıkış: Adım adım teknik talimatları
```

### `get_safety_info`
```
Giriş: language ("tr"|"en")
Çıkış: Kontrendikasyonlar listesi ve sorumluluk reddi
```

### `list_all_zones`
```
Giriş: area ("foot"|"hand"|"ear"|"all"), language ("tr"|"en")
Çıkış: Filtrelenmiş bölge listesi
```

---

## 🤖 Teknik Detaylar

### Model
- **Claude Opus 4.7** (`claude-opus-4-7`)
- Adaptif düşünce (`thinking: {"type": "adaptive"}`)
- Yüksek çaba seviyesi (`output_config: {"effort": "high"}`)

### İstem Önbelleği
Büyük sistem istemi (`cache_control: {"type": "ephemeral"}`) ile önbelleğe alınır. Bu, her konuşma turunda tekrar eden token maliyetini %90'a kadar azaltır.

### Araç Kullanımı
Manuel araç döngüsü ile:
1. Claude yanıt üretir
2. Araç kullanımı gerekiyorsa Python işleyicisi çalışır
3. Araç sonucu Claude'a geri beslenir
4. Claude nihai yanıtı oluşturur

---

## ⚠️ Önemli Uyarı

> **Refleksoloji tamamlayıcı bir terapidir ve tıbbi tedavinin yerini almaz.**
> 
> Bu uygulama yalnızca eğitim ve bilgi amaçlıdır. Herhangi bir sağlık sorununuz için mutlaka bir sağlık uzmanına başvurun. Ağır semptomlarda, kronik hastalıklarda veya hamilelikte refleksoloji uygulamadan önce doktorunuza danışın.

---

## 📄 Lisans

Bu proje eğitim amaçlı geliştirilmiştir.

---

*🦶 Sağlıklı günler dileriz! — Refleks Refleksoloji Ajanı*
