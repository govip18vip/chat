import CryptoJS from "crypto-js";

let db: IDBDatabase | null = null;

export async function initDB(hash: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.open("gchat_" + hash, 2);
    request.onupgradeneeded = (e) => {
      const store = (e.target as IDBOpenDBRequest).result;
      if (!store.objectStoreNames.contains("msg")) {
        const st = store.createObjectStore("msg", { keyPath: "id" });
        st.createIndex("ts", "ts");
        st.createIndex("nick", "nick");
      }
    };
    request.onsuccess = (e) => {
      db = (e.target as IDBOpenDBRequest).result;
      resolve();
    };
    request.onerror = () => resolve();
  });
}

export function saveMsg(msg: Record<string, unknown>, derivedKey: string) {
  if (!db) return;
  try {
    const enc = CryptoJS.AES.encrypt(
      JSON.stringify(msg),
      derivedKey
    ).toString();
    db.transaction("msg", "readwrite")
      .objectStore("msg")
      .put({
        id: msg.id,
        ts: Date.now(),
        nick: msg.nick || "",
        data: enc,
      });
  } catch {}
}

export function deleteMsg(id: string) {
  if (!db) return;
  try {
    db.transaction("msg", "readwrite").objectStore("msg").delete(id);
  } catch {}
}

export async function clearAllMsgs(): Promise<void> {
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const r = db!
        .transaction("msg", "readwrite")
        .objectStore("msg")
        .clear();
      r.onsuccess = () => resolve();
      r.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export interface StoredMessage {
  id: string;
  nick: string;
  text?: string;
  ts: number;
  [key: string]: unknown;
}

export async function loadHistory(
  derivedKey: string
): Promise<StoredMessage[]> {
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const r = db!
        .transaction("msg", "readonly")
        .objectStore("msg")
        .index("ts")
        .getAll();
      r.onsuccess = (e) => {
        const rows = (e.target as IDBRequest).result || [];
        const messages: StoredMessage[] = [];
        rows.forEach(
          (row: { id: string; data: string; nick: string; ts: number }) => {
            try {
              const msg = JSON.parse(
                CryptoJS.AES.decrypt(row.data, derivedKey).toString(
                  CryptoJS.enc.Utf8
                )
              );
              if (msg) messages.push(msg);
            } catch {}
          }
        );
        resolve(messages);
      };
      r.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function searchMsgs(
  keyword: string,
  derivedKey: string
): Promise<StoredMessage[]> {
  if (!db || !keyword.trim()) return [];
  return new Promise((resolve) => {
    try {
      const r = db!
        .transaction("msg", "readonly")
        .objectStore("msg")
        .index("ts")
        .getAll();
      r.onsuccess = (e) => {
        const rows = (e.target as IDBRequest).result || [];
        const lkw = keyword.toLowerCase();
        const results: StoredMessage[] = [];
        rows.forEach((row: { data: string }) => {
          try {
            const msg = JSON.parse(
              CryptoJS.AES.decrypt(row.data, derivedKey).toString(
                CryptoJS.enc.Utf8
              )
            );
            if (msg?.text?.toLowerCase().includes(lkw)) results.push(msg);
          } catch {}
        });
        resolve(results.slice(-50).reverse());
      };
      r.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export function closeDB() {
  if (db) {
    db.close();
    db = null;
  }
}
