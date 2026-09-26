import { logDataSource } from "./logger";

const DB_NAME = "embroideryos_local";
const DB_VERSION = 1;
const OFFLINE_UNLOCK_KEY = "offlineUnlocked";
const MAX_SYNC_RETRIES = 7;
const RETRY_BASE_DELAY_MS = 3000;
const RETRY_MAX_DELAY_MS = 120000;

let dbPromise = null;
let sessionMetaCache = null;
let clearInFlight = null;

const extractQueuedEntityId = (item = {}) => {
  const metaId = String(item?.meta?.id || item?.meta?.localId || "").trim();
  if (metaId) return metaId;
  const url = String(item?.url || "").trim();
  if (!url) return "";
  const parts = url.split("?")[0].split("/").filter(Boolean);
  return parts.length > 1 ? String(parts[parts.length - 1] || "").trim() : "";
};

const isLocalEntityId = (value) => String(value || "").trim().startsWith("local-");
const replaceExactIdDeep = (value, sourceId, targetId) => {
  if (typeof value === "string") return value === sourceId ? targetId : value;
  if (Array.isArray(value)) return value.map((item) => replaceExactIdDeep(item, sourceId, targetId));
  if (!value || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceExactIdDeep(item, sourceId, targetId)]));
};
const toCollectionUrl = (url = "", id = "") => {
  const trimmedUrl = String(url || "").trim();
  const trimmedId = String(id || "").trim();
  if (!trimmedUrl || !trimmedId) return trimmedUrl;
  return trimmedUrl.replace(new RegExp(`/${trimmedId}(?=$|\\?)`), "");
};

const isQueueRowInActiveBusiness = (row, activeBusinessId) => {
  if (!activeBusinessId) return true;
  const rowBusinessId = String(row?.businessId || "").trim();
  // Backward compatibility: old queue rows without businessId belong to current active business.
  if (!rowBusinessId) return true;
  return rowBusinessId === activeBusinessId;
};

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
  if (clearInFlight) await clearInFlight;
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
  sessionMetaCache = { userId, businessId, updatedAt: Date.now() };
  logDataSource("IDB", "offline.init", { userId, businessId });
};

export const getOfflineSessionMeta = async () => {
  if (sessionMetaCache) return sessionMetaCache;
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("meta", "readonly");
    const store = tx.objectStore("meta");
    const req = store.get("session");
    req.onsuccess = () => {
      sessionMetaCache = req.result || null;
      resolve(sessionMetaCache);
    };
    req.onerror = () => reject(req.error || new Error("Failed to read offline session meta"));
  });
};

export const setOfflineMetaValue = async (key, value) => {
  if (!key) return;
  await runTx("meta", "readwrite", (store) => {
    store.put({ key, value, updatedAt: Date.now() });
  });
};

export const getOfflineMetaValue = async (key) => {
  if (!key) return null;
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("meta", "readonly");
    const store = tx.objectStore("meta");
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error("Failed to read offline meta value"));
  });
};

export const clearOfflineData = async () => {
  if (clearInFlight) return clearInFlight;
  clearInFlight = (async () => {
    sessionMetaCache = null;
    const existingDbPromise = dbPromise;
    dbPromise = null;
    const db = existingDbPromise ? await existingDbPromise.catch(() => null) : null;
    if (db) db.close();
    await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error("Failed to delete IndexedDB"));
      req.onblocked = () => reject(new Error("IndexedDB delete blocked"));
    });
    logDataSource("IDB", "offline.cleared");
  })();
  try {
    return await clearInFlight;
  } finally {
    clearInFlight = null;
  }
};

