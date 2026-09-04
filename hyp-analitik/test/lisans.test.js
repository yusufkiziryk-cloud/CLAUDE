import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { lisansCoz, ozellikVar } from '../src/lisans.js';

const b64url = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = publicKey.export({ format: 'jwk' });
const acik = { kid: 'test', kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y };
const uret = (payload) => {
  const m = JSON.stringify(payload);
  const imza = sign('sha256', Buffer.from(m, 'utf8'), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `HYPA1.${b64url(m)}.${b64url(imza)}`;
};

test('geçerli lisans doğrulanır ve plan çözülür', async () => {
  const anahtar = uret({ v: 1, id: 'abc', kid: 'test', plan: 'SAAS_STANDARD', ad: 'Dr. Test', bitis: '2099-01-01', cihaz: 3 });
  const s = await lisansCoz(anahtar, acik);
  assert.equal(s.gecerli, true);
  assert.equal(s.plan.ad, 'Online Standart (yıllık)');
  assert.equal(s.lisans.ad, 'Dr. Test');
});

test('kurcalanmış payload reddedilir', async () => {
  const anahtar = uret({ v: 1, id: 'abc', kid: 'test', plan: 'DEMO', ad: 'X', bitis: '2099-01-01', cihaz: 1 });
  const [on, p, imza] = anahtar.split('.');
  const sahte = b64url(JSON.stringify({ v: 1, id: 'abc', kid: 'test', plan: 'INSTITUTIONAL', ad: 'X', bitis: '2099-01-01', cihaz: 99 }));
  const s = await lisansCoz(`${on}.${sahte}.${imza}`, acik);
  assert.equal(s.gecerli, false);
  assert.equal(s.neden, 'İmza geçersiz');
});

test('süresi dolmuş lisans reddedilir; yanlış açık anahtar reddedilir', async () => {
  const eski = uret({ v: 1, id: 'e', kid: 'test', plan: 'HYBRID_PRO', ad: 'X', bitis: '2020-01-01', cihaz: 5 });
  const s = await lisansCoz(eski, acik);
  assert.equal(s.gecerli, false);
  assert.match(s.neden, /Süresi/);
  const baska = generateKeyPairSync('ec', { namedCurve: 'P-256' }).publicKey.export({ format: 'jwk' });
  const s2 = await lisansCoz(uret({ v: 1, id: 'z', kid: 'test', plan: 'DEMO', ad: 'X', bitis: '2099-01-01', cihaz: 1 }), { kid: 'test', x: baska.x, y: baska.y });
  assert.equal(s2.gecerli, false);
});

test('biçim hataları ve plan özellikleri', async () => {
  assert.equal((await lisansCoz('abc', acik)).gecerli, false);
  assert.equal((await lisansCoz('HYPA1.a.b', null)).neden, 'Satıcı açık anahtarı tanımlı değil');
  assert.equal(ozellikVar('DEMO', 'filigranli_cikti'), true);
  assert.equal(ozellikVar('DEMO', 'temiz_cikti'), false);
  assert.equal(ozellikVar('INSTITUTIONAL', 'coklu_kullanici'), true);
});
