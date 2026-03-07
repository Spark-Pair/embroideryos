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

const CUSTOMERS_URL = "/customers";
const ALL_KEY = "customers:all";
const STATS_KEY = "customers:stats";
const OVERLAY_KEY = "customers:overlay";

let syncInFlight = false;
let onlineHandlerAttached = false;
let syncLoopAttached = false;

const normalizeCustomer = (value = {}) => ({
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

const getAllBaseCustomers = async () => {
  const all = await getEntitySnapshot(ALL_KEY);
  return uniqueById(Array.isArray(all) ? all : []);
};

const getInvoicesSnapshot = async () => {
  const base = await getEntitySnapshot("invoices:all");
  const overlay = (await getEntitySnapshot("invoices:overlay")) || {};
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

const getCustomerPaymentsSnapshot = async () => {
  const base = await getEntitySnapshot("customerPayments:all");
  const overlay = (await getEntitySnapshot("customerPayments:overlay")) || {};
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

const attachCustomerBalances = async (rows = []) => {
  const invoices = await getInvoicesSnapshot();
  const payments = await getCustomerPaymentsSnapshot();

  const invoiceMap = new Map();
  invoices.forEach((inv) => {
    const id = String(inv?.customer_id?._id || inv?.customer_id || "");
    if (!id) return;
    invoiceMap.set(id, (invoiceMap.get(id) || 0) + toNum(inv?.total_amount));
  });

  const paymentMap = new Map();
  payments.forEach((p) => {
    const id = String(p?.customer_id?._id || p?.customer_id || "");
    if (!id) return;
    paymentMap.set(id, (paymentMap.get(id) || 0) + toNum(p?.amount));
  });

  return rows.map((row) => {
    const id = normalizeId(row);
    const opening = toNum(row?.opening_balance);
    const invoiced = invoiceMap.get(id) || 0;
    const paid = paymentMap.get(id) || 0;
    return {
      ...row,
      current_balance: opening + invoiced - paid,
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

const findCustomerByIdLocal = async (id) => {
  const target = String(id || "");
  if (!target) return null;
  const overlay = await getOverlay();
  if (overlay[target] && !overlay[target]?._deleted) return overlay[target];
  const all = await getAllBaseCustomers();
  return all.find((row) => normalizeId(row) === target) || null;
};

const refreshAllSnapshotFromCloud = async () => {
  if (!navigator.onLine) return;
  const res = await apiClient.get(`${CUSTOMERS_URL}?page=1&limit=5000`);
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
  logDataSource("IDB", "customers.snapshot.refreshed", { count: rows.length });
};

const syncCreateSuccess = async (action, serverCustomer) => {
  const localId = String(action?.meta?.localId || "");
  const realId = normalizeId(serverCustomer);

  await patchOverlay((overlay) => {
    if (localId) delete overlay[localId];
    if (realId) overlay[realId] = { ...serverCustomer, _id: realId };
    return overlay;
  });
  await remapPendingSyncEntityId("customers", localId, realId);
};

const syncUpdateSuccess = async (action, serverCustomer) => {
  const id = String(action?.meta?.id || normalizeId(serverCustomer));
  if (!id) return;
  await patchOverlay((overlay) => {
    overlay[id] = { ...serverCustomer, _id: id };
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

const processCustomerQueue = async () => {
  if (syncInFlight) return;
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;

  syncInFlight = true;
  try {
    const actions = await getPendingSyncActions("customers");
    for (const action of actions) {
      try {
        logDataSource("IDB", "sync.customers.start", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
        if (action.method === "POST") {
          const res = await apiClient.post(action.url, action.payload);
          const serverCustomer = res?.data?.customer || res?.data;
          await syncCreateSuccess(action, serverCustomer);
        } else if (action.method === "PUT") {
          const res = await apiClient.put(action.url, action.payload);
          const serverCustomer = res?.data?.customer || res?.data;
          await syncUpdateSuccess(action, serverCustomer);
        } else if (action.method === "PATCH") {
          const res = await apiClient.patch(action.url);
          await syncToggleSuccess(action, res?.data || {});
        }

        await completeSyncAction(action.id);
        logDataSource("IDB", "sync.customers.success", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
      } catch (error) {
        await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed", { statusCode: error?.response?.status });
        logDataSource("IDB", "sync.customers.failed", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
      }
    }

    // After queue sync, refresh canonical snapshot from cloud in background.
    await refreshAllSnapshotFromCloud();
  } finally {
    syncInFlight = false;
  }
};

const ensureOnlineSyncHook = () => {
  if (onlineHandlerAttached || typeof window === "undefined") return;
  onlineHandlerAttached = true;
  window.addEventListener("online", () => {
    processCustomerQueue().catch(() => null);
  });
};

ensureOnlineSyncHook();

const ensureSyncLoop = () => {
  if (syncLoopAttached || typeof window === "undefined") return;
  syncLoopAttached = true;
  setInterval(() => {
    processCustomerQueue().catch(() => null);
  }, 15000);
  window.addEventListener("visibilitychange", () => {
    if (!document.hidden) processCustomerQueue().catch(() => null);
  });
};

ensureSyncLoop();

export const fetchCustomersLocalFirst = async (params = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const query = new URLSearchParams({
      page: params.page || 1,
      limit: params.limit || 30,
      ...(params.name && { name: params.name }),
      ...(params.status && { status: params.status }),
    }).toString();
    const res = await apiClient.get(`${CUSTOMERS_URL}?${query}`);
    return res.data;
  }

  const overlay = await getOverlay();
  const base = await getAllBaseCustomers();
  const merged = withOverlayList(base, overlay);
  const filtered = applyFilters(merged, params);
  const withBalances = await attachCustomerBalances(filtered);

  logDataSource("IDB", "customers.fetch.local", {
    page: Number(params?.page || 1),
    limit: Number(params?.limit || 30),
    count: withBalances.length,
  });

  return toPaginatedResponse(withBalances, params);
};

export const fetchCustomerStatsLocalFirst = async () => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${CUSTOMERS_URL}/stats`);
    return res.data;
  }

  const overlay = await getOverlay();
  const base = await getAllBaseCustomers();
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
  logDataSource("IDB", "customers.stats.local", stats.data);
  return stats;
};

export const fetchCustomerLocalFirst = async (id) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${CUSTOMERS_URL}/${id}`);
    return res.data;
  }

  const local = await findCustomerByIdLocal(id);
  const enriched = local ? (await attachCustomerBalances([local]))[0] : null;
  logDataSource("IDB", "customers.get.local", { id: String(id || "") });
  if (enriched) return enriched;
  throw new Error("Customer not available locally");
};

export const createCustomerLocalFirst = async (payload) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.post(CUSTOMERS_URL, payload);
    return res.data;
  }

  const localId = `local-customer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const localCustomer = {
    _id: localId,
    ...normalizeCustomer(payload),
    isActive: true,
    __syncStatus: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await patchOverlay((overlay) => {
    overlay[localId] = localCustomer;
    return overlay;
  });

  await queueSyncAction({
    entity: "customers",
    method: "POST",
    url: CUSTOMERS_URL,
    payload: normalizeCustomer(payload),
    meta: { localId },
  });

  if (navigator.onLine) await processCustomerQueue();
  else processCustomerQueue().catch(() => null);
  return { customer: localCustomer };
};

export const updateCustomerLocalFirst = async (id, payload) => {
  const targetId = resolveIdInput(id) || resolveIdInput(payload?.id) || resolveIdInput(payload?._id);
  if (!targetId) throw new Error("Invalid customer id for update");

  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.put(`${CUSTOMERS_URL}/${targetId}`, payload);
    return res.data;
  }

  const existing = await findCustomerByIdLocal(targetId);
  const next = {
    ...(existing || {}),
    ...normalizeCustomer(payload),
    _id: targetId,
    __syncStatus: "pending",
    updatedAt: new Date().toISOString(),
  };

  await patchOverlay((overlay) => {
    overlay[targetId] = next;
    return overlay;
  });

  await queueSyncAction({
    entity: "customers",
    method: "PUT",
    url: `${CUSTOMERS_URL}/${targetId}`,
    payload: normalizeCustomer(payload),
    meta: { id: targetId },
  });

  if (navigator.onLine) await processCustomerQueue();
  else processCustomerQueue().catch(() => null);
  return next;
};

export const toggleCustomerStatusLocalFirst = async (id) => {
  const targetId = resolveIdInput(id);
  if (!targetId) throw new Error("Invalid customer id for status toggle");

  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.patch(`${CUSTOMERS_URL}/${targetId}/toggle-status`);
    return res.data;
  }

  const existing = await findCustomerByIdLocal(targetId);
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
  const url = isLocalId(targetId) ? `${CUSTOMERS_URL}/${targetId}` : `${CUSTOMERS_URL}/${targetId}/toggle-status`;
  const payload = isLocalId(targetId) ? { isActive: nextActive } : null;

  await queueSyncAction({
    entity: "customers",
    method,
    url,
    payload,
    meta: { id: targetId },
  });

  if (navigator.onLine) await processCustomerQueue();
  else processCustomerQueue().catch(() => null);
  return { id: targetId, isActive: nextActive };
};

export const refreshCustomersFromCloud = async () => {
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;
  await refreshAllSnapshotFromCloud();
};
