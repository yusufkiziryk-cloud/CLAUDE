'use strict';

/**
 * LAN Camera & File Share — signaling + static server
 *
 * Bağımlılık yok: yalnızca Node.js yerleşik modülleri kullanılır.
 * - Kendinden imzalı HTTPS sertifikası üretir (kamera erişimi güvenli bağlam ister).
 * - Statik web istemcisini sunar.
 * - WebRTC için SSE (sunucu->istemci) + POST (istemci->sunucu) tabanlı
 *   basit bir sinyalleşme (signaling) köprüsü sağlar.
 *
 * Çalıştır:  node server.js   (varsayılan https://0.0.0.0:8443)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const PORT = parseInt(process.env.PORT || '8443', 10);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const CERT_DIR = path.join(__dirname, 'certs');
const KEY_PATH = path.join(CERT_DIR, 'key.pem');
const CERT_PATH = path.join(CERT_DIR, 'cert.pem');

// ---------------------------------------------------------------------------
// Yerel ağ IPv4 adreslerini topla
// ---------------------------------------------------------------------------
function localIPv4Addresses() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const ni of ifaces[name] || []) {
      if (ni.family === 'IPv4' && !ni.internal) out.push(ni.address);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Kendinden imzalı sertifika (yoksa openssl ile üret)
// ---------------------------------------------------------------------------
function ensureCertificate() {
  if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
    return { key: fs.readFileSync(KEY_PATH), cert: fs.readFileSync(CERT_PATH) };
  }
  fs.mkdirSync(CERT_DIR, { recursive: true });

  const ips = localIPv4Addresses();
  const sanParts = ['DNS:localhost', 'IP:127.0.0.1', ...ips.map((ip) => `IP:${ip}`)];
  const san = sanParts.join(',');

  console.log('» Sertifika bulunamadı, kendinden imzalı sertifika üretiliyor...');
  try {
    execFileSync(
      'openssl',
      [
        'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
        '-keyout', KEY_PATH,
        '-out', CERT_PATH,
        '-days', '825',
        '-subj', '/CN=lan-camera-share',
        '-addext', `subjectAltName=${san}`,
      ],
      { stdio: 'ignore' }
    );
  } catch (err) {
    console.error('openssl ile sertifika üretilemedi:', err.message);
    console.error('Lütfen openssl kurulu olduğundan emin olun veya certs/ içine');
    console.error('kendi key.pem ve cert.pem dosyalarınızı koyun.');
    process.exit(1);
  }
  console.log('  Sertifika hazır (SAN: ' + san + ')');
  return { key: fs.readFileSync(KEY_PATH), cert: fs.readFileSync(CERT_PATH) };
}

// ---------------------------------------------------------------------------
// Statik dosya sunumu
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  // path traversal koruması
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Bulunamadı');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// ---------------------------------------------------------------------------
// Sinyalleşme (signaling) — odalar ve SSE bağlantıları
// rooms: Map<roomCode, Map<peerId, res(SSE)>>
// ---------------------------------------------------------------------------
const rooms = new Map();

function getRoom(code) {
  let room = rooms.get(code);
  if (!room) {
    room = new Map();
    rooms.set(code, room);
  }
  return room;
}

function sseSend(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

function handleEvents(req, res, params) {
  const room = (params.get('room') || '').trim();
  const id = (params.get('id') || '').trim();
  if (!room || !id) {
    res.writeHead(400).end('room ve id gerekli');
    return;
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const r = getRoom(room);
  // Bu odadaki diğer eşleri (peers) hoş geldin mesajıyla bildir
  const others = [...r.keys()].filter((pid) => pid !== id);
  r.set(id, res);
  sseSend(res, { t: 'welcome', id, peers: others });

  // Diğerlerine katılımı duyur
  for (const [pid, pres] of r) {
    if (pid !== id) sseSend(pres, { t: 'join', id });
  }

  // Bağlantıyı canlı tut
  const keepAlive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) {}
  }, 20000);

  req.on('close', () => {
    clearInterval(keepAlive);
    const rr = rooms.get(room);
    if (!rr) return;
    rr.delete(id);
    for (const [, pres] of rr) sseSend(pres, { t: 'leave', id });
    if (rr.size === 0) rooms.delete(room);
  });
}

function handleSignal(req, res) {
  let body = '';
  let tooBig = false;
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 5 * 1024 * 1024) { tooBig = true; req.destroy(); }
  });
  req.on('end', () => {
    if (tooBig) return;
    let msg;
    try { msg = JSON.parse(body); } catch (_) {
      res.writeHead(400).end('geçersiz JSON');
      return;
    }
    const { room, from, to, data } = msg || {};
    const r = rooms.get(room);
    if (!r) { res.writeHead(404).end('oda yok'); return; }
    const payload = { t: 'sig', from, data };
    if (to) {
      const target = r.get(to);
      if (target) sseSend(target, payload);
    } else {
      for (const [pid, pres] of r) {
        if (pid !== from) sseSend(pres, payload);
      }
    }
    res.writeHead(204).end();
  });
}

// ---------------------------------------------------------------------------
// HTTPS sunucu
// ---------------------------------------------------------------------------
const creds = ensureCertificate();

const server = https.createServer(creds, (req, res) => {
  const u = new URL(req.url, 'https://localhost');
  if (u.pathname === '/events' && req.method === 'GET') {
    return handleEvents(req, res, u.searchParams);
  }
  if (u.pathname === '/signal' && req.method === 'POST') {
    return handleSignal(req, res);
  }
  if (u.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
    return;
  }
  return serveStatic(req, res, req.url);
});

server.listen(PORT, HOST, () => {
  const ips = localIPv4Addresses();
  console.log('\n  📷  LAN Kamera & Dosya Paylaşımı çalışıyor (HTTPS)\n');
  console.log('  Aynı Wi-Fi ağındaki telefonlardan tarayıcıda aç:');
  if (ips.length === 0) {
    console.log(`     https://<bu-cihazın-IP-adresi>:${PORT}`);
  }
  for (const ip of ips) {
    console.log(`     https://${ip}:${PORT}`);
  }
  console.log(`     https://localhost:${PORT}   (bu cihazda)`);
  console.log('\n  ⚠  Sertifika kendinden imzalı: her telefonda ilk açılışta');
  console.log('     "Gelişmiş > Yine de devam et" diyerek güvenlik uyarısını onayla.\n');
});
