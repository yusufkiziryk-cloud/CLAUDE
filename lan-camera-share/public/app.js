'use strict';

/* =========================================================================
 * LAN Kamera & Dosya Paylaşımı — istemci
 *
 * Roller:
 *   host  = bu cihazın kamerasını + dosyalarını paylaşır (offerer / yayıncı)
 *   guest = diğer cihaza bağlanır, izler ve dosyalara erişir (answerer)
 *
 * Sinyalleşme: SSE (/events) ile sunucudan dinle, POST (/signal) ile gönder.
 * Medya/dosya: WebRTC (track + DataChannel), aynı ağda doğrudan bağlanır.
 * ========================================================================= */

const $ = (sel) => document.querySelector(sel);

const ICE_CONFIG = {
  iceServers: [
    // Aynı ağda host adayları yeterli; internet varsa STUN yedek olarak çalışır.
    { urls: 'stun:stun.l.google.com:19302' },
  ],
};

const CHUNK_SIZE = 16 * 1024;       // 16 KB
const BUFFER_HIGH = 8 * 1024 * 1024; // backpressure eşiği

// ---- Durum -----------------------------------------------------------------
const state = {
  role: null,            // 'host' | 'guest'
  room: null,
  myId: (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2),
  es: null,              // EventSource
  peers: new Map(),      // remoteId -> { pc, dc }
  localStream: null,
  facingMode: 'environment',
  sharedFiles: new Map(),// id -> File (host'un paylaştıkları)
  incoming: null,        // { meta, buffers, received, el }
  sendQueue: [],
  sending: false,
  mode: 'server',        // 'server' (oda kodu) | 'qr' (sunucusuz)
  scanMode: 'url',       // 'url' | 'frames'
  framesOnDone: null,    // çok-kareli QR tamamlanınca çağrılır
};

// Capacitor (APK) içinde çalışıyorsak sunucusuz QR modu varsayılan olsun.
const IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform &&
  window.Capacitor.isNativePlatform());

// ---- UI yardımcıları -------------------------------------------------------
function setStatus(text, kind) {
  const el = $('#status');
  el.textContent = text;
  el.className = 'status status--' + (kind || 'idle');
}

function humanSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

// ---- Sinyalleşme -----------------------------------------------------------
async function postSignal(to, data) {
  try {
    await fetch('/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: state.room, from: state.myId, to, data }),
    });
  } catch (e) {
    console.error('signal gönderilemedi', e);
  }
}

function openSignaling() {
  const url = `/events?room=${encodeURIComponent(state.room)}&id=${encodeURIComponent(state.myId)}`;
  const es = new EventSource(url);
  state.es = es;

  es.onopen = () => setStatus('Eş bekleniyor…', 'connecting');
  es.onerror = () => setStatus('Sinyal bağlantısı koptu', 'error');

  es.onmessage = async (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch (_) { return; }

    if (msg.t === 'welcome') {
      // Odadaki mevcut eşler: host isek onlara teklif başlat
      if (state.role === 'host') {
        for (const pid of msg.peers) startPeer(pid, true);
      }
    } else if (msg.t === 'join') {
      // Yeni eş katıldı: host isek teklif başlat
      if (state.role === 'host') startPeer(msg.id, true);
    } else if (msg.t === 'leave') {
      closePeer(msg.id);
    } else if (msg.t === 'sig') {
      await handleSignal(msg.from, msg.data);
    }
  };
}

// ---- WebRTC ----------------------------------------------------------------
// Her iki modda (sunucu / QR) ortak peer davranışı: durum + gelen görüntü.
function wirePeerCommon(pc) {
  pc.onconnectionstatechange = () => {
    const st = pc.connectionState;
    if (st === 'connected') { setStatus('Bağlandı', 'connected'); onConnected(); }
    else if (st === 'connecting') setStatus('Bağlanıyor…', 'connecting');
    else if (st === 'failed' || st === 'disconnected') setStatus('Bağlantı koptu', 'error');
  };
  pc.ontrack = (e) => {
    const v = $('#remoteVideo');
    if (v.srcObject !== e.streams[0]) v.srcObject = e.streams[0];
    $('#videoPlaceholder').classList.add('hidden');
  };
}

