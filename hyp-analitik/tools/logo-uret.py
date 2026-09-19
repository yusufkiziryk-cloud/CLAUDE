#!/usr/bin/env python3
"""
HYP Analitik logo üretici — marka/*.svg dosyalarını yazı tipinden bağımsız
(harfler yola çevrilmiş) olarak üretir.

  python3 tools/logo-uret.py            → marka/logo.svg, logo-yatay.svg, simge.svg

Tasarım kaynağı: marka/logo-orijinal.jpg (kırmızı çatı + "HYP Analitik" + alt şerit).
Yazı tipi: Montserrat (SIL OFL) — Black (900) sözcük işareti, ExtraBold (800) alt şerit.
Yazı tipi dosyaları yoksa Google Fonts'tan indirilir (tools/.font-onbellek/).
Renkler: SVG içinde CSS değişkeni + geri dönüş değeri kullanılır; uygulama koyu temada
--logo-marka / --logo-ink değişkenleriyle yeniden renklendirir.
Gereksinim: pip install fonttools
"""
import os, re, sys, urllib.request
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

KOK = Path(__file__).resolve().parent.parent
MARKA = KOK / 'marka'
ONBELLEK = KOK / 'tools' / '.font-onbellek'
KIRMIZI = 'var(--logo-marka, #d20a0a)'
GRI = 'var(--logo-ink, #333333)'


def font_getir(agirlik: int) -> TTFont:
    ONBELLEK.mkdir(exist_ok=True)
    yol = ONBELLEK / f'montserrat-{agirlik}.ttf'
    if not yol.exists():
        css_url = f'https://fonts.googleapis.com/css2?family=Montserrat:wght@{agirlik}&display=swap'
        istek = urllib.request.Request(css_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 6.1)'})
        css = urllib.request.urlopen(istek, timeout=30).read().decode()
        url = re.search(r'url\((https://[^)]+\.ttf)\)', css).group(1)
        yol.write_bytes(urllib.request.urlopen(url, timeout=60).read())
    return TTFont(yol)


class Metin:
    """Bir metnin glif yollarını ve sınırlarını üretir (kerning yok, sade izleme)."""

    def __init__(self, font: TTFont, metin: str, boyut: float, izleme: float = 0.0):
        self.gs = font.getGlyphSet()
        self.cmap = font.getBestCmap()
        self.upem = font['head'].unitsPerEm
        self.metin, self.boyut, self.izleme = metin, boyut, izleme
        self.olcek = boyut / self.upem
        self.cap = font['OS/2'].sCapHeight * self.olcek

    def yol(self, x: float, y: float) -> str:
        parcalar, px = [], x
        for ch in self.metin:
            g = self.gs[self.cmap[ord(ch)]]
            pen = SVGPathPen(self.gs)
            g.draw(TransformPen(pen, (self.olcek, 0, 0, -self.olcek, px, y)))
            if ch != ' ':
                parcalar.append(pen.getCommands())
            px += g.width * self.olcek + self.izleme * self.boyut
        return ' '.join(parcalar)

    def sinirlar(self, x: float, y: float):
        xmin = ymin = float('inf'); xmax = ymax = float('-inf'); px = x
        for ch in self.metin:
            g = self.gs[self.cmap[ord(ch)]]
            bp = BoundsPen(self.gs)
            g.draw(TransformPen(bp, (self.olcek, 0, 0, -self.olcek, px, y)))
            if bp.bounds:
                a, b, c, d = bp.bounds
                xmin, ymin, xmax, ymax = min(xmin, a), min(ymin, b), max(xmax, c), max(ymax, d)
            px += g.width * self.olcek + self.izleme * self.boyut
        return xmin, ymin, xmax, ymax

    def genislik(self) -> float:
        a, _, c, _ = self.sinirlar(0, 0)
        return c - a


def cati(x_sol: float, x_sag: float, y_uc: float, yukselme: float, kalinlik: float) -> str:
    orta = (x_sol + x_sag) / 2
    return (f'<path d="M{x_sol:.1f},{y_uc:.1f} L{orta:.1f},{y_uc - yukselme:.1f} L{x_sag:.1f},{y_uc:.1f}" '
            f'fill="none" stroke="{KIRMIZI}" stroke-width="{kalinlik:.1f}" stroke-linecap="round" stroke-linejoin="round"/>')


def svg_sar(icerik: str, vb, baslik: str, kimlik: str) -> str:
    x, y, w, h = vb
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x:.0f} {y:.0f} {w:.0f} {h:.0f}" role="img" aria-labelledby="{kimlik}">\n'
            f'<title id="{kimlik}">{baslik}</title>\n{icerik}\n</svg>\n')


def siteye_yerlestir(dosya: Path, isaret: str, svg: str):
    """<!--ISARET-BAS--> … <!--ISARET-SON--> arasını satır içi SVG ile değiştirir."""
    if not dosya.exists():
        return
    metin = dosya.read_text(encoding='utf-8')
    bas, son = f'<!--{isaret}-BAS-->', f'<!--{isaret}-SON-->'
    if bas not in metin or son not in metin:
        return
    onu, kalan = metin.split(bas, 1)
    _, sonra = kalan.split(son, 1)
    dosya.write_text(onu + bas + svg.strip() + son + sonra, encoding='utf-8')


