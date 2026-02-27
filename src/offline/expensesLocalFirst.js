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

const EXPENSES_URL = "/expenses";
const ALL_KEY = "expenses:all";
const STATS_KEY = "expenses:stats";
const OVERLAY_KEY = "expenses:overlay";

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
    const aTime = toMillis(a?.date) || toMillis(a?.createdAt) || objectIdToMillis(normalizeId(a));
    const bTime = toMillis(b?.date) || toMillis(b?.createdAt) || objectIdToMillis(normalizeId(b));
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

const getAllBaseExpenses = async () => {
  const all = await getEntitySnapshot(ALL_KEY);
  return uniqueById(Array.isArray(all) ? all : []);
};

const getSupplierSnapshot = async () => {
  const suppliers = await getEntitySnapshot("suppliers:all");
  return Array.isArray(suppliers) ? suppliers : [];
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

const inDateRange = (value, from, to) => {
  const ts = toMillis(value);
  if (!ts) return false;
  if (from && ts < toMillis(from)) return false;
  if (to && ts > toMillis(to)) return false;
  return true;
};

const applyFilters = (rows = [], params = {}) => {
  let data = [...rows];
  const itemName = String(params?.item_name || params?.title || "").trim().toLowerCase();
  const expenseType = String(params?.expense_type || "").trim().toLowerCase();
  const fixedSource = String(params?.fixed_source || "").trim().toLowerCase();
  const supplierName = String(params?.supplier_name || "").trim().toLowerCase();
  const referenceNo = String(params?.reference_no || "").trim().toLowerCase();
  const month = String(params?.month || "").trim();
  const dateFrom = params?.date_from;
  const dateTo = params?.date_to;

  if (itemName) {
    data = data.filter((row) => String(row?.item_name || "").toLowerCase().includes(itemName));
  }
  if (expenseType) data = data.filter((row) => String(row?.expense_type || "") === expenseType);
  if (fixedSource) data = data.filter((row) => String(row?.fixed_source || "") === fixedSource);
  if (supplierName) {
    data = data.filter((row) => String(row?.supplier_name || "").toLowerCase().includes(supplierName));
  }
  if (referenceNo) {
    data = data.filter((row) => String(row?.reference_no || "").toLowerCase().includes(referenceNo));
  }
  if (month) data = data.filter((row) => String(row?.month || "") === month);
  if (dateFrom || dateTo) data = data.filter((row) => inDateRange(row?.date, dateFrom, dateTo));

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

const refreshAllSnapshotFromCloud = async () => {
  if (!navigator.onLine) return;
  const [listRes, statsRes] = await Promise.all([
    apiClient.get(`${EXPENSES_URL}?page=1&limit=5000`),
    apiClient.get(`${EXPENSES_URL}/stats`),
  ]);
  const rows = uniqueById(Array.isArray(listRes?.data?.data) ? listRes.data.data : []);
  await upsertEntitySnapshot(ALL_KEY, rows);
  await upsertEntitySnapshot(STATS_KEY, statsRes?.data || null);
  logDataSource("IDB", "expenses.snapshot.refreshed", { count: rows.length });
};

const syncCreateSuccess = async (action, serverExpenses) => {
  const localIds = Array.isArray(action?.meta?.localIds) ? action.meta.localIds : [];
  const items = Array.isArray(serverExpenses) ? serverExpenses : [serverExpenses].filter(Boolean);

  await patchOverlay((overlay) => {
    localIds.forEach((id) => {
      if (overlay[id]) delete overlay[id];
    });
    items.forEach((row) => {
      const id = normalizeId(row);
      if (!id) return;
      overlay[id] = { ...row, _id: id };
    });
    return overlay;
  });
};

const syncUpdateSuccess = async (action, serverExpense) => {
  const id = normalizeId(serverExpense) || String(action?.meta?.id || "");
  if (!id) return;
  await patchOverlay((overlay) => {
    overlay[id] = { ...serverExpense, _id: id };
    return overlay;
  });
};

const syncDeleteSuccess = async (action) => {
  const id = String(action?.meta?.id || "");
  if (!id) return;
  await patchOverlay((overlay) => {
    if (overlay[id]) overlay[id]._deleted = true;
    return overlay;
  });
};

const processExpenseQueue = async () => {
  if (syncInFlight) return;
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;

  syncInFlight = true;
  try {
    const actions = await getPendingSyncActions("expenses");
    for (const action of actions) {
      try {
        logDataSource("IDB", "sync.expenses.start", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
        if (action.method === "POST") {
          const res = await apiClient.post(action.url, action.payload);
          const serverExpenses = res?.data?.data || res?.data;
          await syncCreateSuccess(action, serverExpenses);
        } else if (action.method === "PUT") {
          const res = await apiClient.put(action.url, action.payload);
          const serverExpense = res?.data?.data || res?.data;
          await syncUpdateSuccess(action, serverExpense);
        } else if (action.method === "DELETE") {
          await apiClient.delete(action.url);
          await syncDeleteSuccess(action);
        }

        await completeSyncAction(action.id);
        logDataSource("IDB", "sync.expenses.success", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
      } catch (error) {
        await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed");
        logDataSource("IDB", "sync.expenses.failed", {
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
    processExpenseQueue().catch(() => null);
  });
};

ensureOnlineSyncHook();

const ensureSyncLoop = () => {
  if (syncLoopAttached || typeof window === "undefined") return;
  syncLoopAttached = true;
  setInterval(() => {
    processExpenseQueue().catch(() => null);
  }, 15000);
  window.addEventListener("visibilitychange", () => {
    if (!document.hidden) processExpenseQueue().catch(() => null);
  });
};

ensureSyncLoop();

export const fetchExpensesLocalFirst = async (params = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(EXPENSES_URL, { params });
    return res.data;
  }

  const overlay = await getOverlay();
  const base = await getAllBaseExpenses();
  const merged = withOverlayList(base, overlay);
  const filtered = applyFilters(merged, params);

  logDataSource("IDB", "expenses.fetch.local", {
    page: Number(params?.page || 1),
    limit: Number(params?.limit || 30),
    count: filtered.length,
  });

  return toPaginatedResponse(filtered, params);
};

export const fetchExpenseStatsLocalFirst = async () => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${EXPENSES_URL}/stats`);
    return res.data;
  }

  const overlay = await getOverlay();
  const base = await getAllBaseExpenses();
  const merged = withOverlayList(base, overlay);

  const stats = merged.reduce(
    (acc, row) => {
      acc.total += 1;
      acc.total_amount += Number(row?.amount || 0);
      const type = String(row?.expense_type || "");
      if (type === "cash") acc.cash_count += 1;
      if (type === "supplier") acc.supplier_count += 1;
      if (type === "fixed") acc.fixed_count += 1;
      return acc;
    },
    {
      total: 0,
      total_amount: 0,
      cash_count: 0,
      supplier_count: 0,
      fixed_count: 0,
    }
  );

  const payload = { success: true, data: stats };
  await upsertEntitySnapshot(STATS_KEY, payload);
  logDataSource("IDB", "expenses.stats.local", payload.data);
  return payload;
};

export const createExpenseLocalFirst = async (payload) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.post(EXPENSES_URL, payload);
    return res.data;
  }

  const items = Array.isArray(payload?.items) ? payload.items : [];
  const supplierList = await getSupplierSnapshot();
  const supplierRow = supplierList.find((row) => String(row?._id || "") === String(payload?.supplier_id || ""));
  const supplierName = supplierRow?.name || payload?.supplier_name || "";
  const groupKey = `local-expense-group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const localIds = [];

  const localItems = items.map((row) => {
    const quantity = Number(row?.quantity || 0);
    const rate = Number(row?.rate || 0);
    const rawAmount = Number(row?.amount || 0);
    const derivedAmount = quantity > 0 && rate > 0 ? quantity * rate : rawAmount;
    const localId = `local-expense-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${localIds.length}`;
    localIds.push(localId);
    return {
      _id: localId,
      expense_type: payload?.expense_type || "cash",
      fixed_source: payload?.fixed_source || "",
      item_name: row?.item_name || "",
      quantity,
      rate,
      amount: derivedAmount > 0 ? derivedAmount : rawAmount,
      date: payload?.date || new Date().toISOString(),
      month: payload?.month || String(payload?.date || new Date().toISOString()).slice(0, 7),
      reference_no: payload?.reference_no || "",
      remarks: payload?.remarks || "",
      supplier_id: supplierRow ? supplierRow._id : payload?.supplier_id || null,
      supplier_name: supplierName,
      group_key: groupKey,
      __syncStatus: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  await patchOverlay((overlay) => {
    localItems.forEach((item) => {
      overlay[item._id] = item;
    });
    return overlay;
  });

  await queueSyncAction({
    entity: "expenses",
    method: "POST",
    url: EXPENSES_URL,
    payload,
    meta: { localIds },
  });

  processExpenseQueue().catch(() => null);
  return { success: true, data: localItems };
};

export const updateExpenseLocalFirst = async (id, payload) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.put(`${EXPENSES_URL}/${id}`, payload);
    return res.data;
  }

  const next = {
    ...(payload || {}),
    _id: String(id),
    __syncStatus: "pending",
    updatedAt: new Date().toISOString(),
  };

  await patchOverlay((overlay) => {
    overlay[String(id)] = { ...(overlay[String(id)] || {}), ...next };
    return overlay;
  });

  await queueSyncAction({
    entity: "expenses",
    method: "PUT",
    url: `${EXPENSES_URL}/${id}`,
    payload,
    meta: { id: String(id) },
  });

  processExpenseQueue().catch(() => null);
  return { success: true, data: next };
};

export const deleteExpenseLocalFirst = async (id) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.delete(`${EXPENSES_URL}/${id}`);
    return res.data;
  }

  await patchOverlay((overlay) => {
    const prev = overlay[String(id)] || {};
    overlay[String(id)] = { ...prev, _deleted: true };
    return overlay;
  });

  await queueSyncAction({
    entity: "expenses",
    method: "DELETE",
    url: `${EXPENSES_URL}/${id}`,
    payload: null,
    meta: { id: String(id) },
  });

  processExpenseQueue().catch(() => null);
  return { success: true };
};

export const refreshExpensesFromCloud = async () => {
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;
  await refreshAllSnapshotFromCloud();
};
