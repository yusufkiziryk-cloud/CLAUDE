import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KRITERLER_AH, KRITERLER_ASC, kriterKatsayisi, basariOrani, hedefeKalan, birimDurumu,
  muafiyetVarMi, aylikHesap, ascMaasCarpani, devirliGerceklesme, kriterKoduBul, maasEtkisi,
} from '../src/hyp-katsayi.js';

const yakin = (a, b, tol = 0.0005) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);
const kr = (kod, grup = 'AH') => (grup === 'ASC' ? KRITERLER_ASC : KRITERLER_AH).find((k) => k.kod === kod);

test('resmî tablo tutarlılığı: AH aktif kriter çarpımları 1,5 (üst) ve 0,9 (alt); ASÇ 1,2', () => {
  const aktif = KRITERLER_AH.filter((k) => k.aktif);
  assert.equal(aktif.length, 18);
  yakin(aktif.reduce((t, k) => t * k.ustK, 1), 1.5, 1e-5);
  yakin(aktif.reduce((t, k) => t * k.altK, 1), 0.9, 1e-5);
  yakin(KRITERLER_ASC.reduce((t, k) => t * k.ustK, 1), 1.2, 1e-4);
  yakin(KRITERLER_ASC.reduce((t, k) => t * k.altK, 1), 0.9021, 1e-6);
});

test('kriter katsayısı: asgari altı, asgari, doğrusal arası, azami', () => {
  const ht = kr('HT_TARAMA'); // 40–90
  yakin(kriterKatsayisi(39.9, ht), 0.993999);
  yakin(kriterKatsayisi(40, ht), 1);
  yakin(kriterKatsayisi(65, ht), 1 + 0.5 * 0.02344, 1e-6);
  yakin(kriterKatsayisi(90, ht), 1.02344);
  yakin(kriterKatsayisi(150, ht), 1.02344);
  const kah = kr('KAH_TAKIP'); // 40–85
  yakin(kriterKatsayisi(85, kah), 1.02344);
  const vital = kr('VITAL', 'ASC'); // 40–90, 0,93 → 1,0611
  yakin(kriterKatsayisi(30, vital), 0.93);
  yakin(kriterKatsayisi(40, vital), 1);
  yakin(kriterKatsayisi(65, vital), 1.03055, 1e-6);
  yakin(kriterKatsayisi(95, vital), 1.0611);
  assert.equal(kriterKatsayisi(null, ht), 1);           // hedef nüfus 0 (md.7/8)
  assert.equal(kriterKatsayisi(100, kr('HT_SONUC')), 1); // pasif kriter
});

test('büyük birim kuralı (md.7/4): asgari ve üzeri → 1, altı → alt katsayı', () => {
  const ht = kr('HT_TARAMA');
  assert.equal(kriterKatsayisi(95, ht, { buyukBirim: true }), 1);
  assert.equal(kriterKatsayisi(45, ht, { buyukBirim: true }), 1);
  yakin(kriterKatsayisi(30, ht, { buyukBirim: true }), 0.993999);
});

test('başarı oranı — devir kullanımı ve %10 şartı (md.4/b, md.7/9-10)', () => {
  const ht = kr('HT_TARAMA');
  let o = basariOrani({ gereken: 100, yapilan: 60, devreden: 30 }, ht);
  yakin(o.yuzde, 90); assert.equal(o.kullanilanDevir, 30); assert.equal(o.kalanDevir, 0);
  o = basariOrani({ gereken: 100, yapilan: 90, devreden: 30 }, ht);
  yakin(o.yuzde, 100); assert.equal(o.kullanilanDevir, 10); assert.equal(o.kalanDevir, 20);
  o = basariOrani({ gereken: 100, yapilan: 5, devreden: 30 }, ht);        // %10 yok, devir < azami → alt katsayı
  yakin(o.yuzde, 5); assert.equal(o.kullanilanDevir, 0); assert.equal(o.istisnaKatsayi1, false);
  o = basariOrani({ gereken: 100, yapilan: 5, devreden: 95 }, ht);        // %10 yok, devir > azami → ilk ay 1
  assert.equal(o.istisnaKatsayi1, true);
  o = basariOrani({ gereken: 100, yapilan: 5, devreden: 95 }, ht, { devirIlkAy: false });
  assert.equal(o.istisnaKatsayi1, false);
  o = basariOrani({ gereken: 0, yapilan: 3 }, ht);
  assert.equal(o.yuzde, null);
});

test('hedefe kalan (simülasyon)', () => {
  assert.equal(hedefeKalan({ gereken: 100, yapilan: 20, devreden: 0 }, 40), 20);
  assert.equal(hedefeKalan({ gereken: 100, yapilan: 20, devreden: 15 }, 40), 5);
  assert.equal(hedefeKalan({ gereken: 100, yapilan: 0, devreden: 50 }, 40), 10);  // önce %10 eşiği
  assert.equal(hedefeKalan({ gereken: 100, yapilan: 95, devreden: 0 }, 90), 0);
});

