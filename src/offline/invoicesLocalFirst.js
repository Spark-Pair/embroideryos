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
const objectIdToMillis = (id) => {
  const raw = String(id || "");
  if (!/^[a-fA-F0-9]{24}$/.test(raw)) return 0;
  return parseInt(raw.slice(0, 8), 16) * 1000;
};

const sortLatestFirst = (rows = []) =>
  [...rows].sort((a, b) => {
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

  const overlay = await getOverlay();
  const base = await getAllBaseInvoices();
  const merged = withOverlayList(base, overlay);
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

  const grouped = new Map();
  filtered.forEach((order) => {
    const key = String(order?.customer_id || "");
    if (!key) return;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        customer_id: order.customer_id,
        customer_name: order.customer_name,
        latest_order_date: order.date,
        total_orders: 1,
        total_amount: Number(order.total_amount || 0),
        orders: [order],
      });
      return;
    }
    existing.total_orders += 1;
    existing.total_amount += Number(order.total_amount || 0);
    existing.orders.push(order);
  });

  const data = Array.from(grouped.values()).sort((a, b) => toMillis(b.latest_order_date) - toMillis(a.latest_order_date));
  logDataSource("IDB", "invoices.order_groups.local", { count: data.length });
  return { success: true, data };
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
  const totalAmount = selectedOrders.reduce((sum, row) => sum + Number(row?.total_amount || 0), 0);
  const invoiceDate = payload?.invoice_date || new Date().toISOString();
  const invoiceYear = new Date(invoiceDate).getFullYear();
  const maxSeq = allExisting.reduce((acc, row) => {
    const seq = parseInvoiceSeq(row?.invoice_number, invoiceYear);
    return seq > acc ? seq : acc;
  }, 0);
  const invoiceNumber = `${invoiceYear}-${String(maxSeq + 1).padStart(4, "0")}`;

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

  processInvoiceQueue().catch(() => null);
  return { success: true, data: localInvoice };
};

export const refreshInvoicesFromCloud = async () => {
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;
  await refreshAllSnapshotFromCloud();
};
