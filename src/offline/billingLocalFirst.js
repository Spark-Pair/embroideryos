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

const SUBSCRIPTIONS_URL = "/subscriptions";
const SUBSCRIPTION_PAYMENTS_URL = "/subscription-payments";

const PLANS_KEY = "plans:all";
const PLANS_OVERLAY_KEY = "plans:overlay";
const SUBSCRIPTIONS_KEY = "subscriptions:all";
const SUBSCRIPTIONS_OVERLAY_KEY = "subscriptions:overlay";
const SUBSCRIPTION_PAYMENTS_KEY = "subscriptionPayments:all";
const SUBSCRIPTION_PAYMENTS_OVERLAY_KEY = "subscriptionPayments:overlay";
const SUBSCRIPTION_PAYMENTS_STATS_PREFIX = "subscriptionPayments:stats:";

let syncInFlight = false;
let onlineHandlerAttached = false;
let syncLoopAttached = false;

const toList = (value) => (Array.isArray(value) ? value : []);
const normalizeId = (row) => String(row?._id || row?.id || "");
const sortLatestFirst = (rows = [], field = "updatedAt") =>
  [...rows].sort((a, b) => (new Date(b?.[field] || b?.createdAt || 0).getTime() || 0) - (new Date(a?.[field] || a?.createdAt || 0).getTime() || 0));
const uniqueById = (rows = []) => {
  const map = new Map();
  rows.forEach((row) => {
    const id = normalizeId(row);
    if (!id) return;
    map.set(id, { ...row, _id: id });
  });
  return Array.from(map.values());
};
const getOverlay = async (key) => (await getEntitySnapshot(key)) || {};
const setOverlay = async (key, value) => upsertEntitySnapshot(key, value || {});
const patchOverlay = async (key, patchFn) => {
  const existing = await getOverlay(key);
  const next = patchFn({ ...existing }) || {};
  await setOverlay(key, next);
};
const withOverlayList = (rows = [], overlay = {}) => {
  const map = new Map(uniqueById(rows).map((row) => [normalizeId(row), row]));
  Object.values(overlay || {}).forEach((row) => {
    if (!row) return;
    const id = normalizeId(row);
    if (!id) return;
    if (row._deleted) {
      map.delete(id);
      return;
    }
    map.set(id, { ...(map.get(id) || {}), ...row, _id: id });
  });
  return Array.from(map.values());
};
const toPaginatedResponse = (rows = [], params = {}) => {
  const page = Math.max(1, Number(params?.page || 1));
  const limit = Math.max(1, Number(params?.limit || 30));
  const totalItems = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const start = (page - 1) * limit;
  return {
    success: true,
    data: rows.slice(start, start + limit),
    pagination: {
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage: limit,
    },
  };
};
const toNum = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const refreshPlansFromCloud = async () => {
  const res = await apiClient.get(`${SUBSCRIPTIONS_URL}/plans`);
  await upsertEntitySnapshot(PLANS_KEY, toList(res?.data?.data));
};
const refreshSubscriptionsFromCloud = async () => {
  const res = await apiClient.get(`${SUBSCRIPTIONS_URL}?page=1&limit=5000`);
  await upsertEntitySnapshot(SUBSCRIPTIONS_KEY, toList(res?.data?.data));
};
const refreshSubscriptionPaymentsFromCloud = async (month = "") => {
  const [listRes, statsRes] = await Promise.all([
    apiClient.get(`${SUBSCRIPTION_PAYMENTS_URL}?page=1&limit=5000${month ? `&month=${month}` : ""}`),
    apiClient.get(`${SUBSCRIPTION_PAYMENTS_URL}/stats${month ? `?month=${month}` : ""}`),
  ]);
  await Promise.all([
    upsertEntitySnapshot(SUBSCRIPTION_PAYMENTS_KEY, toList(listRes?.data?.data)),
    upsertEntitySnapshot(`${SUBSCRIPTION_PAYMENTS_STATS_PREFIX}${month || "all"}`, statsRes?.data || null),
  ]);
};

const filterSubscriptions = (rows = [], params = {}) => {
  let data = [...rows];
  if (params?.plan) data = data.filter((row) => row?.plan === params.plan);
  if (params?.status) data = data.filter((row) => row?.status === params.status);
  if (params?.businessId) data = data.filter((row) => String(row?.businessId || "") === String(params.businessId));
  return sortLatestFirst(data);
};
const filterPayments = (rows = [], params = {}) => {
  let data = [...rows];
  if (params?.month) data = data.filter((row) => row?.month === params.month);
  if (params?.status) data = data.filter((row) => row?.status === params.status);
  if (params?.plan) data = data.filter((row) => row?.plan === params.plan);
  if (params?.businessId) data = data.filter((row) => String(row?.businessId || "") === String(params.businessId));
  return sortLatestFirst(data, "payment_date");
};

