import CryptoJS from "crypto-js";
import { PBKDF2_ITERATIONS } from "./constants";
import { uid } from "./utils";

export function deriveKey(password: string, salt: string): string {
  return CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations: PBKDF2_ITERATIONS,
    hasher: CryptoJS.algo.SHA256,
  }).toString();
}

export function getRoomHash(derivedKey: string): string {
  return CryptoJS.SHA256(derivedKey).toString().slice(0, 16);
}

export function getSalt(roomKey: string): string {
  return CryptoJS.SHA256("gchat9_" + roomKey)
    .toString()
    .slice(0, 32);
}

export function encrypt(obj: Record<string, unknown>, derivedKey: string): string {
  const payload = {
    ...obj,
    _ts: obj._ts || Date.now(),
    _nonce: obj._nonce || uid(),
  };
  const iv = CryptoJS.lib.WordArray.random(16);
  const ct = CryptoJS.AES.encrypt(
    JSON.stringify(payload),
    CryptoJS.enc.Hex.parse(derivedKey),
    { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
  );
  const mac = CryptoJS.HmacSHA256(
    iv.toString() + ct.toString(),
    derivedKey
  ).toString();
  return JSON.stringify({ iv: iv.toString(), ct: ct.toString(), mac });
}

export function decrypt(
  str: string,
  derivedKey: string,
  seenNonces: Set<string>
): Record<string, unknown> | null {
  try {
    const pkg = JSON.parse(str);
    const expected = CryptoJS.HmacSHA256(
      pkg.iv + pkg.ct,
      derivedKey
    ).toString();
    if (expected !== pkg.mac) return null;
    const dec = CryptoJS.AES.decrypt(
      pkg.ct,
      CryptoJS.enc.Hex.parse(derivedKey),
      {
        iv: CryptoJS.enc.Hex.parse(pkg.iv),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      }
    );
    const result = JSON.parse(dec.toString(CryptoJS.enc.Utf8));
    if (result._nonce) {
      if (seenNonces.has(result._nonce)) return null;
      seenNonces.add(result._nonce);
      if (seenNonces.size > 5000) {
        const arr = [...seenNonces].slice(-2500);
        seenNonces.clear();
        arr.forEach((n) => seenNonces.add(n));
      }
    }
    return result;
  } catch {
    return null;
  }
}

export function generateRandomKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
  let key = "";
  for (let i = 0; i < bytes.length; i++) {
    key += chars[bytes[i] % chars.length];
  }
  return key.match(/.{4}/g)!.join("-");
}

export function checkPasswordStrength(password: string): number {
  let s = 0;
  if (password.length >= 4) s = 1;
  if (password.length >= 10 && /[A-Z]/.test(password) && /[0-9]/.test(password)) s = 2;
  if (password.length >= 14) s = 3;
  return s;
}

export function buildShareLink(key: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}#key=${encodeURIComponent(key)}`;
}

export function getKeyFromHash(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash.includes("key=")) return null;
  const match = hash.match(/key=([^&]+)/);
  if (!match) return null;
  const key = decodeURIComponent(match[1]);
  window.history.replaceState(null, "", window.location.pathname);
  return key;
}
