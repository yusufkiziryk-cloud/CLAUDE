/**
 * HYP Analitik — Tarama ve Takip Katsayısı hesap motoru (v2)
 *
 * Kaynaklar (doğrulanmış):
 *  - Aile Hekimliği Tarama ve Takip Katsayısına İlişkin Yönerge (md.4, 5, 7, 8;
 *    30/6/2021 tarihli 1091 sayılı yönergeyi yürürlükten kaldıran metin)
 *  - HYP Tarama ve Takip Kılavuzu, 14.04.2026, Bölüm 1 (kriter tabloları)
 * Davranış sözleşmesi: ../bilgi-tabani/kriter-tablolari-resmi.md
 *
 * Bağımlılık yok; Node ve tarayıcıda aynı şekilde çalışır.
 * Tarayıcı kopyası: ../hyp-analitik.html içindeki "MOTOR" bloğu (eşit tutulur).
 */

export const KAYNAK = {
  yonerge: 'Aile Hekimliği Tarama ve Takip Katsayısına İlişkin Yönerge (2025)',
  kilavuz: 'HYP Tarama ve Takip Kılavuzu — 14.04.2026, Bölüm 1',
};

export const DEVIR_PENCERESI_AY = 2;        // md.7/9: en fazla iki ay ileri devreder
export const DEVIR_KULLANIM_ESIGI = 0.10;   // md.7/9: o ay gerekenin ≥ %10'u yapılmalı

/** Kriter tanımı: kod, ad, tur, asgari/azami başarı %, alt/üst katsayı, aktif. */
const K = (kod, ad, tur, asgari, azami, altK, ustK, aktif = true) =>
  ({ kod, ad, tur, asgari, azami, altK, ustK, aktif });

/** Aile hekimliği birimi kriterleri — Kılavuz 14.04.2026, Tablo 1 ve 3. */
export const KRITERLER_AH = [
  K('HT_TARAMA',   'Hipertansiyon taraması',                     'tarama', 40, 90, 0.993999, 1.023440),
  K('HT_TAKIP',    'Hipertansiyon takibi',                       'takip',  50, 90, 0.996994, 1.011652),
  K('HT_SONUC',    'Hipertansiyon sonuç',                        'sonuc',  40, 90, 1, 1, false),
  K('DM_TARAMA',   'Diyabet taraması',                           'tarama', 40, 90, 0.993999, 1.023440),
  K('DM_TAKIP',    'Diyabet takibi',                             'takip',  50, 90, 0.996994, 1.011652),
  K('DM_SONUC',    'Diyabet sonuç',                              'sonuc',  40, 90, 1, 1, false),
  K('OB_TARAMA',   'Obezite taraması',                           'tarama', 40, 90, 0.996994, 1.011652),
  K('OB_TAKIP',    'Obezite takibi',                             'takip',  50, 90, 0.993997, 1.023440),
  K('OB_SONUC',    'Obezite sonuç',                              'sonuc',  40, 90, 1, 1, false),
  K('KA_SERVIKS',  'Serviks kanseri taraması',                   'tarama', 50, 90, 0.991010, 1.035365),
  K('KA_KOLOREKTAL','Kolorektal kanser taraması',                'tarama', 50, 90, 0.991010, 1.035365),
  K('KA_MEME',     'Meme kanseri taraması',                      'tarama', 40, 90, 0.991010, 1.035365),
  K('KVR_TARAMA',  'Kardiyovasküler risk taraması',              'tarama', 40, 90, 0.993999, 1.023440),
  K('KVR_TAKIP',   'Kardiyovasküler risk takibi',                'takip',  50, 90, 0.996994, 1.011652),
  K('KVR_SONUC',   'Kardiyovasküler risk sonuç',                 'sonuc',  40, 90, 1, 1, false),
  K('YASLI_TAKIP', 'Çok yönlü yaşlı sağlığı değerlendirmesi',    'takip',  50, 90, 0.993997, 1.023440),
  K('KAH_TAKIP',   'Koroner arter hastalığı takibi',             'takip',  40, 85, 0.993997, 1.023440),
  K('INME_TAKIP',  'İnme takibi',                                'takip',  40, 85, 0.993997, 1.023440),
  K('KBH_TAKIP',   'Kronik böbrek hastalığı takibi',             'takip',  40, 85, 0.993997, 1.023440),
  K('KOAH_TAKIP',  'KOAH takibi',                                'takip',  40, 85, 0.993997, 1.023440),
  K('ASTIM_TAKIP', 'Astım takibi',                               'takip',  40, 85, 0.993997, 1.023440),
  K('OTIZM_TARAMA','Otizm (OSB) taraması',                       'tarama', 40, 90, 0.993997, 1.023440),
  K('SUREC',       'Süreç yönetimi',                             'surec',  50, 80, 1, 1, false),
];

