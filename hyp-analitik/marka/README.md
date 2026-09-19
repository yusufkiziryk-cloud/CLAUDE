# Marka dosyaları

| Dosya | Kullanım |
|---|---|
| `logo-orijinal.jpg` | Kullanıcının verdiği tasarım (kaynak; doğrudan kullanılmaz) |
| `logo.svg` | Tam logo: çatı + "HYP Analitik" + "AİLE HEKİMİ • ASÇ • MAAŞ • BORDRO" şeridi (site hero) |
| `logo-yatay.svg` | Çatı + sözcük işareti (uygulama ve site başlığı) |
| `simge.svg` | Kare simge: çatı + HYP (sekme simgesi / favicon) |

- SVG'ler yazı tipinden bağımsızdır (harfler yola çevrildi; Montserrat Black/ExtraBold, SIL OFL).
- Renkler CSS değişkeniyle gelir: `--logo-marka` (kırmızı, açık #d20a0a / koyu #f04747) ve
  `--logo-ink` (gri, açık #2f3432 / koyu #f1f3f1). Değişken yoksa geri dönüş değeri kullanılır.
- Yeniden üretmek için: `pip install fonttools && python3 tools/logo-uret.py`
  (yazı tipi yoksa Google Fonts'tan `tools/.font-onbellek/` altına indirir; site sayfalarındaki
  `<!--LOGO-BAS-->…<!--LOGO-SON-->` işaretçileri de güncellenir). Uygulamaya gömme `node tools/derle.js` ile olur.
- Uygulamanın işlev rengi (yeşil vurgu) bilinçli olarak logodan ayrı tutulur: kırmızı,
  tabloda "asgari altı" uyarı rengidir; birincil düğmelerde kırmızı kullanmak uyarıyla karışır.
