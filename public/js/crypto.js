/* crypto.js — 加密 / 密钥 / IndexedDB */
'use strict';

const PBKDF2_ITER = 10000;

function deriveKey(pw, salt) {
  return CryptoJS.PBKDF2(pw, salt, {keySize:256/32, iterations:PBKDF2_ITER, hasher:CryptoJS.algo.SHA256}).toString();
}

function encrypt(obj) {
  if (!obj._ts)    obj._ts    = Date.now();
  if (!obj._nonce) obj._nonce = uid();
  const iv  = CryptoJS.lib.WordArray.random(16);
  const ct  = CryptoJS.AES.encrypt(JSON.stringify(obj), CryptoJS.enc.Hex.parse(derivedKey), {iv, mode:CryptoJS.mode.CBC, padding:CryptoJS.pad.Pkcs7});
  const mac = CryptoJS.HmacSHA256(iv.toString() + ct.toString(), derivedKey).toString();
  return JSON.stringify({iv: iv.toString(), ct: ct.toString(), mac});
}

function decrypt(str) {
  try {
    const pkg = JSON.parse(str);
    const exp = CryptoJS.HmacSHA256(pkg.iv + pkg.ct, derivedKey).toString();
    if (exp !== pkg.mac) return null;
    const dec = CryptoJS.AES.decrypt(pkg.ct, CryptoJS.enc.Hex.parse(derivedKey), {iv:CryptoJS.enc.Hex.parse(pkg.iv), mode:CryptoJS.mode.CBC, padding:CryptoJS.pad.Pkcs7});
    const r = JSON.parse(dec.toString(CryptoJS.enc.Utf8));
    if (r._nonce) {
      if (seenNonces.has(r._nonce)) return null;
      seenNonces.add(r._nonce);
      if (seenNonces.size > 5000) seenNonces = new Set([...seenNonces].slice(-2500));
    }
    return r;
  } catch(e) { return null; }
}

/* 随机房间密钥 */
function generateKey() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  const ch = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  let k = '';
  for (let i = 0; i < b.length; i++) k += ch[b[i] % ch.length];
  k = k.match(/.{4}/g).join('-');

  $('iKey').value = k;
  $('iKey').type  = 'text';
  checkPwdStrength(k);

  $('shareKey').textContent = k;
  $('shareBox').classList.add('show');

  navigator.clipboard.writeText(k).catch(()=>{});
  showToast('🔑 密钥已生成并复制');
}

function buildLink(key) {
  return `${location.origin}${location.pathname}#key=${encodeURIComponent(key)}`;
}

function copyKey() {
  const k = $('iKey').value; if (!k) return;
  navigator.clipboard.writeText(k).then(() => showToast('✅ 密钥已复制'));
}

function copyQRLinkLogin() {
  const k = $('iKey').value; if (!k) { showToast('⚠️ 请先输入或生成密钥'); return; }
  navigator.clipboard.writeText(buildLink(k)).then(() => showToast('✅ 链接已复制'));
}

function copyQRLink() {
  const k = currentQRKey || $('iKey').value;
  if (!k) return;
  navigator.clipboard.writeText(buildLink(k)).then(() => showToast('✅ 链接已复制'));
}

/* 从 URL hash 自动填入密钥 */
function loadKeyFromHash() {
  const hash = location.hash;
  if (!hash.includes('key=')) return;
  const m = hash.match(/key=([^&]+)/);
  if (!m) return;
  const k = decodeURIComponent(m[1]);
  $('iKey').value = k;
  $('iKey').type  = 'text';
  checkPwdStrength(k);
  showToast('🔑 已从链接读取密钥');
  history.replaceState(null, '', location.pathname);
}

function checkPwdStrength(v) {
  let s = 0;
  if (v.length >= 4) s = 1;
  if (v.length >= 10 && /[A-Z]/.test(v) && /[0-9]/.test(v)) s = 2;
  if (v.length >= 14) s = 3;
  const w = ['0','33%','66%','100%'][s];
  const c = ['var(--border)','var(--red)','var(--orange)','var(--g)'][s];
  const bar = $('pwdBar');
  if (bar) { bar.style.width = w; bar.style.background = c; }
}

/* IndexedDB */
let db = null;

function initDB(h) {
  return new Promise(res => {
    const r = indexedDB.open('gchat_' + h, 2);
    r.onupgradeneeded = e => {
      const s = e.target.result;
      if (!s.objectStoreNames.contains('msg')) {
        const st = s.createObjectStore('msg', {keyPath:'id'});
        st.createIndex('ts','ts');
        st.createIndex('nick','nick');
      }
    };
    r.onsuccess = e => { db = e.target.result; res(); };
    r.onerror   = () => res();
  });
}

function saveMsg(msg) {
  if (!db) return;
  try {
    const enc = CryptoJS.AES.encrypt(JSON.stringify(msg), derivedKey).toString();
    db.transaction('msg','readwrite').objectStore('msg').put({id:msg.id, ts:Date.now(), nick:msg.nick||'', data:enc});
  } catch(e){}
}

function deleteMsg(id) {
  if (!db) return;
  try { db.transaction('msg','readwrite').objectStore('msg').delete(id); } catch(e){}
}

function clearAllMsgs() {
  if (!db) return Promise.resolve();
  return new Promise(res => {
    try { const r = db.transaction('msg','readwrite').objectStore('msg').clear(); r.onsuccess=res; r.onerror=res; }
    catch(e){ res(); }
  });
}

function loadHistory() {
  if (!db) return Promise.resolve();
  return new Promise(res => {
    try {
      const r = db.transaction('msg','readonly').objectStore('msg').index('ts').getAll();
      r.onsuccess = e => {
        const rows = e.target.result || [];
        rows.forEach(row => {
          try {
            const msg = JSON.parse(CryptoJS.AES.decrypt(row.data, derivedKey).toString(CryptoJS.enc.Utf8));
            if (msg) renderMsg(msg, msg._isMe, true);
          } catch(e){}
        });
        if (rows.length > 0) sysMsg(`📂 已加载 ${rows.length} 条历史`);
        res();
      };
      r.onerror = () => res();
    } catch(e){ res(); }
  });
}

function searchMsgs(kw) {
  if (!db || !kw.trim()) return Promise.resolve([]);
  return new Promise(res => {
    try {
      const r = db.transaction('msg','readonly').objectStore('msg').index('ts').getAll();
      r.onsuccess = e => {
        const rows = e.target.result || [];
        const lkw = kw.toLowerCase();
        const results = [];
        rows.forEach(row => {
          try {
            const msg = JSON.parse(CryptoJS.AES.decrypt(row.data, derivedKey).toString(CryptoJS.enc.Utf8));
            if (msg && msg.text && msg.text.toLowerCase().includes(lkw)) results.push(msg);
          } catch(e){}
        });
        res(results.slice(-50).reverse());
      };
      r.onerror = () => res([]);
    } catch(e){ res([]); }
  });
}
