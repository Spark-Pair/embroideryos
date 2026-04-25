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

const CRP_RATE_CONFIGS_URL = "/crp-rate-configs";
const ALL_KEY = "crpRateConfigs:all";
const OVERLAY_KEY = "crpRateConfigs:overlay";

let syncInFlight = false;
let onlineHandlerAttached = false;
let syncLoopAttached = false;

const normalizeCategory = (category) => (String(category || "").trim() === "Packing" ? "Cropping" : category);

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
const sortLatestFirst = (rows = []) =>
  [...rows].sort((a, b) => {
    const aTime = toMillis(a?.createdAt) || objectIdToMillis(normalizeId(a));
    const bTime = toMillis(b?.createdAt) || objectIdToMillis(normalizeId(b));
    return bTime - aTime;
  });

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

const getAllBase = async () => {
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

const patchOverlay = async (patchFn) => {
  const existing = await getOverlay();
  const next = patchFn({ ...existing }) || {};
  await setOverlay(next);
};

const refreshAllSnapshotFromCloud = async () => {
  if (!navigator.onLine) return;
  const res = await apiClient.get(CRP_RATE_CONFIGS_URL);
  const rows = uniqueById(Array.isArray(res?.data?.data) ? res.data.data : res?.data || []);
  await upsertEntitySnapshot(ALL_KEY, rows);
  logDataSource("IDB", "crpRateConfigs.snapshot.refreshed", { count: rows.length });
};

const syncCreateSuccess = async (action, serverRow) => {
  const localId = String(action?.meta?.localId || "");
  const realId = normalizeId(serverRow);

  await patchOverlay((overlay) => {
    if (localId) delete overlay[localId];
    if (realId) overlay[realId] = { ...serverRow, _id: realId };
    return overlay;
  });
};

const syncUpdateSuccess = async (action, serverRow) => {
  const id = normalizeId(serverRow) || String(action?.meta?.id || "");
  if (!id) return;
  await patchOverlay((overlay) => {
    overlay[id] = { ...serverRow, _id: id };
    return overlay;
  });
};

const syncToggleSuccess = async (action, payload) => {
  const id = String(payload?.id || action?.meta?.id || "");
  if (!id) return;
  await patchOverlay((overlay) => {
    const prev = overlay[id] || {};
    overlay[id] = {
      ...prev,
      _id: id,
      isActive: !!payload?.isActive,
    };
    return overlay;
  });
};

const processQueue = async () => {
  if (syncInFlight) return;
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;

  syncInFlight = true;
  try {
    const actions = await getPendingSyncActions("crpRateConfigs");
    for (const action of actions) {
      try {
        if (action.method === "POST") {
          const res = await apiClient.post(action.url, action.payload);
          await syncCreateSuccess(action, res?.data?.data || res?.data);
        } else if (action.method === "PUT") {
          const res = await apiClient.put(action.url, action.payload);
          await syncUpdateSuccess(action, res?.data?.data || res?.data);
        } else if (action.method === "PATCH") {
          const res = await apiClient.patch(action.url);
          await syncToggleSuccess(action, res?.data || {});
        }

        await completeSyncAction(action.id);
      } catch (error) {
        await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed", { statusCode: error?.response?.status });
      }
    }

    await refreshAllSnapshotFromCloud();
  } finally {
    syncInFlight = false;
  }
};

const ensureOnlineSyncHook = () => {
  if (onlineHandlerAttached || typeof window === "undefined") return;
  onlineHandlerAttached = true;
  window.addEventListener("online", () => {
    processQueue().catch(() => null);
  });
};

ensureOnlineSyncHook();

const ensureSyncLoop = () => {
  if (syncLoopAttached || typeof window === "undefined") return;
  syncLoopAttached = true;
  setInterval(() => {
    processQueue().catch(() => null);
  }, 15000);
  window.addEventListener("visibilitychange", () => {
    if (!document.hidden) processQueue().catch(() => null);
  });
};

ensureSyncLoop();

export const fetchCrpRateConfigsLocalFirst = async (params = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(CRP_RATE_CONFIGS_URL, { params });
    return res.data;
  }

  const overlay = await getOverlay();
  const base = await getAllBase();
  const merged = withOverlayList(base, overlay);

  const status = String(params?.status || "").trim().toLowerCase();
  const category = String(normalizeCategory(params?.category) || "").trim();
  const typeName = String(params?.type_name || "").trim().toLowerCase();

  const filtered = merged
    .filter((row) => {
      if (status === "active" && !row?.isActive) return false;
      if (status === "inactive" && row?.isActive) return false;
      if (category && row?.category !== category) return false;
      if (typeName && !String(row?.type_name || "").toLowerCase().includes(typeName)) return false;
      return true;
    });
  let sorted = sortLatestFirst(filtered);
  if (sorted.length > 0) {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      refreshAllSnapshotFromCloud().catch(() => null);
    }
    return { success: true, data: sorted };
  }

  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      await refreshAllSnapshotFromCloud();
      const nextMerged = withOverlayList(await getAllBase(), await getOverlay());
      sorted = sortLatestFirst(
        nextMerged.filter((row) => {
          if (status === "active" && !row?.isActive) return false;
          if (status === "inactive" && row?.isActive) return false;
          if (category && row?.category !== category) return false;
          if (typeName && !String(row?.type_name || "").toLowerCase().includes(typeName)) return false;
          return true;
        })
      );
    } catch {
      // fall back to local empty state
    }
  }

  return { success: true, data: sorted };
};

