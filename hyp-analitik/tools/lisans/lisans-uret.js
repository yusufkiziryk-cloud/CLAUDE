#!/usr/bin/env node
/**
 * Lisans anahtarı üretir ve imzalar.
 *   node tools/lisans/lisans-uret.js --plan SAAS_STANDARD --ad "Dr. Ayşe Yılmaz" --bitis 2027-09-04 [--eposta x@y] [--cihaz 3] [--kid uretim] [--not "..."]
 * Çıktı: HYPA1.<payload>.<imza>  (kullanıcıya e-posta/WhatsApp ile iletilir)
 */
import { createPrivateKey, sign, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (ad, varsayilan) => { const i = process.argv.indexOf('--' + ad); return i > -1 ? process.argv[i + 1] : varsayilan; };
const kok = dirname(fileURLToPath(import.meta.url));
const kid = arg('kid', 'uretim');
const plan = arg('plan');
const ad = arg('ad');
const bitis = arg('bitis');
if (!plan || !ad || !bitis || !/^\d{4}-\d{2}-\d{2}$/.test(bitis)) {
  console.error('Kullanım: --plan PLAN --ad "Ad Soyad" --bitis YYYY-MM-DD [--eposta] [--cihaz N] [--kid] [--not]');
  process.exit(1);
}
const payload = {
  v: 1,
  id: randomBytes(6).toString('hex'),
  kid,
  plan,
  ad,
  ...(arg('eposta') ? { eposta: arg('eposta') } : {}),
  bitis,
  cihaz: Number(arg('cihaz', 3)),
  ...(arg('not') ? { not: arg('not') } : {}),
  olusturma: new Date().toISOString().slice(0, 10),
};
const ozel = createPrivateKey(readFileSync(join(kok, '.gizli', `${kid}.ozel.pem`)));
const payloadMetni = JSON.stringify(payload);
const imza = sign('sha256', Buffer.from(payloadMetni, 'utf8'), { key: ozel, dsaEncoding: 'ieee-p1363' });
const b64url = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
console.log(`HYPA1.${b64url(payloadMetni)}.${b64url(imza)}`);
