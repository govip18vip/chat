'use strict';
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 10000;
const RATE_LIMIT     = 120;
const MAX_MSG_SIZE   = 20 * 1024 * 1024;
const MAX_ROOM_SIZE  = 10;
const HEARTBEAT      = 25000;
const OFFLINE_MAX    = 200;
const OFFLINE_TTL    = 15 * 60 * 1000;
const MAX_ROOMS      = 500;
const MAX_CONN_PER_IP = 8;

const TURN_USER = process.env.TURN_USER || '000000002089032158';
const TURN_PASS = process.env.TURN_PASS || '7zR/SIT0zH0aURcrLTNIalplyO0=';
const METERED_DOMAIN = process.env.METERED_DOMAIN || 'hongda.metered.live';
const METERED_SECRET = process.env.METERED_SECRET || '';

const SEC_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "connect-src 'self' wss: ws: https://*.metered.live",
    "media-src 'self' blob: mediastream: data:",
    "img-src 'self' data: blob:",
    "frame-ancestors 'none'"
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(self), microphone=(self)',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.png':  'image/png'
};

const PUBLIC = path.join(__dirname, 'public');
const rooms = new Map();
const offline = new Map();
const ipConns = new Map();
const chunkBufs = new Map();
let nextId = 1;

/* ── HTTP ── */
const server = http.createServer(async (req, res) => {
  Object.entries(SEC_HEADERS).forEach(([k,v]) => res.setHeader(k, v));
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (p === '/health') {
    res.writeHead(200, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({
      ok: true, rooms: rooms.size, clients: wss.clients.size,
      mem: Math.round(process.memoryUsage().heapUsed/1024/1024)+'MB',
      up: Math.floor(process.uptime())
    }));
  }

  if (p === '/api/turn') {
    const iceServers = await fetchTURN().catch(() => fallbackICE());
    res.writeHead(200, {'Content-Type':'application/json','Cache-Control':'max-age=3600'});
    return res.end(JSON.stringify({iceServers}));
  }

  const fp = p === '/' || p === '/index.html'
    ? path.join(PUBLIC, 'index.html')
    : path.join(PUBLIC, p);
  if (!fp.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream'});
    res.end(data);
  });
});

async function fetchTURN() {
  if (!METERED_SECRET) throw new Error('no secret');
  const https = require('https');
  return new Promise((res, rej) => {
    const r = https.get(`https://${METERED_DOMAIN}/api/v1/turn/credentials?apiKey=${METERED_SECRET}`, resp => {
      let d = '';
      resp.on('data', c => d += c);
      resp.on('end', () => { try { const j = JSON.parse(d); res(Array.isArray(j) ? j : j.iceServers || fallbackICE()); } catch(e){ rej(e); } });
    });
    r.on('error', rej);
    setTimeout(() => rej(new Error('timeout')), 5000);
  });
}

function fallbackICE() {
  return [
    {urls:`turn:${METERED_DOMAIN}:80`,            username:TURN_USER, credential:TURN_PASS},
    {urls:`turn:${METERED_DOMAIN}:443`,           username:TURN_USER, credential:TURN_PASS},
    {urls:`turn:${METERED_DOMAIN}:443?transport=tcp`, username:TURN_USER, credential:TURN_PASS},
    {urls:'turn:openrelay.metered.ca:443?transport=tcp', username:'openrelayproject', credential:'openrelayproject'}
  ];
}

/* ── WebSocket ── */
const wss = new WebSocket.Server({server, maxPayload: MAX_MSG_SIZE,
  perMessageDeflate:{zlibDeflateOptions:{level:3},threshold:1024}});

const hb = setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws._alive) return ws.terminate();
    ws._alive = false;
    try { ws.ping(); } catch(e){}
  });
}, HEARTBEAT);
wss.on('close', () => clearInterval(hb));

setInterval(() => {
  const now = Date.now();
  for (const [r, q] of offline) {
    const v = q.filter(m => now - m.ts < OFFLINE_TTL);
    v.length ? offline.set(r, v) : offline.delete(r);
  }
  for (const [r, m] of rooms) if (!m.size) rooms.delete(r);
  for (const [k, v] of chunkBufs) if (now - v.ts > 120000) chunkBufs.delete(k);
}, 60000);

function getIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket.remoteAddress || 'unknown';
}

function pushOffline(room, from, data) {
  if (!offline.has(room)) offline.set(room, []);
  const q = offline.get(room);
  q.push({from, data, ts: Date.now()});
  while (q.length > OFFLINE_MAX) q.shift();
}

function popOffline(room) {
  const q = offline.get(room); if (!q) return [];
  const valid = q.filter(m => Date.now() - m.ts < OFFLINE_TTL);
  offline.delete(room);
  return valid;
}