// Bağlantı kurulunca el sıkışma/kurulum panellerini gizle, canlı paneli aç.
function onConnected() {
  stopPayloadQR();
  $('#qrHandshake').classList.add('hidden');
  $('#scanner').classList.add('hidden');
  $('#setup').classList.add('hidden');
  $('#live').classList.remove('hidden');
}

function startPeer(remoteId, isOfferer) {
  if (state.peers.has(remoteId)) return;
  const pc = new RTCPeerConnection(ICE_CONFIG);
  const entry = { pc, dc: null };
  state.peers.set(remoteId, entry);

  wirePeerCommon(pc);
  pc.onicecandidate = (e) => {
    if (e.candidate) postSignal(remoteId, { kind: 'ice', candidate: e.candidate });
  };

  // Host kamerayı yollar
  if (state.role === 'host' && state.localStream) {
    for (const track of state.localStream.getTracks()) {
      pc.addTrack(track, state.localStream);
    }
  }

  if (isOfferer) {
    const dc = pc.createDataChannel('data');
    setupDataChannel(remoteId, dc);
    entry.dc = dc;
    pc.onnegotiationneeded = async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        postSignal(remoteId, { kind: 'offer', sdp: pc.localDescription });
      } catch (e) { console.error(e); }
    };
  } else {
    pc.ondatachannel = (e) => {
      entry.dc = e.channel;
      setupDataChannel(remoteId, e.channel);
    };
  }

  return entry;
}