export const queueSyncAction = async (action) => {
  const session = await getOfflineSessionMeta().catch(() => null);
  const scopedBusinessId = String(action?.businessId || session?.businessId || "").trim();
  const method = String(action?.method || "").toUpperCase();
  const url = String(action?.url || "").trim();
  const metaId = String(action?.meta?.id || action?.meta?.localId || "").trim();
  const entityName = String(action?.entity || "").trim();
  const dedupeKey = String(
    action?.dedupeKey ||
      (method === "POST" && metaId
        ? `${entityName}:${method}:${url}:id:${metaId}`
        : `${entityName}:${method}:${url}`)
  ).trim();
  const item = {
    ...action,
    businessId: scopedBusinessId || undefined,
    method,
    url,
    dedupeKey: dedupeKey || undefined,
    status: action?.status || "pending",
    retries: Number(action?.retries || 0),
    nextRetryAt: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const db = await getDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("sync_queue", "readwrite");
    const store = tx.objectStore("sync_queue");
    const req = store.getAll();

    req.onsuccess = () => {
      const all = Array.isArray(req.result) ? req.result : [];

      // Collapse "create locally -> edit locally before first sync" into a single POST.
      // This prevents duplicate cloud records when a PUT is queued against a local-only id.
      if ((method === "PUT" || method === "DELETE") && entityName && metaId && isLocalEntityId(metaId)) {
        const pendingCreate = all.find((row) => {
          if (row?.status !== "pending") return false;
          if (String(row?.entity || "") !== entityName) return false;
          if (String(row?.method || "").toUpperCase() !== "POST") return false;
          if (String(row?.businessId || "") !== String(item?.businessId || "")) return false;
          return extractQueuedEntityId(row) === metaId;
        });

        if (pendingCreate?.id) {
          if (method === "PUT") {
            store.put({
              ...pendingCreate,
              payload: {
                ...(pendingCreate?.payload || {}),
                ...(action?.payload || {}),
              },
              updatedAt: Date.now(),
              status: "pending",
              nextRetryAt: 0,
            });
            return;
          }

          if (method === "DELETE") {
            store.delete(pendingCreate.id);
            all.forEach((row) => {
              if (!row?.id || row.id === pendingCreate.id) return;
              if (row?.status !== "pending") return;
              if (String(row?.entity || "") !== entityName) return;
              if (String(row?.businessId || "") !== String(item?.businessId || "")) return;
              if (extractQueuedEntityId(row) !== metaId) return;
              store.delete(row.id);
            });
            return;
          }
        }

        if (method === "PUT") {
          const createUrl = toCollectionUrl(url, metaId);
          const fallbackDedupeKey = `${entityName}:POST:${createUrl}:id:${metaId}`;
          const existingFallback = all.find((row) => {
            if (row?.status !== "pending") return false;
            if (String(row?.dedupeKey || "") !== fallbackDedupeKey) return false;
            if (String(row?.businessId || "") !== String(item?.businessId || "")) return false;
            return true;
          });
          const fallbackRow = {
            ...item,
            method: "POST",
            url: createUrl,
            dedupeKey: fallbackDedupeKey,
            meta: {
              ...(item?.meta || {}),
              localId: metaId,
            },
            updatedAt: Date.now(),
            status: "pending",
            nextRetryAt: 0,
          };

          if (existingFallback?.id) {
            store.put({
              ...existingFallback,
              ...fallbackRow,
              id: existingFallback.id,
              payload: {
                ...(existingFallback?.payload || {}),
                ...(item?.payload || {}),
              },
              createdAt: existingFallback.createdAt || item.createdAt,
            });
          } else {
            store.add(fallbackRow);
          }
          return;
        }

        if (method === "DELETE") {
          return;
        }
      }

      const existing = all.find((row) => {
        if (!dedupeKey || !row?.dedupeKey) return false;
        if (String(row.dedupeKey) !== dedupeKey) return false;
        if (String(row?.businessId || "") !== String(item?.businessId || "")) return false;
        return row?.status === "pending";
      });

      if (existing?.id) {
        store.put({
          ...existing,
          ...item,
          id: existing.id,
          createdAt: existing.createdAt || item.createdAt,
          updatedAt: Date.now(),
          status: "pending",
          nextRetryAt: 0,
        });
        return;
      }

      store.add(item);
    };

    req.onerror = () => reject(req.error || new Error("Failed to enqueue sync action"));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Failed to enqueue sync action"));
    tx.onabort = () => reject(tx.error || new Error("Sync queue enqueue aborted"));
  });
  logDataSource("IDB", "sync_queue.enqueue", {
    entity: item.entity || null,
    method: item.method || null,
    dedupeKey: item.dedupeKey || null,
  });
};

