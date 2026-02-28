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

const SUPPLIER_PAYMENTS_URL = "/supplier-payments";
const ALL_KEY = "supplierPayments:all";
const STATS_KEY = "supplierPayments:stats";
const MONTHS_KEY = "supplierPayments:months";
const OVERLAY_KEY = "supplierPayments:overlay";

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

const getAllBasePayments = async () => {
  const all = await getEntitySnapshot(ALL_KEY);
  return uniqueById(Array.isArray(all) ? all : []);
};

const getSupplierSnapshot = async () => {
  const suppliers = await getEntitySnapshot("suppliers:all");
  return Array.isArray(suppliers) ? suppliers : [];
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
  const supplierId = String(params?.supplier_id || "").trim();
  const method = String(params?.method || "").trim();
  const month = String(params?.month || "").trim();
  const name = String(params?.name || "").trim().toLowerCase();
  const dateFrom = params?.date_from;
  const dateTo = params?.date_to;

  if (supplierId) data = data.filter((row) => String(row?.supplier_id?._id || row?.supplier_id || "") === supplierId);
  if (method) data = data.filter((row) => String(row?.method || "") === method);
  if (month) data = data.filter((row) => String(row?.month || "") === month);
  if (dateFrom || dateTo) data = data.filter((row) => inDateRange(row?.date, dateFrom, dateTo));
  if (name) {
    data = data.filter((row) =>
      String(row?.supplier_id?.name || row?.supplier_name || "")
        .toLowerCase()
        .includes(name)
    );
  }

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

const attachSupplierInfo = async (payments = []) => {
  const suppliers = await getSupplierSnapshot();
  const supplierMap = new Map(suppliers.map((row) => [String(row?._id || ""), row]));
  return payments.map((payment) => {
    const supplierId = String(payment?.supplier_id?._id || payment?.supplier_id || "");
    if (!supplierId) return payment;
    const supplierRow = supplierMap.get(supplierId);
    if (!supplierRow) return payment;
    return { ...payment, supplier_id: { ...supplierRow, _id: supplierId } };
  });
};

const refreshAllSnapshotFromCloud = async () => {
  if (!navigator.onLine) return;
  const [listRes, statsRes, monthsRes] = await Promise.all([
    apiClient.get(`${SUPPLIER_PAYMENTS_URL}?page=1&limit=5000`),
    apiClient.get(`${SUPPLIER_PAYMENTS_URL}/stats`),
    apiClient.get(`${SUPPLIER_PAYMENTS_URL}/months`),
  ]);
  const rows = uniqueById(Array.isArray(listRes?.data?.data) ? listRes.data.data : []);
  await upsertEntitySnapshot(ALL_KEY, rows);
  await upsertEntitySnapshot(STATS_KEY, statsRes?.data || null);
  await upsertEntitySnapshot(MONTHS_KEY, monthsRes?.data || null);
  logDataSource("IDB", "supplierPayments.snapshot.refreshed", { count: rows.length });
};

const syncCreateSuccess = async (action, serverPayment) => {
  const localId = String(action?.meta?.localId || "");
  const realId = normalizeId(serverPayment);

  await patchOverlay((overlay) => {
    if (localId) delete overlay[localId];
    if (realId) overlay[realId] = { ...serverPayment, _id: realId };
    return overlay;
  });
};

const processSupplierPaymentQueue = async () => {
  if (syncInFlight) return;
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;

  syncInFlight = true;
  try {
    const actions = await getPendingSyncActions("supplierPayments");
    for (const action of actions) {
      try {
        logDataSource("IDB", "sync.supplierPayments.start", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
        if (action.method === "POST") {
          const res = await apiClient.post(action.url, action.payload);
          const serverPayment = res?.data?.data || res?.data;
          await syncCreateSuccess(action, serverPayment);
        }

        await completeSyncAction(action.id);
        logDataSource("IDB", "sync.supplierPayments.success", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
      } catch (error) {
        await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed");
        logDataSource("IDB", "sync.supplierPayments.failed", {
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
    processSupplierPaymentQueue().catch(() => null);
  });
};

ensureOnlineSyncHook();

const ensureSyncLoop = () => {
  if (syncLoopAttached || typeof window === "undefined") return;
  syncLoopAttached = true;
  setInterval(() => {
    processSupplierPaymentQueue().catch(() => null);
  }, 15000);
  window.addEventListener("visibilitychange", () => {
    if (!document.hidden) processSupplierPaymentQueue().catch(() => null);
  });
};

ensureSyncLoop();

export const fetchSupplierPaymentsLocalFirst = async (params = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(SUPPLIER_PAYMENTS_URL, { params });
    return res.data;
  }

  const overlay = await getOverlay();
  const base = await getAllBasePayments();
  const merged = withOverlayList(base, overlay);
  const withSupplier = await attachSupplierInfo(merged);
  const filtered = applyFilters(withSupplier, params);

  logDataSource("IDB", "supplierPayments.fetch.local", {
    page: Number(params?.page || 1),
    limit: Number(params?.limit || 30),
    count: filtered.length,
  });

  return toPaginatedResponse(filtered, params);
};

export const fetchSupplierPaymentStatsLocalFirst = async () => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${SUPPLIER_PAYMENTS_URL}/stats`);
    return res.data;
  }

  const overlay = await getOverlay();
  const base = await getAllBasePayments();
  const merged = withOverlayList(base, overlay);

  const stats = merged.reduce(
    (acc, row) => {
      acc.total += 1;
      acc.total_amount += Number(row?.amount || 0);
      const method = String(row?.method || "");
      if (method === "cash") acc.cash += 1;
      if (method === "cheque") acc.cheque += 1;
      if (method === "online") acc.online += 1;
      return acc;
    },
    {
      total: 0,
      cash: 0,
      cheque: 0,
      online: 0,
      total_amount: 0,
    }
  );

  const payload = { success: true, data: stats };
  await upsertEntitySnapshot(STATS_KEY, payload);
  logDataSource("IDB", "supplierPayments.stats.local", payload.data);
  return payload;
};

export const fetchSupplierPaymentMonthsLocalFirst = async () => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${SUPPLIER_PAYMENTS_URL}/months`);
    return res.data;
  }

  const overlay = await getOverlay();
  const base = await getAllBasePayments();
  const merged = withOverlayList(base, overlay);

  const months = Array.from(
    merged.reduce((acc, row) => {
      const month = String(row?.month || "").trim();
      if (month) acc.add(month);
      return acc;
    }, new Set())
  ).sort((a, b) => (a < b ? 1 : -1));

  const payload = { success: true, data: months };
  await upsertEntitySnapshot(MONTHS_KEY, payload);
  logDataSource("IDB", "supplierPayments.months.local", { count: months.length });
  return payload;
};

export const createSupplierPaymentLocalFirst = async (payload) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.post(SUPPLIER_PAYMENTS_URL, payload);
    return res.data;
  }

  const localId = `local-supplier-payment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const suppliers = await getSupplierSnapshot();
  const supplierRow = suppliers.find((row) => String(row?._id || "") === String(payload?.supplier_id || ""));
  const localPayment = {
    _id: localId,
    ...payload,
    supplier_id: supplierRow ? { ...supplierRow, _id: supplierRow._id } : payload?.supplier_id,
    supplier_name: supplierRow?.name || payload?.supplier_name || "",
    __syncStatus: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await patchOverlay((overlay) => {
    overlay[localId] = localPayment;
    return overlay;
  });

  await queueSyncAction({
    entity: "supplierPayments",
    method: "POST",
    url: SUPPLIER_PAYMENTS_URL,
    payload,
    meta: { localId },
  });

  processSupplierPaymentQueue().catch(() => null);
  return { success: true, data: localPayment };
};

export const refreshSupplierPaymentsFromCloud = async () => {
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;
  await refreshAllSnapshotFromCloud();
};

export const fetchSupplierStatementLocalFirst = async (params = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${SUPPLIER_PAYMENTS_URL}/statement`, { params });
    return res.data;
  }

  const supplierId = String(params?.supplier_id || "").trim();
  const dateFrom = params?.date_from;
  const dateTo = params?.date_to;

  if (!supplierId) throw new Error("supplier_id is required");
  if (!dateFrom || !dateTo) throw new Error("date_from and date_to are required");

  const startDate = new Date(dateFrom);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(dateTo);
  endDate.setHours(23, 59, 59, 999);

  const suppliers = await getSupplierSnapshot();
  const supplier = suppliers.find((row) => String(row?._id || "") === supplierId);
  if (!supplier) throw new Error("Supplier not found");

  const overlay = await getOverlay();
  const basePayments = await getAllBasePayments();
  const payments = withOverlayList(basePayments, overlay).filter(
    (row) => String(row?.supplier_id?._id || row?.supplier_id || "") === supplierId
  );

  const expenses = (await getExpensesSnapshot()).filter((row) => {
    const sid = String(row?.supplier_id?._id || row?.supplier_id || "");
    const isSupplierExpense =
      String(row?.expense_type || "") === "supplier" ||
      (String(row?.expense_type || "") === "fixed" && String(row?.fixed_source || "") === "supplier");
    return sid === supplierId && isSupplierExpense;
  });

  const priorExpensesTotal = expenses
    .filter((row) => toMillis(row?.date) < startDate.getTime())
    .reduce((sum, row) => sum + Number(row?.amount || 0), 0);

  const priorPaymentsTotal = payments
    .filter((row) => toMillis(row?.date) < startDate.getTime())
    .reduce((sum, row) => sum + Number(row?.amount || 0), 0);

  const openingBalance = Number(supplier?.opening_balance || 0) + priorExpensesTotal - priorPaymentsTotal;

  const rows = [
    ...expenses
      .filter((row) => inDateRange(row?.date, startDate, endDate))
      .map((row) => ({
        kind: "expense",
        _id: row?._id,
        date: row?.date,
        reference_no: row?.reference_no || "",
        method: row?.expense_type || "",
        details: row?.remarks || row?.item_name || "",
        debit: Number(row?.amount || 0),
        credit: 0,
        createdAt: row?.createdAt,
      })),
    ...payments
      .filter((row) => inDateRange(row?.date, startDate, endDate))
      .map((row) => ({
        kind: "payment",
        _id: row?._id,
        date: row?.date,
        reference_no: row?.reference_no || "",
        method: row?.method || "",
        details: row?.remarks || "",
        debit: 0,
        credit: Number(row?.amount || 0),
        createdAt: row?.createdAt,
      })),
  ].sort((a, b) => {
    const ad = toMillis(a?.date);
    const bd = toMillis(b?.date);
    if (ad !== bd) return ad - bd;
    const ac = toMillis(a?.createdAt);
    const bc = toMillis(b?.createdAt);
    if (ac !== bc) return ac - bc;
    return String(a?._id || "").localeCompare(String(b?._id || ""));
  });

  let running = openingBalance;
  const statementRows = rows.map((row) => {
    running += Number(row?.debit || 0);
    running -= Number(row?.credit || 0);
    return { ...row, balance: running };
  });

  const totalExpenses = statementRows.reduce((sum, row) => sum + Number(row?.debit || 0), 0);
  const totalPayments = statementRows.reduce((sum, row) => sum + Number(row?.credit || 0), 0);

  return {
    success: true,
    data: {
      supplier: {
        _id: supplier?._id,
        name: supplier?.name || "",
      },
      date_from: dateFrom,
      date_to: dateTo,
      opening_balance: openingBalance,
      total_expenses: totalExpenses,
      total_payments: totalPayments,
      net_change: totalExpenses - totalPayments,
      closing_balance: openingBalance + totalExpenses - totalPayments,
      rows: statementRows,
    },
  };
};