async function handleSignal(from, data) {
  let entry = state.peers.get(from);
  if (!entry) entry = startPeer(from, false); // guest tarafı: gelen teklife yanıt
  const pc = entry.pc;

  if (data.kind === 'offer') {
    await pc.setRemoteDescription(data.sdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    postSignal(from, { kind: 'answer', sdp: pc.localDescription });
  } else if (data.kind === 'answer') {
    await pc.setRemoteDescription(data.sdp);
  } else if (data.kind === 'ice') {
    try { await pc.addIceCandidate(data.candidate); } catch (e) { console.warn('ice eklenemedi', e); }
  }
}

function closePeer(remoteId) {
  const entry = state.peers.get(remoteId);
  if (!entry) return;
  try { entry.dc && entry.dc.close(); } catch (_) {}
  try { entry.pc.close(); } catch (_) {}
  state.peers.delete(remoteId);
  if (state.peers.size === 0) {
    $('#videoPlaceholder').classList.remove('hidden');
    $('#videoPlaceholder').textContent = 'Bağlantı bekleniyor…';
    setStatus('Eş bekleniyor…', 'connecting');
  }
}

// ---- Veri kanalı (dosya) ---------------------------------------------------
function setupDataChannel(remoteId, dc) {
  dc.binaryType = 'arraybuffer';
  dc.bufferedAmountLowThreshold = 1 << 20;

  dc.onopen = () => {
    // Host: paylaşılan dosya listesini bu eşe yolla
    if (state.role === 'host') sendFileList(dc);
  };
  dc.onmessage = (e) => onDataMessage(remoteId, dc, e.data);
}

function broadcast(obj) {
  for (const { dc } of state.peers.values()) {
    if (dc && dc.readyState === 'open') dc.send(JSON.stringify(obj));
  }
}

function sendFileList(dc) {
  const files = [...state.sharedFiles.entries()].map(([id, f]) => ({
    id, name: f.name, size: f.size,
  }));
  dc.send(JSON.stringify({ type: 'file-list', files }));
}

function onDataMessage(remoteId, dc, data) {
  if (typeof data === 'string') {
    let msg;
    try { msg = JSON.parse(data); } catch (_) { return; }

    if (msg.type === 'file-list') {
      renderSharedList(msg.files, remoteId);
    } else if (msg.type === 'file-request') {
      const file = state.sharedFiles.get(msg.id);
      if (file) enqueueSend(dc, file);
    } else if (msg.type === 'file-begin') {
      beginIncoming(msg);
    } else if (msg.type === 'file-end') {
      endIncoming();
    }
  } else {
    // binary chunk
    if (!state.incoming) return;
    state.incoming.buffers.push(data);
    state.incoming.received += data.byteLength;
    updateProgress(state.incoming.el, state.incoming.received / state.incoming.meta.size);
  }
}

// ---- Gelen dosya -----------------------------------------------------------
function beginIncoming(meta) {
  const el = addTransferItem('⬇️', meta.name, meta.size);
  state.incoming = { meta, buffers: [], received: 0, el };
}

function endIncoming() {
  const inc = state.incoming;
  if (!inc) return;
  const blob = new Blob(inc.buffers, { type: inc.meta.mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  finishTransferItem(inc.el, inc.meta.name, blob.size, url);
  state.incoming = null;
}

// ---- Giden dosya (kuyruk + backpressure) -----------------------------------
function enqueueSend(dc, file) {
  state.sendQueue.push({ dc, file });
  if (!state.sending) drainQueue();
}

async function drainQueue() {
  state.sending = true;
  while (state.sendQueue.length) {
    const { dc, file } = state.sendQueue.shift();
    if (!dc || dc.readyState !== 'open') continue;
    await streamFile(dc, file);
  }
  state.sending = false;
}

async function streamFile(dc, file) {
  const meta = { type: 'file-begin', name: file.name, size: file.size, mime: file.type };
  dc.send(JSON.stringify(meta));
  const el = addTransferItem('⬆️', file.name, file.size);

  let offset = 0;
  while (offset < file.size) {
    if (dc.bufferedAmount > BUFFER_HIGH) {
      await new Promise((res) => {
        const h = () => { dc.removeEventListener('bufferedamountlow', h); res(); };
        dc.addEventListener('bufferedamountlow', h);
      });
    }
    const slice = file.slice(offset, offset + CHUNK_SIZE);
    const buf = await slice.arrayBuffer();
    try { dc.send(buf); } catch (e) { console.error('chunk gönderilemedi', e); break; }
    offset += buf.byteLength;
    updateProgress(el, offset / file.size);
  }
  dc.send(JSON.stringify({ type: 'file-end', name: file.name }));
  finishTransferItem(el, file.name, file.size, null, 'Gönderildi');
}

// ---- Liste / UI bileşenleri ------------------------------------------------
function renderSharedList(files, remoteId) {
  const ul = $('#sharedList');
  ul.innerHTML = '';
  if (!files.length) {
    ul.innerHTML = '<li class="hint">Henüz paylaşılan dosya yok.</li>';
    return;
  }
  for (const f of files) {
    const li = document.createElement('li');
    li.className = 'fileitem';
    li.innerHTML = `
      <div class="fileitem__info">
        <div class="fileitem__name">${escapeHtml(f.name)}</div>
        <div class="fileitem__meta">${humanSize(f.size)}</div>
      </div>`;
    const btn = document.createElement('button');
    btn.className = 'fileitem__action';
    btn.textContent = 'İndir';
    btn.onclick = () => {
      const entry = state.peers.get(remoteId);
      if (entry && entry.dc && entry.dc.readyState === 'open') {
        entry.dc.send(JSON.stringify({ type: 'file-request', id: f.id }));
        btn.textContent = '…';
      }
    };
    li.appendChild(btn);
    ul.appendChild(li);
  }
}

function addTransferItem(icon, name, size) {
  const ul = $('#transferList');
  const li = document.createElement('li');
  li.className = 'fileitem';
  li.innerHTML = `
    <div class="fileitem__info">
      <div class="fileitem__name">${icon} ${escapeHtml(name)}</div>
      <div class="fileitem__meta">${humanSize(size)}</div>
      <div class="progress"><span></span></div>
    </div>`;
  ul.prepend(li);
  return li;
}

function updateProgress(el, ratio) {
  const bar = el.querySelector('.progress > span');
  if (bar) bar.style.width = Math.min(100, Math.round(ratio * 100)) + '%';
}

function finishTransferItem(el, name, size, url, label) {
  updateProgress(el, 1);
  const meta = el.querySelector('.fileitem__meta');
  if (url) {
    const a = document.createElement('a');
    a.className = 'fileitem__action';
    a.href = url;
    a.download = name;
    a.textContent = 'Kaydet';
    el.appendChild(a);
    a.click(); // tarayıcı izin verirse otomatik indir
    meta.textContent = humanSize(size) + ' • hazır';
  } else if (label) {
    meta.textContent = humanSize(size) + ' • ' + label;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// ---- Kamera (host) ---------------------------------------------------------
async function startCamera() {
  try {
    state.localStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: state.facingMode },
      audio: true,
    });
    const lv = $('#localVideo');
    lv.srcObject = state.localStream;
    lv.classList.remove('hidden');
    $('#videoPlaceholder').textContent = 'Karşı cihazın bağlanması bekleniyor…';
  } catch (e) {
    alert('Kameraya erişilemedi: ' + e.message +
      '\n\nHTTPS güvenlik uyarısını onayladığından ve kamera iznini verdiğinden emin ol.');
    throw e;
  }
}

async function switchCamera() {
  if (!state.localStream) return;
  state.facingMode = state.facingMode === 'environment' ? 'user' : 'environment';
  const old = state.localStream;
  const newStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: state.facingMode },
    audio: true,
  });
  const newTrack = newStream.getVideoTracks()[0];
  for (const { pc } of state.peers.values()) {
    const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
    if (sender) sender.replaceTrack(newTrack);
  }
  // ses izini koru, sadece video izini değiştir
  old.getVideoTracks().forEach((t) => { t.stop(); old.removeTrack(t); });
  old.addTrack(newTrack);
  $('#localVideo').srcObject = old;
  newStream.getAudioTracks().forEach((t) => t.stop());
}