export const getPendingSyncActions = async (entity = null) => {
  const session = await getOfflineSessionMeta().catch(() => null);
  const activeBusinessId = String(session?.businessId || "").trim();
  const now = Date.now();
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
        .filter((item) => Number(item?.nextRetryAt || 0) <= now)
        .filter((item) => isQueueRowInActiveBusiness(item, activeBusinessId))
        .sort((a, b) => Number(a?.createdAt || 0) - Number(b?.createdAt || 0));
      resolve(pending);
    };
    req.onerror = () => reject(req.error || new Error("Failed to read sync queue"));
  });
};

export const completeSyncAction = async (id) => {
  if (!id) return;
  const session = await getOfflineSessionMeta().catch(() => null);
  const activeBusinessId = String(session?.businessId || "").trim();
  const db = await getDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("sync_queue", "readwrite");
    const store = tx.objectStore("sync_queue");
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const row = getReq.result;
      if (!row) return;
      if (
        !isQueueRowInActiveBusiness(row, activeBusinessId)
      ) {
        return;
      }
      store.delete(id);
    };
    getReq.onerror = () => reject(getReq.error || new Error("Failed to complete sync action"));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Failed to complete sync action"));
    tx.onabort = () => reject(tx.error || new Error("Sync action completion aborted"));
  });
  await setOfflineMetaValue("last_queue_success_at", Date.now());
  logDataSource("IDB", "sync_queue.complete", { id });
};

export const failSyncAction = async (id, errorMessage = "", options = {}) => {
  if (!id) return;
  const session = await getOfflineSessionMeta().catch(() => null);
  const activeBusinessId = String(session?.businessId || "").trim();
  const errorStatusCode =
    Number(typeof options === "number" ? options : options?.statusCode || 0) || 0;
  const db = await getDb();
  let queuedAction = null;
  await new Promise((resolve, reject) => {
    const tx = db.transaction("sync_queue", "readwrite");
    const store = tx.objectStore("sync_queue");
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (!existing) return;
      if (
        !isQueueRowInActiveBusiness(existing, activeBusinessId)
      ) {
        return;
      }
      const retries = Number(existing.retries || 0) + 1;
      const isClientFatal =
        errorStatusCode >= 400 &&
        errorStatusCode < 500 &&
        ![408, 409, 429].includes(errorStatusCode);
      const shouldStopRetry = isClientFatal || retries >= MAX_SYNC_RETRIES;
      const backoffMs = Math.min(RETRY_BASE_DELAY_MS * Math.pow(2, Math.max(0, retries - 1)), RETRY_MAX_DELAY_MS);
      queuedAction = {
        ...existing,
        status: shouldStopRetry ? "failed" : "pending",
        lastError: errorMessage || existing.lastError || "",
        retries,
        nextRetryAt: shouldStopRetry ? 0 : Date.now() + backoffMs,
        lastErrorStatusCode: errorStatusCode || existing.lastErrorStatusCode || 0,
        updatedAt: Date.now(),
      };
      store.put(queuedAction);
    };
    getReq.onerror = () => reject(getReq.error || new Error("Failed to update sync action"));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Failed to update sync action"));
    tx.onabort = () => reject(tx.error || new Error("Sync action update aborted"));
  });
  if (queuedAction) {
    await markQueuedEntityStatus(
      queuedAction,
      queuedAction.status === "failed" ? "failed" : "pending",
      errorMessage
    );
  }
  logDataSource("IDB", "sync_queue.retry", { id, errorMessage });
};

