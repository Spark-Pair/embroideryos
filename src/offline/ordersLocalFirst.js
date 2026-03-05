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
import { fetchProductionConfigLocalFirst } from "./productionConfigLocalFirst";

const ORDERS_URL = "/orders";
const ALL_KEY = "orders:all";
const STATS_KEY = "orders:stats";
const OVERLAY_KEY = "orders:overlay";

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
    const aTime = toMillis(a?.createdAt) || toMillis(a?.date) || objectIdToMillis(normalizeId(a));
    const bTime = toMillis(b?.createdAt) || toMillis(b?.date) || objectIdToMillis(normalizeId(b));
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

const getAllBaseOrders = async () => {
  const all = await getEntitySnapshot(ALL_KEY);
  return uniqueById(Array.isArray(all) ? all : []);
};

const getCustomerSnapshot = async () => {
  const customers = await getEntitySnapshot("customers:all");
  return Array.isArray(customers) ? customers : [];
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
  const description = String(params?.description || "").trim().toLowerCase();
  const machineNo = String(params?.machine_no || "").trim().toLowerCase();
  const dateFrom = params?.date_from;
  const dateTo = params?.date_to;

  if (customerName) {
    data = data.filter((row) => String(row?.customer_name || "").toLowerCase().includes(customerName));
  }
  if (description) {
    data = data.filter((row) => String(row?.description || "").toLowerCase().includes(description));
  }
  if (machineNo) {
    data = data.filter((row) => String(row?.machine_no || "").toLowerCase().includes(machineNo));
  }
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

const toNum = (val) => {
  if (val === "" || val == null) return 0;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
};

const roundDown = (value, digits = 2) => {
  const factor = Math.pow(10, digits);
  return Math.floor(value * factor) / factor;
};

const toBool = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true") return true;
    if (v === "false") return false;
  }
  return fallback;
};

const DEFAULT_STITCH_FORMULA_RULES = [
  { up_to: 4237, mode: "fixed", value: 5000 },
  { up_to: 10000, mode: "percent", value: 18 },
  { up_to: 50000, mode: "percent", value: 10 },
  { up_to: null, mode: "percent", value: 5 },
];

const normalizeFormulaRules = (rawRules) => {
  if (!Array.isArray(rawRules) || rawRules.length === 0) return DEFAULT_STITCH_FORMULA_RULES;
  const clean = rawRules
    .map((rule = {}) => {
      const upToRaw = rule?.up_to;
      const up_to = upToRaw === "" || upToRaw == null ? null : Math.max(0, toNum(upToRaw));
      const mode = ["fixed", "percent", "identity"].includes(rule?.mode) ? rule.mode : "identity";
      const value = mode === "identity" ? 0 : Math.max(0, toNum(rule?.value));
      return { up_to, mode, value };
    })
    .sort((a, b) => {
      const av = a.up_to == null ? Number.POSITIVE_INFINITY : a.up_to;
      const bv = b.up_to == null ? Number.POSITIVE_INFINITY : b.up_to;
      return av - bv;
    });
  return clean.length ? clean : DEFAULT_STITCH_FORMULA_RULES;
};

const computeDesignStitchesByConfig = (actualStitches, config) => {
  const s = toNum(actualStitches);
  if (s <= 0) return 0;
  if (config?.stitch_formula_enabled === false) return s;
  const rules = normalizeFormulaRules(config?.stitch_formula_rules);
  if (!rules.length) return s;
  for (const rule of rules) {
    const threshold = rule.up_to == null ? Number.POSITIVE_INFINITY : toNum(rule.up_to);
    if (s > threshold) continue;
    if (rule.mode === "fixed") return Math.max(0, toNum(rule.value));
    if (rule.mode === "percent") return s + (s * toNum(rule.value)) / 100;
    return s;
  }
  return s;
};

