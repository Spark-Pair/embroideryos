import { apiClient } from "../api/apiClient";
import { completeSyncAction, failSyncAction, getEntitySnapshot, getPendingSyncActions, offlineAccess, queueSyncAction, upsertEntitySnapshot } from "./idb";
import { logDataSource } from "./logger";

const BANNER_KEY = "business:invoice_banner";
const INVOICE_COUNTER_KEY = "business:invoice_counter";

let syncInFlight = false;
let onlineHandlerAttached = false;
let syncLoopAttached = false;

const processBannerQueue = async () => {
  if (syncInFlight) return;
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;

  syncInFlight = true;
  try {
    const actions = await getPendingSyncActions("business.invoiceBanner");
    for (const action of actions) {
      try {
        logDataSource("IDB", "sync.invoiceBanner.start", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
        const res = await apiClient.patch(action.url, action.payload);
        await completeSyncAction(action.id);
        logDataSource("IDB", "sync.invoiceBanner.success", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
        if (res?.data?.invoice_banner_data != null) {
          await upsertEntitySnapshot(BANNER_KEY, res.data.invoice_banner_data);
        }
      } catch (error) {
        await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed", { statusCode: error?.response?.status });
        logDataSource("IDB", "sync.invoiceBanner.failed", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
      }
    }

    const counterActions = await getPendingSyncActions("business.invoiceCounter");
    for (const action of counterActions) {
      try {
        logDataSource("IDB", "sync.invoiceCounter.start", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
        const res = await apiClient.patch(action.url, action.payload);
        await completeSyncAction(action.id);
        logDataSource("IDB", "sync.invoiceCounter.success", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
        if (res?.data) {
          await upsertEntitySnapshot(INVOICE_COUNTER_KEY, res.data);
        }
      } catch (error) {
        await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed", { statusCode: error?.response?.status });
        logDataSource("IDB", "sync.invoiceCounter.failed", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
      }
    }
  } finally {
    syncInFlight = false;
  }
};

const ensureOnlineSyncHook = () => {
  if (onlineHandlerAttached || typeof window === "undefined") return;
  onlineHandlerAttached = true;
  window.addEventListener("online", () => {
    processBannerQueue().catch(() => null);
  });
};

ensureOnlineSyncHook();

const ensureSyncLoop = () => {
  if (syncLoopAttached || typeof window === "undefined") return;
  syncLoopAttached = true;
  setInterval(() => {
    processBannerQueue().catch(() => null);
  }, 15000);
  window.addEventListener("visibilitychange", () => {
    if (!document.hidden) processBannerQueue().catch(() => null);
  });
};

ensureSyncLoop();

export const fetchMyInvoiceBannerLocalFirst = async () => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get("/businesses/me/invoice-banner");
    return res.data;
  }

  const cached = await getEntitySnapshot(BANNER_KEY);
  logDataSource("IDB", "business.invoiceBanner.local", { hasBanner: Boolean(cached) });
  return { invoice_banner_data: cached || "" };
};

export const updateMyInvoiceBannerLocalFirst = async (invoice_banner_data) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.patch("/businesses/me/invoice-banner", { invoice_banner_data });
    return res.data;
  }

  await upsertEntitySnapshot(BANNER_KEY, invoice_banner_data || "");

  await queueSyncAction({
    entity: "business.invoiceBanner",
    method: "PATCH",
    url: "/businesses/me/invoice-banner",
    payload: { invoice_banner_data },
    meta: {},
  });

  processBannerQueue().catch(() => null);
  return { invoice_banner_data };
};

export const fetchMyInvoiceCounterLocalFirst = async (params = {}) => {
  const year = Number(params?.year) || new Date().getFullYear();
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get("/businesses/me/invoice-counter", { params: { year } });
    return res.data;
  }

  if (navigator.onLine) {
    try {
      const res = await apiClient.get("/businesses/me/invoice-counter", { params: { year } });
      if (res?.data) {
        await upsertEntitySnapshot(INVOICE_COUNTER_KEY, res.data);
        return res.data;
      }
    } catch {
      // Fall back to local snapshot
    }
  }

  const cached = await getEntitySnapshot(INVOICE_COUNTER_KEY);
  if (cached && typeof cached === "object") {
    logDataSource("IDB", "business.invoiceCounter.local", { cached: true });
    return cached;
  }

  return {
    year,
    last_invoice_no: 0,
    next_invoice_no: 1,
    can_update: true,
    has_invoices: false,
    invoice_count: 0,
  };
};

export const updateMyInvoiceCounterLocalFirst = async (payload) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.patch("/businesses/me/invoice-counter", payload);
    return res.data;
  }

  const merged = {
    ...(await getEntitySnapshot(INVOICE_COUNTER_KEY)),
    ...(payload || {}),
  };
  const next = {
    year: Number(merged?.year || new Date().getFullYear()),
    last_invoice_no: Number(merged?.last_invoice_no || 0),
    next_invoice_no: Number(merged?.last_invoice_no || 0) + 1,
    can_update: true,
    has_invoices: false,
    invoice_count: 0,
  };
  await upsertEntitySnapshot(INVOICE_COUNTER_KEY, next);

  await queueSyncAction({
    entity: "business.invoiceCounter",
    method: "PATCH",
    url: "/businesses/me/invoice-counter",
    payload,
    meta: {},
  });

  processBannerQueue().catch(() => null);
  return next;
};