function broadcast(room, from, msg) {
  const r = rooms.get(room); if (!r) return;
  const env = JSON.stringify({_data: msg, _from: from});
  let sent = 0;
  r.forEach((ws, id) => {
    if (id !== from && ws.readyState === WebSocket.OPEN) {
      try { ws.send(env); sent++; } catch(e){}
    }
  });
  if (!sent) pushOffline(room, from, msg);
}

function handleChunk(ws, d) {
  const {chunkId, index, total, data} = d;
  const key = `${ws._cid}_${chunkId}`;
  if (!chunkBufs.has(key)) chunkBufs.set(key, {parts: new Array(total), got: 0, total, ts: Date.now()});
  const buf = chunkBufs.get(key);
  if (index >= total || buf.parts[index]) return null;
  buf.parts[index] = data; buf.got++;
  if (buf.got === buf.total) { const full = buf.parts.join(''); chunkBufs.delete(key); return full; }
  try { ws.send(JSON.stringify({_sys:'chunk_ack', chunkId, index})); } catch(e){}
  return null;
}

wss.on('connection', (ws, req) => {
  const ip = getIP(req);
  const n = ipConns.get(ip) || 0;
  if (n >= MAX_CONN_PER_IP) { ws.close(4002, 'Too many'); return; }
  ipConns.set(ip, n + 1);

  ws._alive = true; ws._n = 0; ws._t = Date.now(); ws._ip = ip;
  ws.on('pong', () => { ws._alive = true; });

  const params = new URL(req.url, 'http://x').searchParams;
  const room = (params.get('r') || 'default').substring(0, 64);
  const cid = 'u' + (nextId++) + '_' + crypto.randomBytes(4).toString('hex');

  if (!rooms.has(room) && rooms.size >= MAX_ROOMS) { ws.close(4003, 'Full'); ipConns.set(ip, Math.max(0, (ipConns.get(ip)||1)-1)); return; }
  if (rooms.has(room) && rooms.get(room).size >= MAX_ROOM_SIZE) { ws.close(4001, 'Room full'); ipConns.set(ip, Math.max(0, (ipConns.get(ip)||1)-1)); return; }

  if (!rooms.has(room)) rooms.set(room, new Map());
  rooms.get(room).set(cid, ws);
  ws._room = room; ws._cid = cid;

  try { ws.send(JSON.stringify({_sys:'welcome', _id:cid, _size:rooms.get(room).size, _ts:Date.now()})); } catch(e){}

  const msgs = popOffline(room);
  msgs.forEach(m => { try { ws.send(JSON.stringify({_data:m.data, _from:m.from, _offline:true})); } catch(e){} });
  if (msgs.length) try { ws.send(JSON.stringify({_sys:'offline_done', count:msgs.length})); } catch(e){}

  ws.on('message', raw => {
    const now = Date.now();
    if (now - ws._t > 1000) { ws._n = 0; ws._t = now; }
    if (++ws._n > RATE_LIMIT) { try { ws.send(JSON.stringify({_sys:'rate_limit'})); } catch(e){} return; }
    const msg = raw.toString();
    if (msg.length > MAX_MSG_SIZE) { try { ws.send(JSON.stringify({_sys:'too_large'})); } catch(e){} return; }
    try {
      const p = JSON.parse(msg);
      if (p._ping) { try { ws.send(JSON.stringify({_pong:p._ping})); } catch(e){} return; }
      if (p._chunk && p._chunkData) { const full = handleChunk(ws, p._chunkData); if (full) broadcast(room, cid, full); return; }
    } catch(e){}
    if (msg.length < 10) return;
    broadcast(room, cid, msg);
  });

  ws.on('close', () => {
    const c = ipConns.get(ip) || 1;
    c <= 1 ? ipConns.delete(ip) : ipConns.set(ip, c - 1);
    const r = rooms.get(room); if (!r) return;
    r.delete(cid);
    if (!r.size) { rooms.delete(room); return; }
    const note = JSON.stringify({_sys:'left', _id:cid});
    r.forEach(c => { if (c.readyState === WebSocket.OPEN) try { c.send(note); } catch(e){} });
  });

  ws.on('error', e => console.error(`[WS] ${cid}:`, e.message));
});

process.on('uncaughtException', e => console.error('[UNCAUGHT]', e));
process.on('unhandledRejection', e => console.error('[REJECT]', e));

const HOST = process.env.HOST || "0.0.0.0";
server.listen(PORT, HOST, () => {
  console.log(`✅ GeekChat v8.0 → http://${HOST}:${PORT}`);
  console.log(`   health: /health  turn: /api/turn`);
});

process.on('SIGTERM', () => {
  wss.clients.forEach(ws => ws.close(1001, 'Shutdown'));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000);
});