/** Aile sağlığı çalışanı kriterleri — Kılavuz 14.04.2026, Tablo 2 ve 4. */
export const KRITERLER_ASC = [
  K('VITAL',  'Vital bulgular (tarama-takip)',                          'tarama-takip', 40, 90, 0.93, 1.0611),
  K('YASLI',  'Çok yönlü yaşlı sağlığı değerlendirmesi (tarama-takip)', 'tarama-takip', 40, 90, 0.97, 1.1309),
];

/** SİNA / HYP ekranlarında görülen adları kanonik koda eşler (normalize edilmiş). */
export const SINA_ESLEME = {
  'hipertansiyon taramasi': 'HT_TARAMA', 'hipertansiyon tarama': 'HT_TARAMA',
  'hipertansiyon izlem': 'HT_TAKIP', 'hipertansiyon izlemi': 'HT_TAKIP', 'hipertansiyon takip': 'HT_TAKIP',
  'diyabet taramasi': 'DM_TARAMA', 'diyabet tarama': 'DM_TARAMA',
  'diyabet izlemi': 'DM_TAKIP', 'diyabet izlem': 'DM_TAKIP', 'diyabet takip': 'DM_TAKIP',
  'obezite taramasi': 'OB_TARAMA', 'obezite tarama': 'OB_TARAMA',
  'obezite izlemi': 'OB_TAKIP', 'obezite izlem': 'OB_TAKIP', 'obezite izlem (aile hekimi)': 'OB_TAKIP', 'obezite takip': 'OB_TAKIP',
  'kanser serviks taramasi': 'KA_SERVIKS', 'serviks kanseri taramasi': 'KA_SERVIKS', 'serviks kanseri': 'KA_SERVIKS',
  'kanser kolorektal taramasi': 'KA_KOLOREKTAL', 'kolorektal kanser taramasi': 'KA_KOLOREKTAL', 'kolorektal kanser': 'KA_KOLOREKTAL',
  'kanser mamografi taramasi': 'KA_MEME', 'meme kanseri taramasi': 'KA_MEME', 'meme kanseri': 'KA_MEME',
  'kvr taramasi': 'KVR_TARAMA', 'kardiyovaskuler risk tarama': 'KVR_TARAMA', 'kardiyovaskuler risk taramasi': 'KVR_TARAMA',
  'kvr izlemi': 'KVR_TAKIP', 'kardiyovaskuler risk izlem': 'KVR_TAKIP', 'kardiyovaskuler risk takip': 'KVR_TAKIP',
  'kardiyovaskuler risk degerlendirmesi tarama': 'KVR_TARAMA', 'kardiyovaskuler risk degerlendirmesi takip': 'KVR_TAKIP',
  'hipertansiyon takibi': 'HT_TAKIP', 'diyabet takibi': 'DM_TAKIP', 'obezite takibi': 'OB_TAKIP',
  'yasli sagligi takibi': 'YASLI_TAKIP', 'cok yonlu yasli sagligi degerlendirmesi takip': 'YASLI_TAKIP',
  'yasli sagligi izlemi': 'YASLI_TAKIP', 'yasli degerlendirme izlem': 'YASLI_TAKIP', 'cok yonlu yasli sagligi degerlendirmesi': 'YASLI_TAKIP',
  'koronerarter izlemi': 'KAH_TAKIP', 'koroner arter hastaligi izlem': 'KAH_TAKIP', 'koroner arter hastaligi': 'KAH_TAKIP',
  'inme izlemi': 'INME_TAKIP', 'inme izlem': 'INME_TAKIP', 'inme': 'INME_TAKIP',
  'kronik bobrek izlemi': 'KBH_TAKIP', 'kronik bobrek hastaligi izlem': 'KBH_TAKIP', 'kronik bobrek hastaligi': 'KBH_TAKIP',
  'koah izlemi': 'KOAH_TAKIP', 'kronik obstruktif akciger hastaligi izlem': 'KOAH_TAKIP', 'koah': 'KOAH_TAKIP',
  'astim izlemi': 'ASTIM_TAKIP', 'astim izlem': 'ASTIM_TAKIP', 'astim': 'ASTIM_TAKIP',
  'otizm tarama': 'OTIZM_TARAMA', 'osb tarama': 'OTIZM_TARAMA', 'otizm': 'OTIZM_TARAMA',
  'vital bulgu asc': 'VITAL', 'vital bulgular': 'VITAL', 'vital bulgu': 'VITAL',
  'yasli sagligi izlemi asc': 'YASLI', 'cok yonlu yasli sagligi degerlendirmesi asc': 'YASLI',
};