const syncPlansQueue = async () => {
  const actions = await getPendingSyncActions("plans");
  for (const action of actions) {
    try {
      if (action.method === "POST") await apiClient.post(action.url, action.payload);
      if (action.method === "PUT") await apiClient.put(action.url, action.payload);
      await refreshPlansFromCloud();
      await completeSyncAction(action.id);
    } catch (error) {
      await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed", { statusCode: error?.response?.status });
    }
  }
};

const syncSubscriptionsQueue = async () => {
  const actions = await getPendingSyncActions("subscriptions");
  for (const action of actions) {
    try {
      if (action.method === "POST") {
        const res = await apiClient.post(action.url, action.payload);
        const isRenew = action.url.includes("/renew");
        if (!isRenew) {
          const subscription = res?.data?.data || res?.data;
          const localId = String(action?.meta?.localId || "");
          const realId = normalizeId(subscription);
          if (localId && realId) {
            await patchOverlay(SUBSCRIPTIONS_OVERLAY_KEY, (overlay) => {
              delete overlay[localId];
              return overlay;
            });
            await remapPendingSyncEntityId("subscriptions", localId, realId);
          }
        }
      }
      if (action.method === "PATCH") await apiClient.patch(action.url, action.payload);
      await refreshSubscriptionsFromCloud();
      await completeSyncAction(action.id);
    } catch (error) {
      await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed", { statusCode: error?.response?.status });
    }
  }
};

const syncSubscriptionPaymentsQueue = async () => {
  const actions = await getPendingSyncActions("subscriptionPayments");
  for (const action of actions) {
    try {
      if (action.method === "POST") {
        const res = await apiClient.post(action.url, action.payload);
        const row = res?.data?.data || res?.data;
        const localId = String(action?.meta?.localId || "");
        const realId = normalizeId(row);
        if (localId && realId) {
          await patchOverlay(SUBSCRIPTION_PAYMENTS_OVERLAY_KEY, (overlay) => {
            delete overlay[localId];
            return overlay;
          });
          await remapPendingSyncEntityId("subscriptionPayments", localId, realId);
        }
      }
      if (action.method === "PUT") await apiClient.put(action.url, action.payload);
      await refreshSubscriptionPaymentsFromCloud(action?.meta?.month || "");
      await completeSyncAction(action.id);
    } catch (error) {
      await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed", { statusCode: error?.response?.status });
    }
  }
};

const processQueue = async () => {
  if (syncInFlight || !offlineAccess.isUnlocked() || typeof navigator === "undefined" || navigator.onLine === false) return;
  syncInFlight = true;
  try {
    await syncPlansQueue();
    await syncSubscriptionsQueue();
    await syncSubscriptionPaymentsQueue();
  } finally {
    syncInFlight = false;
  }
};

const ensureSyncHooks = () => {
  if (!onlineHandlerAttached && typeof window !== "undefined") {
    onlineHandlerAttached = true;
    window.addEventListener("online", () => processQueue().catch(() => null));
  }
  if (!syncLoopAttached && typeof window !== "undefined") {
    syncLoopAttached = true;
    setInterval(() => processQueue().catch(() => null), 15000);
    window.addEventListener("visibilitychange", () => {
      if (!document.hidden) processQueue().catch(() => null);
    });
  }
};
ensureSyncHooks();