test('birim durumu: tavan ve büyük birim (md.7/4-5)', () => {
  yakin(birimDurumu({ nufus: 3600 }).tavan, 4000 / 3600);
  assert.equal(birimDurumu({ nufus: 2600 }).tavan > 1.5, true);              // tavan bağlayıcı değil
  assert.equal(birimDurumu({ nufus: 4200 }).buyukBirim, true);
  assert.equal(birimDurumu({ nufus: 4200 }).tavan, null);
  yakin(birimDurumu({ birimTipi: 'entegre', nufus: 2000 }).tavan, 1.2);
  assert.equal(birimDurumu({ birimTipi: 'entegre', nufus: 2500 }).buyukBirim, true);
  yakin(birimDurumu({ nufus: 3000, tutukluSayisi: 1600 }).tavan, 4000 / 3000 > 1.333334 ? 1.333334 : 4000 / 3000);
  yakin(birimDurumu({ nufus: 3000, tutukluSayisi: 1800 }).tavan, 1.176471);
  assert.equal(birimDurumu({ nufus: 3000, tutukluSayisi: 2100 }).buyukBirim, true);
});

test('muafiyetler (md.7/6-7)', () => {
  assert.equal(muafiyetVarMi({ maasaEsasPuan: 999 }), 'puan');
  assert.equal(muafiyetVarMi({ maasaEsasPuan: 1000 }), null);
  assert.equal(muafiyetVarMi({ yeniBirimMuafiyeti: true }), 'yeni-birim');
});

test('aylık hesap AH: tam performans → 1,5; tavan uygulanır', () => {
  const satirlar = KRITERLER_AH.map((k) => ({ kod: k.kod, gereken: 100, yapilan: 100, devreden: 0 }));
  const h = aylikHesap({ grup: 'AH', satirlar, birim: { nufus: 2600 } });
  yakin(h.hamKatsayi, 1.5, 1e-5);
  yakin(h.katsayi, 1.5, 1e-5);
  assert.equal(h.tavanUygulandi, false);
  const h2 = aylikHesap({ grup: 'AH', satirlar, birim: { nufus: 3600 } });
  yakin(h2.katsayi, 4000 / 3600);
  assert.equal(h2.tavanUygulandi, true);
  const h3 = aylikHesap({ grup: 'AH', satirlar, birim: { nufus: 4500 } });
  yakin(h3.katsayi, 1, 1e-9); // büyük birim: her kriter 1
});

test('aylık hesap ASÇ: hiç yapmama 0,9021; tam 1,2; muafiyet 1', () => {
  const hic = [{ kod: 'VITAL', gereken: 100, yapilan: 0 }, { kod: 'YASLI', gereken: 20, yapilan: 0 }];
  yakin(aylikHesap({ grup: 'ASC', satirlar: hic }).katsayi, 0.9021, 1e-6);
  const tam = [{ kod: 'VITAL', gereken: 100, yapilan: 95 }, { kod: 'YASLI', gereken: 20, yapilan: 19 }];
  yakin(aylikHesap({ grup: 'ASC', satirlar: tam, birim: { nufus: 2600 } }).katsayi, 1.2, 1e-4);
  assert.equal(aylikHesap({ grup: 'ASC', satirlar: tam, birim: { maasaEsasPuan: 900 } }).katsayi, 1);
});

test('ASÇ maaş çarpanı (md.7/3 a-b-c)', () => {
  yakin(ascMaasCarpani({ kAsc: 0.9021, kBirim: 1.4 }).carpan, 0.9021);      // a
  yakin(ascMaasCarpani({ kAsc: 1.02, kBirim: 1.45 }).carpan, 1.02);         // b: 1,02 < 1,0875
  const c = ascMaasCarpani({ kAsc: 1.13, kBirim: 1.45 });                    // c: 1,13 ≥ 1,0875 → 1,45
  yakin(c.carpan, 1.45); assert.equal(c.gecerli, 'birim');
  yakin(ascMaasCarpani({ kAsc: 1.19, kBirim: 1.1 }).carpan, 1.19);          // c: büyük olan ASÇ
  assert.equal(ascMaasCarpani({ kAsc: 0.9, muafiyet: 'puan' }).carpan, 1);
});

test('devir zinciri — yönergedeki 4 aylık örnek (ASÇ belgesi)', () => {
  const s = devirliGerceklesme([
    { hedef: 15, yapilan: 50 }, { hedef: 20, yapilan: 5 }, { hedef: 10, yapilan: 2 }, { hedef: 10, yapilan: 5 },
  ], kr('YASLI', 'ASC'));
  yakin(s[1].yuzde, 100); assert.equal(s[1].kullanilanDevir, 15);
  yakin(s[2].yuzde, 100); assert.equal(s[2].kullanilanDevir, 8);
  yakin(s[3].yuzde, 50);  assert.equal(s[3].kullanilanDevir, 0);
});

test('SİNA/HYP adlarının koda eşlenmesi', () => {
  assert.equal(kriterKoduBul('HİPERTANSİYON TARAMASI'), 'HT_TARAMA');
  assert.equal(kriterKoduBul('KARDİYOVASKÜLER RİSK İZLEM'), 'KVR_TAKIP');
  assert.equal(kriterKoduBul('OBEZİTE İZLEM (AİLE HEKİMİ)'), 'OB_TAKIP');
  assert.equal(kriterKoduBul('KANSER MAMOGRAFİ TARAMASI'), 'KA_MEME');
  assert.equal(kriterKoduBul('VİTAL BULGU ASÇ', 'ASC'), 'VITAL');
  assert.equal(kriterKoduBul('YAŞLI SAĞLIĞI İZLEMİ ASÇ', 'ASC'), 'YASLI');
  assert.equal(kriterKoduBul('bilinmeyen parametre'), null);
});

test('maaş etkisi', () => {
  const e = maasEtkisi(100000, 1.2);
  yakin(e.yeni, 120000); yakin(e.fark, 20000); yakin(e.yuzde, 20);
});
