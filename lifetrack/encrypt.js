#!/usr/bin/env node
// Wraps lifetrack.html in AES-256-GCM encryption with a password prompt.
import { createCipheriv, pbkdf2Sync, randomBytes } from 'crypto'
import { readFileSync, writeFileSync } from 'fs'

const PASSWORD = '5839526'
const inFile = 'dist/lifetrack.html'
const outFile = 'dist/lifetrack-encrypted.html'

const plain = readFileSync(inFile, 'utf8')
const salt = randomBytes(16)
const iv = randomBytes(12)
const key = pbkdf2Sync(PASSWORD, salt, 100000, 32, 'sha256')
const cipher = createCipheriv('aes-256-gcm', key, iv)
const encBuf = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
const tag = cipher.getAuthTag()
const enc = encBuf.toString('base64')

const payload = {
  salt: salt.toString('base64'),
  iv: iv.toString('base64'),
  tag: tag.toString('base64'),
  data: enc,
}

const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LifeTrack — Şifreli</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; font-family: system-ui, sans-serif; }
  .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 40px; width: 340px; text-align: center; }
  h1 { color: #f1f5f9; font-size: 22px; margin-bottom: 6px; }
  p { color: #94a3b8; font-size: 13px; margin-bottom: 24px; }
  input { width: 100%; padding: 12px 16px; background: #0f172a; border: 1px solid #475569; border-radius: 10px; color: #f1f5f9; font-size: 20px; letter-spacing: 4px; text-align: center; outline: none; margin-bottom: 14px; }
  input:focus { border-color: #6366f1; }
  button { width: 100%; padding: 12px; background: #6366f1; color: white; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }
  button:hover { background: #4f46e5; }
  button:disabled { opacity: 0.6; cursor: not-allowed; }
  .err { color: #f87171; font-size: 13px; margin-top: 10px; min-height: 18px; }
  .spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<div class="card">
  <h1>🔒 LifeTrack</h1>
  <p>Kişisel Hafıza Merkezi<br>Devam etmek için şifrenizi girin.</p>
  <input type="password" id="pw" placeholder="••••••••" autofocus />
  <button id="btn" onclick="unlock()">Aç</button>
  <div class="err" id="err"></div>
</div>
<script>
const P = ${JSON.stringify(payload)};
async function unlock() {
  const pw = document.getElementById('pw').value;
  if (!pw) return;
  const btn = document.getElementById('btn');
  const errEl = document.getElementById('err');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Açılıyor...';
  errEl.textContent = '';
  await new Promise(r => setTimeout(r, 10));
  try {
    const enc = new TextEncoder();
    const keyMat = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']);
    const saltBuf = Uint8Array.from(atob(P.salt), c => c.charCodeAt(0));
    const ivBuf = Uint8Array.from(atob(P.iv), c => c.charCodeAt(0));
    const tagBuf = Uint8Array.from(atob(P.tag), c => c.charCodeAt(0));
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: saltBuf, iterations: 100000, hash: 'SHA-256' },
      keyMat, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
    );
    const dataBuf = Uint8Array.from(atob(P.data), c => c.charCodeAt(0));
    const combined = new Uint8Array(dataBuf.length + tagBuf.length);
    combined.set(dataBuf); combined.set(tagBuf, dataBuf.length);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBuf }, key, combined);
    const html = new TextDecoder().decode(plain);
    document.open(); document.write(html); document.close();
  } catch(e) {
    errEl.textContent = 'Yanlış şifre. Tekrar deneyin.';
    btn.disabled = false;
    btn.innerHTML = 'Aç';
  }
}
document.getElementById('pw').addEventListener('keydown', e => { if (e.key === 'Enter') unlock(); });
</script>
</body>
</html>`

writeFileSync(outFile, html)
console.log(`Written: ${outFile} (${Math.round(html.length / 1024)} KB)`)