const computeCalculatedRate = (baseRate, ds, apqChr) => {
  if (toNum(ds) <= 0) return 0;
  const raw = (toNum(baseRate) * toNum(ds)) / 1000 + toNum(apqChr);
  return Math.round(raw * 100) / 100;
};

const computeStitchRate = (rate, ds, apq, apqChr) => {
  const d = toNum(ds);
  const r = toNum(rate);
  if (d <= 0 || r <= 0) return 0;
  const base = toNum(apq) === 0 ? r : r - toNum(apqChr);
  return roundDown((base / d) * 1000, 2);
};

const computeDesignStitchFromRate = (rate, stitchRate, apqChr) => {
  const r = toNum(rate);
  const sr = toNum(stitchRate);
  const ac = toNum(apqChr);
  if (r <= 0 || sr <= 0) return 0;
  return roundDown(((r - ac) / sr) * 1000, 2);
};

const computeQtPcs = (qty, unit) => (unit === "Dzn" ? toNum(qty) * 12 : toNum(qty));
const computeTotalAmount = (rate, qtPcs) => roundDown(toNum(rate) * toNum(qtPcs), 2);
const buildClientRef = () => `order-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const buildOrderPayload = async (body) => {
  const {
    customer_id,
    customer_name,
    customer_base_rate,
    description,
    date,
    machine_no,
    lot_no,
    unit,
    quantity,
    actual_stitches,
    apq,
    apq_chr,
    reverse_mode,
    two_side,
    rate_input,
    rate,
  } = body;

  let resolvedCustomerName = customer_name || "";
  let resolvedCustomerBaseRate = toNum(customer_base_rate);

  const customers = await getCustomerSnapshot();
  const customerRow = customers.find((row) => String(row?._id || "") === String(customer_id || ""));
  if (customerRow) {
    resolvedCustomerName = customerRow.name || resolvedCustomerName;
    resolvedCustomerBaseRate = toNum(customerRow.rate);
  }

  const resolvedUnit = unit === "Pcs" ? "Pcs" : "Dzn";
  const resolvedQty = toNum(quantity);
  const resolvedActualStitches = toNum(actual_stitches);
  const resolvedApq = apq === "" || apq == null ? null : Math.max(0, Math.min(30, Math.floor(toNum(apq))));
  const resolvedApqChr = apq_chr === "" || apq_chr == null ? null : Math.max(0, toNum(apq_chr));
  const resolvedReverseMode = toBool(reverse_mode, false);
  const resolvedTwoSide = toBool(two_side, false);
  const resolvedRateInput = Math.max(0, toNum(rate_input ?? rate));
  const resolvedRate = !resolvedReverseMode && resolvedTwoSide ? roundDown(resolvedRateInput * 2, 2) : resolvedRateInput;
  const rateForDesignStitch = resolvedTwoSide ? resolvedRateInput / 2 : resolvedRateInput;
  const configRes = await fetchProductionConfigLocalFirst(date);
  const stitchFormulaConfig = configRes?.data || null;
  const design_stitches = resolvedReverseMode
    ? computeDesignStitchFromRate(rateForDesignStitch, resolvedCustomerBaseRate, resolvedApqChr)
    : computeDesignStitchesByConfig(resolvedActualStitches, stitchFormulaConfig);
  const qt_pcs = computeQtPcs(resolvedQty, resolvedUnit);
  const calculated_rate = computeCalculatedRate(resolvedCustomerBaseRate, design_stitches, resolvedApqChr);
  const stitch_rate = computeStitchRate(resolvedRate, design_stitches, resolvedApq, resolvedApqChr);
  const total_amount = computeTotalAmount(resolvedRate, qt_pcs);

  return {
    customer_id,
    customer_name: resolvedCustomerName,
    customer_base_rate: resolvedCustomerBaseRate,
    description: description || "",
    date: new Date(date),
    machine_no,
    lot_no: lot_no || "",
    unit: resolvedUnit,
    quantity: resolvedQty,
    qt_pcs,
    actual_stitches: resolvedActualStitches,
    design_stitches,
    apq: resolvedApq,
    apq_chr: resolvedApqChr,
    reverse_mode: resolvedReverseMode,
    two_side: resolvedTwoSide,
    rate_input: resolvedRateInput,
    rate: resolvedRate,
    calculated_rate,
    stitch_rate,
    total_amount,
  };
};

const refreshAllSnapshotFromCloud = async () => {
  if (!navigator.onLine) return;
  const [listRes, statsRes] = await Promise.all([
    apiClient.get(`${ORDERS_URL}?page=1&limit=5000`),
    apiClient.get(`${ORDERS_URL}/stats`),
  ]);
  const rows = uniqueById(Array.isArray(listRes?.data?.data) ? listRes.data.data : []);
  await upsertEntitySnapshot(ALL_KEY, rows);
  await upsertEntitySnapshot(STATS_KEY, statsRes?.data || null);
  logDataSource("IDB", "orders.snapshot.refreshed", { count: rows.length });
};

const syncCreateSuccess = async (action, serverOrder) => {
  const localId = String(action?.meta?.localId || "");
  const realId = normalizeId(serverOrder);

  await patchOverlay((overlay) => {
    if (localId) delete overlay[localId];
    if (realId) overlay[realId] = { ...serverOrder, _id: realId };
    return overlay;
  });
};

const syncUpdateSuccess = async (action, serverOrder) => {
  const id = normalizeId(serverOrder) || String(action?.meta?.id || "");
  if (!id) return;
  await patchOverlay((overlay) => {
    overlay[id] = { ...serverOrder, _id: id };
    return overlay;
  });
};

const processOrderQueue = async () => {
  if (syncInFlight) return;
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;

  syncInFlight = true;
  try {
    const actions = await getPendingSyncActions("orders");
    for (const action of actions) {
      try {
        logDataSource("IDB", "sync.orders.start", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
        if (action.method === "POST") {
          const res = await apiClient.post(action.url, action.payload);
          const serverOrder = res?.data?.data || res?.data;
          await syncCreateSuccess(action, serverOrder);
        } else if (action.method === "PUT") {
          const res = await apiClient.put(action.url, action.payload);
          const serverOrder = res?.data?.data || res?.data;
          await syncUpdateSuccess(action, serverOrder);
        }

        await completeSyncAction(action.id);
        logDataSource("IDB", "sync.orders.success", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
      } catch (error) {
        await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed");
        logDataSource("IDB", "sync.orders.failed", {
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
    processOrderQueue().catch(() => null);
  });
};

ensureOnlineSyncHook();

const ensureSyncLoop = () => {
  if (syncLoopAttached || typeof window === "undefined") return;
  syncLoopAttached = true;
  setInterval(() => {
    processOrderQueue().catch(() => null);
  }, 15000);
  window.addEventListener("visibilitychange", () => {
    if (!document.hidden) processOrderQueue().catch(() => null);
  });
};

ensureSyncLoop();

export const fetchOrdersLocalFirst = async (params = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(ORDERS_URL, { params });
    return res.data;
  }

  const overlay = await getOverlay();
  const base = await getAllBaseOrders();
  const merged = withOverlayList(base, overlay);
  const filtered = applyFilters(merged, params);

  logDataSource("IDB", "orders.fetch.local", {
    page: Number(params?.page || 1),
    limit: Number(params?.limit || 30),
    count: filtered.length,
  });

  return toPaginatedResponse(filtered, params);
};

export const fetchOrderStatsLocalFirst = async (params = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${ORDERS_URL}/stats`, { params });
    return res.data;
  }

  const overlay = await getOverlay();
  const base = await getAllBaseOrders();
  const merged = withOverlayList(base, overlay);
  const filtered = applyFilters(merged, params);

  const total_amount = filtered.reduce((sum, row) => sum + Number(row?.total_amount || 0), 0);
  const stats = { success: true, data: { total_orders: filtered.length, total_amount } };
  await upsertEntitySnapshot(STATS_KEY, stats);
  logDataSource("IDB", "orders.stats.local", stats.data);
  return stats;
};

