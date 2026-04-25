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

const CONFIG_URL = "/order-configs";
const ALL_KEY = "orderConfigs:all";
const OVERLAY_KEY = "orderConfigs:overlay";

let syncInFlight = false;
let onlineHandlerAttached = false;
let syncLoopAttached = false;

const normalizeConfig = (value = {}) => ({
  ...value,
  stitch_formula_enabled:
    value?.stitch_formula_enabled === undefined ? false : Boolean(value?.stitch_formula_enabled),
  stitch_formula_rules: Array.isArray(value?.stitch_formula_rules)
    ? value.stitch_formula_rules.map((rule = {}) => ({
        up_to: rule?.up_to === "" || rule?.up_to == null ? null : Number(rule.up_to),
        mode: ["fixed", "percent", "identity"].includes(rule?.mode) ? rule.mode : "identity",
        value: Number(rule?.value || 0),
      }))
    : [],
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

const getEffectiveConfigForDate = (rows = [], date) => {
  if (!date) return sortByEffectiveDateDesc(rows)[0] || null;
  const target = toMillis(date);
  if (!target) return sortByEffectiveDateDesc(rows)[0] || null;

  const eligible = rows.filter((row) => {
    const eff = toMillis(row?.effective_date);
    return eff && eff <= target;
  });

  return eligible.length > 0 ? sortByEffectiveDateDesc(eligible)[0] : sortByEffectiveDateDesc(rows)[0] || null;
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
  logDataSource("IDB", "orderConfigs.snapshot.refreshed", { count: list.length });
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
  if (syncInFlight || !offlineAccess.isUnlocked() || !navigator.onLine) return;
  syncInFlight = true;
  try {
    const actions = await getPendingSyncActions("orderConfigs");
    for (const action of actions) {
      try {
        if (action.method === "POST") {
          const res = await apiClient.post(action.url, action.payload);
          await syncCreateSuccess(action, res?.data?.data || res?.data);
        } else if (action.method === "PUT") {
          const res = await apiClient.put(action.url, action.payload);
          await syncUpdateSuccess(action, res?.data?.data || res?.data);
        }
        await completeSyncAction(action.id);
      } catch (error) {
        await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed", { statusCode: error?.response?.status });
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

export const fetchOrderConfigLocalFirst = async (date) => {
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

  return { success: true, data: {} };
};

export const createOrderConfigLocalFirst = async (payload) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.post(CONFIG_URL, payload);
    return res.data;
  }
  const localId = `local-order-config-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const localConfig = {
    _id: localId,
    ...normalizeConfig(payload),
    __syncStatus: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await patchOverlay((overlay) => {
    overlay[localId] = localConfig;
    return overlay;
  });
  await queueSyncAction({
    entity: "orderConfigs",
    method: "POST",
    url: CONFIG_URL,
    payload: normalizeConfig(payload),
    meta: { localId },
  });
  processConfigQueue().catch(() => null);
  return { success: true, data: localConfig };
};

export const updateOrderConfigLocalFirst = async (payload) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.put(CONFIG_URL, payload);
    return res.data;
  }
  const overlay = await getOverlay();
  const base = await getAllBaseConfigs();
  const merged = withOverlayList(base, overlay);
  const latest = sortByEffectiveDateDesc(merged)[0];
  const localId = latest?._id || `local-order-config-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
    entity: "orderConfigs",
    method: "PUT",
    url: CONFIG_URL,
    payload: normalizeConfig(payload),
    meta: { id: String(localId) },
  });
  processConfigQueue().catch(() => null);
  return { success: true, data: localConfig };
};