// ---- Akış kontrolü ---------------------------------------------------------
async function connect() {
  if (!state.role || !state.room) return;
  $('#setup').classList.add('hidden');
  $('#live').classList.remove('hidden');

  if (state.role === 'host') {
    $('#hostControls').classList.remove('hidden');
    $('#hostShareBox').classList.remove('hidden');
    $('#sharedTitle').textContent = 'Paylaştığın dosyalar';
    await startCamera();
  } else {
    $('#sharedTitle').textContent = 'Diğer cihazın paylaştıkları';
  }
  openSignaling();
}

function hangup() {
  for (const id of [...state.peers.keys()]) closePeer(id);
  if (state.es) { state.es.close(); state.es = null; }
  if (state.localStream) { state.localStream.getTracks().forEach((t) => t.stop()); state.localStream = null; }
  location.reload();
}

// ---- Olay bağlama ----------------------------------------------------------
function refreshConnectBtn() {
  $('#connectBtn').disabled = !(state.role && $('#roomInput').value.trim().length >= 4);
}

function buildShareUrl() {
  const code = $('#roomInput').value.trim().toUpperCase();
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  u.searchParams.set('room', code);
  u.searchParams.set('role', 'guest');
  return u.toString();
}

function renderQRInto(el, text, cellSize) {
  el.innerHTML = '';
  if (typeof qrcode === 'undefined') return;
  try {
    const qr = qrcode(0, 'L'); // 0 = otomatik boyut, L = düşük ECC (daha çok veri sığar)
    qr.addData(text);
    qr.make();
    el.innerHTML = qr.createSvgTag({ cellSize: cellSize || 6, margin: 10, scalable: true });
  } catch (e) {
    console.warn('QR üretilemedi', e);
  }
}

function renderQR(text) {
  renderQRInto($('#qrcode'), text);
}

function updateShareLink() {
  const box = $('#shareLink');
  if (state.role === 'host' && $('#roomInput').value.trim().length >= 4) {
    box.classList.remove('hidden');
    const url = buildShareUrl();
    $('#shareUrl').textContent = url;
    renderQR(url);
    if (navigator.share) $('#shareSheet').classList.remove('hidden');
  } else {
    box.classList.add('hidden');
  }
}