export const resetFailedSyncActions = async () => {
  const session = await getOfflineSessionMeta().catch(() => null);
  const activeBusinessId = String(session?.businessId || "").trim();
  const db = await getDb();
  let resetCount = 0;
  await new Promise((resolve, reject) => {
    const tx = db.transaction("sync_queue", "readwrite");
    const store = tx.objectStore("sync_queue");
    const req = store.getAll();
    req.onsuccess = () => {
      const all = Array.isArray(req.result) ? req.result : [];
      all.forEach((row) => {
        if (row?.status !== "failed") return;
        if (
          !isQueueRowInActiveBusiness(row, activeBusinessId)
        ) {
          return;
        }
        store.put({
          ...row,
          status: "pending",
          nextRetryAt: 0,
          updatedAt: Date.now(),
        });
        resetCount += 1;
      });
    };
    req.onerror = () => reject(req.error || new Error("Failed to reset failed sync actions"));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Failed to reset failed sync actions"));
    tx.onabort = () => reject(tx.error || new Error("Reset failed sync actions aborted"));
  });
  return resetCount;
};

export const retrySyncAction = async (id) => {
  if (!id) return false;
  const session = await getOfflineSessionMeta().catch(() => null);
  const activeBusinessId = String(session?.businessId || "").trim();
  const db = await getDb();
  let updated = false;
  let queuedAction = null;
  await new Promise((resolve, reject) => {
    const tx = db.transaction("sync_queue", "readwrite");
    const store = tx.objectStore("sync_queue");
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const row = getReq.result;
      if (!row) return;
      if (
        !isQueueRowInActiveBusiness(row, activeBusinessId)
      ) {
        return;
      }
      queuedAction = {
        ...row,
        status: "pending",
        nextRetryAt: 0,
        updatedAt: Date.now(),
      };
      store.put(queuedAction);
      updated = true;
    };
    getReq.onerror = () => reject(getReq.error || new Error("Failed to retry sync action"));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Failed to retry sync action"));
    tx.onabort = () => reject(tx.error || new Error("Retry sync action aborted"));
  });
  if (updated && queuedAction) await markQueuedEntityStatus(queuedAction, "pending");
  return updated;
};

export const discardSyncAction = async (id) => {
  if (!id) return false;
  const session = await getOfflineSessionMeta().catch(() => null);
  const activeBusinessId = String(session?.businessId || "").trim();
  const db = await getDb();
  let removed = false;
  let discardedAction = null;
  await new Promise((resolve, reject) => {
    const tx = db.transaction("sync_queue", "readwrite");
    const store = tx.objectStore("sync_queue");
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const row = getReq.result;
      if (!row) return;
      if (
        !isQueueRowInActiveBusiness(row, activeBusinessId)
      ) {
        return;
      }
      discardedAction = row;
      store.delete(id);
      removed = true;
    };
    getReq.onerror = () => reject(getReq.error || new Error("Failed to discard sync action"));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Failed to discard sync action"));
    tx.onabort = () => reject(tx.error || new Error("Discard sync action aborted"));
  });
  if (removed && discardedAction) await markQueuedEntityStatus(discardedAction, "discarded", "Change discarded before cloud sync");
  return removed;
};