export const fetchPlansLocalFirst = async () => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${SUBSCRIPTIONS_URL}/plans`);
    return res.data;
  }
  let rows = toList(await getEntitySnapshot(PLANS_KEY));
  if (rows.length > 0) {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      refreshPlansFromCloud().catch(() => null);
    }
    return { success: true, data: rows };
  }
  if (!rows.length && typeof navigator !== "undefined" && navigator.onLine) {
    try {
      await refreshPlansFromCloud();
      rows = toList(await getEntitySnapshot(PLANS_KEY));
    } catch {}
  }
  return { success: true, data: rows };
};

export const createPlanLocalFirst = async (payload = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.post(`${SUBSCRIPTIONS_URL}/plans`, payload);
    return res.data;
  }
  const existing = toList(await getEntitySnapshot(PLANS_KEY));
  const next = sortLatestFirst(uniqueById(existing.concat([{ ...payload, id: payload?.id || `local-plan-${Date.now()}` }])));
  await upsertEntitySnapshot(PLANS_KEY, next);
  await queueSyncAction({ entity: "plans", method: "POST", url: `${SUBSCRIPTIONS_URL}/plans`, payload, meta: {} });
  return { success: true, data: payload, offline: true };
};

export const updatePlanLocalFirst = async (id, payload = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.put(`${SUBSCRIPTIONS_URL}/plans/${id}`, payload);
    return res.data;
  }
  const rows = toList(await getEntitySnapshot(PLANS_KEY));
  const next = rows.map((row) => (row?.id === id ? { ...row, ...payload, id } : row));
  await upsertEntitySnapshot(PLANS_KEY, next);
  await queueSyncAction({ entity: "plans", method: "PUT", url: `${SUBSCRIPTIONS_URL}/plans/${id}`, payload, meta: { id } });
  return { success: true, data: { ...payload, id }, offline: true };
};

export const fetchSubscriptionsLocalFirst = async (params = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(SUBSCRIPTIONS_URL, { params });
    return res.data;
  }
  let rows = filterSubscriptions(withOverlayList(toList(await getEntitySnapshot(SUBSCRIPTIONS_KEY)), await getOverlay(SUBSCRIPTIONS_OVERLAY_KEY)), params);
  if (rows.length > 0) {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      refreshSubscriptionsFromCloud().catch(() => null);
    }
    return toPaginatedResponse(rows, params);
  }
  if (!rows.length && typeof navigator !== "undefined" && navigator.onLine) {
    try {
      await refreshSubscriptionsFromCloud();
      rows = filterSubscriptions(withOverlayList(toList(await getEntitySnapshot(SUBSCRIPTIONS_KEY)), await getOverlay(SUBSCRIPTIONS_OVERLAY_KEY)), params);
    } catch {}
  }
  return toPaginatedResponse(rows, params);
};

export const createSubscriptionLocalFirst = async (payload = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.post(SUBSCRIPTIONS_URL, payload);
    return res.data;
  }
  const localId = `local-subscription-${Date.now()}`;
  const row = {
    _id: localId,
    businessId: payload?.businessId || "",
    business_name: "",
    plan: payload?.plan || "trial",
    status: payload?.status || "active",
    active: payload?.active !== false,
    startsAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await patchOverlay(SUBSCRIPTIONS_OVERLAY_KEY, (overlay) => ({ ...overlay, [localId]: row }));
  await queueSyncAction({ entity: "subscriptions", method: "POST", url: SUBSCRIPTIONS_URL, payload, meta: { localId } });
  return { success: true, data: row, offline: true };
};

export const updateSubscriptionLocalFirst = async (id, payload = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.patch(`${SUBSCRIPTIONS_URL}/${id}`, payload);
    return res.data;
  }
  const targetId = String(id || "");
  const base = withOverlayList(toList(await getEntitySnapshot(SUBSCRIPTIONS_KEY)), await getOverlay(SUBSCRIPTIONS_OVERLAY_KEY));
  const existing = base.find((row) => normalizeId(row) === targetId) || {};
  const next = { ...existing, ...payload, _id: targetId, updatedAt: new Date().toISOString() };
  await patchOverlay(SUBSCRIPTIONS_OVERLAY_KEY, (overlay) => ({ ...overlay, [targetId]: next }));
  await queueSyncAction({ entity: "subscriptions", method: "PATCH", url: `${SUBSCRIPTIONS_URL}/${targetId}`, payload, meta: { id: targetId } });
  return { success: true, data: next, offline: true };
};

export const renewSubscriptionLocalFirst = async (id, payload = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.post(`${SUBSCRIPTIONS_URL}/${id}/renew`, payload);
    return res.data;
  }
  const targetId = String(id || "");
  const base = withOverlayList(toList(await getEntitySnapshot(SUBSCRIPTIONS_KEY)), await getOverlay(SUBSCRIPTIONS_OVERLAY_KEY));
  const existing = base.find((row) => normalizeId(row) === targetId) || {};
  const next = { ...existing, _id: targetId, plan: payload?.plan || existing?.plan, status: "active", active: true, updatedAt: new Date().toISOString() };
  await patchOverlay(SUBSCRIPTIONS_OVERLAY_KEY, (overlay) => ({ ...overlay, [targetId]: next }));
  await queueSyncAction({ entity: "subscriptions", method: "POST", url: `${SUBSCRIPTIONS_URL}/${targetId}/renew`, payload, meta: { id: targetId } });
  return { success: true, data: next, offline: true };
};

export const fetchSubscriptionPaymentsLocalFirst = async (params = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(SUBSCRIPTION_PAYMENTS_URL, { params });
    return res.data;
  }
  let rows = filterPayments(withOverlayList(toList(await getEntitySnapshot(SUBSCRIPTION_PAYMENTS_KEY)), await getOverlay(SUBSCRIPTION_PAYMENTS_OVERLAY_KEY)), params);
  if (rows.length > 0) {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      refreshSubscriptionPaymentsFromCloud(params?.month || "").catch(() => null);
    }
    return toPaginatedResponse(rows, params);
  }
  if (!rows.length && typeof navigator !== "undefined" && navigator.onLine) {
    try {
      await refreshSubscriptionPaymentsFromCloud(params?.month || "");
      rows = filterPayments(withOverlayList(toList(await getEntitySnapshot(SUBSCRIPTION_PAYMENTS_KEY)), await getOverlay(SUBSCRIPTION_PAYMENTS_OVERLAY_KEY)), params);
    } catch {}
  }
  return toPaginatedResponse(rows, params);
};

export const fetchSubscriptionPaymentStatsLocalFirst = async (params = {}) => {
  const month = String(params?.month || "all");
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${SUBSCRIPTION_PAYMENTS_URL}/stats`, { params });
    return res.data;
  }
  const cached = (await getEntitySnapshot(`${SUBSCRIPTION_PAYMENTS_STATS_PREFIX}${month}`)) || { data: {} };
  const rows = filterPayments(withOverlayList(toList(await getEntitySnapshot(SUBSCRIPTION_PAYMENTS_KEY)), await getOverlay(SUBSCRIPTION_PAYMENTS_OVERLAY_KEY)), { month: params?.month || "" });
  if (rows.length > 0 && typeof navigator !== "undefined" && navigator.onLine) {
    apiClient.get(`${SUBSCRIPTION_PAYMENTS_URL}/stats`, { params }).then((res) => upsertEntitySnapshot(`${SUBSCRIPTION_PAYMENTS_STATS_PREFIX}${month}`, res.data || null)).catch(() => null);
  }
  return {
    success: true,
    data: {
      ...(cached?.data || {}),
      month: params?.month || cached?.data?.month || "",
      month_received: rows.filter((row) => row?.status === "received").reduce((sum, row) => sum + toNum(row?.amount), 0),
      month_pending: rows.filter((row) => row?.status === "pending").reduce((sum, row) => sum + toNum(row?.amount), 0),
      month_total_count: rows.length,
    },
  };
};

