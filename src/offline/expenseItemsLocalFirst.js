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

const EXPENSE_ITEMS_URL = "/expense-items";
const ALL_KEY = "expenseItems:all";
const OVERLAY_KEY = "expenseItems:overlay";

let syncInFlight = false;
let onlineHandlerAttached = false;
let syncLoopAttached = false;

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

const getAllBaseItems = async () => {
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
  const res = await apiClient.get(EXPENSE_ITEMS_URL);
  const rows = uniqueById(Array.isArray(res?.data?.data) ? res.data.data : res?.data || []);
  await upsertEntitySnapshot(ALL_KEY, rows);
  logDataSource("IDB", "expenseItems.snapshot.refreshed", { count: rows.length });
};

const syncCreateSuccess = async (action, serverItem) => {
  const localId = String(action?.meta?.localId || "");
  const realId = normalizeId(serverItem);

  await patchOverlay((overlay) => {
    if (localId) delete overlay[localId];
    if (realId) overlay[realId] = { ...serverItem, _id: realId };
    return overlay;
  });
};

const syncUpdateSuccess = async (action, serverItem) => {
  const id = normalizeId(serverItem) || String(action?.meta?.id || "");
  if (!id) return;
  await patchOverlay((overlay) => {
    overlay[id] = { ...serverItem, _id: id };
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
      isActive: Boolean(payload?.isActive),
    };
    return overlay;
  });
};

const processExpenseItemQueue = async () => {
  if (syncInFlight) return;
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;

  syncInFlight = true;
  try {
    const actions = await getPendingSyncActions("expenseItems");
    for (const action of actions) {
      try {
        logDataSource("IDB", "sync.expenseItems.start", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
        if (action.method === "POST") {
          const res = await apiClient.post(action.url, action.payload);
          const serverItem = res?.data?.data || res?.data;
          await syncCreateSuccess(action, serverItem);
        } else if (action.method === "PUT") {
          const res = await apiClient.put(action.url, action.payload);
          const serverItem = res?.data?.data || res?.data;
          await syncUpdateSuccess(action, serverItem);
        } else if (action.method === "PATCH") {
          const res = await apiClient.patch(action.url);
          await syncToggleSuccess(action, res?.data || {});
        }

        await completeSyncAction(action.id);
        logDataSource("IDB", "sync.expenseItems.success", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
      } catch (error) {
        await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed");
        logDataSource("IDB", "sync.expenseItems.failed", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
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
    processExpenseItemQueue().catch(() => null);
  });
};

ensureOnlineSyncHook();

const ensureSyncLoop = () => {
  if (syncLoopAttached || typeof window === "undefined") return;
  syncLoopAttached = true;
  setInterval(() => {
    processExpenseItemQueue().catch(() => null);
  }, 15000);
  window.addEventListener("visibilitychange", () => {
    if (!document.hidden) processExpenseItemQueue().catch(() => null);
  });
};

ensureSyncLoop();

export const fetchExpenseItemsLocalFirst = async (params = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(EXPENSE_ITEMS_URL, { params });
    return res.data;
  }

  const overlay = await getOverlay();
  const base = await getAllBaseItems();
  const merged = withOverlayList(base, overlay);
  const status = String(params?.status || "").trim().toLowerCase();
  const filtered =
    status === "active"
      ? merged.filter((row) => Boolean(row?.isActive))
      : status === "inactive"
        ? merged.filter((row) => !Boolean(row?.isActive))
        : merged;
  const sorted = sortLatestFirst(filtered);
  logDataSource("IDB", "expenseItems.fetch.local", { count: sorted.length });
  return { data: sorted };
};

export const createExpenseItemLocalFirst = async (payload) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.post(EXPENSE_ITEMS_URL, payload);
    return res.data;
  }

  const localId = `local-expense-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const localItem = {
    _id: localId,
    ...payload,
    isActive: true,
    __syncStatus: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await patchOverlay((overlay) => {
    overlay[localId] = localItem;
    return overlay;
  });

  await queueSyncAction({
    entity: "expenseItems",
    method: "POST",
    url: EXPENSE_ITEMS_URL,
    payload,
    meta: { localId },
  });

  processExpenseItemQueue().catch(() => null);
  return { data: localItem };
};

export const updateExpenseItemLocalFirst = async (id, payload) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.put(`${EXPENSE_ITEMS_URL}/${id}`, payload);
    return res.data;
  }

  const localItem = {
    ...(payload || {}),
    _id: String(id),
    __syncStatus: "pending",
    updatedAt: new Date().toISOString(),
  };

  await patchOverlay((overlay) => {
    overlay[String(id)] = { ...(overlay[String(id)] || {}), ...localItem };
    return overlay;
  });

  await queueSyncAction({
    entity: "expenseItems",
    method: "PUT",
    url: `${EXPENSE_ITEMS_URL}/${id}`,
    payload,
    meta: { id: String(id) },
  });

  processExpenseItemQueue().catch(() => null);
  return { data: localItem };
};

export const toggleExpenseItemStatusLocalFirst = async (id) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.patch(`${EXPENSE_ITEMS_URL}/${id}/toggle-status`);
    return res.data;
  }

  await patchOverlay((overlay) => {
    const prev = overlay[String(id)] || {};
    overlay[String(id)] = {
      ...prev,
      _id: String(id),
      isActive: !Boolean(prev?.isActive),
      __syncStatus: "pending",
      updatedAt: new Date().toISOString(),
    };
    return overlay;
  });

  await queueSyncAction({
    entity: "expenseItems",
    method: "PATCH",
    url: `${EXPENSE_ITEMS_URL}/${id}/toggle-status`,
    payload: null,
    meta: { id: String(id) },
  });

  processExpenseItemQueue().catch(() => null);
  return { success: true };
};

export const refreshExpenseItemsFromCloud = async () => {
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;
  await refreshAllSnapshotFromCloud();
};
