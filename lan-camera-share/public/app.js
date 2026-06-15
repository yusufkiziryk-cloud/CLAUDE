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
};

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
function startPeer(remoteId, isOfferer) {
  if (state.peers.has(remoteId)) return;
  const pc = new RTCPeerConnection(ICE_CONFIG);
  const entry = { pc, dc: null };
  state.peers.set(remoteId, entry);

  pc.onicecandidate = (e) => {
    if (e.candidate) postSignal(remoteId, { kind: 'ice', candidate: e.candidate });
  };
  pc.onconnectionstatechange = () => {
    const st = pc.connectionState;
    if (st === 'connected') setStatus('Bağlandı', 'connected');
    else if (st === 'connecting') setStatus('Bağlanıyor…', 'connecting');
    else if (st === 'failed' || st === 'disconnected') setStatus('Bağlantı koptu', 'error');
  };
  pc.ontrack = (e) => {
    const v = $('#remoteVideo');
    if (v.srcObject !== e.streams[0]) v.srcObject = e.streams[0];
    $('#videoPlaceholder').classList.add('hidden');
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

function updateShareLink() {
  const box = $('#shareLink');
  if (state.role === 'host' && $('#roomInput').value.trim().length >= 4) {
    box.classList.remove('hidden');
    $('#shareUrl').textContent = buildShareUrl();
    if (navigator.share) $('#shareSheet').classList.remove('hidden');
  } else {
    box.classList.add('hidden');
  }
}

function init() {
  // Rol seçimi
  document.querySelectorAll('.role').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.role').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      state.role = btn.dataset.role;
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

  $('#hangupBtn').addEventListener('click', hangup);

  // URL'den otomatik doldur (paylaşılan bağlantı)
  const params = new URLSearchParams(location.search);
  const roomParam = params.get('room');
  const roleParam = params.get('role');
  if (roomParam) $('#roomInput').value = roomParam.toUpperCase();
  if (roleParam === 'guest' || roleParam === 'host') {
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