// ---- QR tarayıcı (guest) ---------------------------------------------------
const scan = { stream: null, raf: null, canvas: null, ctx: null };

async function startScanner() {
  if (typeof jsQR === 'undefined') { alert('QR tarayıcı yüklenemedi.'); return; }
  const overlay = $('#scanner');
  overlay.classList.remove('hidden');
  try {
    scan.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }, audio: false,
    });
  } catch (e) {
    alert('Kamera açılamadı: ' + e.message +
      '\n\nHTTPS güvenlik uyarısını onayladığından ve kamera iznini verdiğinden emin ol.');
    stopScanner();
    return;
  }
  const v = $('#scanVideo');
  v.srcObject = scan.stream;
  await v.play().catch(() => {});

  scan.canvas = document.createElement('canvas');
  scan.ctx = scan.canvas.getContext('2d', { willReadFrequently: true });

  const tick = () => {
    if (!scan.stream) return;
    if (v.readyState >= v.HAVE_ENOUGH_DATA && v.videoWidth) {
      scan.canvas.width = v.videoWidth;
      scan.canvas.height = v.videoHeight;
      scan.ctx.drawImage(v, 0, 0, v.videoWidth, v.videoHeight);
      const img = scan.ctx.getImageData(0, 0, v.videoWidth, v.videoHeight);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      if (code && code.data) {
        if (state.scanMode === 'frames') {
          const finished = collectFrame(code.data);
          if (finished) { stopScanner(); return; }
          // diğer kareleri okumaya devam et
        } else {
          onScanResult(code.data);
          return;
        }
      }
    }
    scan.raf = requestAnimationFrame(tick);
  };
  scan.raf = requestAnimationFrame(tick);
}

function stopScanner() {
  if (scan.raf) { cancelAnimationFrame(scan.raf); scan.raf = null; }
  if (scan.stream) { scan.stream.getTracks().forEach((t) => t.stop()); scan.stream = null; }
  $('#scanner').classList.add('hidden');
  const hint = $('#scanHint');
  if (hint) hint.textContent = 'QR kodu çerçeveye getir';
}

function onScanResult(text) {
  stopScanner();
  let room = null;
  try {
    const u = new URL(text);
    room = u.searchParams.get('room');
  } catch (_) {
    room = (text || '').trim(); // düz oda kodu da kabul et
  }
  if (!room) { alert('Geçersiz QR. Bağlantı/oda kodu bulunamadı.'); return; }

  // guest rolünü seç ve doğrudan bağlan
  document.querySelectorAll('.role').forEach((b) => b.classList.remove('is-active'));
  document.querySelector('.role[data-role="guest"]').classList.add('is-active');
  state.role = 'guest';
  $('#roomInput').value = room.toUpperCase();
  refreshConnectBtn();
  updateShareLink();
  state.room = $('#roomInput').value.trim().toUpperCase();
  connect();
}

// ===========================================================================
// SUNUCUSUZ MOD — QR ile WebRTC el sıkışma (signaling server yok)
//
// Akış:
//   host:  kamera + offer üretir, ICE toplanmasını bekler, offer'ı QR yapar.
//          guest'in cevap QR'ını okutunca bağlanır.
//   guest: host'un offer QR'ını okutur, answer üretir, answer'ı QR yapar.
//          host bunu okutunca bağlanır.
// SDP, deflate ile sıkıştırılıp base64'lenir ve gerekirse çok kareli QR'a bölünür.
// ===========================================================================

