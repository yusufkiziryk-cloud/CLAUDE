#!/usr/bin/env node
/**
 * Tek dosyalık uygulamayı derler:
 *   node tools/derle.js                 → hyp-analitik.html (tam belge)
 *   node tools/derle.js --artifact ÇIKTI → sarmalayıcısız sürüm (Artifact/önizleme)
 * app/sablon.html içindeki yer tutucular:
 *   /*__MOTOR__*\/    → src/hyp-katsayi.js (export'lar soyulmuş)
 *   /*__LISANS__*\/   → src/lisans.js (export'lar soyulmuş)
 *   __ACIK_ANAHTAR__  → tools/lisans/<kid>.acik.json (varsayılan: dev)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const kok = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (ad) => { const i = process.argv.indexOf('--' + ad); return i > -1 ? process.argv[i + 1] : null; };
const kid = arg('kid') || 'dev';

const soy = (kaynak) => readFileSync(join(kok, kaynak), 'utf8')
  .replace(/^export\s+(const|function|async function|let)\s/gm, '$1 ')
  .replace(/^export\s*\{[^}]*\};?\s*$/gm, '');

const anahtarYolu = join(kok, 'tools', 'lisans', `${kid}.acik.json`);
const acikAnahtar = existsSync(anahtarYolu) ? readFileSync(anahtarYolu, 'utf8').trim() : 'null';

let html = readFileSync(join(kok, 'app', 'sablon.html'), 'utf8')
  .replace('/*__MOTOR__*/', () => soy('src/hyp-katsayi.js'))
  .replace('/*__LISANS__*/', () => soy('src/lisans.js'))
  .replace('__ACIK_ANAHTAR__', () => acikAnahtar)
  .replace('__DERLEME_ZAMANI__', () => new Date().toISOString().slice(0, 10));

const artifactYolu = arg('artifact');
if (artifactYolu) {
  const blok = (bas, son) => html.split(bas, 2)[1].split(son, 1)[0];
  const cikti = '<title>HYP Analitik</title>\n' + blok('<!-- APP-HEAD-START -->', '<!-- APP-HEAD-END -->').trim()
    + '\n' + blok('<!-- APP-BODY-START -->', '<!-- APP-BODY-END -->').trim() + '\n';
  writeFileSync(artifactYolu, cikti);
  console.log('artifact:', artifactYolu, cikti.length, 'bayt');
} else {
  writeFileSync(join(kok, 'hyp-analitik.html'), html);
  console.log('hyp-analitik.html', html.length, 'bayt | anahtar:', kid);
}
