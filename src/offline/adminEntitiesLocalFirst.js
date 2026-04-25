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
import { logDataSource } from "./logger";

const BUSINESSES_URL = "/businesses";
const USERS_URL = "/users";

const BUSINESSES_ALL_KEY = "businesses:all";
const BUSINESSES_STATS_KEY = "businesses:stats";
const BUSINESSES_OVERLAY_KEY = "businesses:overlay";
const USERS_ALL_KEY = "users:all";
const USERS_STATS_KEY = "users:stats";
const USERS_OVERLAY_KEY = "users:overlay";
const BUSINESS_USERS_ALL_KEY = "users:business:all";
const BUSINESS_USERS_STATS_KEY = "users:business:stats";
const BUSINESS_USERS_OVERLAY_KEY = "users:business:overlay";

let syncInFlight = false;
let onlineHandlerAttached = false;
let syncLoopAttached = false;

const toList = (value) => (Array.isArray(value) ? value : []);
const normalizeId = (row) => String(row?._id || row?.id || "");
const isLocalId = (value) => String(value || "").startsWith("local-");
const getCachedUser = () => {
  try {
    const raw = localStorage.getItem("cachedUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const sortLatestFirst = (rows = []) =>
  [...rows].sort((a, b) => {
    const aTime = new Date(a?.updatedAt || a?.createdAt || 0).getTime() || 0;
    const bTime = new Date(b?.updatedAt || b?.createdAt || 0).getTime() || 0;
    return bTime - aTime;
  });
const uniqueById = (rows = []) => {
  const map = new Map();
  rows.forEach((row) => {
    const id = normalizeId(row);
    if (!id) return;
    map.set(id, { ...row, _id: id });
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
    data: rows.slice(start, start + limit),
    pagination: {
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage: limit,
    },
  };
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

const getBusinessesBase = async () => uniqueById(toList(await getEntitySnapshot(BUSINESSES_ALL_KEY)));
const getBusinessUsersBase = async () => uniqueById(toList(await getEntitySnapshot(BUSINESS_USERS_ALL_KEY)));
const getUsersBase = async () => uniqueById(toList(await getEntitySnapshot(USERS_ALL_KEY)));

const buildSimpleStats = (rows = []) => ({
  success: true,
  data: {
    total: rows.length,
    active: rows.filter((row) => row?.isActive !== false).length,
    inactive: rows.filter((row) => row?.isActive === false).length,
  },
});

const filterBusinesses = (rows = [], params = {}) => {
  let data = [...rows];
  const name = String(params?.name || "").trim().toLowerCase();
  const status = String(params?.status || "").trim().toLowerCase();
  if (name) data = data.filter((row) => String(row?.name || "").toLowerCase().includes(name));
  if (status === "active") data = data.filter((row) => row?.isActive !== false);
  if (status === "inactive") data = data.filter((row) => row?.isActive === false);
  return sortLatestFirst(data);
};

const filterUsers = (rows = [], params = {}) => {
  let data = [...rows];
  const name = String(params?.name || "").trim().toLowerCase();
  const status = String(params?.status || "").trim().toLowerCase();
  if (name) data = data.filter((row) => String(row?.name || "").toLowerCase().includes(name));
  if (status === "active") data = data.filter((row) => row?.isActive !== false);
  if (status === "inactive") data = data.filter((row) => row?.isActive === false);
  return sortLatestFirst(data);
};

const refreshBusinessesFromCloud = async () => {
  const [listRes, statsRes] = await Promise.all([
    apiClient.get(`${BUSINESSES_URL}?page=1&limit=5000`),
    apiClient.get(`${BUSINESSES_URL}/stats`),
  ]);
  await Promise.all([
    upsertEntitySnapshot(BUSINESSES_ALL_KEY, toList(listRes?.data?.data)),
    upsertEntitySnapshot(BUSINESSES_STATS_KEY, statsRes?.data || null),
  ]);
};

const refreshUsersFromCloud = async () => {
  const [listRes, statsRes] = await Promise.all([
    apiClient.get(`${USERS_URL}?page=1&limit=5000`),
    apiClient.get(`${USERS_URL}/stats`),
  ]);
  await Promise.all([
    upsertEntitySnapshot(USERS_ALL_KEY, toList(listRes?.data?.data)),
    upsertEntitySnapshot(USERS_STATS_KEY, statsRes?.data || null),
  ]);
};

const refreshBusinessUsersFromCloud = async () => {
  const [listRes, statsRes] = await Promise.all([
    apiClient.get(`${USERS_URL}/business?page=1&limit=5000`),
    apiClient.get(`${USERS_URL}/business/stats`),
  ]);
  await Promise.all([
    upsertEntitySnapshot(BUSINESS_USERS_ALL_KEY, toList(listRes?.data?.data)),
    upsertEntitySnapshot(BUSINESS_USERS_STATS_KEY, statsRes?.data || null),
  ]);
};

const syncBusinessesQueue = async () => {
  const actions = await getPendingSyncActions("businesses");
  for (const action of actions) {
    try {
      if (action.method === "POST") {
        const res = await apiClient.post(action.url, action.payload);
        const business = res?.data?.business || res?.data;
        const localId = String(action?.meta?.localId || "");
        const realId = normalizeId(business);
        if (localId && realId) {
          await patchOverlay(BUSINESSES_OVERLAY_KEY, (overlay) => {
            delete overlay[localId];
            return overlay;
          });
          await remapPendingSyncEntityId("businesses", localId, realId);
        }
      } else if (action.method === "PUT") {
        await apiClient.put(action.url, action.payload);
      } else if (action.method === "PATCH") {
        await apiClient.patch(action.url, action.payload);
      }
      await refreshBusinessesFromCloud();
      await completeSyncAction(action.id);
    } catch (error) {
      await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed", { statusCode: error?.response?.status });
    }
  }
};

const syncUsersQueue = async () => {
  const actions = await getPendingSyncActions("users");
  for (const action of actions) {
    try {
      if (action.method === "PATCH") {
        await apiClient.patch(action.url, action.payload);
      }
      await refreshUsersFromCloud();
      await completeSyncAction(action.id);
    } catch (error) {
      await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed", { statusCode: error?.response?.status });
    }
  }
};

const syncBusinessUsersQueue = async () => {
  const actions = await getPendingSyncActions("businessUsers");
  for (const action of actions) {
    try {
      if (action.method === "POST") {
        const res = await apiClient.post(action.url, action.payload);
        const realId = String(res?.data?.id || "");
        const localId = String(action?.meta?.localId || "");
        if (localId && realId) {
          await patchOverlay(BUSINESS_USERS_OVERLAY_KEY, (overlay) => {
            const row = overlay[localId];
            delete overlay[localId];
            if (row) overlay[realId] = { ...row, _id: realId };
            return overlay;
          });
          await remapPendingSyncEntityId("businessUsers", localId, realId);
        }
      } else if (action.method === "PATCH") {
        await apiClient.patch(action.url, action.payload);
      }
      await refreshBusinessUsersFromCloud();
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
    await syncBusinessesQueue();
    await syncUsersQueue();
    await syncBusinessUsersQueue();
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

export const fetchBusinessesLocalFirst = async (params = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const queryParams = new URLSearchParams({ page: params.page || 1, limit: params.limit || 30, ...(params.name && { name: params.name }), ...(params.status && { status: params.status }) });
    const res = await apiClient.get(`${BUSINESSES_URL}?${queryParams}`);
    return res.data;
  }
  try {
    const [listRes, statsRes] = await Promise.all([
      apiClient.get(`${BUSINESSES_URL}?page=1&limit=5000`),
      apiClient.get(`${BUSINESSES_URL}/stats`),
    ]);
    await Promise.all([
      upsertEntitySnapshot(BUSINESSES_ALL_KEY, toList(listRes?.data?.data)),
      upsertEntitySnapshot(BUSINESSES_STATS_KEY, statsRes?.data || null),
    ]);
  } catch {}
  let rows = filterBusinesses(withOverlayList(await getBusinessesBase(), await getOverlay(BUSINESSES_OVERLAY_KEY)), params);
  if (!rows.length && typeof navigator !== "undefined" && navigator.onLine) {
    try {
      await refreshBusinessesFromCloud();
      rows = filterBusinesses(withOverlayList(await getBusinessesBase(), await getOverlay(BUSINESSES_OVERLAY_KEY)), params);
    } catch {}
  }
  return toPaginatedResponse(rows, params);
};

export const fetchBusinessStatsLocalFirst = async () => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${BUSINESSES_URL}/stats`);
    return res.data;
  }
  try {
    const res = await apiClient.get(`${BUSINESSES_URL}/stats`);
    await upsertEntitySnapshot(BUSINESSES_STATS_KEY, res.data || null);
  } catch {}
  const rows = withOverlayList(await getBusinessesBase(), await getOverlay(BUSINESSES_OVERLAY_KEY));
  return buildSimpleStats(rows);
};

export const createBusinessLocalFirst = async (payload = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.post(BUSINESSES_URL, payload);
    return res.data;
  }
  const localId = `local-business-${Date.now()}`;
  const row = {
    _id: localId,
    name: payload?.name || "",
    person: payload?.person || "",
    price: Number(payload?.price || 0),
    registration_date: payload?.registration_date || new Date().toISOString(),
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await patchOverlay(BUSINESSES_OVERLAY_KEY, (overlay) => ({ ...overlay, [localId]: row }));
  await queueSyncAction({
    entity: "businesses",
    method: "POST",
    url: BUSINESSES_URL,
    payload,
    meta: { localId },
  });
  return { business: row, offline: true };
};

export const updateBusinessLocalFirst = async (id, payload = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.put(`${BUSINESSES_URL}/${id}`, payload);
    return res.data;
  }
  const targetId = String(id || "");
  const baseRows = withOverlayList(await getBusinessesBase(), await getOverlay(BUSINESSES_OVERLAY_KEY));
  const existing = baseRows.find((row) => normalizeId(row) === targetId) || {};
  const next = { ...existing, ...payload, _id: targetId, updatedAt: new Date().toISOString() };
  await patchOverlay(BUSINESSES_OVERLAY_KEY, (overlay) => ({ ...overlay, [targetId]: next }));
  await queueSyncAction({
    entity: "businesses",
    method: "PUT",
    url: `${BUSINESSES_URL}/${targetId}`,
    payload,
    meta: { id: targetId },
  });
  return next;
};

export const toggleBusinessStatusLocalFirst = async (id) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.patch(`${BUSINESSES_URL}/${id}/toggle-status`);
    return res.data;
  }
  const targetId = String(id || "");
  const baseRows = withOverlayList(await getBusinessesBase(), await getOverlay(BUSINESSES_OVERLAY_KEY));
  const existing = baseRows.find((row) => normalizeId(row) === targetId) || {};
  const next = { ...existing, _id: targetId, isActive: existing?.isActive === false ? true : false, updatedAt: new Date().toISOString() };
  await patchOverlay(BUSINESSES_OVERLAY_KEY, (overlay) => ({ ...overlay, [targetId]: next }));
  await queueSyncAction({
    entity: "businesses",
    method: "PATCH",
    url: `${BUSINESSES_URL}/${targetId}/toggle-status`,
    payload: {},
    meta: { id: targetId },
    dedupeKey: `businesses:toggle:${targetId}`,
  });
  return { id: targetId, isActive: next.isActive, offline: true };
};

export const fetchUsersLocalFirst = async (params = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const queryParams = new URLSearchParams({ page: params.page || 1, limit: params.limit || 30, ...(params.name && { name: params.name }), ...(params.status && { status: params.status }) });
    const res = await apiClient.get(`${USERS_URL}?${queryParams}`);
    return res.data;
  }
  let rows = filterUsers(withOverlayList(await getUsersBase(), await getOverlay(USERS_OVERLAY_KEY)), params);
  if (rows.length > 0) {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      refreshUsersFromCloud().catch(() => null);
    }
    return toPaginatedResponse(rows, params);
  }
  if (!rows.length && typeof navigator !== "undefined" && navigator.onLine) {
    try {
      await refreshUsersFromCloud();
      rows = filterUsers(withOverlayList(await getUsersBase(), await getOverlay(USERS_OVERLAY_KEY)), params);
    } catch {}
  }
  return toPaginatedResponse(rows, params);
};

export const fetchUserStatsLocalFirst = async () => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${USERS_URL}/stats`);
    return res.data;
  }
  const rows = withOverlayList(await getUsersBase(), await getOverlay(USERS_OVERLAY_KEY));
  if (rows.length > 0) {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      apiClient.get(`${USERS_URL}/stats`).then((res) => upsertEntitySnapshot(USERS_STATS_KEY, res.data || null)).catch(() => null);
    }
    return buildSimpleStats(rows);
  }
  try {
    const res = await apiClient.get(`${USERS_URL}/stats`);
    await upsertEntitySnapshot(USERS_STATS_KEY, res.data || null);
  } catch {}
  return buildSimpleStats(rows);
};

export const fetchBusinessUsersLocalFirst = async (params = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const queryParams = new URLSearchParams({ page: params.page || 1, limit: params.limit || 30, ...(params.name && { name: params.name }), ...(params.status && { status: params.status }) });
    const res = await apiClient.get(`${USERS_URL}/business?${queryParams}`);
    return res.data;
  }
  let rows = filterUsers(withOverlayList(await getBusinessUsersBase(), await getOverlay(BUSINESS_USERS_OVERLAY_KEY)), params);
  if (rows.length > 0) {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      refreshBusinessUsersFromCloud().catch(() => null);
    }
    return toPaginatedResponse(rows, params);
  }
  if (!rows.length && typeof navigator !== "undefined" && navigator.onLine) {
    try {
      await refreshBusinessUsersFromCloud();
      rows = filterUsers(withOverlayList(await getBusinessUsersBase(), await getOverlay(BUSINESS_USERS_OVERLAY_KEY)), params);
    } catch {}
  }
  return toPaginatedResponse(rows, params);
};

export const fetchBusinessUserStatsLocalFirst = async () => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${USERS_URL}/business/stats`);
    return res.data;
  }
  const rows = withOverlayList(await getBusinessUsersBase(), await getOverlay(BUSINESS_USERS_OVERLAY_KEY));
  if (rows.length > 0) {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      apiClient.get(`${USERS_URL}/business/stats`).then((res) => upsertEntitySnapshot(BUSINESS_USERS_STATS_KEY, res.data || null)).catch(() => null);
    }
    return buildSimpleStats(rows);
  }
  try {
    const res = await apiClient.get(`${USERS_URL}/business/stats`);
    await upsertEntitySnapshot(BUSINESS_USERS_STATS_KEY, res.data || null);
  } catch {}
  return buildSimpleStats(rows);
};

export const createBusinessUserLocalFirst = async (payload = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.post(`${USERS_URL}/business`, payload);
    return res.data;
  }
  const localId = `local-business-user-${Date.now()}`;
  const cachedUser = getCachedUser();
  const row = {
    _id: localId,
    name: payload?.name || "",
    username: payload?.username || "",
    role: payload?.role || "staff",
    isActive: true,
    business_name: cachedUser?.business?.name || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await patchOverlay(BUSINESS_USERS_OVERLAY_KEY, (overlay) => ({ ...overlay, [localId]: row }));
  await queueSyncAction({
    entity: "businessUsers",
    method: "POST",
    url: `${USERS_URL}/business`,
    payload,
    meta: { localId },
  });
  return { id: localId, offline: true };
};

export const toggleBusinessUserStatusLocalFirst = async (id) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.patch(`${USERS_URL}/business/${id}/toggle-status`);
    return res.data;
  }
  const targetId = String(id || "");
  const baseRows = withOverlayList(await getBusinessUsersBase(), await getOverlay(BUSINESS_USERS_OVERLAY_KEY));
  const existing = baseRows.find((row) => normalizeId(row) === targetId) || {};
  const next = { ...existing, _id: targetId, isActive: existing?.isActive === false ? true : false, updatedAt: new Date().toISOString() };
  await patchOverlay(BUSINESS_USERS_OVERLAY_KEY, (overlay) => ({ ...overlay, [targetId]: next }));
  await queueSyncAction({
    entity: "businessUsers",
    method: "PATCH",
    url: `${USERS_URL}/business/${targetId}/toggle-status`,
    payload: {},
    meta: { id: targetId },
    dedupeKey: `businessUsers:toggle:${targetId}`,
  });
  return { id: targetId, isActive: next.isActive, offline: true };
};

export const toggleUserStatusLocalFirst = async (id) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.patch(`${USERS_URL}/${id}/toggle-status`);
    return res.data;
  }
  const targetId = String(id || "");
  const baseRows = withOverlayList(await getUsersBase(), await getOverlay(USERS_OVERLAY_KEY));
  const existing = baseRows.find((row) => normalizeId(row) === targetId) || {};
  const next = {
    ...existing,
    _id: targetId,
    isActive: existing?.isActive === false ? true : false,
    updatedAt: new Date().toISOString(),
  };
  await patchOverlay(USERS_OVERLAY_KEY, (overlay) => ({ ...overlay, [targetId]: next }));
  await queueSyncAction({
    entity: "users",
    method: "PATCH",
    url: `${USERS_URL}/${targetId}/toggle-status`,
    payload: {},
    meta: { id: targetId },
    dedupeKey: `users:toggle:${targetId}`,
  });
  return { id: targetId, isActive: next.isActive, offline: true };
};