export const fetchOrderLocalFirst = async (id) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${ORDERS_URL}/${id}`);
    return res.data;
  }

  const overlay = await getOverlay();
  if (overlay[String(id)] && !overlay[String(id)]?._deleted) return { success: true, data: overlay[String(id)] };
  const all = await getAllBaseOrders();
  const found = all.find((row) => normalizeId(row) === String(id));
  if (found) return { success: true, data: found };
  throw new Error("Order not available locally");
};

export const createOrderLocalFirst = async (payload) => {
  const payloadWithClientRef = {
    ...payload,
    client_ref: payload?.client_ref || buildClientRef(),
  };

  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.post(ORDERS_URL, payloadWithClientRef);
    return res.data;
  }

  const localId = `local-order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const computed = await buildOrderPayload(payloadWithClientRef);
  const localOrder = {
    _id: localId,
    ...computed,
    invoice_id: payload?.invoice_id || null,
    invoiced_at: payload?.invoiced_at || null,
    __syncStatus: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await patchOverlay((overlay) => {
    overlay[localId] = localOrder;
    return overlay;
  });

  await queueSyncAction({
    entity: "orders",
    method: "POST",
    url: ORDERS_URL,
    payload: payloadWithClientRef,
    meta: { localId },
  });

  processOrderQueue().catch(() => null);
  return { success: true, data: localOrder };
};

