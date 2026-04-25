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
import { applyInvoiceLinkToOrders, replaceInvoiceLinkForOrders } from "./ordersLocalFirst";

const INVOICES_URL = "/invoices";
const ALL_KEY = "invoices:all";
const OVERLAY_KEY = "invoices:overlay";

let syncInFlight = false;
let onlineHandlerAttached = false;
let syncLoopAttached = false;

const normalizeId = (row) => String(row?._id || row?.id || "");
const toMillis = (value) => {
  if (!value) return 0;
  const d = new Date(value).getTime();
  return Number.isFinite(d) ? d : 0;
};
const toDateInput = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const startOfDay = (value) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};
const throwLocalError = (message) => {
  const error = new Error(message);
  error.response = { data: { message } };
  throw error;
};
const objectIdToMillis = (id) => {
  const raw = String(id || "");
  if (!/^[a-fA-F0-9]{24}$/.test(raw)) return 0;
  return parseInt(raw.slice(0, 8), 16) * 1000;
};
const parseInvoiceNumber = (invoiceNumber = "") => {
  const raw = String(invoiceNumber || "").trim();
  const m = raw.match(/^(\d{4})-(\d{4,})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const seq = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(seq)) return null;
  return { year, seq };
};

const sortLatestFirst = (rows = []) =>
  [...rows].sort((a, b) => {
    const aInvoice = parseInvoiceNumber(a?.invoice_number);
    const bInvoice = parseInvoiceNumber(b?.invoice_number);
    if (aInvoice && bInvoice) {
      if (aInvoice.year !== bInvoice.year) return bInvoice.year - aInvoice.year;
      if (aInvoice.seq !== bInvoice.seq) return bInvoice.seq - aInvoice.seq;
    }
    if (aInvoice && !bInvoice) return -1;
    if (!aInvoice && bInvoice) return 1;
    const aTime = toMillis(a?.invoice_date) || toMillis(a?.createdAt) || objectIdToMillis(normalizeId(a));
    const bTime = toMillis(b?.invoice_date) || toMillis(b?.createdAt) || objectIdToMillis(normalizeId(b));
    return bTime - aTime;
  });

