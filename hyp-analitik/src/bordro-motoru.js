/**
 * HYP Analitik — Bordro (brüt → net) simülasyon motoru
 *
 * Tasarım kaynağı: bilgi-tabani/kamu-maas (05 vergi/SGK/kesinti motoru,
 * 06 kural sürümleme, 07 hesap sırası, 14 fail-closed kuralları).
 *
 * İlkeler:
 *  - Kod içinde sihirli sayı yok; tüm parametreler kurallar/*.json'dan, tarihe göre seçilir.
 *  - Kural bulunamazsa veya durumu CONFLICT/RETIRED ise sonuç KİLİTLİ (fail-closed).
 *  - Kullanılan kurallardan biri VERIFIED değilse sonuç "TAHMİNİ" etiketlenir.
 *  - Her kalemin vergi/prim/damga niteliği adından değil, kalem profilinden gelir.
 *  - Çıktı yalnız net değil, açıklama zinciridir (hangi kural, hangi sürüm, hangi matrah).
 *
 * Kapsam: ücret niteliğindeki brüt kalemlerden kişi kesintileri (5510 4/c veya 5434),
 * kümülatif gelir vergisi, damga vergisi, isteğe bağlı diğer kesintiler ve işveren maliyeti.
 * Kapsam dışı: kalemlerin nasıl oluştuğu (puan × katsayı vb.); bu, rejim adaptörlerinin işidir.
 */

export const SOSYAL_GUVENLIK = {
  SGK_5510_4C: 'SGK_5510_4C',
  PENSION_5434: 'PENSION_5434',
  BELIRSIZ: 'BELIRSIZ',
};

/** Verilen tarihte yürürlükte olan kural sürümünü seçer (en yüksek sürüm öncelikli). */
export function kuralSec(kurallar, ruleId, tarih) {
  const t = String(tarih);
  const adaylar = (kurallar || [])
    .filter((k) => k.rule_id === ruleId && k.effective_from <= t && (k.effective_to === null || k.effective_to === undefined || k.effective_to >= t))
    .sort((a, b) => b.version - a.version);
  return adaylar[0] || null;
}

/** Kümülatif matrah üzerinden dilimli gelir vergisi. Önceki kümülatif matrah zorunlu girdidir (05 §2). */
export function gelirVergisi(matrah, oncekiKumulatif, dilimler) {
  const bas = Math.max(0, Number(oncekiKumulatif) || 0);
  const m = Math.max(0, Number(matrah) || 0);
  const son = bas + m;
  const parcalar = [];
  let vergi = 0;
  let altSinir = 0;
  for (const d of dilimler) {
    const ust = d.ustSinir === null ? Infinity : d.ustSinir;
    const kesisimAlt = Math.max(bas, altSinir);
    const kesisimUst = Math.min(son, ust);
    if (kesisimUst > kesisimAlt) {
      const tutar = kesisimUst - kesisimAlt;
      parcalar.push({ oran: d.oran, matrah: tutar, vergi: tutar * d.oran });
      vergi += tutar * d.oran;
    }
    altSinir = ust;
    if (son <= ust) break;
  }
  return { vergi, parcalar, yeniKumulatif: son };
}

const yuvarla = (x) => Math.round((Number(x) + Number.EPSILON) * 100) / 100;
const tl = (x) => yuvarla(x).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
const yuzde = (oran) => '%' + yuvarla(oran * 100).toLocaleString('tr-TR', { maximumFractionDigits: 2 });

/**
 * Bordro hesabı.
 * @param {Object} g
 * @param {string} g.tarih Hesap tarihi (YYYY-MM-DD); kural sürümünü seçer.
 * @param {Array}  g.kalemler [{kod, ad, brut, gelirVergisi, damga, sgkPek, aciklama}]
 * @param {string} g.sosyalGuvenlik SGK_5510_4C | PENSION_5434 | BELIRSIZ
 * @param {number} g.oncekiKumulatifMatrah Takvim yılı içinde önceki aylardan gelen GV matrahı
 * @param {Array}  g.digerKesintiler [{ad, tutar}] (sendika, BES, icra... kullanıcı girişi)
 * @param {Array}  g.kurallar Kural listesi (kurallar/*.json → kurallar)
 */