export const createSubscriptionPaymentLocalFirst = async (payload = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.post(SUBSCRIPTION_PAYMENTS_URL, payload);
    return res.data;
  }
  const localId = `local-subscription-payment-${Date.now()}`;
  const row = {
    _id: localId,
    businessId: payload?.businessId || "",
    business_name: "",
    plan: payload?.plan || "",
    payment_date: payload?.payment_date || new Date().toISOString(),
    month: payload?.month || String(payload?.payment_date || "").slice(0, 7),
    amount: toNum(payload?.amount),
    method: payload?.method || "online",
    status: payload?.status || "received",
    reference_no: payload?.reference_no || "",
    remarks: payload?.remarks || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await patchOverlay(SUBSCRIPTION_PAYMENTS_OVERLAY_KEY, (overlay) => ({ ...overlay, [localId]: row }));
  await queueSyncAction({
    entity: "subscriptionPayments",
    method: "POST",
    url: SUBSCRIPTION_PAYMENTS_URL,
    payload,
    meta: { localId, month: row.month || "" },
  });
  return { success: true, data: row, offline: true };
};

export const updateSubscriptionPaymentLocalFirst = async (id, payload = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.put(`${SUBSCRIPTION_PAYMENTS_URL}/${id}`, payload);
    return res.data;
  }
  const targetId = String(id || "");
  const base = withOverlayList(toList(await getEntitySnapshot(SUBSCRIPTION_PAYMENTS_KEY)), await getOverlay(SUBSCRIPTION_PAYMENTS_OVERLAY_KEY));
  const existing = base.find((row) => normalizeId(row) === targetId) || {};
  const next = { ...existing, ...payload, _id: targetId, updatedAt: new Date().toISOString() };
  await patchOverlay(SUBSCRIPTION_PAYMENTS_OVERLAY_KEY, (overlay) => ({ ...overlay, [targetId]: next }));
  await queueSyncAction({
    entity: "subscriptionPayments",
    method: "PUT",
    url: `${SUBSCRIPTION_PAYMENTS_URL}/${targetId}`,
    payload,
    meta: { id: targetId, month: next?.month || "" },
  });
  return { success: true, data: next, offline: true };
};