export const createCrpRateConfigLocalFirst = async (payload) => {
  const normalizedPayload = {
    ...(payload || {}),
    category: normalizeCategory(payload?.category),
  };
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.post(CRP_RATE_CONFIGS_URL, normalizedPayload);
    return res.data;
  }

  const localId = `local-crp-rate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const localRow = {
    _id: localId,
    ...normalizedPayload,
    isActive: true,
    __syncStatus: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await patchOverlay((overlay) => {
    overlay[localId] = localRow;
    return overlay;
  });

  await queueSyncAction({
    entity: "crpRateConfigs",
    method: "POST",
    url: CRP_RATE_CONFIGS_URL,
    payload: normalizedPayload,
    meta: { localId },
  });

  processQueue().catch(() => null);
  return { success: true, data: localRow };
};

export const updateCrpRateConfigLocalFirst = async (id, payload) => {
  const normalizedPayload = {
    ...(payload || {}),
    category: normalizeCategory(payload?.category),
  };
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.put(`${CRP_RATE_CONFIGS_URL}/${id}`, normalizedPayload);
    return res.data;
  }

  const next = {
    ...normalizedPayload,
    _id: String(id),
    __syncStatus: "pending",
    updatedAt: new Date().toISOString(),
  };

  await patchOverlay((overlay) => {
    overlay[String(id)] = { ...(overlay[String(id)] || {}), ...next };
    return overlay;
  });

  await queueSyncAction({
    entity: "crpRateConfigs",
    method: "PUT",
    url: `${CRP_RATE_CONFIGS_URL}/${id}`,
    payload: normalizedPayload,
    meta: { id: String(id) },
  });

  processQueue().catch(() => null);
  return { success: true, data: next };
};

export const toggleCrpRateConfigStatusLocalFirst = async (id) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.patch(`${CRP_RATE_CONFIGS_URL}/${id}/toggle-status`);
    return res.data;
  }

  await patchOverlay((overlay) => {
    const prev = overlay[String(id)] || {};
    overlay[String(id)] = {
      ...prev,
      _id: String(id),
      isActive: !prev?.isActive,
      __syncStatus: "pending",
      updatedAt: new Date().toISOString(),
    };
    return overlay;
  });

  await queueSyncAction({
    entity: "crpRateConfigs",
    method: "PATCH",
    url: `${CRP_RATE_CONFIGS_URL}/${id}/toggle-status`,
    payload: null,
    meta: { id: String(id) },
  });

  processQueue().catch(() => null);
  return { success: true };
};