async function deflateToBytes(str) {
  const data = new TextEncoder().encode(str);
  if (typeof CompressionStream === 'undefined') return data;
  const cs = new CompressionStream('deflate-raw');
  const ab = await new Response(new Blob([data]).stream().pipeThrough(cs)).arrayBuffer();
  return new Uint8Array(ab);
}
async function inflateFromBytes(bytes) {
  if (typeof DecompressionStream === 'undefined') return new TextDecoder().decode(bytes);
  const ds = new DecompressionStream('deflate-raw');
  const ab = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
  return new TextDecoder().decode(ab);
}
function bytesToB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64ToBytes(b64) {
  const s = atob(b64);
  const a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
  return a;
}
async function encodeDesc(desc) {
  const json = JSON.stringify({ t: desc.type, s: desc.sdp });
  const compressed = typeof CompressionStream !== 'undefined';
  const bytes = await deflateToBytes(json);
  return (compressed ? '1' : '0') + bytesToB64(bytes); // önek = sıkıştırma bayrağı
}
async function decodeDesc(payload) {
  const flag = payload[0];
  const bytes = b64ToBytes(payload.slice(1));
  const json = flag === '1' ? await inflateFromBytes(bytes) : new TextDecoder().decode(bytes);
  const o = JSON.parse(json);
  return { type: o.t, sdp: o.s };
}

// Tüm ICE adayları toplanana kadar bekle (non-trickle); zaman aşımıyla devam et.
function waitIceComplete(pc, timeoutMs) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') finish();
    });
    setTimeout(finish, timeoutMs || 2500);
  });
}

// ---- Çok kareli QR gösterimi ----
let hsFrames = null, hsTimer = null, hsIdx = 0;
function showPayloadQR(payload) {
  stopPayloadQR();
  const CH = 200; // kare başına base64 karakter
  const total = Math.ceil(payload.length / CH);
  hsFrames = [];
  for (let i = 0; i < total; i++) {
    hsFrames.push(`LCS|${i}|${total}|${payload.slice(i * CH, (i + 1) * CH)}`);
  }
  hsIdx = 0;
  const draw = () => {
    renderQRInto($('#hsQR'), hsFrames[hsIdx % total], 5);
    $('#hsFrameInfo').textContent = total > 1
      ? `Kare ${(hsIdx % total) + 1}/${total} — QR ekrana sığacak şekilde okut`
      : '';
    hsIdx++;
  };
  draw();
  if (total > 1) hsTimer = setInterval(draw, 600);
}
function stopPayloadQR() {
  if (hsTimer) { clearInterval(hsTimer); hsTimer = null; }
  hsFrames = null;
}

// ---- Kare toplayıcı (tarayıcı çok-kareli modda) ----
let frameCollect = null;
function collectFrame(text) {
  const m = /^LCS\|(\d+)\|(\d+)\|([\s\S]*)$/.exec(text);
  if (!m) return false;
  const idx = +m[1], total = +m[2], data = m[3];
  if (!frameCollect || frameCollect.total !== total) frameCollect = { total, parts: new Map() };
  frameCollect.parts.set(idx, data);
  $('#scanHint').textContent = `QR okunuyor… ${frameCollect.parts.size}/${total}`;
  if (frameCollect.parts.size === total) {
    let payload = '';
    for (let i = 0; i < total; i++) payload += frameCollect.parts.get(i);
    const cb = state.framesOnDone;
    frameCollect = null;
    if (cb) cb(payload);
    return true;
  }
  return false;
}

// ---- QR modu: host ----
async function qrHostStart() {
  state.role = 'host';
  $('#setup').classList.add('hidden');
  $('#hostControls').classList.remove('hidden');
  $('#hostShareBox').classList.remove('hidden');
  $('#sharedTitle').textContent = 'Paylaştığın dosyalar';

  try { await startCamera(); } catch (_) { return; }

  const pc = new RTCPeerConnection({ iceServers: [] }); // sadece yerel adaylar (LAN)
  const entry = { pc, dc: null };
  state.peers.set('qr', entry);
  wirePeerCommon(pc);
  for (const t of state.localStream.getTracks()) pc.addTrack(t, state.localStream);
  const dc = pc.createDataChannel('data');
  entry.dc = dc;
  setupDataChannel('qr', dc);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  setStatus('ICE toplanıyor…', 'connecting');
  await waitIceComplete(pc);

  const payload = await encodeDesc(pc.localDescription);
  openHandshake('host-offer', payload);
}

