import { apiClient } from "../api/apiClient";
import {
  completeSyncAction,
  failSyncAction,
  getEntitySnapshot,
  getPendingSyncActions,
  offlineAccess,
  queueSyncAction,
  upsertEntitySnapshot,
} from "./idb";
import { logDataSource } from "./logger";
import { normalizeProductionConfig } from "../utils/productionPayout";

const CONFIG_URL = "/production-configs";
const ALL_KEY = "productionConfigs:all";
const OVERLAY_KEY = "productionConfigs:overlay";

let syncInFlight = false;
let onlineHandlerAttached = false;
let syncLoopAttached = false;

const normalizeConfig = (value = {}) => ({
  ...normalizeProductionConfig(value),
  effective_date: value?.effective_date ?? null,
});

const normalizeId = (row) => String(row?._id || row?.id || "");
const toMillis = (value) => {
  if (!value) return 0;
  const d = new Date(value).getTime();
  return Number.isFinite(d) ? d : 0;
};
const objectIdToMillis = (id) => {
  const raw = String(id || "");
  if (!/^[a-fA-F0-9]{24}$/.test(raw)) return 0;
  return parseInt(raw.slice(0, 8), 16) * 1000;
};

const uniqueById = (rows = []) => {
  const map = new Map();
  rows.forEach((row) => {
    const id = normalizeId(row);
    if (!id) return;
    map.set(id, { ...row, _id: row?._id || id });
  });
  return Array.from(map.values());
};

const getOverlay = async () => (await getEntitySnapshot(OVERLAY_KEY)) || {};

const setOverlay = async (overlay) => {
  await upsertEntitySnapshot(OVERLAY_KEY, overlay || {});
};

const getAllBaseConfigs = async () => {
  const all = await getEntitySnapshot(ALL_KEY);
  return uniqueById(Array.isArray(all) ? all : []);
};

const withOverlayList = (rows = [], overlay = {}) => {
  const base = uniqueById(rows);
  const map = new Map(base.map((row) => [normalizeId(row), row]));

  Object.values(overlay || {}).forEach((item) => {
    if (!item) return;
    const id = normalizeId(item);
    if (!id) return;
    if (item._deleted) {
      map.delete(id);
      return;
    }
    const prev = map.get(id) || {};
    map.set(id, { ...prev, ...item, _id: id });
  });

  return Array.from(map.values());
};

const sortByEffectiveDateDesc = (rows = []) =>
  [...rows].sort((a, b) => {
    const aTime = toMillis(a?.effective_date) || toMillis(a?.createdAt) || objectIdToMillis(normalizeId(a));
    const bTime = toMillis(b?.effective_date) || toMillis(b?.createdAt) || objectIdToMillis(normalizeId(b));
    return bTime - aTime;
  });

const toEffectiveDateKey = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const getEffectiveConfigForDate = (rows = [], date) => {
  if (!date) {
    return sortByEffectiveDateDesc(rows)[0] || null;
  }
  const target = toMillis(date);
  if (!target) return sortByEffectiveDateDesc(rows)[0] || null;

  const eligible = rows.filter((row) => {
    const eff = toMillis(row?.effective_date);
    if (!eff) return false;
    return eff <= target;
  });

  if (eligible.length > 0) {
    return sortByEffectiveDateDesc(eligible)[0];
  }

  return sortByEffectiveDateDesc(rows)[0] || null;
};

const patchOverlay = async (patchFn) => {
  const existing = await getOverlay();
  const next = patchFn({ ...existing }) || {};
  await setOverlay(next);
};

const refreshLatestSnapshotFromCloud = async (date = null) => {
  if (!navigator.onLine) return;
  const params = date ? { date } : {};
  const res = await apiClient.get(CONFIG_URL, { params });
  const config = res?.data?.data || res?.data || null;
  if (!config) return;

  const existing = await getAllBaseConfigs();
  const list = uniqueById([...existing.filter((row) => normalizeId(row) !== normalizeId(config)), config]);
  await upsertEntitySnapshot(ALL_KEY, list);
  logDataSource("IDB", "productionConfigs.snapshot.refreshed", { count: list.length });
};

const syncCreateSuccess = async (action, serverConfig) => {
  const localId = String(action?.meta?.localId || "");
  const realId = normalizeId(serverConfig);

  await patchOverlay((overlay) => {
    if (localId) delete overlay[localId];
    if (realId) overlay[realId] = { ...serverConfig, _id: realId };
    return overlay;
  });
};

const syncUpdateSuccess = async (action, serverConfig) => {
  const id = normalizeId(serverConfig) || String(action?.meta?.id || "");
  if (!id) return;
  await patchOverlay((overlay) => {
    overlay[id] = { ...serverConfig, _id: id };
    return overlay;
  });
};