export const getSyncQueueSnapshot = async () => {
  const session = await getOfflineSessionMeta().catch(() => null);
  const activeBusinessId = String(session?.businessId || "").trim();
  const now = Date.now();
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sync_queue", "readonly");
    const store = tx.objectStore("sync_queue");
    const req = store.getAll();
    req.onsuccess = () => {
      const allRows = Array.isArray(req.result) ? req.result : [];
      const rows = activeBusinessId
        ? allRows.filter((row) => isQueueRowInActiveBusiness(row, activeBusinessId))
        : allRows;
      const pending = rows
        .filter((row) => row?.status === "pending")
        .sort((a, b) => Number(a?.createdAt || 0) - Number(b?.createdAt || 0));
      const duePending = pending.filter((row) => Number(row?.nextRetryAt || 0) <= now);
      const delayed = pending.filter((row) => Number(row?.nextRetryAt || 0) > now);
      const failed = rows
        .filter((row) => row?.status === "failed")
        .sort((a, b) => Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0));
      const latestErrors = [...failed, ...pending.filter((row) => row?.lastError)]
        .sort((a, b) => Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0))
        .slice(0, 5)
        .map((row) => ({
          id: row?.id,
          entity: row?.entity || "",
          method: row?.method || "",
          url: row?.url || "",
          message: row?.lastError || "",
          statusCode: Number(row?.lastErrorStatusCode || 0) || null,
          retries: Number(row?.retries || 0),
          status: row?.status || "pending",
          nextRetryAt: Number(row?.nextRetryAt || 0) || 0,
        }));

      const errorBreakdown = rows.reduce(
        (acc, row) => {
          const statusCode = Number(row?.lastErrorStatusCode || 0) || 0;
          const message = String(row?.lastError || "").toLowerCase();
          if (!statusCode && !message) return acc;
          if (statusCode === 409 || message.includes("conflict")) {
            acc.conflict += 1;
            return acc;
          }
          if ((statusCode >= 400 && statusCode < 500 && ![408, 409, 429].includes(statusCode)) || message.includes("validation")) {
            acc.validation += 1;
            return acc;
          }
          if (message.includes("offline") || message.includes("network")) {
            acc.network += 1;
            return acc;
          }
          acc.other += 1;
          return acc;
        },
        { conflict: 0, validation: 0, network: 0, other: 0 }
      );

      resolve({
        total: rows.length,
        pendingCount: duePending.length,
        delayedCount: delayed.length,
        failedCount: failed.length,
        errorBreakdown,
        nextAction:
          duePending.length > 0
            ? {
                id: duePending[0]?.id,
                entity: duePending[0]?.entity || "",
                method: duePending[0]?.method || "",
                url: duePending[0]?.url || "",
                retries: Number(duePending[0]?.retries || 0),
              }
            : null,
        latestErrors,
      });
    };
    req.onerror = () => reject(req.error || new Error("Failed to read sync queue snapshot"));
  });
};

export const remapPendingSyncEntityId = async (entity, fromId, toId) => {
  const sourceId = String(fromId || "").trim();
  const targetId = String(toId || "").trim();
  const entityName = String(entity || "").trim();
  if (!entityName || !sourceId || !targetId || sourceId === targetId) return 0;
  const session = await getOfflineSessionMeta().catch(() => null);
  const activeBusinessId = String(session?.businessId || "").trim();

  const db = await getDb();
  const changed = await new Promise((resolve, reject) => {
    const tx = db.transaction("sync_queue", "readwrite");
    const store = tx.objectStore("sync_queue");
    const req = store.getAll();
    let updates = 0;

    req.onsuccess = () => {
      const rows = Array.isArray(req.result) ? req.result : [];
      rows.forEach((item) => {
        if (
          !isQueueRowInActiveBusiness(item, activeBusinessId)
        ) {
          return;
        }

        const metaId = String(item?.meta?.id || "");
        const url = String(item?.url || "");
        const payload = item?.payload || null;
        const urlNeedsRemap =
          url.includes(`/${sourceId}/`) || url.endsWith(`/${sourceId}`) || url.includes(sourceId);
        const metaNeedsRemap = metaId === sourceId;
        const payloadRemapped = replaceExactIdDeep(payload, sourceId, targetId);
        const payloadNeedsRemap = JSON.stringify(payloadRemapped) !== JSON.stringify(payload);
        if (!urlNeedsRemap && !metaNeedsRemap && !payloadNeedsRemap) return;

        const nextMeta = { ...(item?.meta || {}) };
        if (metaNeedsRemap) nextMeta.id = targetId;

        const nextUrl = url.replaceAll(sourceId, targetId);
        const nextDedupeKey = String(item?.dedupeKey || "").replaceAll(sourceId, targetId);
        store.put({
          ...item,
          url: nextUrl,
          dedupeKey: nextDedupeKey || item?.dedupeKey,
          meta: nextMeta,
          payload: payloadRemapped,
          updatedAt: Date.now(),
        });
        updates += 1;
      });
    };

    req.onerror = () => reject(req.error || new Error("Failed to remap sync queue ids"));
    tx.oncomplete = () => resolve(updates);
    tx.onerror = () => reject(tx.error || new Error("Failed to remap sync queue ids"));
    tx.onabort = () => reject(tx.error || new Error("Sync queue remap aborted"));
  });

  // Also update optimistic cached records that reference the temporary ID.
  // This keeps local screens consistent while dependent queued actions sync.
  await new Promise((resolve, reject) => {
    const tx = db.transaction("entities", "readwrite");
    const store = tx.objectStore("entities");
    const req = store.getAll();
    req.onsuccess = () => {
      const rows = Array.isArray(req.result) ? req.result : [];
      rows.forEach((row) => {
        const nextData = replaceExactIdDeep(row?.data, sourceId, targetId);
        if (JSON.stringify(nextData) !== JSON.stringify(row?.data)) {
          store.put({ ...row, data: nextData, updatedAt: Date.now() });
        }
      });
    };
    req.onerror = () => reject(req.error || new Error("Failed to remap cached entity IDs"));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Failed to remap cached entity IDs"));
    tx.onabort = () => reject(tx.error || new Error("Cached entity ID remap aborted"));
  });

  if (changed > 0) {
    logDataSource("IDB", "sync_queue.id_remap", {
      entity: entityName,
      fromId: sourceId,
      toId: targetId,
      count: changed,
    });
  }
  return changed;
};