/** Türkçe karakterleri sadeleştirip küçük harfe çevirir (eşleme için). */
export function normalizeTR(s) {
  return String(s || '')
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
    .replace(/Ğ/g, 'g').replace(/ğ/g, 'g').replace(/Ü/g, 'u').replace(/ü/g, 'u')
    .replace(/Ş/g, 's').replace(/ş/g, 's').replace(/Ö/g, 'o').replace(/ö/g, 'o')
    .replace(/Ç/g, 'c').replace(/ç/g, 'c')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Ekranda görülen parametre adını kriter koduna çevirir; bulamazsa null. */
export function kriterKoduBul(ad, grup = 'AH') {
  const n = normalizeTR(ad);
  if (n.length < 3) return null;
  const liste = grup === 'ASC' ? KRITERLER_ASC : KRITERLER_AH;
  const gecerli = new Set(liste.map((k) => k.kod));
  if (SINA_ESLEME[n] && gecerli.has(SINA_ESLEME[n])) return SINA_ESLEME[n];
  const tam = liste.find((k) => normalizeTR(k.ad) === n);
  if (tam) return tam.kod;
  // Kısmi eşleme: yalnızca tam kelime sınırında ve en uzun anahtar öncelikli
  // ("bilinmeyen" içindeki "inme" gibi yanlış yakalamaları önler).
  const kelimeSiniri = (metin, parca) => new RegExp(`(^|[^a-z0-9])${parca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(metin);
  const kismi = Object.keys(SINA_ESLEME)
    .filter((anahtar) => anahtar.length >= 4 && gecerli.has(SINA_ESLEME[anahtar]) && (kelimeSiniri(n, anahtar) || kelimeSiniri(anahtar, n)))
    .sort((a, b) => b.length - a.length)[0];
  return kismi ? SINA_ESLEME[kismi] : null;
}

/**
 * Tek kriterin katsayısı (Yönerge md.7/2; büyük birim kuralı md.7/4).
 * yüzde null → 1 (hedef nüfus 0, md.7/8). Asgari altı → altK; azami ve üzeri → ustK;
 * arada doğrusal. Büyük birimde (nüfus 4000/2400 üzeri veya tutuklu 2000 üzeri):
 * asgari ve üzeri → 1, altı → altK.
 */
export function kriterKatsayisi(yuzde, kriter, { buyukBirim = false } = {}) {
  if (yuzde === null || yuzde === undefined || Number.isNaN(yuzde)) return 1;
  if (!kriter.aktif) return 1;
  if (yuzde < kriter.asgari) return kriter.altK;
  if (buyukBirim) return 1;
  if (yuzde >= kriter.azami) return kriter.ustK;
  return 1 + ((yuzde - kriter.asgari) / (kriter.azami - kriter.asgari)) * (kriter.ustK - 1);
}

/**
 * SİNA satır biçiminden (gereken / yapılan / devreden) aylık başarı oranı.
 * md.4/b ve md.7/9-10:
 *  - yapılan ≥ %10·gereken → devir kullanılır (hedefe kadar), oran = (yapılan + kullanılan) / gereken.
 *  - yapılan < %10·gereken ve devir varsa: devreden < azami·gereken → alt katsayı (oran ham kalır);
 *    devreden > azami·gereken → devrin ilk ayında kriter katsayısı 1 (devirIlkAy=true varsayılır).
 */
export function basariOrani({ gereken, yapilan, devreden = 0 }, kriter, { devirIlkAy = true } = {}) {
  gereken = Math.max(0, Number(gereken) || 0);
  yapilan = Math.max(0, Number(yapilan) || 0);
  devreden = Math.max(0, Number(devreden) || 0);
  if (gereken === 0) return { yuzde: null, kullanilanDevir: 0, kalanDevir: devreden, istisnaKatsayi1: false, devirSarti: null };

  const devirSarti = yapilan >= DEVIR_KULLANIM_ESIGI * gereken;
  let kullanilanDevir = 0;
  let istisnaKatsayi1 = false;
  if (devirSarti) {
    kullanilanDevir = Math.min(devreden, Math.max(0, gereken - yapilan));
  } else if (devreden > 0 && kriter && devreden > (kriter.azami / 100) * gereken && devirIlkAy) {
    istisnaKatsayi1 = true;
  }
  const yuzde = ((yapilan + kullanilanDevir) / gereken) * 100;
  return { yuzde, kullanilanDevir, kalanDevir: devreden - kullanilanDevir, istisnaKatsayi1, devirSarti, fazla: Math.max(0, yapilan - gereken) };
}

/**
 * Hedefe ulaşmak için ek kaç yapılan gerekir (simülasyon).
 * Devir sayılabilmesi için önce %10 eşiği aşılmalıdır; hesap bunu gözetir.
 */
export function hedefeKalan({ gereken, yapilan, devreden = 0 }, hedefYuzde) {
  gereken = Math.max(0, Number(gereken) || 0);
  yapilan = Math.max(0, Number(yapilan) || 0);
  devreden = Math.max(0, Number(devreden) || 0);
  if (gereken === 0) return 0;
  const esik = Math.ceil(DEVIR_KULLANIM_ESIGI * gereken);
  const gerekenToplam = Math.ceil((hedefYuzde / 100) * gereken - 1e-9);
  const yapilanMin = Math.max(esik, gerekenToplam - devreden);
  return Math.max(0, yapilanMin - yapilan);
}

/**
 * Birim nüfusuna göre tavan ve büyük birim durumu (md.7/4-5).
 * Normal ≤ 4000 → 4000/nüfus; entegre/zorunlu düşük ≤ 2400 → 2400/nüfus.
 * Nüfus sınırın üzerinde → tavan yok, büyük birim kuralı (kriter katsayısı 1).
 * Tutuklu-hükümlü > 1700 → 1,176471; 1500–1700 → 1,333334; > 2000 → büyük birim.
 */
export function birimDurumu({ birimTipi = 'normal', nufus = null, tutukluSayisi = 0 } = {}) {
  const sinir = birimTipi === 'entegre' ? 2400 : 4000;
  let tavan = null;
  let buyukBirim = false;
  if (nufus && nufus > 0) {
    if (nufus > sinir) buyukBirim = true;
    else tavan = sinir / nufus;
  }
  if (tutukluSayisi > 2000) buyukBirim = true;
  else if (tutukluSayisi > 1700) tavan = Math.min(tavan ?? Infinity, 1.176471);
  else if (tutukluSayisi >= 1500) tavan = Math.min(tavan ?? Infinity, 1.333334);
  if (tavan === Infinity) tavan = null;
  return { tavan, buyukBirim, sinir };
}

/** Katsayı muafiyetleri: maaşa esas puan < 1000 (md.7/6), yeni birim (md.7/7). */
export function muafiyetVarMi({ maasaEsasPuan = null, yeniBirimMuafiyeti = false } = {}) {
  if (yeniBirimMuafiyeti) return 'yeni-birim';
  if (maasaEsasPuan !== null && maasaEsasPuan !== undefined && maasaEsasPuan < 1000) return 'puan';
  return null;
}

/**
 * Bir ayın tam hesabı (AH veya ASÇ): satırlar {kod, gereken, yapilan, devreden}.
 * Dönüş: kriter bazlı ayrıntı, ham katsayı (çarpım), tavan sonrası katsayı, muafiyet.
 */
export function aylikHesap({ grup = 'AH', satirlar = [], birim = {}, devirIlkAy = true }) {
  const kriterler = grup === 'ASC' ? KRITERLER_ASC : KRITERLER_AH;
  const durum = birimDurumu(birim);
  const muafiyet = muafiyetVarMi(birim);
  const satirMap = new Map(satirlar.map((s) => [s.kod, s]));
  const ayrinti = kriterler.map((kriter) => {
    const s = satirMap.get(kriter.kod) || { gereken: 0, yapilan: 0, devreden: 0 };
    const oran = basariOrani(s, kriter, { devirIlkAy });
    const katsayi = oran.istisnaKatsayi1 ? 1 : kriterKatsayisi(oran.yuzde, kriter, { buyukBirim: durum.buyukBirim });
    const seviye = oran.yuzde === null ? 'yok' : oran.yuzde < kriter.asgari ? 'asgari-alti' : oran.yuzde >= kriter.azami ? 'azami' : 'arada';
    return {
      kriter, gereken: oran.yuzde === null ? 0 : Number(s.gereken) || 0, yapilan: Number(s.yapilan) || 0, devreden: Number(s.devreden) || 0,
      yuzde: oran.yuzde, kullanilanDevir: oran.kullanilanDevir, istisnaKatsayi1: oran.istisnaKatsayi1, devirSarti: oran.devirSarti,
      katsayi, seviye,
      asgariIcinKalan: hedefeKalan(s, kriter.asgari), azamiIcinKalan: hedefeKalan(s, kriter.azami),
    };
  });
  const ham = ayrinti.reduce((t, a) => t * a.katsayi, 1);
  let katsayi = ham;
  let tavanUygulandi = false;
  if (durum.tavan !== null && ham > durum.tavan) { katsayi = durum.tavan; tavanUygulandi = true; }
  if (muafiyet) katsayi = 1;
  return { grup, ayrinti, hamKatsayi: ham, katsayi, tavan: durum.tavan, buyukBirim: durum.buyukBirim, tavanUygulandi, muafiyet };
}

/**
 * ASÇ maaş çarpanı (md.7/3):
 *  a) ASÇ katsayısı < 1 → ASÇ'nin kendi katsayısı,
 *  b) ASÇ ≥ 1 ve birimin %75'inden küçük → ASÇ'nin kendi katsayısı,
 *  c) ASÇ ≥ 1 ve birimin %75'ine eşit/büyük → birim ile ASÇ'den büyük olanı.
 * Katsayılar tavan uygulanmış değerlerdir; muafiyet varsa 1.
 */
export function ascMaasCarpani({ kAsc, kBirim = null, muafiyet = null }) {
  if (muafiyet) return { carpan: 1, gecerli: 'muafiyet', esik: null };
  if (kAsc < 1) return { carpan: kAsc, gecerli: 'asc', esik: kBirim !== null ? 0.75 * kBirim : null };
  if (kBirim === null || kBirim === undefined) return { carpan: kAsc, gecerli: 'asc', esik: null };
  const esik = 0.75 * kBirim;
  if (kAsc >= esik) return { carpan: Math.max(kAsc, kBirim), gecerli: kBirim > kAsc ? 'birim' : 'asc', esik };
  return { carpan: kAsc, gecerli: 'asc', esik };
}

/**
 * Çok aylı devir zinciri (SİNA devreden sayısı elde yokken simülasyon için).
 * md.7/9-10: fazla en fazla 2 ay ileri; %10 şartı; kullanılan sayı devirden düşülür;
 * mevcut ayın yapılanı önce kendi hedefine sayılır, açık en eski uygun devirden kapanır.
 */
export function devirliGerceklesme(aylar, kriter = null) {
  const fazlalar = [];
  const azami = kriter ? kriter.azami : 90;
  return aylar.map(({ hedef, yapilan }, ay) => {
    hedef = Math.max(0, Number(hedef) || 0);
    yapilan = Math.max(0, Number(yapilan) || 0);
    const uygunlar = fazlalar.filter((f) => ay - f.kaynakAy <= DEVIR_PENCERESI_AY && f.kalan > 0);
    const devreden = uygunlar.reduce((t, f) => t + f.kalan, 0);
    let kullanilanDevir = 0;
    let istisnaKatsayi1 = false;
    if (hedef === 0) {
      if (yapilan > 0) fazlalar.push({ kaynakAy: ay, kalan: yapilan });
      return { hedef, yapilan, devreden, kullanilanDevir: 0, yuzde: null, istisnaKatsayi1: false };
    }
    if (yapilan >= DEVIR_KULLANIM_ESIGI * hedef) {
      let acik = Math.max(0, hedef - yapilan);
      for (const f of uygunlar) {
        if (acik <= 0) break;
        const kullan = Math.min(acik, f.kalan);
        f.kalan -= kullan; acik -= kullan; kullanilanDevir += kullan;
      }
    } else if (devreden > (azami / 100) * hedef && uygunlar.some((f) => ay - f.kaynakAy === 1)) {
      istisnaKatsayi1 = true;
    }
    if (yapilan > hedef) fazlalar.push({ kaynakAy: ay, kalan: yapilan - hedef });
    const yuzde = ((yapilan + kullanilanDevir) / hedef) * 100;
    return { hedef, yapilan, devreden, kullanilanDevir, yuzde, istisnaKatsayi1 };
  });
}

/** Maaş etkisi: brüt tutar × çarpan; fark ve yüzde. */
export function maasEtkisi(brut, carpan) {
  const b = Number(brut) || 0;
  return { brut: b, yeni: b * carpan, fark: b * (carpan - 1), yuzde: (carpan - 1) * 100 };
}
