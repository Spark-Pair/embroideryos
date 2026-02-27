import { logDataSource } from "./logger";

const DB_NAME = "embroideryos_local";
const DB_VERSION = 1;
const OFFLINE_UNLOCK_KEY = "offlineUnlocked";

let dbPromise = null;

const openDb = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
      if (!db.objectStoreNames.contains("sync_queue")) {
        const store = db.createObjectStore("sync_queue", { keyPath: "id", autoIncrement: true });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains("entities")) {
        db.createObjectStore("entities", { keyPath: "key" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Failed to open IndexedDB"));
  });

const getDb = async () => {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
};

const runTx = async (storeName, mode, fn) => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let output;
    try {
      output = fn(store);
    } catch (err) {
      reject(err);
      return;
    }
    tx.oncomplete = () => resolve(output);
    tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
  });
};

export const offlineAccess = {
  isUnlocked() {
    return localStorage.getItem(OFFLINE_UNLOCK_KEY) === "1";
  },
  unlock() {
    localStorage.setItem(OFFLINE_UNLOCK_KEY, "1");
  },
  lock() {
    localStorage.removeItem(OFFLINE_UNLOCK_KEY);
  },
};

export const initOfflineForUser = async ({ userId, businessId }) => {
  if (!userId || !businessId) return;
  await runTx("meta", "readwrite", (store) => {
    store.put({ key: "session", userId, businessId, updatedAt: Date.now() });
  });
  logDataSource("IDB", "offline.init", { userId, businessId });
};

export const clearOfflineData = async () => {
  const db = await getDb();
  db.close();
  dbPromise = null;
  await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error("Failed to delete IndexedDB"));
    req.onblocked = () => reject(new Error("IndexedDB delete blocked"));
  });
  logDataSource("IDB", "offline.cleared");
};

export const queueSyncAction = async (action) => {
  const item = {
    ...action,
    status: action?.status || "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await runTx("sync_queue", "readwrite", (store) => store.add(item));
  logDataSource("IDB", "sync_queue.enqueue", {
    entity: item.entity || null,
    method: item.method || null,
  });
};

export const getPendingSyncActions = async (entity = null) => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sync_queue", "readonly");
    const store = tx.objectStore("sync_queue");
    const req = store.getAll();
    req.onsuccess = () => {
      const all = Array.isArray(req.result) ? req.result : [];
      const pending = all
        .filter((item) => item?.status === "pending")
        .filter((item) => (entity ? item?.entity === entity : true))
        .sort((a, b) => Number(a?.createdAt || 0) - Number(b?.createdAt || 0));
      resolve(pending);
    };
    req.onerror = () => reject(req.error || new Error("Failed to read sync queue"));
  });
};

export const completeSyncAction = async (id) => {
  if (!id) return;
  await runTx("sync_queue", "readwrite", (store) => store.delete(id));
  logDataSource("IDB", "sync_queue.complete", { id });
};

export const failSyncAction = async (id, errorMessage = "") => {
  if (!id) return;
  const db = await getDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("sync_queue", "readwrite");
    const store = tx.objectStore("sync_queue");
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (!existing) return;
      store.put({
        ...existing,
        status: "pending",
        lastError: errorMessage || existing.lastError || "",
        retries: Number(existing.retries || 0) + 1,
        updatedAt: Date.now(),
      });
    };
    getReq.onerror = () => reject(getReq.error || new Error("Failed to update sync action"));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Failed to update sync action"));
    tx.onabort = () => reject(tx.error || new Error("Sync action update aborted"));
  });
  logDataSource("IDB", "sync_queue.retry", { id, errorMessage });
};

export const upsertEntitySnapshot = async (key, data) => {
  if (!key) return;
  await runTx("entities", "readwrite", (store) =>
    store.put({
      key,
      data,
      updatedAt: Date.now(),
    })
  );
  logDataSource("IDB", "entity.upsert", { key });
};

export const getEntitySnapshot = async (key) => {
  if (!key) return null;
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("entities", "readonly");
    const store = tx.objectStore("entities");
    const req = store.get(key);
    req.onsuccess = () => {
      logDataSource("IDB", "entity.get", { key });
      resolve(req.result?.data ?? null);
    };
    req.onerror = () => reject(req.error || new Error("Failed to read entity snapshot"));
  });
};

export const listEntitySnapshots = async (prefix = "") => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("entities", "readonly");
    const store = tx.objectStore("entities");
    const req = store.getAll();
    req.onsuccess = () => {
      const all = Array.isArray(req.result) ? req.result : [];
      const filtered = prefix
        ? all.filter((item) => String(item?.key || "").startsWith(prefix))
        : all;
      resolve(filtered);
    };
    req.onerror = () => reject(req.error || new Error("Failed to list entity snapshots"));
  });
};