export function bordroHesapla({ tarih, kalemler = [], sosyalGuvenlik = SOSYAL_GUVENLIK.BELIRSIZ, oncekiKumulatifMatrah = 0, digerKesintiler = [], kurallar = [] }) {
  const uyarilar = [];
  const kilitNedenleri = [];
  const kullanilan = [];
  const aciklama = [];
  const kural = (id) => {
    const k = kuralSec(kurallar, id, tarih);
    if (k) kullanilan.push({ rule_id: k.rule_id, version: k.version, status: k.status, kaynak: k.source?.document_name || '', url: k.source?.official_url || null });
    return k;
  };

  // 1) Kalemleri topla
  const satirlar = kalemler.map((k) => {
    const brut = Math.max(0, Number(k.brut) || 0);
    if (k.gelirVergisi === undefined || k.damga === undefined || k.sgkPek === undefined) {
      uyarilar.push(`UNRESOLVED_PAY_ITEM: "${k.ad || k.kod}" kaleminin vergi/prim profili eksik; kalem hesaba katılmadı.`);
      return { ...k, brut, dahil: false };
    }
    return { ...k, brut, dahil: true };
  });
  const dahil = satirlar.filter((s) => s.dahil);
  const brutToplam = dahil.reduce((t, s) => t + s.brut, 0);
  aciklama.push(`Brüt hakediş: ${dahil.length} kalem, toplam ${tl(brutToplam)}.`);

  // 2) Sosyal güvenlik kişi payı (fail-closed: rejim belirsizse kilit)
  let sgKisi = 0, sgIsveren = 0, sgMatrah = 0;
  if (sosyalGuvenlik === SOSYAL_GUVENLIK.SGK_5510_4C) {
    const k = kural('SGK_5510_4C_ORANLARI');
    if (!k) kilitNedenleri.push('5510 4/c oranları için yürürlükte kural bulunamadı.');
    else {
      sgMatrah = dahil.filter((s) => s.sgkPek).reduce((t, s) => t + s.brut, 0);
      sgKisi = sgMatrah * (k.parameters.myoKisi + k.parameters.gssKisi);
      sgIsveren = sgMatrah * (k.parameters.myoIsveren + k.parameters.gssIsveren);
      aciklama.push(`5510 4/c: PEK ${tl(sgMatrah)} × (${yuzde(k.parameters.myoKisi)} MYÖ + ${yuzde(k.parameters.gssKisi)} GSS) = kişi payı ${tl(sgKisi)}; işveren ${yuzde(k.parameters.myoIsveren + k.parameters.gssIsveren)} = ${tl(sgIsveren)}.`);
    }
  } else if (sosyalGuvenlik === SOSYAL_GUVENLIK.PENSION_5434) {
    const k = kural('EMEKLI_5434_ORANLARI');
    if (!k) kilitNedenleri.push('5434 kesenek oranları için yürürlükte kural bulunamadı.');
    else {
      sgMatrah = dahil.filter((s) => s.sgkPek).reduce((t, s) => t + s.brut, 0);
      sgKisi = sgMatrah * k.parameters.sahisKesenegi;
      sgIsveren = sgMatrah * k.parameters.kurumKarsiligi;
      uyarilar.push('5434: emekli keseneğine esas aylık, brüt kalemlerle aynı kavram değildir; kesenek matrahı olarak PEK işaretli kalemler kullanıldı. %100 artış farkı ve kurum GSS payı hesaba alınmadı.');
      aciklama.push(`5434: kesenek matrahı ${tl(sgMatrah)} × ${yuzde(k.parameters.sahisKesenegi)} = ${tl(sgKisi)}; kurum karşılığı ${yuzde(k.parameters.kurumKarsiligi)} = ${tl(sgIsveren)}.`);
    }
  } else {
    kilitNedenleri.push('Sosyal güvenlik rejimi belirsiz (5510 4/c mi, 5434 mü?). Sonucu etkilediği için hesap kilitlendi.');
  }

  // 3) Gelir vergisi matrahı ve vergi
  let gvMatrah = 0, gv = 0, gvParcalar = [], yeniKumulatif = Number(oncekiKumulatifMatrah) || 0;
  const tarife = kural('GV_UCRET_TARIFESI');
  if (!tarife) kilitNedenleri.push('Hesap tarihine ait gelir vergisi tarifesi bulunamadı.');
  else {
    const vergiyeTabi = dahil.filter((s) => s.gelirVergisi).reduce((t, s) => t + s.brut, 0);
    const indirim = kural('GVK_63_PRIM_INDIRIMI');
    const primIndirimi = indirim && indirim.parameters.kisiPrimleriMatrahtanDusulur ? sgKisi : 0;
    gvMatrah = Math.max(0, vergiyeTabi - primIndirimi);
    const istisna = kural('ASGARI_UCRET_GV_ISTISNASI');
    if (!istisna || istisna.status === 'RESEARCH_REQUIRED' || istisna.parameters.aylikIstisnaMatrahi === null) {
      uyarilar.push('Asgari ücret gelir vergisi istisnası uygulanmadı: 2026 istisna parametresi doğrulanmadı. Net, gerçek bordrodan bu istisna kadar düşük görünür.');
    } else {
      const kullanilanIstisna = Math.min(gvMatrah, istisna.parameters.aylikIstisnaMatrahi);
      gvMatrah -= kullanilanIstisna;
      aciklama.push(`Asgari ücret istisnası: matrahtan ${tl(kullanilanIstisna)} düşüldü (aylık havuz bir kez).`);
    }
    const sonuc = gelirVergisi(gvMatrah, oncekiKumulatifMatrah, tarife.parameters.dilimler);
    gv = sonuc.vergi; gvParcalar = sonuc.parcalar; yeniKumulatif = sonuc.yeniKumulatif;
    aciklama.push(`Gelir vergisi: vergiye tabi ${tl(vergiyeTabi)} − kişi primi ${tl(primIndirimi)} = matrah ${tl(gvMatrah)}; önceki kümülatif ${tl(oncekiKumulatifMatrah)} → ${gvParcalar.map((p) => `${yuzde(p.oran)}: ${tl(p.matrah)}`).join(', ')} → vergi ${tl(gv)}.`);
  }

  // 4) Damga vergisi
  let damga = 0;
  const damgaK = kural('DAMGA_UCRET_ORANI');
  if (!damgaK) kilitNedenleri.push('Damga vergisi oranı için kural bulunamadı.');
  else {
    const damgaMatrah = dahil.filter((s) => s.damga).reduce((t, s) => t + s.brut, 0);
    damga = damgaMatrah * damgaK.parameters.oran;
    aciklama.push(`Damga vergisi: ${tl(damgaMatrah)} × binde ${yuvarla(damgaK.parameters.oran * 1000).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} = ${tl(damga)}.`);
  }

  // 5) Diğer kesintiler ve net (05 §7 sırası)
  const diger = (digerKesintiler || []).reduce((t, d) => t + Math.max(0, Number(d.tutar) || 0), 0);
  const net = brutToplam - sgKisi - gv - damga - diger;
  const isverenMaliyeti = brutToplam + sgIsveren;

  const durum = kilitNedenleri.length ? 'KILITLI' : 'TAMAM';
  const tamamiDogrulanmis = kullanilan.length > 0 && kullanilan.every((k) => k.status === 'VERIFIED');
  const etiket = durum === 'KILITLI' ? 'KİLİTLİ' : tamamiDogrulanmis && !uyarilar.length ? 'DOĞRULANMIŞ KURALLARLA' : 'TAHMİNİ / SİMÜLASYON';
  kullanilan.forEach((k) => { if (['CONFLICT', 'RETIRED'].includes(k.status)) kilitNedenleri.push(`${k.rule_id} v${k.version} durumu ${k.status}; sessiz kullanılamaz.`); });

  return {
    durum: kilitNedenleri.length ? 'KILITLI' : 'TAMAM',
    etiket: kilitNedenleri.length ? 'KİLİTLİ' : etiket,
    kilitNedenleri, uyarilar, kullanilanKurallar: kullanilan, aciklama,
    satirlar,
    ozet: {
      brutToplam: yuvarla(brutToplam), sgMatrah: yuvarla(sgMatrah), sgKisi: yuvarla(sgKisi), sgIsveren: yuvarla(sgIsveren),
      gvMatrah: yuvarla(gvMatrah), gelirVergisi: yuvarla(gv), damgaVergisi: yuvarla(damga), digerKesintiler: yuvarla(diger),
      net: yuvarla(net), isverenMaliyeti: yuvarla(isverenMaliyeti), yeniKumulatifMatrah: yuvarla(yeniKumulatif),
      ham: { brutToplam, sgKisi, sgIsveren, gvMatrah, gelirVergisi: gv, damgaVergisi: damga, net, isverenMaliyeti },
    },
  };
}