export const updateOrderLocalFirst = async (id, payload) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.put(`${ORDERS_URL}/${id}`, payload);
    return res.data;
  }

  const existing = await fetchOrderLocalFirst(id).then((r) => r?.data).catch(() => null);
  const computed = await buildOrderPayload({
    ...(existing || {}),
    ...payload,
    customer_id: payload?.customer_id || existing?.customer_id,
    date: payload?.date || existing?.date,
    machine_no: payload?.machine_no || existing?.machine_no,
  });

  const next = {
    ...(existing || {}),
    ...computed,
    _id: String(id),
    __syncStatus: "pending",
    updatedAt: new Date().toISOString(),
  };

  await patchOverlay((overlay) => {
    overlay[String(id)] = next;
    return overlay;
  });

  await queueSyncAction({
    entity: "orders",
    method: "PUT",
    url: `${ORDERS_URL}/${id}`,
    payload,
    meta: { id: String(id) },
  });

  processOrderQueue().catch(() => null);
  return { success: true, data: next };
};

export const applyInvoiceLinkToOrders = async (orderIds = [], invoiceId, invoicedAt = null) => {
  if (!Array.isArray(orderIds) || orderIds.length === 0) return;
  await patchOverlay((overlay) => {
    orderIds.forEach((orderId) => {
      const key = String(orderId);
      const prev = overlay[key] || {};
      overlay[key] = {
        ...prev,
        _id: key,
        invoice_id: invoiceId || null,
        invoiced_at: invoicedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
    return overlay;
  });
};

export const replaceInvoiceLinkForOrders = async (orderIds = [], oldInvoiceId, newInvoiceId) => {
  if (!Array.isArray(orderIds) || orderIds.length === 0) return;
  await patchOverlay((overlay) => {
    orderIds.forEach((orderId) => {
      const key = String(orderId);
      const prev = overlay[key] || {};
      if (String(prev?.invoice_id || "") !== String(oldInvoiceId || "")) return;
      overlay[key] = {
        ...prev,
        _id: key,
        invoice_id: newInvoiceId || null,
        updatedAt: new Date().toISOString(),
      };
    });
    return overlay;
  });
};

export const refreshOrdersFromCloud = async () => {
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;
  await refreshAllSnapshotFromCloud();
};