def uret():
    siyah = font_getir(900)
    kalin = font_getir(800)
    W = 1366.0
    # --- Sözcük işareti: "HYP" kırmızı + "Analitik" gri; toplam genişlik 1215 (orijinal orantı) ---
    hedef = 1215.0
    hyp1, ana1 = Metin(siyah, 'HYP', 100, izleme=-0.015), Metin(siyah, 'Analitik', 100, izleme=-0.015)
    bosluk_em = 0.06
    toplam1 = hyp1.genislik() + ana1.genislik() + bosluk_em * 100
    boyut = 100 * hedef / toplam1
    hyp, ana = Metin(siyah, 'HYP', boyut, izleme=-0.015), Metin(siyah, 'Analitik', boyut, izleme=-0.015)
    taban = 700.0
    x0 = (W - hedef) / 2
    hx0, _, hx1, _ = hyp.sinirlar(0, taban)
    hyp_x = x0 - hx0
    ax0, _, ax1, _ = ana.sinirlar(0, taban)
    ana_x = x0 + (hx1 - hx0) + bosluk_em * boyut - ax0
    sozcuk = (f'<path fill="{KIRMIZI}" d="{hyp.yol(hyp_x, taban)}"/>\n'
              f'<path fill="{GRI}" d="{ana.yol(ana_x, taban)}"/>')
    cap_ust = taban - hyp.cap
    # --- Çatı: sözcük genişliğine göre; uçlar 15 içeride, uç merkezi cap üstünün 50 üstünde ---
    kalinlik = 0.0724 * hedef
    cati_svg = cati(x0 + 15, x0 + hedef - 15, cap_ust - 50, 0.464 * (hedef / 2 - 15), kalinlik)
    cati_ust = cap_ust - 50 - 0.464 * (hedef / 2 - 15) - kalinlik / 2
    # --- Alt şerit: "AİLE HEKİMİ • ASÇ • MAAŞ • BORDRO" ---
    parcalar = ['AİLE HEKİMİ', 'ASÇ', 'MAAŞ', 'BORDRO']

    def serit_kur(boyut_):
        m_ = [Metin(kalin, p, boyut_, izleme=0.06) for p in parcalar]
        r_ = 0.17 * boyut_
        a_ = 0.55 * boyut_  # sözcük ile nokta arası
        w_ = sum(m.genislik() for m in m_) + (len(parcalar) - 1) * (2 * a_ + 2 * r_)
        return m_, r_, a_, w_

    # şerit, sözcük işaretinin %96'sına sığacak şekilde ölçeklenir (orijinal orantı)
    _, _, _, w64 = serit_kur(64.0)
    serit_boyut = 64.0 * (0.96 * hedef) / w64
    metinler, nokta_r, ara, serit_w = serit_kur(serit_boyut)
    serit_taban = taban + 92
    sx = (W - serit_w) / 2
    serit = []
    for i, m in enumerate(metinler):
        a, _, _, _ = m.sinirlar(0, serit_taban)
        serit.append(f'<path fill="{GRI}" d="{m.yol(sx - a, serit_taban)}"/>')
        sx += m.genislik()
        if i < len(metinler) - 1:
            cx = sx + ara + nokta_r
            serit.append(f'<circle fill="{KIRMIZI}" cx="{cx:.1f}" cy="{serit_taban - m.cap / 2:.1f}" r="{nokta_r:.1f}"/>')
            sx += 2 * ara + 2 * nokta_r
    serit_svg = '\n'.join(serit)

    pad = 24
    ust = cati_ust - pad
    tam = svg_sar(cati_svg + '\n' + sozcuk + '\n' + serit_svg, (0, ust, W, serit_taban + 16 + pad - ust), 'HYP Analitik — Aile Hekimi, ASÇ, Maaş, Bordro', 'hyp-logo-tam')
    yatay = svg_sar(cati_svg + '\n' + sozcuk, (0, ust, W, taban + 8 + pad - ust), 'HYP Analitik', 'hyp-logo')

    # --- Simge (kare): çatı + HYP ---
    S = 512.0
    shyp = Metin(siyah, 'HYP', 100)
    sboyut = 100 * 360 / shyp.genislik()
    shyp = Metin(siyah, 'HYP', sboyut)
    st = 400.0
    a, _, c, _ = shyp.sinirlar(0, st)
    sx0 = (S - (c - a)) / 2 - a
    skal = 0.0724 * 470
    simge_icerik = (cati((S - 470) / 2 + 12, (S + 470) / 2 - 12, st - shyp.cap - 40, 0.464 * (235 - 12), skal) + '\n'
                    + f'<path fill="{KIRMIZI}" d="{shyp.yol(sx0, st)}"/>')
    simge = svg_sar(simge_icerik, (0, 0, S, S), 'HYP Analitik', 'hyp-simge')

    MARKA.mkdir(exist_ok=True)
    (MARKA / 'logo.svg').write_text(tam, encoding='utf-8')
    (MARKA / 'logo-yatay.svg').write_text(yatay, encoding='utf-8')
    (MARKA / 'simge.svg').write_text(simge, encoding='utf-8')
    for ad in ('logo.svg', 'logo-yatay.svg', 'simge.svg'):
        print(ad, (MARKA / ad).stat().st_size, 'bayt')
    # site sayfaları derlenmez; işaretçiler arasına satır içi SVG yerleştirilir
    siteye_yerlestir(KOK / 'site' / 'index.html', 'LOGO', yatay)
    siteye_yerlestir(KOK / 'site' / 'index.html', 'LOGO-TAM', tam)
    siteye_yerlestir(KOK / 'site' / 'gizlilik.html', 'LOGO', yatay)
    print('site/index.html ve site/gizlilik.html güncellendi')


if __name__ == '__main__':
    uret()