// ---- QR modu: guest ----
function qrGuestStart() {
  state.role = 'guest';
  $('#setup').classList.add('hidden');
  $('#sharedTitle').textContent = 'Diğer cihazın paylaştıkları';
  openHandshake('guest-scan');
}

async function onHostOfferScanned(payload) {
  const offer = await decodeDesc(payload);
  const pc = new RTCPeerConnection({ iceServers: [] });
  const entry = { pc, dc: null };
  state.peers.set('qr', entry);
  wirePeerCommon(pc);
  pc.ondatachannel = (e) => { entry.dc = e.channel; setupDataChannel('qr', e.channel); };
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  setStatus('ICE toplanıyor…', 'connecting');
  await waitIceComplete(pc);
  const ansPayload = await encodeDesc(pc.localDescription);
  openHandshake('guest-answer', ansPayload);
}

async function onGuestAnswerScanned(payload) {
  const answer = await decodeDesc(payload);
  const entry = state.peers.get('qr');
  if (entry) await entry.pc.setRemoteDescription(answer);
  setStatus('Bağlanıyor…', 'connecting');
}

// ---- El sıkışma paneli adımları ----
function openHandshake(step, payload) {
  const panel = $('#qrHandshake');
  panel.classList.remove('hidden');
  const text = $('#hsText');
  const qrBox = $('#hsQR');
  const scanBtn = $('#hsScanBtn');

  qrBox.classList.add('hidden');
  scanBtn.classList.add('hidden');
  $('#hsFrameInfo').textContent = '';

  if (step === 'host-offer') {
    text.textContent = '1) Bu QR\'ı karşı telefona okut.  2) Sonra "Cevabı tara" ile onun cevabını okut.';
    qrBox.classList.remove('hidden');
    showPayloadQR(payload);
    scanBtn.textContent = '📷 Cevabı tara';
    scanBtn.classList.remove('hidden');
    scanBtn.onclick = () => startScannerFrames(onGuestAnswerScanned);
  } else if (step === 'guest-scan') {
    text.textContent = 'Host telefondaki QR\'ı tara.';
    startScannerFrames(onHostOfferScanned);
  } else if (step === 'guest-answer') {
    text.textContent = 'Bu cevap QR\'ını host telefona okut. Bağlantı kurulunca yayın başlar.';
    qrBox.classList.remove('hidden');
    showPayloadQR(payload);
  }
}

function startScannerFrames(onDone) {
  frameCollect = null;
  state.scanMode = 'frames';
  state.framesOnDone = onDone;
  startScanner();
}

function applyMode(mode) {
  state.mode = mode;
  document.querySelectorAll('.mode').forEach((b) => b.classList.toggle('is-active', b.dataset.mode === mode));
  // sunucu moduna özel kontroller
  document.querySelectorAll('.server-only').forEach((el) => el.classList.toggle('hidden', mode !== 'server'));
  // rol seçimini sıfırla
  document.querySelectorAll('.role').forEach((b) => b.classList.remove('is-active'));
  state.role = null;
  $('#shareLink').classList.add('hidden');
}