/**
 * Aile hekimliği ödemesinde tarama-takip katsayısı yalnızca kayıtlı kişi ödemesine
 * uygulanır (Yönerge md.3 → Ödeme Yönetmeliği md.18/2-a-6 ve md.21/2-a-6).
 * Kalemlerden `katsayiyaTabi: true` olanlar çarpanla çarpılır; diğerleri aynen kalır.
 */
export function katsayiUygula(kalemler, carpan) {
  const c = Number(carpan);
  if (!Number.isFinite(c) || c <= 0) return kalemler.map((k) => ({ ...k }));
  return kalemler.map((k) => (k.katsayiyaTabi ? { ...k, brutOncesi: k.brut, brut: (Number(k.brut) || 0) * c } : { ...k }));
}

/**
 * İki senaryo arasındaki net farkı verir (ör. katsayı 1,05 → 1,08 olsa net ne kadar artar).
 */
export function netFark(girdi, carpanA, carpanB) {
  const a = bordroHesapla({ ...girdi, kalemler: katsayiUygula(girdi.kalemler, carpanA) });
  const b = bordroHesapla({ ...girdi, kalemler: katsayiUygula(girdi.kalemler, carpanB) });
  if (a.durum !== 'TAMAM' || b.durum !== 'TAMAM') return null;
  return { netA: a.ozet.net, netB: b.ozet.net, fark: yuvarla(b.ozet.ham.net - a.ozet.ham.net), brutFark: yuvarla(b.ozet.ham.brutToplam - a.ozet.ham.brutToplam) };
}