const resolveScopedEntityKey = async (key) => {
  const raw = String(key || "").trim();
  if (!raw) return "";
  if (raw.startsWith("b:")) return raw;
  const session = await getOfflineSessionMeta().catch(() => null);
  const businessId = String(session?.businessId || "").trim();
  if (!businessId) return raw;
  return `b:${businessId}:${raw}`;
};

export const upsertEntitySnapshot = async (key, data) => {
  if (!key) return;
  const scopedKey = await resolveScopedEntityKey(key);
  if (!scopedKey) return;
  await runTx("entities", "readwrite", (store) =>
    store.put({
      key: scopedKey,
      data,
      updatedAt: Date.now(),
    })
  );
  await setOfflineMetaValue("last_snapshot_update_at", Date.now());
  logDataSource("IDB", "entity.upsert", { key: scopedKey });
};

export const getEntitySnapshot = async (key) => {
  if (!key) return null;
  const scopedKey = await resolveScopedEntityKey(key);
  if (!scopedKey) return null;
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("entities", "readonly");
    const store = tx.objectStore("entities");
    const req = store.get(scopedKey);
    req.onsuccess = () => {
      logDataSource("IDB", "entity.get", { key: scopedKey });
      resolve(req.result?.data ?? null);
    };
    req.onerror = () => reject(req.error || new Error("Failed to read entity snapshot"));
  });
};

const markQueuedEntityStatus = async (action, status, errorMessage = "") => {
  const entity = String(action?.entity || "").trim();
  const id = String(action?.meta?.id || action?.meta?.localId || "").trim();
  if (!entity || !id) return;
  const overlayKey = entity === "businessUsers" ? "users:business:overlay" : `${entity}:overlay`;
  const overlay = await getEntitySnapshot(overlayKey).catch(() => null);
  if (!overlay || typeof overlay !== "object" || !overlay[id]) return;
  await upsertEntitySnapshot(overlayKey, {
    ...overlay,
    [id]: {
      ...overlay[id],
      __syncStatus: status,
      ...(errorMessage ? { __syncError: errorMessage } : {}),
    },
  });
};

export const listEntitySnapshots = async (prefix = "") => {
  const scopedPrefix = await resolveScopedEntityKey(prefix || "");
  const session = await getOfflineSessionMeta().catch(() => null);
  const businessId = String(session?.businessId || "").trim();
  const businessPrefix = businessId ? `b:${businessId}:` : "";
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("entities", "readonly");
    const store = tx.objectStore("entities");
    const req = store.getAll();
    req.onsuccess = () => {
      const all = Array.isArray(req.result) ? req.result : [];
      const filtered = scopedPrefix
        ? all.filter((item) => String(item?.key || "").startsWith(scopedPrefix))
        : businessPrefix
          ? all.filter((item) => String(item?.key || "").startsWith(businessPrefix))
          : all;
      resolve(filtered);
    };
    req.onerror = () => reject(req.error || new Error("Failed to list entity snapshots"));
  });
};