const parseInvoiceSeq = (invoiceNumber = "", year) => {
  const raw = String(invoiceNumber || "").trim();
  const m = raw.match(/^(\d{4})-(\d{4,})$/);
  if (!m) return 0;
  if (Number(m[1]) !== Number(year)) return 0;
  const seq = Number(m[2]);
  return Number.isFinite(seq) ? seq : 0;
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

const getAllBaseInvoices = async () => {
  const all = await getEntitySnapshot(ALL_KEY);
  return uniqueById(Array.isArray(all) ? all : []);
};

const getOrdersSnapshot = async () => {
  const base = await getEntitySnapshot("orders:all");
  const overlay = (await getEntitySnapshot("orders:overlay")) || {};
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

const getCustomersSnapshot = async () => {
  const customers = await getEntitySnapshot("customers:all");
  return Array.isArray(customers) ? customers : [];
};

const getCustomerPaymentsSnapshot = async () => {
  const payments = await getEntitySnapshot("customerPayments:all");
  return Array.isArray(payments) ? payments : [];
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
  const customerName = String(params?.customer_name || "").trim().toLowerCase();
  const dateFrom = params?.date_from;
  const dateTo = params?.date_to;

  if (customerName) {
    data = data.filter((row) => String(row?.customer_name || "").toLowerCase().includes(customerName));
  }
  if (dateFrom || dateTo) data = data.filter((row) => inDateRange(row?.invoice_date, dateFrom, dateTo));

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
  const res = await apiClient.get(`${INVOICES_URL}?page=1&limit=5000`);
  const rows = uniqueById(Array.isArray(res?.data?.data) ? res.data.data : []);
  await upsertEntitySnapshot(ALL_KEY, rows);
  logDataSource("IDB", "invoices.snapshot.refreshed", { count: rows.length });
};

const syncCreateSuccess = async (action, serverInvoice) => {
  const localId = String(action?.meta?.localId || "");
  const realId = normalizeId(serverInvoice);

  await patchOverlay((overlay) => {
    if (localId) delete overlay[localId];
    if (realId) overlay[realId] = { ...serverInvoice, _id: realId };
    return overlay;
  });

  if (Array.isArray(action?.meta?.orderIds) && localId && realId) {
    await replaceInvoiceLinkForOrders(action.meta.orderIds, localId, realId);
  }
};

const processInvoiceQueue = async () => {
  if (syncInFlight) return;
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;

  syncInFlight = true;
  try {
    const actions = await getPendingSyncActions("invoices");
    for (const action of actions) {
      try {
        logDataSource("IDB", "sync.invoices.start", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
        if (action.method === "POST") {
          const res = await apiClient.post(action.url, action.payload);
          const serverInvoice = res?.data?.data || res?.data;
          await syncCreateSuccess(action, serverInvoice);
        }

        await completeSyncAction(action.id);
        logDataSource("IDB", "sync.invoices.success", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
      } catch (error) {
        await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed", { statusCode: error?.response?.status });
        logDataSource("IDB", "sync.invoices.failed", {
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
    processInvoiceQueue().catch(() => null);
  });
};

ensureOnlineSyncHook();

const ensureSyncLoop = () => {
  if (syncLoopAttached || typeof window === "undefined") return;
  syncLoopAttached = true;
  setInterval(() => {
    processInvoiceQueue().catch(() => null);
  }, 15000);
  window.addEventListener("visibilitychange", () => {
    if (!document.hidden) processInvoiceQueue().catch(() => null);
  });
};

ensureSyncLoop();

export const fetchInvoicesLocalFirst = async (params = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(INVOICES_URL, { params });
    return res.data;
  }

  let overlay = await getOverlay();
  let base = await getAllBaseInvoices();
  let merged = withOverlayList(base, overlay);
  if (!merged.length && typeof navigator !== "undefined" && navigator.onLine) {
    try {
      await refreshAllSnapshotFromCloud();
      overlay = await getOverlay();
      base = await getAllBaseInvoices();
      merged = withOverlayList(base, overlay);
    } catch {}
  }
  const filtered = applyFilters(merged, params);

  logDataSource("IDB", "invoices.fetch.local", {
    page: Number(params?.page || 1),
    limit: Number(params?.limit || 30),
    count: filtered.length,
  });

  return toPaginatedResponse(filtered, params);
};

export const fetchInvoiceOrderGroupsLocalFirst = async (params = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${INVOICES_URL}/order-groups`, { params });
    return res.data;
  }

  const customerName = String(params?.customer_name || "").trim().toLowerCase();
  const ordersBase = await getOrdersSnapshot();
  const orders = ordersBase.filter((order) => !order?.invoice_id);

  const filtered = customerName
    ? orders.filter((order) => String(order?.customer_name || "").toLowerCase().includes(customerName))
    : orders;
  const sortedFiltered = [...filtered].sort((a, b) => {
    const aTime = toMillis(a?.date) || toMillis(a?.createdAt) || objectIdToMillis(normalizeId(a));
    const bTime = toMillis(b?.date) || toMillis(b?.createdAt) || objectIdToMillis(normalizeId(b));
    return aTime - bTime;
  });

  const grouped = new Map();
  sortedFiltered.forEach((order) => {
    const key = String(order?.customer_id || "");
    if (!key) return;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        customer_id: order.customer_id,
        customer_name: order.customer_name,
        oldest_order_date: order.date,
        total_orders: 1,
        total_amount: Number(order.total_amount || 0),
        orders: [order],
      });
      return;
    }
    if (toMillis(order.date) < toMillis(existing.oldest_order_date)) {
      existing.oldest_order_date = order.date;
    }
    existing.total_orders += 1;
    existing.total_amount += Number(order.total_amount || 0);
    existing.orders.push(order);
  });

  const data = Array.from(grouped.values()).sort((a, b) => toMillis(a.oldest_order_date) - toMillis(b.oldest_order_date));
  const allInvoices = withOverlayList(await getAllBaseInvoices(), await getOverlay());
  const lastInvoiceDateMs = allInvoices.reduce((latest, row) => {
    const ts = toMillis(row?.invoice_date);
    if (!ts) return latest;
    return ts > latest ? ts : latest;
  }, 0);
  if (!data.length && typeof navigator !== "undefined" && navigator.onLine) {
    try {
      await refreshAllSnapshotFromCloud();
      return fetchInvoiceOrderGroupsLocalFirst(params);
    } catch {
      // fall back to empty local result
    }
  }
  logDataSource("IDB", "invoices.order_groups.local", { count: data.length });
  return {
    success: true,
    data,
    meta: {
      last_invoice_date: lastInvoiceDateMs ? toDateInput(new Date(lastInvoiceDateMs)) : "",
    },
  };
};

export const fetchInvoiceLocalFirst = async (id) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${INVOICES_URL}/${id}`);
    return res.data;
  }

  const overlay = await getOverlay();
  const base = await getAllBaseInvoices();
  const merged = withOverlayList(base, overlay);
  const invoice = merged.find((row) => normalizeId(row) === String(id));
  if (!invoice && typeof navigator !== "undefined" && navigator.onLine) {
    try {
      await refreshAllSnapshotFromCloud();
      return fetchInvoiceLocalFirst(id);
    } catch {
      // fall through
    }
  }
  if (!invoice) throw new Error("Invoice not available locally");

  const orders = await getOrdersSnapshot();
  const orderMap = new Map(orders.map((row) => [String(row?._id || ""), row]));
  const invoiceOrders = (invoice.order_ids || []).map((oid) => orderMap.get(String(oid))).filter(Boolean);

  const customers = await getCustomersSnapshot();
  const customer = customers.find((row) => String(row?._id || "") === String(invoice.customer_id || ""));
  const openingBalance = Number(customer?.opening_balance || 0);

  const invoiceDate = invoice.invoice_date;
  const createdAt = invoice.createdAt;

  const previousInvoices = merged.filter((row) => {
    if (String(row?.customer_id || "") !== String(invoice.customer_id || "")) return false;
    if (String(row?._id || "") === String(invoice._id || "")) return false;
    if (toMillis(row?.invoice_date) < toMillis(invoiceDate)) return true;
    if (toMillis(row?.invoice_date) === toMillis(invoiceDate)) {
      if (toMillis(row?.createdAt) < toMillis(createdAt)) return true;
      if (toMillis(row?.createdAt) === toMillis(createdAt)) {
        return objectIdToMillis(row?._id) < objectIdToMillis(invoice._id);
      }
    }
    return false;
  });

  const previousInvoicedAmount = previousInvoices.reduce((sum, row) => sum + Number(row?.total_amount || 0), 0);

  const payments = await getCustomerPaymentsSnapshot();
  const previousPaymentAmount = payments
    .filter((row) => String(row?.customer_id?._id || row?.customer_id || "") === String(invoice.customer_id || ""))
    .filter((row) => {
      if (toMillis(row?.date) < toMillis(invoiceDate)) return true;
      if (toMillis(row?.date) === toMillis(invoiceDate)) {
        if (toMillis(row?.createdAt) < toMillis(createdAt)) return true;
        if (toMillis(row?.createdAt) === toMillis(createdAt)) {
          return objectIdToMillis(row?._id) < objectIdToMillis(invoice._id);
        }
      }
      return false;
    })
    .reduce((sum, row) => sum + Number(row?.amount || 0), 0);

  const outstandingBalance = openingBalance + previousInvoicedAmount - previousPaymentAmount;
  const newBalance = outstandingBalance + Number(invoice.total_amount || 0);

  return {
    success: true,
    data: {
      ...invoice,
      orders: invoiceOrders,
      opening_balance: openingBalance,
      paid_before_invoice: previousPaymentAmount,
      outstanding_balance: outstandingBalance,
      new_balance: newBalance,
    },
  };
};

export const createInvoiceLocalFirst = async (payload) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.post(INVOICES_URL, payload);
    return res.data;
  }

  const localId = `local-invoice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const customers = await getCustomersSnapshot();
  const allExisting = withOverlayList(await getAllBaseInvoices(), await getOverlay());
  const customer = customers.find((row) => String(row?._id || "") === String(payload?.customer_id || ""));
  const orders = await getOrdersSnapshot();
  const orderMap = new Map(orders.map((row) => [String(row?._id || ""), row]));
  const orderIds = Array.isArray(payload?.order_ids) ? payload.order_ids : [];
  const selectedOrders = orderIds.map((oid) => orderMap.get(String(oid))).filter(Boolean);
  if (!selectedOrders.length || selectedOrders.length !== orderIds.length) {
    throwLocalError("Some selected orders are missing or already invoiced");
  }
  const totalAmount = selectedOrders.reduce((sum, row) => sum + Number(row?.total_amount || 0), 0);
  const invoiceDate = payload?.invoice_date || new Date().toISOString();
  const invoiceDateObj = new Date(invoiceDate);
  if (Number.isNaN(invoiceDateObj.getTime())) throwLocalError("Invalid invoice date");
  const invoiceDay = startOfDay(invoiceDateObj);
  const todayDay = startOfDay(new Date());
  if (invoiceDay > todayDay) throwLocalError("Invoice date cannot be after today");
  const lastInvoiceDateMs = allExisting.reduce((latest, row) => {
    const ts = toMillis(row?.invoice_date);
    if (!ts) return latest;
    return ts > latest ? ts : latest;
  }, 0);
  if (lastInvoiceDateMs && invoiceDay < startOfDay(new Date(lastInvoiceDateMs))) {
    throwLocalError(`Invoice date cannot be before last invoice date (${toDateInput(new Date(lastInvoiceDateMs))})`);
  }
  const latestOrderDateMs = selectedOrders.reduce((latest, row) => {
    const ts = toMillis(row?.date);
    if (!ts) return latest;
    return ts > latest ? ts : latest;
  }, 0);
  if (latestOrderDateMs && invoiceDay < startOfDay(new Date(latestOrderDateMs))) {
    throwLocalError(`Invoice date cannot be before selected order date (${toDateInput(new Date(latestOrderDateMs))})`);
  }
  const invoiceYear = new Date(invoiceDate).getFullYear();
  const counterSnapshot = await getEntitySnapshot("business:invoice_counter");
  const counterLastSeq =
    Number(counterSnapshot?.year) === Number(invoiceYear)
      ? Number(counterSnapshot?.last_invoice_no || 0)
      : 0;
  const maxSeq = allExisting.reduce((acc, row) => {
    const seq = parseInvoiceSeq(row?.invoice_number, invoiceYear);
    return seq > acc ? seq : acc;
  }, 0);
  const nextSeq = Math.max(maxSeq, counterLastSeq) + 1;
  const invoiceNumber = `${invoiceYear}-${String(nextSeq).padStart(4, "0")}`;

  const localInvoice = {
    _id: localId,
    invoice_number: invoiceNumber,
    customer_id: payload?.customer_id,
    customer_name: customer?.name || payload?.customer_name || "",
    customer_person: customer?.person || "",
    order_ids: orderIds,
    order_count: orderIds.length,
    total_amount: totalAmount,
    invoice_date: invoiceDate,
    image_data: payload?.image_data || "",
    note: payload?.note || "",
    __syncStatus: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await patchOverlay((overlay) => {
    overlay[localId] = localInvoice;
    return overlay;
  });

  await applyInvoiceLinkToOrders(orderIds, localId, invoiceDate);

  await queueSyncAction({
    entity: "invoices",
    method: "POST",
    url: INVOICES_URL,
    payload,
    meta: { localId, orderIds },
  });

  await upsertEntitySnapshot("business:invoice_counter", {
    year: invoiceYear,
    last_invoice_no: nextSeq,
    next_invoice_no: nextSeq + 1,
    can_update: false,
    has_invoices: true,
    invoice_count: Number(counterSnapshot?.invoice_count || 0) + 1,
  });

  processInvoiceQueue().catch(() => null);
  return { success: true, data: localInvoice };
};

export const refreshInvoicesFromCloud = async () => {
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;
  await refreshAllSnapshotFromCloud();
};
