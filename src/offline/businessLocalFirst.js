import { apiClient } from "../api/apiClient";
import { completeSyncAction, failSyncAction, getEntitySnapshot, getPendingSyncActions, offlineAccess, queueSyncAction, upsertEntitySnapshot } from "./idb";
import { logDataSource } from "./logger";

const BANNER_KEY = "business:invoice_banner";
const MACHINE_OPTIONS_KEY = "business:machine_options";
const REFERENCE_DATA_KEY = "business:reference_data";
const RULE_DATA_KEY = "business:rule_data";
const INVOICE_COUNTER_KEY = "business:invoice_counter";
const BUSINESSES_ALL_KEY = "businesses:all";
const BUSINESSES_OVERLAY_KEY = "businesses:overlay";

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

    const machineOptionActions = await getPendingSyncActions("business.machineOptions");
    for (const action of machineOptionActions) {
      try {
        logDataSource("IDB", "sync.machineOptions.start", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
        const res = await apiClient.patch(action.url, action.payload);
        await completeSyncAction(action.id);
        logDataSource("IDB", "sync.machineOptions.success", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
        if (Array.isArray(res?.data?.machine_options)) {
          await upsertEntitySnapshot(MACHINE_OPTIONS_KEY, res.data.machine_options);
        }
      } catch (error) {
        await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed", { statusCode: error?.response?.status });
        logDataSource("IDB", "sync.machineOptions.failed", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
      }
    }

    const referenceDataActions = await getPendingSyncActions("business.referenceData");
    for (const action of referenceDataActions) {
      try {
        logDataSource("IDB", "sync.referenceData.start", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
        const res = await apiClient.patch(action.url, action.payload);
        await completeSyncAction(action.id);
        logDataSource("IDB", "sync.referenceData.success", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
        if (res?.data?.reference_data) {
          await upsertEntitySnapshot(REFERENCE_DATA_KEY, res.data.reference_data);
        }
      } catch (error) {
        await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed", { statusCode: error?.response?.status });
        logDataSource("IDB", "sync.referenceData.failed", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
      }
    }

    const ruleDataActions = await getPendingSyncActions("business.ruleData");
    for (const action of ruleDataActions) {
      try {
        logDataSource("IDB", "sync.ruleData.start", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
        const res = await apiClient.patch(action.url, action.payload);
        await completeSyncAction(action.id);
        logDataSource("IDB", "sync.ruleData.success", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
        if (res?.data?.rule_data) {
          await upsertEntitySnapshot(RULE_DATA_KEY, res.data.rule_data);
        }
        if (res?.data?.reference_data) {
          await upsertEntitySnapshot(REFERENCE_DATA_KEY, res.data.reference_data);
        }
      } catch (error) {
        await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed", { statusCode: error?.response?.status });
        logDataSource("IDB", "sync.ruleData.failed", {
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

const normalizeMachineOptions = (value) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const clean = value
    .map((item) => String(item ?? "").trim())
    .filter((item) => item.length > 0)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 50);
  return clean;
};

const normalizeStringList = (value) => normalizeMachineOptions(value);

const normalizeReferenceData = (value = {}) => ({
  attendance_options: normalizeStringList(value?.attendance_options),
  staff_categories: normalizeStringList(value?.staff_categories),
  user_roles: normalizeStringList(value?.user_roles),
  customer_payment_methods: normalizeStringList(value?.customer_payment_methods),
  supplier_payment_methods: normalizeStringList(value?.supplier_payment_methods),
  staff_payment_types: normalizeStringList(value?.staff_payment_types),
  expense_types: normalizeStringList(value?.expense_types),
  order_units: normalizeStringList(value?.order_units),
  crp_categories: normalizeStringList(value?.crp_categories),
  bank_suggestions: normalizeStringList(value?.bank_suggestions),
  party_suggestions: normalizeStringList(value?.party_suggestions),
});

const normalizeRuleData = (value = {}) => ({
  attendance_rules: Array.isArray(value?.attendance_rules) ? value.attendance_rules : [],
  customer_payment_method_rules: Array.isArray(value?.customer_payment_method_rules)
    ? value.customer_payment_method_rules
    : [],
  staff_payment_type_rules: Array.isArray(value?.staff_payment_type_rules)
    ? value.staff_payment_type_rules
    : [],
  expense_type_rules: Array.isArray(value?.expense_type_rules)
    ? value.expense_type_rules
    : [],
  access_rules: Array.isArray(value?.access_rules)
    ? value.access_rules
    : [],
  allowance_rule: value?.allowance_rule && typeof value.allowance_rule === "object"
    ? value.allowance_rule
    : {},
  display_preferences: value?.display_preferences && typeof value.display_preferences === "object"
    ? value.display_preferences
    : {},
});

const normalizeBusinessRow = (value = {}) => {
  if (!value || typeof value !== "object") return null;
  const id = String(value?._id || value?.id || "");
  if (!id) return null;
  return { ...value, _id: id };
};

const getBusinessList = async () => {
  const baseSnapshot = await getEntitySnapshot(BUSINESSES_ALL_KEY);
  const base = Array.isArray(baseSnapshot) ? baseSnapshot : [];
  const overlay = (await getEntitySnapshot(BUSINESSES_OVERLAY_KEY)) || {};
  const map = new Map(
    base
      .map((row) => normalizeBusinessRow(row))
      .filter(Boolean)
      .map((row) => [String(row._id), row])
  );
  Object.values(overlay).forEach((row) => {
    const normalized = normalizeBusinessRow(row);
    if (!normalized) return;
    if (normalized._deleted) {
      map.delete(normalized._id);
      return;
    }
    map.set(normalized._id, { ...(map.get(normalized._id) || {}), ...normalized });
  });
  return Array.from(map.values());
};

const refreshInvoiceBannerFromCloud = async () => {
  const res = await apiClient.get("/businesses/me/invoice-banner");
  const banner = res?.data?.invoice_banner_data || "";
  await upsertEntitySnapshot(BANNER_KEY, banner);
  return banner;
};

const refreshMachineOptionsFromCloud = async () => {
  const res = await apiClient.get("/businesses/me/machine-options");
  const machineOptions = normalizeMachineOptions(res?.data?.machine_options);
  await upsertEntitySnapshot(MACHINE_OPTIONS_KEY, machineOptions);
  return machineOptions;
};

const refreshReferenceDataFromCloud = async () => {
  const res = await apiClient.get("/businesses/me/reference-data");
  const referenceData = normalizeReferenceData(res?.data?.reference_data);
  await upsertEntitySnapshot(REFERENCE_DATA_KEY, referenceData);
  return referenceData;
};

const refreshRuleDataFromCloud = async () => {
  const res = await apiClient.get("/businesses/me/rule-data");
  const ruleData = normalizeRuleData(res?.data?.rule_data);
  await upsertEntitySnapshot(RULE_DATA_KEY, ruleData);
  if (res?.data?.reference_data) {
    await upsertEntitySnapshot(REFERENCE_DATA_KEY, normalizeReferenceData(res.data.reference_data));
  }
  return ruleData;
};

const refreshInvoiceCounterFromCloud = async (year) => {
  const res = await apiClient.get("/businesses/me/invoice-counter", { params: { year } });
  if (res?.data) {
    await upsertEntitySnapshot(INVOICE_COUNTER_KEY, res.data);
    return res.data;
  }
  return null;
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
  if (!cached && typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const banner = await refreshInvoiceBannerFromCloud();
      return { invoice_banner_data: banner };
    } catch {
      // fall back to local snapshot
    }
  }
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

  if (typeof navigator !== "undefined" && navigator.onLine) {
    await processBannerQueue();
  } else {
    processBannerQueue().catch(() => null);
  }
  return { invoice_banner_data };
};

export const fetchMyMachineOptionsLocalFirst = async () => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get("/businesses/me/machine-options");
    return res.data;
  }

  const cached = await getEntitySnapshot(MACHINE_OPTIONS_KEY);
  const pendingActions = await getPendingSyncActions("business.machineOptions");
  if (Array.isArray(pendingActions) && pendingActions.length > 0) {
    const localMachineOptions = normalizeMachineOptions(cached);
    logDataSource("IDB", "business.machineOptions.local_pending", {
      count: localMachineOptions.length,
      pending: pendingActions.length,
    });
    return { machine_options: localMachineOptions };
  }

  const localMachineOptions = normalizeMachineOptions(cached);
  if (localMachineOptions.length > 0) {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      refreshMachineOptionsFromCloud().catch(() => null);
    }
    logDataSource("IDB", "business.machineOptions.local", { count: localMachineOptions.length });
    return { machine_options: localMachineOptions };
  }

  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const machineOptions = await refreshMachineOptionsFromCloud();
      return { machine_options: machineOptions };
    } catch {
      // Fall back to local snapshot
    }
  }
  return { machine_options: normalizeMachineOptions(cached) };
};

export const updateMyMachineOptionsLocalFirst = async (machine_options) => {
  const normalized = normalizeMachineOptions(machine_options);

  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.patch("/businesses/me/machine-options", { machine_options: normalized });
    return res.data;
  }

  await upsertEntitySnapshot(MACHINE_OPTIONS_KEY, normalized);

  await queueSyncAction({
    entity: "business.machineOptions",
    method: "PATCH",
    url: "/businesses/me/machine-options",
    payload: { machine_options: normalized },
    meta: {},
  });

  if (typeof navigator !== "undefined" && navigator.onLine) {
    await processBannerQueue();
  } else {
    processBannerQueue().catch(() => null);
  }
  return { machine_options: normalized };
};

export const fetchMyReferenceDataLocalFirst = async () => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get("/businesses/me/reference-data");
    return res.data;
  }

  const cached = await getEntitySnapshot(REFERENCE_DATA_KEY);
  const pendingActions = await getPendingSyncActions("business.referenceData");
  if (Array.isArray(pendingActions) && pendingActions.length > 0) {
    return { reference_data: normalizeReferenceData(cached) };
  }

  const localReferenceData = normalizeReferenceData(cached);
  const hasLocalReferenceData = Object.values(localReferenceData).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(value));
  if (hasLocalReferenceData) {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      refreshReferenceDataFromCloud().catch(() => null);
    }
    return { reference_data: localReferenceData };
  }

  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const referenceData = await refreshReferenceDataFromCloud();
      return { reference_data: referenceData };
    } catch {
      // fall back to cache
    }
  }

  return { reference_data: normalizeReferenceData(cached) };
};

