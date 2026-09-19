// HYP Analitik - SINA Pozitif Performans okuyucu (icerik betigi)
// Kullanici SINA'ya kendisi giris yapar; bu betik yalnizca ekranda gorunen
// tabloyu okur, hicbir yere gondermez. Cikti panoya ve JSON dosyasina yazilir.
(() => {
  'use strict';

  // SINA arayuzu degisirse yalnizca bu blok guncellenir.
  const SECICILER = {
    hekimEkranKodu: 'SC-DBBEMXEEDFCCEAB',
    ascEkranKodu: 'SC-0320Z42B2FCOK70',
    hekimBaslik: 'Pozitif Performans Hekim Ekranı',
    ascBaslik: 'Gerçekleşme Tablosu ASÇ',
    izgara: '.ReactVirtualized__Grid.ReactVirtualized__List',
    icKap: '.ReactVirtualized__Grid__innerScrollContainer',
    yilFiltre: '[data-sh-id="sh-Yıl-widgetSelectfilter"]',
    ayFiltre: '[data-sh-id="sh-Ay-widgetSelectfilter"]',
  };
  const AYLAR = { ocak: 1, subat: 2, mart: 3, nisan: 4, mayis: 5, haziran: 6, temmuz: 7, agustos: 8, eylul: 9, ekim: 10, kasim: 11, aralik: 12 };
  const DUGME_ID = 'hyp-analitik-aktar';

  const normal = (s) => String(s || '')
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i').replace(/Ğ/g, 'g').replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u').replace(/ü/g, 'u').replace(/Ş/g, 's').replace(/ş/g, 's')
    .replace(/Ö/g, 'o').replace(/ö/g, 'o').replace(/Ç/g, 'c').replace(/ç/g, 'c')
    .toLowerCase().trim();
  const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
  const metinVar = (secici, metin) => Array.from(document.querySelectorAll(secici)).some((el) => el.textContent.trim() === metin);

  function ekranTipi() {
    const url = location.href;
    if (url.includes(SECICILER.ascEkranKodu) || metinVar('span', SECICILER.ascBaslik)) return 'ASC';
    if (url.includes(SECICILER.hekimEkranKodu) || metinVar('.v-toolbar-title', SECICILER.hekimBaslik)) return 'AH';
    return null;
  }

  function beklenenSatirSayisi() {
    let sayi = null;
    document.querySelectorAll('p, div, span').forEach((el) => {
      if (el.children.length) return;
      const m = el.textContent.match(/(\d+)\s*satır/i) || el.textContent.match(/of\s*(\d+)\s*rows?/i);
      if (m) sayi = parseInt(m[1], 10);
    });
    return sayi;
  }

  function donemOku() {
    const oku = (sec) => document.querySelector(sec)?.textContent?.trim() || '';
    const yil = (oku(SECICILER.yilFiltre).match(/20\d{2}/) || [null])[0];
    const ayAd = normal(oku(SECICILER.ayFiltre)).split(/\s+/).find((k) => AYLAR[k]);
    return yil && ayAd ? `${yil}-${String(AYLAR[ayAd]).padStart(2, '0')}` : null;
  }

  // Sanallastirilmis tabloyu kaydirarak tum satirlari toplar.
  async function satirlariTopla(izgara, beklenen) {
    const toplanan = new Map();
    const topla = () => izgara.querySelectorAll('tr').forEach((tr) => {
      const h = Array.from(tr.children).map((td) => td.textContent.trim());
      if (h.length >= 5 && h.join('').trim()) toplanan.set(h.join('|'), h);
    });
    const adim = Math.max(120, Math.floor(izgara.clientHeight * 0.8));
    izgara.scrollTop = 0;
    await bekle(250);
    topla();
    let sabit = 0;
    let onceki = toplanan.size;
    const t0 = Date.now();
    while (Date.now() - t0 < 20000) {
      if (beklenen && toplanan.size >= beklenen) break;
      izgara.scrollTop += adim;
      await bekle(140);
      topla();
      const sonaGeldi = izgara.scrollTop + izgara.clientHeight >= izgara.scrollHeight - 2;
      sabit = toplanan.size === onceki ? sabit + 1 : 0;
      onceki = toplanan.size;
      if (sonaGeldi && sabit >= 2) break;
    }
    return Array.from(toplanan.values());
  }

  function satirlariYorumla(ham, tip) {
    const birimler = {};
    const sayi = (v) => parseInt(String(v).replace(/\D/g, ''), 10) || 0;
    ham.forEach((h) => {
      const [birim, parametre, gereken, yapilan, devreden] = h;
      if (!parametre || /tekil/i.test(parametre)) return;
      if (!/\d/.test(gereken || '') && !/\d/.test(yapilan || '')) return;
      (birimler[birim] ||= []).push({ parametre, gereken: sayi(gereken), yapilan: sayi(yapilan), devreden: sayi(devreden) });
    });
    return {
      format: 'hyp-analitik/sina-v1',
      tip,
      donem: donemOku(),
      okumaZamani: new Date().toISOString(),
      kaynak: location.href.split('?')[0],
      birimler,
    };
  }

  function bildir(mesaj, hata = false) {
    let t = document.getElementById('hyp-analitik-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'hyp-analitik-toast';
      document.body.appendChild(t);
    }
    t.textContent = mesaj;
    t.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483647;padding:12px 18px;'
      + 'border-radius:10px;font:600 14px system-ui,sans-serif;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.25);'
      + 'max-width:80vw;text-align:center;background:' + (hata ? '#b32f2f' : '#0e6a5c');
    clearTimeout(t._z);
    t._z = setTimeout(() => t.remove(), hata ? 7000 : 4500);
  }

  async function aktar(dugme) {
    const tip = ekranTipi();
    const izgara = document.querySelector(SECICILER.izgara);
    if (!tip || !izgara) {
      bildir('Pozitif Performans tablosu bulunamadı. Ekranı açıp tekrar deneyin.', true);
      return;
    }
    dugme.disabled = true;
    dugme.textContent = 'Okunuyor...';
    try {
      const ham = await satirlariTopla(izgara, beklenenSatirSayisi());
      const sonuc = satirlariYorumla(ham, tip);
      const satirSayisi = Object.values(sonuc.birimler).reduce((t, s) => t + s.length, 0);
      if (!satirSayisi) {
        bildir('Satır okunamadı. Tablonun yüklendiğinden emin olun.', true);
        return;
      }
      const metin = JSON.stringify(sonuc, null, 2);
      try { await navigator.clipboard.writeText(metin); } catch (_) { /* pano izni yoksa dosya yeterli */ }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([metin], { type: 'application/json' }));
      a.download = 'sina-' + tip.toLowerCase() + '-' + (sonuc.donem || 'donem') + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      if (chrome.storage && chrome.storage.local) chrome.storage.local.set({ sonAktarim: sonuc });
      bildir(satirSayisi + ' satır okundu (' + Object.keys(sonuc.birimler).length + ' birim). Panoya kopyalandı; HYP Analitik\'te "İçe aktar" ile yapıştırın.');
    } catch (hata) {
      bildir('Okuma hatası: ' + (hata.message || hata), true);
    } finally {
      dugme.disabled = false;
      dugme.textContent = "HYP Analitik'e aktar";
    }
  }

  function dugmeYerlestir() {
    const tip = ekranTipi();
    const izgara = document.querySelector(SECICILER.izgara);
    const mevcut = document.getElementById(DUGME_ID);
    if (!tip || !izgara || izgara.innerText.length < 40) {
      if (mevcut) mevcut.remove();
      return;
    }
    if (mevcut) return;
    const d = document.createElement('button');
    d.id = DUGME_ID;
    d.type = 'button';
    d.textContent = "HYP Analitik'e aktar";
    d.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483646;padding:12px 18px;border:0;border-radius:999px;'
      + 'background:#0e6a5c;color:#fff;font:700 14px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.28);cursor:pointer';
    d.addEventListener('click', () => aktar(d));
    document.body.appendChild(d);
  }

  setInterval(dugmeYerlestir, 1000);
})();
