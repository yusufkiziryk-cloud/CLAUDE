import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { kuralSec, gelirVergisi, bordroHesapla, katsayiUygula, netFark } from '../src/bordro-motoru.js';

const { kurallar } = JSON.parse(readFileSync(new URL('../kurallar/2026-kurallar.json', import.meta.url), 'utf8'));
const yakin = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);
const kalem = (kod, brut, ek = {}) => ({ kod, ad: kod, brut, gelirVergisi: true, damga: true, sgkPek: true, ...ek });

test('kural seçimi tarihe göre sürüm seçer; tarih dışı → null', () => {
  assert.equal(kuralSec(kurallar, 'HMB_KATSAYI', '2026-03-15').parameters.aylikKatsayi, 1.387871);
  assert.equal(kuralSec(kurallar, 'HMB_KATSAYI', '2026-07-01').parameters.aylikKatsayi, 1.575512);
  assert.equal(kuralSec(kurallar, 'HMB_KATSAYI', '2027-01-01'), null);
  assert.equal(kuralSec(kurallar, 'GV_UCRET_TARIFESI', '2025-12-31'), null);
});

test('gelir vergisi tarifesi — bilgi tabanındaki kontrol değerleri (kümülatif)', () => {
  const d = kuralSec(kurallar, 'GV_UCRET_TARIFESI', '2026-06-01').parameters.dilimler;
  yakin(gelirVergisi(190000, 0, d).vergi, 28500);
  yakin(gelirVergisi(400000, 0, d).vergi, 70500);
  yakin(gelirVergisi(1500000, 0, d).vergi, 367500);
  yakin(gelirVergisi(5300000, 0, d).vergi, 1697500);
  yakin(gelirVergisi(5400000, 0, d).vergi, 1697500 + 100000 * 0.40);
  // dilim geçişi: önceki kümülatif 185.000, bu ay 10.000 → 5.000 %15 + 5.000 %20
  const g = gelirVergisi(10000, 185000, d);
  yakin(g.vergi, 5000 * 0.15 + 5000 * 0.20);
  assert.equal(g.parcalar.length, 2);
  assert.equal(g.yeniKumulatif, 195000);
  // tam sınırda kuruş farkı: 190.000,00 → hepsi %15
  yakin(gelirVergisi(0.01, 189999.99, d).vergi, 0.0015, 1e-6);
});

test('5510 4/c bordro — kesinti sırası ve net', () => {
  const s = bordroHesapla({
    tarih: '2026-07-15',
    sosyalGuvenlik: 'SGK_5510_4C',
    oncekiKumulatifMatrah: 0,
    kalemler: [kalem('KAYITLI_KISI', 100000)],
    kurallar,
  });
  assert.equal(s.durum, 'TAMAM');
  yakin(s.ozet.sgKisi, 14000);          // %9 + %5
  yakin(s.ozet.sgIsveren, 19500);       // %12 + %7,5
  yakin(s.ozet.gvMatrah, 86000);        // brüt − kişi primi (GVK 63)
  yakin(s.ozet.gelirVergisi, 86000 * 0.15);
  yakin(s.ozet.damgaVergisi, 100000 * 0.00759);
  yakin(s.ozet.net, 100000 - 14000 - 12900 - 759);
  yakin(s.ozet.isverenMaliyeti, 119500);
  assert.equal(s.etiket, 'TAHMİNİ / SİMÜLASYON'); // kurallar PROVISIONAL + istisna uygulanmadı
  assert.ok(s.uyarilar.some((u) => u.includes('Asgari ücret')));
  assert.ok(s.aciklama.length >= 4);
});

test('5434 rejimi — kesenek %16, kurum %20, uyarı verir', () => {
  const s = bordroHesapla({ tarih: '2026-02-01', sosyalGuvenlik: 'PENSION_5434', kalemler: [kalem('A', 50000)], kurallar });
  yakin(s.ozet.sgKisi, 8000);
  yakin(s.ozet.sgIsveren, 10000);
  assert.ok(s.uyarilar.some((u) => u.includes('5434')));
});

test('kalem profili: vergi dışı / damga dışı / PEK dışı kalemler matraha girmez', () => {
  const s = bordroHesapla({
    tarih: '2026-07-15', sosyalGuvenlik: 'SGK_5510_4C', kurallar,
    kalemler: [kalem('A', 10000), kalem('GIDER', 5000, { gelirVergisi: false, damga: false, sgkPek: false })],
  });
  yakin(s.ozet.brutToplam, 15000);
  yakin(s.ozet.sgMatrah, 10000);
  yakin(s.ozet.damgaVergisi, 10000 * 0.00759);
  yakin(s.ozet.gvMatrah, 10000 - 1400);
});

test('fail-closed: rejim belirsiz veya tarife yok → KİLİTLİ; profili eksik kalem UNRESOLVED', () => {
  const k1 = bordroHesapla({ tarih: '2026-07-15', sosyalGuvenlik: 'BELIRSIZ', kalemler: [kalem('A', 1000)], kurallar });
  assert.equal(k1.durum, 'KILITLI');
  assert.equal(k1.etiket, 'KİLİTLİ');
  const k2 = bordroHesapla({ tarih: '2027-03-01', sosyalGuvenlik: 'SGK_5510_4C', kalemler: [kalem('A', 1000)], kurallar });
  assert.equal(k2.durum, 'KILITLI');
  assert.ok(k2.kilitNedenleri.some((n) => n.includes('tarife')));
  const k3 = bordroHesapla({ tarih: '2026-07-15', sosyalGuvenlik: 'SGK_5510_4C', kalemler: [{ kod: 'X', ad: 'Profilsiz', brut: 1000 }], kurallar });
  assert.ok(k3.uyarilar.some((u) => u.startsWith('UNRESOLVED_PAY_ITEM')));
  assert.equal(k3.ozet.brutToplam, 0);
});

test('katsayı yalnızca katsayıya tabi kaleme uygulanır; net fark hesaplanır', () => {
  const kalemler = [kalem('KAYITLI_KISI', 100000, { katsayiyaTabi: true }), kalem('ASM_GIDER', 30000, { gelirVergisi: false, damga: false, sgkPek: false })];
  const u = katsayiUygula(kalemler, 1.1);
  yakin(u[0].brut, 110000); yakin(u[1].brut, 30000);
  const f = netFark({ tarih: '2026-07-15', sosyalGuvenlik: 'SGK_5510_4C', kalemler, kurallar }, 1.0, 1.1);
  yakin(f.brutFark, 10000);
  // brüt +10.000 → kişi primi +1.400, GV +(10.000−1.400)×0,15 = 1.290, damga +75,9 → net +7.234,10
  yakin(f.fark, 10000 - 1400 - 1290 - 75.9);
});

test('kümülatif matrah: yıl içinde önceki matrah dilimi yükseltir', () => {
  const a = bordroHesapla({ tarih: '2026-01-15', sosyalGuvenlik: 'SGK_5510_4C', oncekiKumulatifMatrah: 0, kalemler: [kalem('A', 100000)], kurallar });
  const b = bordroHesapla({ tarih: '2026-09-15', sosyalGuvenlik: 'SGK_5510_4C', oncekiKumulatifMatrah: 700000, kalemler: [kalem('A', 100000)], kurallar });
  assert.ok(b.ozet.gelirVergisi > a.ozet.gelirVergisi);
  yakin(b.ozet.gelirVergisi, 86000 * 0.27);
  yakin(b.ozet.yeniKumulatifMatrah, 786000);
});