const processConfigQueue = async () => {
  if (syncInFlight) return;
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;

  syncInFlight = true;
  try {
    const actions = await getPendingSyncActions("productionConfigs");
    for (const action of actions) {
      try {
        logDataSource("IDB", "sync.productionConfigs.start", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
        if (action.method === "POST") {
          const res = await apiClient.post(action.url, action.payload);
          const serverConfig = res?.data?.data || res?.data;
          await syncCreateSuccess(action, serverConfig);
        } else if (action.method === "PUT") {
          const res = await apiClient.put(action.url, action.payload);
          const serverConfig = res?.data?.data || res?.data;
          await syncUpdateSuccess(action, serverConfig);
        }

        await completeSyncAction(action.id);
        logDataSource("IDB", "sync.productionConfigs.success", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
      } catch (error) {
        await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed", { statusCode: error?.response?.status });
        logDataSource("IDB", "sync.productionConfigs.failed", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
      }
    }

    await refreshLatestSnapshotFromCloud();
  } finally {
    syncInFlight = false;
  }
};

const ensureOnlineSyncHook = () => {
  if (onlineHandlerAttached || typeof window === "undefined") return;
  onlineHandlerAttached = true;
  window.addEventListener("online", () => {
    processConfigQueue().catch(() => null);
  });
};

ensureOnlineSyncHook();

const ensureSyncLoop = () => {
  if (syncLoopAttached || typeof window === "undefined") return;
  syncLoopAttached = true;
  setInterval(() => {
    processConfigQueue().catch(() => null);
  }, 15000);
  window.addEventListener("visibilitychange", () => {
    if (!document.hidden) processConfigQueue().catch(() => null);
  });
};

ensureSyncLoop();

export const fetchProductionConfigLocalFirst = async (date) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(CONFIG_URL, { params: date ? { date } : {} });
    return res.data;
  }

  const overlay = await getOverlay();
  const base = await getAllBaseConfigs();
  const merged = withOverlayList(base, overlay);
  const selected = getEffectiveConfigForDate(merged, date);

  if (selected) {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      refreshLatestSnapshotFromCloud(date).catch(() => null);
    }
    logDataSource("IDB", "productionConfigs.fetch.local", {
      date: date || null,
      found: true,
    });
    return { success: true, data: selected };
  }

  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      await refreshLatestSnapshotFromCloud(date);
      const nextBase = await getAllBaseConfigs();
      const nextSelected = getEffectiveConfigForDate(withOverlayList(nextBase, await getOverlay()), date);
      return { success: true, data: nextSelected || {} };
    } catch {
      // fall back to empty local shape
    }
  }

  logDataSource("IDB", "productionConfigs.fetch.local", {
    date: date || null,
    found: Boolean(selected),
  });

  return { success: true, data: selected || {} };
};

export const fetchAllProductionConfigsLocalFirst = async () => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(CONFIG_URL, { params: { all: true } });
    return res.data;
  }
  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const res = await apiClient.get(CONFIG_URL, { params: { all: true } });
      const rows = Array.isArray(res?.data?.data) ? res.data.data.map(normalizeConfig) : [];
      await upsertEntitySnapshot(ALL_KEY, rows);
    } catch {
      // Use the complete locally cached list when refresh is unavailable.
    }
  }
  const rows = withOverlayList(await getAllBaseConfigs(), await getOverlay());
  return { success: true, data: sortByEffectiveDateDesc(rows) };
};

export const createProductionConfigLocalFirst = async (payload) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.post(CONFIG_URL, payload);
    return res.data;
  }

  const normalizedPayload = normalizeConfig(payload);
  const effectiveDateKey = toEffectiveDateKey(normalizedPayload?.effective_date);
  const overlay = await getOverlay();
  const base = await getAllBaseConfigs();
  const merged = withOverlayList(base, overlay);
  const duplicate = merged.find((row) => toEffectiveDateKey(row?.effective_date) === effectiveDateKey);
  if (effectiveDateKey && duplicate) {
    const error = new Error("A production config already exists for this effective date");
    error.statusCode = 409;
    throw error;
  }

  const localId = `local-production-config-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const localConfig = {
    _id: localId,
    ...normalizedPayload,
    __syncStatus: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await patchOverlay((overlay) => {
    overlay[localId] = localConfig;
    return overlay;
  });

  await queueSyncAction({
    entity: "productionConfigs",
    method: "POST",
    url: CONFIG_URL,
    payload: normalizedPayload,
    meta: { localId },
    dedupeKey: `productionConfigs:POST:${effectiveDateKey || localId}`,
  });

  if (typeof navigator !== "undefined" && navigator.onLine) {
    await processConfigQueue();
  } else {
    processConfigQueue().catch(() => null);
  }
  return { success: true, data: localConfig };
};

export const updateProductionConfigLocalFirst = async (payload) => {
  const requestedId = String(payload?._id || payload?.id || "");
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.put(requestedId ? `${CONFIG_URL}/${requestedId}` : CONFIG_URL, payload);
    return res.data;
  }

  const overlay = await getOverlay();
  const base = await getAllBaseConfigs();
  const merged = withOverlayList(base, overlay);
  const latest = requestedId ? merged.find((row) => normalizeId(row) === requestedId) : sortByEffectiveDateDesc(merged)[0];

  const localId = latest?._id || `local-production-config-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const localConfig = {
    ...(latest || {}),
    ...normalizeConfig(payload),
    _id: localId,
    __syncStatus: "pending",
    updatedAt: new Date().toISOString(),
  };

  await patchOverlay((nextOverlay) => {
    nextOverlay[localId] = localConfig;
    return nextOverlay;
  });

  await queueSyncAction({
    entity: "productionConfigs",
    method: "PUT",
    url: requestedId ? `${CONFIG_URL}/${requestedId}` : CONFIG_URL,
    payload: normalizeConfig(payload),
    meta: { id: String(localId) },
  });

  if (typeof navigator !== "undefined" && navigator.onLine) {
    await processConfigQueue();
  } else {
    processConfigQueue().catch(() => null);
  }
  return { success: true, data: localConfig };
};

export const refreshProductionConfigFromCloud = async (date) => {
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;
  await refreshLatestSnapshotFromCloud(date);
};