export const updateMyReferenceDataLocalFirst = async (reference_data) => {
  const normalized = normalizeReferenceData(reference_data);

  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.patch("/businesses/me/reference-data", { reference_data: normalized });
    return res.data;
  }

  await upsertEntitySnapshot(REFERENCE_DATA_KEY, normalized);

  await queueSyncAction({
    entity: "business.referenceData",
    method: "PATCH",
    url: "/businesses/me/reference-data",
    payload: { reference_data: normalized },
    meta: {},
  });

  if (typeof navigator !== "undefined" && navigator.onLine) {
    await processBannerQueue();
  } else {
    processBannerQueue().catch(() => null);
  }
  return { reference_data: normalized };
};

export const fetchMyRuleDataLocalFirst = async () => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get("/businesses/me/rule-data");
    return res.data;
  }

  const cached = await getEntitySnapshot(RULE_DATA_KEY);
  const pendingActions = await getPendingSyncActions("business.ruleData");
  if (Array.isArray(pendingActions) && pendingActions.length > 0) {
    return { rule_data: normalizeRuleData(cached) };
  }

  const localRuleData = normalizeRuleData(cached);
  const hasLocalRuleData = Object.values(localRuleData).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(Object.keys(value || {}).length));
  if (hasLocalRuleData) {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      refreshRuleDataFromCloud().catch(() => null);
    }
    return { rule_data: localRuleData };
  }

  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const ruleData = await refreshRuleDataFromCloud();
      return { rule_data: ruleData };
    } catch {
      // fall back
    }
  }

  return { rule_data: normalizeRuleData(cached) };
};

