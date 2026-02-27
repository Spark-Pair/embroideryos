import { apiClient } from "../api/apiClient";
import { completeSyncAction, failSyncAction, getEntitySnapshot, getPendingSyncActions, offlineAccess, queueSyncAction, upsertEntitySnapshot } from "./idb";
import { logDataSource } from "./logger";

const BANNER_KEY = "business:invoice_banner";

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
        await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed");
        logDataSource("IDB", "sync.invoiceBanner.failed", {
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