function init() {
  // Mod seçimi (sunucusuz QR / oda kodu)
  document.querySelectorAll('.mode').forEach((btn) => {
    btn.addEventListener('click', () => applyMode(btn.dataset.mode));
  });

  // Rol seçimi
  document.querySelectorAll('.role').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.role').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      state.role = btn.dataset.role;

      if (state.mode === 'qr') {
        // Sunucusuz mod: rol seçimi doğrudan QR el sıkışmayı başlatır
        if (state.role === 'host') qrHostStart();
        else qrGuestStart();
        return;
      }

      if (state.role === 'host' && !$('#roomInput').value.trim()) {
        $('#roomInput').value = randomCode();
      }
      refreshConnectBtn();
      updateShareLink();
    });
  });

  $('#genCode').addEventListener('click', () => {
    $('#roomInput').value = randomCode();
    refreshConnectBtn();
    updateShareLink();
  });

  $('#roomInput').addEventListener('input', () => {
    $('#roomInput').value = $('#roomInput').value.toUpperCase();
    refreshConnectBtn();
    updateShareLink();
  });

  $('#connectBtn').addEventListener('click', () => {
    state.room = $('#roomInput').value.trim().toUpperCase();
    connect();
  });

  $('#copyLink').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(buildShareUrl()); $('#copyLink').textContent = 'Kopyalandı ✓'; }
    catch (_) {}
  });
  $('#shareSheet').addEventListener('click', () => {
    navigator.share({ title: 'LAN Paylaşım', text: 'Bağlan:', url: buildShareUrl() }).catch(() => {});
  });

  // Host: paylaşılacak dosya seç
  $('#pickShare').addEventListener('click', () => $('#sharePicker').click());
  $('#sharePicker').addEventListener('change', (e) => {
    for (const f of e.target.files) {
      const id = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2);
      state.sharedFiles.set(id, f);
    }
    // local listeyi göster + tüm eşlere güncel listeyi yolla
    renderHostShared();
    for (const { dc } of state.peers.values()) {
      if (dc && dc.readyState === 'open') sendFileList(dc);
    }
    e.target.value = '';
  });

  // Her iki taraf: karşı cihaza dosya gönder (push)
  $('#sendFileBtn').addEventListener('click', () => $('#sendPicker').click());
  $('#sendPicker').addEventListener('change', (e) => {
    for (const f of e.target.files) {
      for (const { dc } of state.peers.values()) {
        if (dc && dc.readyState === 'open') enqueueSend(dc, f);
      }
    }
    e.target.value = '';
  });

  $('#switchCam').addEventListener('click', () => switchCamera().catch(console.error));
  $('#muteMic').addEventListener('click', () => {
    if (!state.localStream) return;
    const t = state.localStream.getAudioTracks()[0];
    if (t) { t.enabled = !t.enabled; $('#muteMic').textContent = t.enabled ? '🎤 Mikrofon' : '🔇 Kapalı'; }
  });
  $('#toggleVideo').addEventListener('click', () => {
    if (!state.localStream) return;
    const t = state.localStream.getVideoTracks()[0];
    if (t) { t.enabled = !t.enabled; $('#toggleVideo').textContent = t.enabled ? '📹 Kamera aç/kapa' : '🚫 Kamera kapalı'; }
  });

  $('#scanBtn').addEventListener('click', () => { state.scanMode = 'url'; startScanner(); });
  $('#scanClose').addEventListener('click', () => stopScanner());
  $('#hsCancel').addEventListener('click', () => location.reload());

  $('#hangupBtn').addEventListener('click', hangup);

  // Varsayılan mod: APK içinde sunucusuz QR, web'de oda kodu
  applyMode(IS_NATIVE ? 'qr' : 'server');

  // URL'den otomatik doldur (paylaşılan bağlantı — yalnız sunucu modu)
  const params = new URLSearchParams(location.search);
  const roomParam = params.get('room');
  const roleParam = params.get('role');
  if (roomParam) {
    applyMode('server');
    $('#roomInput').value = roomParam.toUpperCase();
  }
  if (roomParam && (roleParam === 'guest' || roleParam === 'host')) {
    const btn = document.querySelector(`.role[data-role="${roleParam}"]`);
    if (btn) btn.click();
  }
  refreshConnectBtn();
}

// host'un paylaştığı dosyaların kendi ekranındaki listesi
function renderHostShared() {
  const ul = $('#sharedList');
  ul.innerHTML = '';
  for (const [, f] of state.sharedFiles) {
    const li = document.createElement('li');
    li.className = 'fileitem';
    li.innerHTML = `<div class="fileitem__info">
        <div class="fileitem__name">${escapeHtml(f.name)}</div>
        <div class="fileitem__meta">${humanSize(f.size)} • paylaşımda</div>
      </div>`;
    ul.appendChild(li);
  }
}

document.addEventListener('DOMContentLoaded', init);
