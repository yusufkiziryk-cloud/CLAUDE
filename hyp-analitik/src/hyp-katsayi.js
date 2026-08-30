/**
 * HYP Analitik — Tarama ve Takip Katsayısı hesap motoru (ASÇ)
 *
 * Kaynak: "Aile Hekimliği Tarama ve Takip Katsayısına İlişkin Yönerge" (01.06.2025)
 * esas alınarak hazırlanan "ASÇ HYP Katsayı Hesabı 01.06.2025" bilgilendirme
 * dokümanı. Ayrıntılar: ../bilgi-tabani/katsayi-hesabi-asc.md
 *
 * Bu modül aile sağlığı çalışanı (ASÇ) tarafını kapsar. Aile hekimi tarafının
 * kriter seti (DM/HT/KVR/obezite tarama-izlemleri) ayrı katsayı aralıklarına
 * sahiptir ve doğrulanmış kaynak eklenene kadar bu motorda YOKTUR; hekim
 * katsayısı karşılaştırma için dışarıdan girilir.
 *
 * Bağımlılık yok; Node ve tarayıcıda aynı şekilde çalışır.
 */

/** ASÇ'nin sorumlu olduğu iki kriter ve katsayı bantları. */
export const KRITERLER = {
  vital: { ad: 'Vital Bulgular', altKatsayi: 0.93, ustKatsayi: 1.06 },
  cyysd: { ad: 'Çok Yönlü Yaşlı Sağlığı Değerlendirmesi', altKatsayi: 0.97, ustKatsayi: 1.13 },
};

export const ASGARI_BASARI = 50; // %
export const AZAMI_BASARI = 90; // %
export const DEVIR_PENCERESI_AY = 2; // fazla yapılan izlem en fazla 2 ay ileri devreder
export const DEVIR_KULLANIM_ESIGI = 0.10; // devir sayılması için o ay hedefin ≥ %10'u yapılmalı

/**
 * Tek kriterin katsayısı.
 * %50 altı → alt katsayı; %50 → 1; %50–90 arası doğrusal 1→üst; %90 ve üzeri → üst.
 * Hedefi 0 olan kriterde katsayı 1'dir (yüzde null geçilir).
 */
export function kriterKatsayisi(yuzde, kriter) {
  if (yuzde === null || yuzde === undefined || Number.isNaN(yuzde)) return 1;
  if (yuzde < ASGARI_BASARI) return kriter.altKatsayi;
  if (yuzde >= AZAMI_BASARI) return kriter.ustKatsayi;
  return 1 + ((yuzde - ASGARI_BASARI) / (AZAMI_BASARI - ASGARI_BASARI)) * (kriter.ustKatsayi - 1);
}

/**
 * Devir zinciriyle aylık gerçekleşme hesabı (tek kriter).
 *
 * Kurallar (Yönerge md.7/10):
 *  - %100'ü aşan sayılar en fazla 2 ay ileriye devreder (yapıldığı aya göre).
 *  - Devir, ilgili ay hedefinin en az %10'u yapılmışsa kullanılır.
 *  - Mevcut ayın yapılanı önce kendi hedefine sayılır; açık, en eski uygun
 *    devirden kapatılır. Kullanılmayan devir kendi yapıldığı ayın yaşıyla kalır.
 *  - İstisna (md.7/10-b): %10 şartı sağlanamamış ama devreden sayı o ay
 *    hedefinin %90'ından fazlaysa, yalnızca devrin İLK ayında kriter
 *    katsayısı 1 kabul edilir (istisnaKatsayi1 işaretlenir).
 *
 * @param {Array<{hedef:number, yapilan:number}>} aylar Kronolojik sırada aylık veriler.
 * @returns {Array<{hedef, yapilan, kullanilanDevir, sayilanToplam, yuzde, istisnaKatsayi1}>}
 */
export function devirliGerceklesme(aylar) {
  const fazlalar = []; // {kaynakAy, kalan}
  return aylar.map(({ hedef, yapilan }, ay) => {
    hedef = Math.max(0, Number(hedef) || 0);
    yapilan = Math.max(0, Number(yapilan) || 0);

    const uygunlar = fazlalar.filter((f) => ay - f.kaynakAy <= DEVIR_PENCERESI_AY && f.kalan > 0);
    let kullanilanDevir = 0;
    let istisnaKatsayi1 = false;

    if (hedef === 0) {
      // Hedef nüfusu 0 olan kriterde katsayı 1'dir; yüzde tanımsız.
      if (yapilan > 0) fazlalar.push({ kaynakAy: ay, kalan: yapilan });
      return { hedef, yapilan, kullanilanDevir: 0, sayilanToplam: yapilan, yuzde: null, istisnaKatsayi1: false };
    }

    if (yapilan >= DEVIR_KULLANIM_ESIGI * hedef) {
      let acik = Math.max(0, hedef - yapilan);
      for (const f of uygunlar) {
        if (acik <= 0) break;
        const kullan = Math.min(acik, f.kalan);
        f.kalan -= kullan;
        acik -= kullan;
        kullanilanDevir += kullan;
      }
    } else {
      const devredenToplam = uygunlar.reduce((t, f) => t + f.kalan, 0);
      const ilkDevirAyi = uygunlar.some((f) => ay - f.kaynakAy === 1);
      if (ilkDevirAyi && devredenToplam > (AZAMI_BASARI / 100) * hedef) istisnaKatsayi1 = true;
    }

    if (yapilan > hedef) fazlalar.push({ kaynakAy: ay, kalan: yapilan - hedef });

    const sayilanToplam = Math.min(hedef, yapilan + kullanilanDevir);
    const yuzde = ((yapilan + kullanilanDevir) / hedef) * 100;
    return { hedef, yapilan, kullanilanDevir, sayilanToplam, yuzde, istisnaKatsayi1 };
  });
}

