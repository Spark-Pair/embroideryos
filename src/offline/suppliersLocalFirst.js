import { apiClient } from "../api/apiClient";
import {
  completeSyncAction,
  failSyncAction,
  getEntitySnapshot,
  getPendingSyncActions,
  offlineAccess,
  queueSyncAction,
  remapPendingSyncEntityId,
  upsertEntitySnapshot,
} from "./idb";
import { logDataSource } from "./logger";

const SUPPLIERS_URL = "/suppliers";
const ALL_KEY = "suppliers:all";
const STATS_KEY = "suppliers:stats";
const OVERLAY_KEY = "suppliers:overlay";

let syncInFlight = false;
let onlineHandlerAttached = false;
let syncLoopAttached = false;

const normalizeSupplier = (value = {}) => ({
  ...value,
  opening_balance:
    value?.opening_balance === "" || value?.opening_balance == null
      ? 0
      : Number(value.opening_balance),
});

const normalizeId = (row) => String(row?._id || row?.id || "");
const resolveIdInput = (value) => {
  if (value && typeof value === "object") return String(value?._id || value?.id || "").trim();
  return String(value || "").trim();
};
const isLocalId = (value) => resolveIdInput(value).startsWith("local-");
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
const toNum = (value) => {
  if (value === "" || value == null) return 0;
  if (typeof value === "string") {
    const n = Number(value.replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const sortLatestFirst = (rows = []) =>
  [...rows].sort((a, b) => {
    const aTime = toMillis(a?.createdAt) || toMillis(a?.updatedAt) || objectIdToMillis(normalizeId(a));
    const bTime = toMillis(b?.createdAt) || toMillis(b?.updatedAt) || objectIdToMillis(normalizeId(b));
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

const getAllBaseSuppliers = async () => {
  const all = await getEntitySnapshot(ALL_KEY);
  return uniqueById(Array.isArray(all) ? all : []);
};

const getExpensesSnapshot = async () => {
  const base = await getEntitySnapshot("expenses:all");
  const overlay = (await getEntitySnapshot("expenses:overlay")) || {};
  const rows = Array.isArray(base) ? base : [];
  const map = new Map(rows.map((row) => [normalizeId(row), row]));
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

const getSupplierPaymentsSnapshot = async () => {
  const base = await getEntitySnapshot("supplierPayments:all");
  const overlay = (await getEntitySnapshot("supplierPayments:overlay")) || {};
  const rows = Array.isArray(base) ? base : [];
  const map = new Map(rows.map((row) => [normalizeId(row), row]));
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

const attachSupplierBalances = async (rows = []) => {
  const expenses = await getExpensesSnapshot();
  const payments = await getSupplierPaymentsSnapshot();

  const expenseMap = new Map();
  expenses.forEach((exp) => {
    const id = String(exp?.supplier_id?._id || exp?.supplier_id || "");
    if (!id) return;
    expenseMap.set(id, (expenseMap.get(id) || 0) + toNum(exp?.amount));
  });

  const paymentMap = new Map();
  payments.forEach((p) => {
    const id = String(p?.supplier_id?._id || p?.supplier_id || "");
    if (!id) return;
    paymentMap.set(id, (paymentMap.get(id) || 0) + toNum(p?.amount));
  });

  return rows.map((row) => {
    const id = normalizeId(row);
    const opening = toNum(row?.opening_balance);
    const spent = expenseMap.get(id) || 0;
    const paid = paymentMap.get(id) || 0;
    return {
      ...row,
      current_balance: opening + spent - paid,
    };
  });
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

const applyFilters = (rows = [], params = {}) => {
  let data = [...rows];
  const name = String(params?.name || "").trim().toLowerCase();
  const status = String(params?.status || "").trim().toLowerCase();

  if (name) {
    data = data.filter((row) => String(row?.name || "").toLowerCase().includes(name));
  }

  if (status === "active") data = data.filter((row) => Boolean(row?.isActive));
  if (status === "inactive") data = data.filter((row) => !Boolean(row?.isActive));

  return sortLatestFirst(data);
};

const toPaginatedResponse = (rows = [], params = {}) => {
  const page = Math.max(1, Number(params?.page || 1));
  const limit = Math.max(1, Number(params?.limit || 30));
  const totalItems = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const start = (page - 1) * limit;
  const data = rows.slice(start, start + limit);

  return {
    success: true,
    data,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage: limit,
    },
  };
};

const patchOverlay = async (patchFn) => {
  const existing = await getOverlay();
  const next = patchFn({ ...existing }) || {};
  await setOverlay(next);
};

const findSupplierByIdLocal = async (id) => {
  const target = String(id || "");
  if (!target) return null;
  const overlay = await getOverlay();
  if (overlay[target] && !overlay[target]?._deleted) return overlay[target];
  const all = await getAllBaseSuppliers();
  return all.find((row) => normalizeId(row) === target) || null;
};

const refreshAllSnapshotFromCloud = async () => {
  if (!navigator.onLine) return;
  const res = await apiClient.get(`${SUPPLIERS_URL}?page=1&limit=5000`);
  const rows = uniqueById(Array.isArray(res?.data?.data) ? res.data.data : []);
  await upsertEntitySnapshot(ALL_KEY, rows);
  await upsertEntitySnapshot(STATS_KEY, {
    success: true,
    data: {
      total: rows.length,
      active: rows.filter((r) => Boolean(r?.isActive)).length,
      inactive: rows.filter((r) => !Boolean(r?.isActive)).length,
    },
  });
  logDataSource("IDB", "suppliers.snapshot.refreshed", { count: rows.length });
};

const syncCreateSuccess = async (action, serverSupplier) => {
  const localId = String(action?.meta?.localId || "");
  const realId = normalizeId(serverSupplier);

  await patchOverlay((overlay) => {
    if (localId) delete overlay[localId];
    if (realId) overlay[realId] = { ...serverSupplier, _id: realId };
    return overlay;
  });
  await remapPendingSyncEntityId("suppliers", localId, realId);
};

const syncUpdateSuccess = async (action, serverSupplier) => {
  const id = String(action?.meta?.id || normalizeId(serverSupplier));
  if (!id) return;
  await patchOverlay((overlay) => {
    overlay[id] = { ...serverSupplier, _id: id };
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

const processSupplierQueue = async () => {
  if (syncInFlight) return;
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;

  syncInFlight = true;
  try {
    const actions = await getPendingSyncActions("suppliers");
    for (const action of actions) {
      try {
        logDataSource("IDB", "sync.suppliers.start", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
        if (action.method === "POST") {
          const res = await apiClient.post(action.url, action.payload);
          const serverSupplier = res?.data?.supplier || res?.data;
          await syncCreateSuccess(action, serverSupplier);
        } else if (action.method === "PUT") {
          const res = await apiClient.put(action.url, action.payload);
          const serverSupplier = res?.data?.supplier || res?.data;
          await syncUpdateSuccess(action, serverSupplier);
        } else if (action.method === "PATCH") {
          const res = await apiClient.patch(action.url);
          await syncToggleSuccess(action, res?.data || {});
        }

        await completeSyncAction(action.id);
        logDataSource("IDB", "sync.suppliers.success", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
      } catch (error) {
        await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed");
        logDataSource("IDB", "sync.suppliers.failed", {
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
    processSupplierQueue().catch(() => null);
  });
};

ensureOnlineSyncHook();

const ensureSyncLoop = () => {
  if (syncLoopAttached || typeof window === "undefined") return;
  syncLoopAttached = true;
  setInterval(() => {
    processSupplierQueue().catch(() => null);
  }, 15000);
  window.addEventListener("visibilitychange", () => {
    if (!document.hidden) processSupplierQueue().catch(() => null);
  });
};

ensureSyncLoop();

export const fetchSuppliersLocalFirst = async (params = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const query = new URLSearchParams({
      page: params.page || 1,
      limit: params.limit || 30,
      ...(params.name && { name: params.name }),
      ...(params.status && { status: params.status }),
    }).toString();
    const res = await apiClient.get(`${SUPPLIERS_URL}?${query}`);
    return res.data;
  }

  const overlay = await getOverlay();
  const base = await getAllBaseSuppliers();
  const merged = withOverlayList(base, overlay);
  const filtered = applyFilters(merged, params);
  const withBalances = await attachSupplierBalances(filtered);

  logDataSource("IDB", "suppliers.fetch.local", {
    page: Number(params?.page || 1),
    limit: Number(params?.limit || 30),
    count: withBalances.length,
  });

  return toPaginatedResponse(withBalances, params);
};

export const fetchSupplierStatsLocalFirst = async () => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${SUPPLIERS_URL}/stats`);
    return res.data;
  }

  const overlay = await getOverlay();
  const base = await getAllBaseSuppliers();
  const merged = withOverlayList(base, overlay);
  const stats = {
    success: true,
    data: {
      total: merged.length,
      active: merged.filter((row) => Boolean(row?.isActive)).length,
      inactive: merged.filter((row) => !Boolean(row?.isActive)).length,
    },
  };

  await upsertEntitySnapshot(STATS_KEY, stats);
  logDataSource("IDB", "suppliers.stats.local", stats.data);
  return stats;
};

export const fetchSupplierLocalFirst = async (id) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${SUPPLIERS_URL}/${id}`);
    return res.data;
  }

  const local = await findSupplierByIdLocal(id);
  const enriched = local ? (await attachSupplierBalances([local]))[0] : null;
  logDataSource("IDB", "suppliers.get.local", { id: String(id || "") });
  if (enriched) return enriched;
  throw new Error("Supplier not available locally");
};

export const createSupplierLocalFirst = async (payload) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.post(SUPPLIERS_URL, payload);
    return res.data;
  }

  const localId = `local-supplier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const localSupplier = {
    _id: localId,
    ...normalizeSupplier(payload),
    isActive: true,
    __syncStatus: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await patchOverlay((overlay) => {
    overlay[localId] = localSupplier;
    return overlay;
  });

  await queueSyncAction({
    entity: "suppliers",
    method: "POST",
    url: SUPPLIERS_URL,
    payload: normalizeSupplier(payload),
    meta: { localId },
  });

  if (navigator.onLine) await processSupplierQueue();
  else processSupplierQueue().catch(() => null);
  return { supplier: localSupplier };
};

export const updateSupplierLocalFirst = async (id, payload) => {
  const targetId = resolveIdInput(id) || resolveIdInput(payload?.id) || resolveIdInput(payload?._id);
  if (!targetId) throw new Error("Invalid supplier id for update");

  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.put(`${SUPPLIERS_URL}/${targetId}`, payload);
    return res.data;
  }

  const existing = await findSupplierByIdLocal(targetId);
  const next = {
    ...(existing || {}),
    ...normalizeSupplier(payload),
    _id: targetId,
    __syncStatus: "pending",
    updatedAt: new Date().toISOString(),
  };

  await patchOverlay((overlay) => {
    overlay[targetId] = next;
    return overlay;
  });

  await queueSyncAction({
    entity: "suppliers",
    method: "PUT",
    url: `${SUPPLIERS_URL}/${targetId}`,
    payload: normalizeSupplier(payload),
    meta: { id: targetId },
  });

  if (navigator.onLine) await processSupplierQueue();
  else processSupplierQueue().catch(() => null);
  return next;
};

export const toggleSupplierStatusLocalFirst = async (id) => {
  const targetId = resolveIdInput(id);
  if (!targetId) throw new Error("Invalid supplier id for status toggle");

  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.patch(`${SUPPLIERS_URL}/${targetId}/toggle-status`);
    return res.data;
  }

  const existing = await findSupplierByIdLocal(targetId);
  const nextActive = !Boolean(existing?.isActive);

  await patchOverlay((overlay) => {
    const prev = overlay[targetId] || existing || {};
    overlay[targetId] = {
      ...prev,
      _id: targetId,
      isActive: nextActive,
      __syncStatus: "pending",
      updatedAt: new Date().toISOString(),
    };
    return overlay;
  });

  const method = isLocalId(targetId) ? "PUT" : "PATCH";
  const url = isLocalId(targetId) ? `${SUPPLIERS_URL}/${targetId}` : `${SUPPLIERS_URL}/${targetId}/toggle-status`;
  const payload = isLocalId(targetId) ? { isActive: nextActive } : null;

  await queueSyncAction({
    entity: "suppliers",
    method,
    url,
    payload,
    meta: { id: targetId },
  });

  if (navigator.onLine) await processSupplierQueue();
  else processSupplierQueue().catch(() => null);
  return { id: targetId, isActive: nextActive };
};

export const refreshSuppliersFromCloud = async () => {
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;
  await refreshAllSnapshotFromCloud();
};
