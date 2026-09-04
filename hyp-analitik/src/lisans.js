/**
 * HYP Analitik — Lisans anahtarı doğrulama (istemci tarafı)
 *
 * Anahtar biçimi:  HYPA1.<payload-base64url>.<imza-base64url>
 *  - payload: UTF-8 JSON {v:1, id, kid, plan, ad, eposta?, bitis:'YYYY-MM-DD', cihaz, not?}
 *  - imza: ECDSA P-256 / SHA-256, IEEE P1363 (r||s, 64 bayt), payload metni üzerinde
 * Doğrulama WebCrypto ile yapılır (tarayıcı ve Node 20+ aynı API).
 * Açık anahtar (JWK) uygulamaya gömülür; özel anahtar yalnızca satıcıda kalır.
 */

export const LISANS_ONEKI = 'HYPA1';

/** Plan tanımları (config/planlar.json ile eş). Fiyatlar satıcı tarafından doldurulur. */
export const PLANLAR = {
  DEMO:               { ad: 'Ücretsiz Deneme',               donemSiniri: 3,    ozellikler: ['veri_okuma', 'yedekleme', 'geri_yukleme', 'filigranli_cikti'] },
  OFFLINE_INDIVIDUAL: { ad: 'Çevrimdışı Bireysel (yıllık)',  donemSiniri: null, ozellikler: ['veri_okuma', 'yedekleme', 'geri_yukleme', 'sinirsiz_hesap', 'temiz_cikti', 'tam_disa_aktarim', 'offline_indirme'] },
  SAAS_STANDARD:      { ad: 'Online Standart (yıllık)',       donemSiniri: null, ozellikler: ['veri_okuma', 'yedekleme', 'geri_yukleme', 'sinirsiz_hesap', 'temiz_cikti', 'tam_disa_aktarim'] },
  HYBRID_PRO:         { ad: 'Hibrit Pro (yıllık)',            donemSiniri: null, ozellikler: ['veri_okuma', 'yedekleme', 'geri_yukleme', 'sinirsiz_hesap', 'temiz_cikti', 'tam_disa_aktarim', 'offline_indirme'] },
  INSTITUTIONAL:      { ad: 'Kurumsal (özel teklif)',         donemSiniri: null, ozellikler: ['veri_okuma', 'yedekleme', 'geri_yukleme', 'sinirsiz_hesap', 'temiz_cikti', 'tam_disa_aktarim', 'offline_indirme', 'coklu_kullanici'] },
};

const b64urlCoz = (s) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function acikAnahtariIceAktar(jwk) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto yok');
  return subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
}

/**
 * Anahtarı çözer ve imzayı doğrular.
 * @returns {Promise<{gecerli:boolean, neden?:string, lisans?:object, plan?:object}>}
 */
export async function lisansCoz(anahtarMetni, acikJwk, { bugun = new Date() } = {}) {
  try {
    const parcalar = String(anahtarMetni || '').trim().split('.');
    if (parcalar.length !== 3 || parcalar[0] !== LISANS_ONEKI) return { gecerli: false, neden: 'Biçim tanınmadı' };
    if (!acikJwk) return { gecerli: false, neden: 'Satıcı açık anahtarı tanımlı değil' };
    const payloadBayt = b64urlCoz(parcalar[1]);
    const imza = b64urlCoz(parcalar[2]);
    const key = await acikAnahtariIceAktar(acikJwk);
    const dogru = await globalThis.crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, imza, payloadBayt);
    if (!dogru) return { gecerli: false, neden: 'İmza geçersiz' };
    const lisans = JSON.parse(new TextDecoder().decode(payloadBayt));
    if (lisans.v !== 1) return { gecerli: false, neden: 'Sürüm desteklenmiyor' };
    if (acikJwk.kid && lisans.kid && lisans.kid !== acikJwk.kid) return { gecerli: false, neden: 'Anahtar kimliği uyuşmuyor' };
    const plan = PLANLAR[lisans.plan];
    if (!plan) return { gecerli: false, neden: 'Bilinmeyen plan' };
    const bitis = new Date(lisans.bitis + 'T23:59:59');
    if (Number.isNaN(bitis.getTime())) return { gecerli: false, neden: 'Bitiş tarihi okunamadı' };
    if (bitis < bugun) return { gecerli: false, neden: `Süresi ${lisans.bitis} tarihinde doldu`, lisans, plan };
    return { gecerli: true, lisans, plan };
  } catch (hata) {
    return { gecerli: false, neden: 'Doğrulama hatası: ' + (hata.message || hata) };
  }
}

/** Plan bir özelliği içeriyor mu? */
export function ozellikVar(planKodu, ozellik) {
  return (PLANLAR[planKodu] || PLANLAR.DEMO).ozellikler.includes(ozellik);
}