/**
 * Birim tipine ve nüfusa göre tarama-takip katsayısı tavanı.
 * Normal birim: min(1,5; 4000/nüfus). Entegre / zorunlu düşük nüfus: min(1,5; 2400/nüfus).
 * Tutuklu-hükümlü kayıtlı sayısı 1700 üzeri → 1,176471; 1500–1700 → 1,333334 tavanı ayrıca uygulanır.
 * Not: Normal birim nüfusu mevzuat gereği ~4000'i aşmaz; 4000 üzeri girişte tavan 1'in altına iner
 * (doküman "geçemez" der; giriş doğrulaması UI katmanındadır).
 */
export function tavanKatsayisi({ birimTipi = 'normal', nufus, tutukluSayisi = 0 }) {
  let tavan = 1.5;
  if (nufus && nufus > 0) {
    const pay = birimTipi === 'entegre' ? 2400 : 4000;
    tavan = Math.min(tavan, pay / nufus);
  }
  if (tutukluSayisi > 1700) tavan = Math.min(tavan, 1.176471);
  else if (tutukluSayisi >= 1500) tavan = Math.min(tavan, 1.333334);
  return tavan;
}

/**
 * ASÇ maaş çarpanı.
 *  - Maaşa esas puan < 1000 veya yeni birim muafiyeti → 1.
 *  - Katsayı < 1 → maaş doğrudan bu katsayıyla çarpılır.
 *  - Katsayı ≥ 1 ve hekim katsayısının %75'ine ulaşıyorsa → yüksek olan geçerli.
 *  - Aksi halde ASÇ'nin kendi katsayısı geçerli.
 * Tavan hem ASÇ hem hekim katsayısına uygulanır.
 */
export function maasCarpani({ kAsc, kHekim = null, tavan = 1.5, puanMuafiyeti = false, yeniBirimMuafiyeti = false }) {
  if (puanMuafiyeti || yeniBirimMuafiyeti) {
    return { carpan: 1, gecerli: 'muafiyet' };
  }
  const asc = Math.min(kAsc, tavan);
  const hekim = kHekim === null || kHekim === undefined ? null : Math.min(kHekim, tavan);
  if (asc < 1) return { carpan: asc, gecerli: 'asc' };
  if (hekim !== null && asc >= 0.75 * hekim && hekim > asc) {
    return { carpan: hekim, gecerli: 'hekim' };
  }
  return { carpan: asc, gecerli: 'asc' };
}

/**
 * Uçtan uca aylık hesap: iki kriterin aylık {hedef, yapilan} serilerinden
 * her ay için kriter katsayıları, tarama-takip katsayısı ve maaş çarpanı.
 *
 * @param {Object} girdi
 * @param {Array<{hedef:number, yapilan:number}>} girdi.vital
 * @param {Array<{hedef:number, yapilan:number}>} girdi.cyysd
 * @param {Object} girdi.birim {birimTipi, nufus, tutukluSayisi, maasaEsasPuan, yeniBirimMuafiyeti}
 * @param {Array<number|null>} [girdi.hekimKatsayilari] Aylık hekim katsayısı (biliniyorsa).
 */
export function hesaplaDonem({ vital, cyysd, birim = {}, hekimKatsayilari = [] }) {
  const vitalSonuc = devirliGerceklesme(vital);
  const cyysdSonuc = devirliGerceklesme(cyysd);
  const tavan = tavanKatsayisi(birim);
  const puanMuafiyeti = birim.maasaEsasPuan !== undefined && birim.maasaEsasPuan !== null && birim.maasaEsasPuan < 1000;

  const aySayisi = Math.max(vitalSonuc.length, cyysdSonuc.length);
  const aylar = [];
  for (let i = 0; i < aySayisi; i++) {
    const v = vitalSonuc[i];
    const c = cyysdSonuc[i];
    const vitalK = v ? (v.istisnaKatsayi1 ? 1 : kriterKatsayisi(v.yuzde, KRITERLER.vital)) : 1;
    const cyysdK = c ? (c.istisnaKatsayi1 ? 1 : kriterKatsayisi(c.yuzde, KRITERLER.cyysd)) : 1;
    const ham = vitalK * cyysdK;
    const kAsc = Math.min(ham, tavan);
    const maas = maasCarpani({
      kAsc: ham,
      kHekim: hekimKatsayilari[i] ?? null,
      tavan,
      puanMuafiyeti,
      yeniBirimMuafiyeti: !!birim.yeniBirimMuafiyeti,
    });
    aylar.push({ vital: v, cyysd: c, vitalK, cyysdK, katsayi: kAsc, hamKatsayi: ham, maas });
  }
  return { aylar, tavan, puanMuafiyeti };
}
