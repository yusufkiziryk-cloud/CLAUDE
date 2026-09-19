#!/usr/bin/env node
/**
 * Satıcı anahtar çifti üretir (ECDSA P-256).
 *   node tools/lisans/anahtar-uret.js [kid]
 * Çıktı:
 *   tools/lisans/.gizli/<kid>.ozel.pem   → ÖZEL anahtar; ASLA paylaşmayın/commit'lemeyin (.gitignore'da)
 *   tools/lisans/<kid>.acik.json          → AÇIK anahtar (JWK); uygulamaya gömülür
 */
import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const kok = dirname(fileURLToPath(import.meta.url));
const kid = process.argv[2] || 'uretim';
const gizli = join(kok, '.gizli');
mkdirSync(gizli, { recursive: true });
const ozelYol = join(gizli, `${kid}.ozel.pem`);
if (existsSync(ozelYol)) { console.error(`Zaten var: ${ozelYol} — üzerine yazılmadı.`); process.exit(1); }

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
writeFileSync(ozelYol, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
const jwk = publicKey.export({ format: 'jwk' });
const acik = { kid, kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y };
writeFileSync(join(kok, `${kid}.acik.json`), JSON.stringify(acik, null, 2) + '\n');
console.log('Özel anahtar :', ozelYol);
console.log('Açık anahtar :', join(kok, `${kid}.acik.json`));
console.log('\nUygulamaya gömülecek JWK:\n' + JSON.stringify(acik));
