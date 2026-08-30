import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KRITERLER,
  kriterKatsayisi,
  devirliGerceklesme,
  tavanKatsayisi,
  maasCarpani,
  hesaplaDonem,
} from '../src/hyp-katsayi.js';

const yakin = (a, b, tol = 0.0005) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

test('kriter katsayıları — yönerge tablosundaki değerler', () => {
  // Vital Bulgular: <50 → 0,93; 50 → 1; doğrusal artış; ≥90 → 1,06
  yakin(kriterKatsayisi(0, KRITERLER.vital), 0.93);
  yakin(kriterKatsayisi(49.9, KRITERLER.vital), 0.93);
  yakin(kriterKatsayisi(50, KRITERLER.vital), 1.0);
  yakin(kriterKatsayisi(55, KRITERLER.vital), 1.0075); // tabloda 1,008
  yakin(kriterKatsayisi(65, KRITERLER.vital), 1.0225); // tabloda 1,023
  yakin(kriterKatsayisi(85, KRITERLER.vital), 1.0525); // tabloda 1,053
  yakin(kriterKatsayisi(90, KRITERLER.vital), 1.06);
  yakin(kriterKatsayisi(100, KRITERLER.vital), 1.06);

  // ÇYYSD: <50 → 0,97; 50 → 1; ≥90 → 1,13
  yakin(kriterKatsayisi(0, KRITERLER.cyysd), 0.97);
  yakin(kriterKatsayisi(55, KRITERLER.cyysd), 1.01625); // tabloda 1,016
  yakin(kriterKatsayisi(90, KRITERLER.cyysd), 1.13);
});

test('dokümandaki örnek: Vital %85 × ÇYYSD %55 → 1,07', () => {
  const k = kriterKatsayisi(85, KRITERLER.vital) * kriterKatsayisi(55, KRITERLER.cyysd);
  yakin(Math.round(k * 100) / 100, 1.07);
});

test('uç değerler: hiç HYP yapmama → 0,9021; her ikisi ≥%90 → 1,1978', () => {
  yakin(kriterKatsayisi(0, KRITERLER.vital) * kriterKatsayisi(0, KRITERLER.cyysd), 0.9021);
  yakin(kriterKatsayisi(95, KRITERLER.vital) * kriterKatsayisi(95, KRITERLER.cyysd), 1.1978);
});

test('devir zinciri — dokümandaki 4 aylık ÇYYSD örneği', () => {
  const sonuc = devirliGerceklesme([
    { hedef: 15, yapilan: 50 }, // %100, 35 devreder
    { hedef: 20, yapilan: 5 },  // 5 + 15 devir → %100, 20 kalır (1. aydan)
    { hedef: 10, yapilan: 2 },  // 2 + 8 devir → %100, 12 kalır (1. aydan)
    { hedef: 10, yapilan: 5 },  // 1. ay fazlası 2 aydan eski → devir yok → %50
  ]);
  yakin(sonuc[0].yuzde, (50 / 15) * 100);
  assert.equal(sonuc[0].sayilanToplam, 15);
  yakin(sonuc[1].yuzde, 100);
  assert.equal(sonuc[1].kullanilanDevir, 15);
  yakin(sonuc[2].yuzde, 100);
  assert.equal(sonuc[2].kullanilanDevir, 8);
  yakin(sonuc[3].yuzde, 50);
  assert.equal(sonuc[3].kullanilanDevir, 0);
});

test('devir %10 şartı: o ay hedefin %10 altı yapılırsa devir kullanılmaz', () => {
  const sonuc = devirliGerceklesme([
    { hedef: 10, yapilan: 30 }, // 20 devreder
    { hedef: 20, yapilan: 1 },  // %10 şartı (2) sağlanmadı → devir yok
  ]);
  assert.equal(sonuc[1].kullanilanDevir, 0);
  yakin(sonuc[1].yuzde, 5);
});

test('md.7/10-b istisnası: %10 yapılamadı ama ilk devir ayı ve devreden > %90 hedef → katsayı 1', () => {
  const sonuc = devirliGerceklesme([
    { hedef: 10, yapilan: 40 }, // 30 devreder
    { hedef: 10, yapilan: 0 },  // %10 yok; devreden 30 > 9 → istisna
  ]);
  assert.equal(sonuc[1].istisnaKatsayi1, true);
  const donem = hesaplaDonem({
    vital: [{ hedef: 10, yapilan: 5 }, { hedef: 10, yapilan: 5 }],
    cyysd: [{ hedef: 10, yapilan: 40 }, { hedef: 10, yapilan: 0 }],
  });
  assert.equal(donem.aylar[1].cyysdK, 1);
});

test('hedef 0 → kriter katsayısı 1', () => {
  const donem = hesaplaDonem({
    vital: [{ hedef: 0, yapilan: 0 }],
    cyysd: [{ hedef: 10, yapilan: 9 }],
  });
  assert.equal(donem.aylar[0].vitalK, 1);
});

test('tavan katsayısı — nüfus ve birim tipi', () => {
  yakin(tavanKatsayisi({ birimTipi: 'normal', nufus: 2600 }), 1.5);
  yakin(tavanKatsayisi({ birimTipi: 'normal', nufus: 3600 }), 4000 / 3600);
  yakin(tavanKatsayisi({ birimTipi: 'entegre', nufus: 2000 }), 1.2);
  yakin(tavanKatsayisi({ birimTipi: 'normal', nufus: 2600, tutukluSayisi: 1600 }), 1.333334);
  yakin(tavanKatsayisi({ birimTipi: 'normal', nufus: 2600, tutukluSayisi: 1800 }), 1.176471);
});

test('maaş çarpanı — karşılaştırma kuralları', () => {
  // Katsayı 1'in altında → doğrudan uygulanır (maaş düşer)
  assert.deepEqual(maasCarpani({ kAsc: 0.9021 }), { carpan: 0.9021, gecerli: 'asc' });
  // Katsayı ≥ 1 ama hekimin %75'inin altında → kendi katsayısı
  yakin(maasCarpani({ kAsc: 1.05, kHekim: 1.5 }).carpan, 1.05);
  // Hekimin %75'ine ulaştı → yüksek olan (hekim) geçerli
  const avantaj = maasCarpani({ kAsc: 1.13, kHekim: 1.5 });
  yakin(avantaj.carpan, 1.5);
  assert.equal(avantaj.gecerli, 'hekim');
  // Maaşa esas puan < 1000 → çarpan 1
  assert.equal(maasCarpani({ kAsc: 0.9, puanMuafiyeti: true }).carpan, 1);
  // Tavan her iki tarafa uygulanır
  yakin(maasCarpani({ kAsc: 1.19, kHekim: 1.5, tavan: 4000 / 3600 }).carpan, 4000 / 3600);
});

test('uçtan uca dönem hesabı — nüfus 3333 üzeri ASÇ tavana takılır', () => {
  const donem = hesaplaDonem({
    vital: [{ hedef: 100, yapilan: 95 }],
    cyysd: [{ hedef: 100, yapilan: 95 }],
    birim: { birimTipi: 'normal', nufus: 3600 },
  });
  yakin(donem.aylar[0].hamKatsayi, 1.1978);
  yakin(donem.aylar[0].katsayi, 4000 / 3600);
});