export const updateMyRuleDataLocalFirst = async (rule_data) => {
  const normalized = normalizeRuleData(rule_data);

  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.patch("/businesses/me/rule-data", { rule_data: normalized });
    return res.data;
  }

  await upsertEntitySnapshot(RULE_DATA_KEY, normalized);

  await queueSyncAction({
    entity: "business.ruleData",
    method: "PATCH",
    url: "/businesses/me/rule-data",
    payload: { rule_data: normalized },
    meta: {},
  });

  if (typeof navigator !== "undefined" && navigator.onLine) {
    await processBannerQueue();
  } else {
    processBannerQueue().catch(() => null);
  }
  return { rule_data: normalized };
};

export const fetchMyInvoiceCounterLocalFirst = async (params = {}) => {
  const year = Number(params?.year) || new Date().getFullYear();
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get("/businesses/me/invoice-counter", { params: { year } });
    return res.data;
  }

  const cached = await getEntitySnapshot(INVOICE_COUNTER_KEY);
  if (cached && typeof cached === "object" && Number(cached?.year || year) === year) {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      refreshInvoiceCounterFromCloud(year).catch(() => null);
    }
    logDataSource("IDB", "business.invoiceCounter.local", { cached: true });
    return cached;
  }

  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const remoteCounter = await refreshInvoiceCounterFromCloud(year);
      if (remoteCounter) return remoteCounter;
    } catch {
      // Fall back to local snapshot
    }
  }

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

export const fetchBusinessLocalFirst = async (id) => {
  const targetId = String(id || "").trim();
  if (!targetId) return null;

  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`/businesses/${targetId}`);
    return res.data;
  }

  const localRows = await getBusinessList();
  const localRow = localRows.find((row) => String(row?._id || row?.id || "") === targetId);
  if (localRow) {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      apiClient
        .get(`/businesses/${targetId}`)
        .then(async (res) => {
          const remote = normalizeBusinessRow(res?.data?.business || res?.data);
          if (!remote) return;
          const next = await getBusinessList();
          const nextRows = next.some((row) => String(row?._id || row?.id || "") === targetId)
            ? next.map((row) => (String(row?._id || row?.id || "") === targetId ? { ...row, ...remote } : row))
            : [...next, remote];
          await upsertEntitySnapshot(BUSINESSES_ALL_KEY, nextRows);
        })
        .catch(() => null);
    }
    return localRow;
  }

  if (typeof navigator !== "undefined" && navigator.onLine) {
    const res = await apiClient.get(`/businesses/${targetId}`);
    const remote = normalizeBusinessRow(res?.data?.business || res?.data);
    if (remote) {
      const nextRows = [...localRows.filter((row) => String(row?._id || row?.id || "") !== targetId), remote];
      await upsertEntitySnapshot(BUSINESSES_ALL_KEY, nextRows);
    }
    return res.data;
  }

  return null;
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

  if (typeof navigator !== "undefined" && navigator.onLine) {
    await processBannerQueue();
  } else {
    processBannerQueue().catch(() => null);
  }
  return next;
};
