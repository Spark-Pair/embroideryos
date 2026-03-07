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

const CUSTOMER_PAYMENTS_URL = "/customer-payments";
const ALL_KEY = "customerPayments:all";
const STATS_KEY = "customerPayments:stats";
const MONTHS_KEY = "customerPayments:months";
const OVERLAY_KEY = "customerPayments:overlay";

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

const getCustomerSnapshot = async () => {
  const customers = await getEntitySnapshot("customers:all");
  return Array.isArray(customers) ? customers : [];
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
  const customerId = String(params?.customer_id || "").trim();
  const method = String(params?.method || "").trim();
  const month = String(params?.month || "").trim();
  const name = String(params?.name || "").trim().toLowerCase();
  const dateFrom = params?.date_from;
  const dateTo = params?.date_to;

  if (customerId) data = data.filter((row) => String(row?.customer_id?._id || row?.customer_id || "") === customerId);
  if (method) data = data.filter((row) => String(row?.method || "") === method);
  if (month) data = data.filter((row) => String(row?.month || "") === month);
  if (dateFrom || dateTo) data = data.filter((row) => inDateRange(row?.date, dateFrom, dateTo));
  if (name) {
    data = data.filter((row) =>
      String(row?.customer_id?.name || row?.customer_name || "")
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

const attachCustomerInfo = async (payments = []) => {
  const customers = await getCustomerSnapshot();
  const customerMap = new Map(customers.map((row) => [String(row?._id || ""), row]));
  return payments.map((payment) => {
    const customerId = String(payment?.customer_id?._id || payment?.customer_id || "");
    if (!customerId) return payment;
    const customerRow = customerMap.get(customerId);
    if (!customerRow) return payment;
    return { ...payment, customer_id: { ...customerRow, _id: customerId } };
  });
};

const refreshAllSnapshotFromCloud = async () => {
  if (!navigator.onLine) return;
  const [listRes, statsRes, monthsRes] = await Promise.all([
    apiClient.get(`${CUSTOMER_PAYMENTS_URL}?page=1&limit=5000`),
    apiClient.get(`${CUSTOMER_PAYMENTS_URL}/stats`),
    apiClient.get(`${CUSTOMER_PAYMENTS_URL}/months`),
  ]);
  const rows = uniqueById(Array.isArray(listRes?.data?.data) ? listRes.data.data : []);
  await upsertEntitySnapshot(ALL_KEY, rows);
  await upsertEntitySnapshot(STATS_KEY, statsRes?.data || null);
  await upsertEntitySnapshot(MONTHS_KEY, monthsRes?.data || null);
  logDataSource("IDB", "customerPayments.snapshot.refreshed", { count: rows.length });
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

const syncUpdateSuccess = async (action, serverPayment) => {
  const id = normalizeId(serverPayment) || String(action?.meta?.id || "");
  if (!id) return;
  await patchOverlay((overlay) => {
    overlay[id] = { ...serverPayment, _id: id };
    return overlay;
  });
};

const processCustomerPaymentQueue = async () => {
  if (syncInFlight) return;
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;

  syncInFlight = true;
  try {
    const actions = await getPendingSyncActions("customerPayments");
    for (const action of actions) {
      try {
        logDataSource("IDB", "sync.customerPayments.start", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
        if (action.method === "POST") {
          const res = await apiClient.post(action.url, action.payload);
          const serverPayment = res?.data?.data || res?.data;
          await syncCreateSuccess(action, serverPayment);
        } else if (action.method === "PUT") {
          const res = await apiClient.put(action.url, action.payload);
          const serverPayment = res?.data?.data || res?.data;
          await syncUpdateSuccess(action, serverPayment);
        }

        await completeSyncAction(action.id);
        logDataSource("IDB", "sync.customerPayments.success", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
      } catch (error) {
        await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed", { statusCode: error?.response?.status });
        logDataSource("IDB", "sync.customerPayments.failed", {
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
    processCustomerPaymentQueue().catch(() => null);
  });
};

ensureOnlineSyncHook();

const ensureSyncLoop = () => {
  if (syncLoopAttached || typeof window === "undefined") return;
  syncLoopAttached = true;
  setInterval(() => {
    processCustomerPaymentQueue().catch(() => null);
  }, 15000);
  window.addEventListener("visibilitychange", () => {
    if (!document.hidden) processCustomerPaymentQueue().catch(() => null);
  });
};

ensureSyncLoop();

export const fetchCustomerPaymentsLocalFirst = async (params = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(CUSTOMER_PAYMENTS_URL, { params });
    return res.data;
  }

  const overlay = await getOverlay();
  const base = await getAllBasePayments();
  const merged = withOverlayList(base, overlay);
  const withCustomer = await attachCustomerInfo(merged);
  const filtered = applyFilters(withCustomer, params);

  logDataSource("IDB", "customerPayments.fetch.local", {
    page: Number(params?.page || 1),
    limit: Number(params?.limit || 30),
    count: filtered.length,
  });

  return toPaginatedResponse(filtered, params);
};

export const fetchCustomerPaymentStatsLocalFirst = async () => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${CUSTOMER_PAYMENTS_URL}/stats`);
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
      if (method === "slip") acc.slip += 1;
      if (method === "online") acc.online += 1;
      if (method === "adjustment") acc.adjustment += 1;
      return acc;
    },
    {
      total: 0,
      cash: 0,
      cheque: 0,
      slip: 0,
      online: 0,
      adjustment: 0,
      total_amount: 0,
    }
  );

  const payload = { success: true, data: stats };
  await upsertEntitySnapshot(STATS_KEY, payload);
  logDataSource("IDB", "customerPayments.stats.local", payload.data);
  return payload;
};

export const fetchCustomerPaymentMonthsLocalFirst = async () => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${CUSTOMER_PAYMENTS_URL}/months`);
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
  logDataSource("IDB", "customerPayments.months.local", { count: months.length });
  return payload;
};

export const createCustomerPaymentLocalFirst = async (payload) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.post(CUSTOMER_PAYMENTS_URL, payload);
    return res.data;
  }

  const localId = `local-customer-payment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const customers = await getCustomerSnapshot();
  const customerRow = customers.find((row) => String(row?._id || "") === String(payload?.customer_id || ""));
  const localPayment = {
    _id: localId,
    ...payload,
    customer_id: customerRow ? { ...customerRow, _id: customerRow._id } : payload?.customer_id,
    customer_name: customerRow?.name || payload?.customer_name || "",
    __syncStatus: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await patchOverlay((overlay) => {
    overlay[localId] = localPayment;
    return overlay;
  });

  await queueSyncAction({
    entity: "customerPayments",
    method: "POST",
    url: CUSTOMER_PAYMENTS_URL,
    payload,
    meta: { localId },
  });

  processCustomerPaymentQueue().catch(() => null);
  return { success: true, data: localPayment };
};

export const updateCustomerPaymentLocalFirst = async (id, payload) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.put(`${CUSTOMER_PAYMENTS_URL}/${id}`, payload);
    return res.data;
  }

  const customers = await getCustomerSnapshot();
  const customerRow = customers.find((row) => String(row?._id || "") === String(payload?.customer_id || ""));
  const localPayment = {
    ...(payload || {}),
    _id: String(id),
    customer_id: customerRow ? { ...customerRow, _id: customerRow._id } : payload?.customer_id,
    customer_name: customerRow?.name || payload?.customer_name || "",
    __syncStatus: "pending",
    updatedAt: new Date().toISOString(),
  };

  await patchOverlay((overlay) => {
    overlay[String(id)] = { ...(overlay[String(id)] || {}), ...localPayment };
    return overlay;
  });

  await queueSyncAction({
    entity: "customerPayments",
    method: "PUT",
    url: `${CUSTOMER_PAYMENTS_URL}/${id}`,
    payload,
    meta: { id: String(id) },
  });

  processCustomerPaymentQueue().catch(() => null);
  return { success: true, data: localPayment };
};

export const refreshCustomerPaymentsFromCloud = async () => {
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;
  await refreshAllSnapshotFromCloud();
};

export const fetchCustomerStatementLocalFirst = async (params = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${CUSTOMER_PAYMENTS_URL}/statement`, { params });
    return res.data;
  }

  const customerId = String(params?.customer_id || "").trim();
  const dateFrom = params?.date_from;
  const dateTo = params?.date_to;

  if (!customerId) throw new Error("customer_id is required");
  if (!dateFrom || !dateTo) throw new Error("date_from and date_to are required");

  const startDate = new Date(dateFrom);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(dateTo);
  endDate.setHours(23, 59, 59, 999);

  const customers = await getCustomerSnapshot();
  const customer = customers.find((row) => String(row?._id || "") === customerId);
  if (!customer) throw new Error("Customer not found");

  const overlay = await getOverlay();
  const basePayments = await getAllBasePayments();
  const payments = withOverlayList(basePayments, overlay).filter(
    (row) => String(row?.customer_id?._id || row?.customer_id || "") === customerId
  );
  const invoices = (await getInvoicesSnapshot()).filter(
    (row) => String(row?.customer_id?._id || row?.customer_id || "") === customerId
  );

  const priorInvoicesTotal = invoices
    .filter((row) => toMillis(row?.invoice_date) < startDate.getTime())
    .reduce((sum, row) => sum + Number(row?.total_amount || 0), 0);

  const priorPaymentsTotal = payments
    .filter((row) => toMillis(row?.date) < startDate.getTime())
    .reduce((sum, row) => sum + Number(row?.amount || 0), 0);

  const openingBalance = Number(customer?.opening_balance || 0) + priorInvoicesTotal - priorPaymentsTotal;

  const rows = [
    ...invoices
      .filter((row) => inDateRange(row?.invoice_date, startDate, endDate))
      .map((row) => ({
        kind: "invoice",
        _id: row?._id,
        date: row?.invoice_date,
        invoice_number: row?.invoice_number || "",
        details: row?.note || "",
        debit: Number(row?.total_amount || 0),
        credit: 0,
        createdAt: row?.createdAt,
      })),
    ...payments
      .filter((row) => inDateRange(row?.date, startDate, endDate))
      .map((row) => ({
        kind: "payment",
        _id: row?._id,
        date: row?.date,
        method: row?.method || "",
        reference_no: row?.reference_no || "",
        bank_name: row?.bank_name || "",
        party_name: row?.party_name || "",
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

  const totalInvoices = statementRows.reduce((sum, row) => sum + Number(row?.debit || 0), 0);
  const totalPayments = statementRows.reduce((sum, row) => sum + Number(row?.credit || 0), 0);

  return {
    success: true,
    data: {
      customer: {
        _id: customer?._id,
        name: customer?.name || "",
        person: customer?.person || "",
      },
      date_from: dateFrom,
      date_to: dateTo,
      opening_balance: openingBalance,
      total_invoices: totalInvoices,
      total_payments: totalPayments,
      net_change: totalInvoices - totalPayments,
      closing_balance: openingBalance + totalInvoices - totalPayments,
      rows: statementRows,
    },
  };
};
