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

const STAFF_URL = "/staffs";
const ALL_KEY = "staffs:all";
const STATS_KEY = "staffs:stats";
const NAMES_KEY = "staffs:names";
const OVERLAY_KEY = "staffs:overlay";

let syncInFlight = false;
let onlineHandlerAttached = false;
let syncLoopAttached = false;

const normalizeStaff = (value = {}) => ({
  ...value,
  opening_balance:
    value?.opening_balance === "" || value?.opening_balance == null
      ? 0
      : Number(value.opening_balance),
});

const normalizeId = (row) => String(row?._id || row?.id || "");
const resolveIdInput = (value) => {
  if (value && typeof value === "object") {
    return String(value?._id || value?.id || "").trim();
  }
  return String(value || "").trim();
};
const isLocalId = (value) => resolveIdInput(value).startsWith("local-");
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
const toNum = (value) => {
  if (value === "" || value == null) return 0;
  if (typeof value === "string") {
    const n = Number(value.replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const sortLatestFirst = (rows = []) =>
  [...rows].sort((a, b) => {
    const aTime = toMillis(a?.createdAt) || toMillis(a?.updatedAt) || objectIdToMillis(normalizeId(a));
    const bTime = toMillis(b?.createdAt) || toMillis(b?.updatedAt) || objectIdToMillis(normalizeId(b));
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

const getAllBaseStaffs = async () => {
  const all = await getEntitySnapshot(ALL_KEY);
  return uniqueById(Array.isArray(all) ? all : []);
};

const getStaffRecordsSnapshot = async () => {
  const base = await getEntitySnapshot("staffRecords:all");
  const overlay = (await getEntitySnapshot("staffRecords:overlay")) || {};
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

const getStaffPaymentsSnapshot = async () => {
  const base = await getEntitySnapshot("staffPayments:all");
  const overlay = (await getEntitySnapshot("staffPayments:overlay")) || {};
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

const getCrpStaffRecordsSnapshot = async () => {
  const base = await getEntitySnapshot("crpStaffRecords:all");
  const overlay = (await getEntitySnapshot("crpStaffRecords:overlay")) || {};
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

const attachStaffBalances = async (rows = []) => {
  const records = await getStaffRecordsSnapshot();
  const crpRecords = await getCrpStaffRecordsSnapshot();
  const payments = await getStaffPaymentsSnapshot();

  const earnedMap = new Map();
  records.forEach((rec) => {
    const id = String(rec?.staff_id?._id || rec?.staff_id || "");
    if (!id) return;
    earnedMap.set(id, (earnedMap.get(id) || 0) + toNum(rec?.final_amount));
  });

  crpRecords.forEach((rec) => {
    const id = String(rec?.staff_id?._id || rec?.staff_id || "");
    if (!id) return;
    earnedMap.set(id, (earnedMap.get(id) || 0) + toNum(rec?.total_amount));
  });

  const paymentMap = new Map();
  payments.forEach((p) => {
    const id = String(p?.staff_id?._id || p?.staff_id || "");
    if (!id) return;
    const existing = paymentMap.get(id) || { advance: 0, payment: 0, adjustment: 0 };
    if (p?.type === "advance") existing.advance += toNum(p?.amount);
    if (p?.type === "payment") existing.payment += toNum(p?.amount);
    if (p?.type === "adjustment") existing.adjustment += toNum(p?.amount);
    paymentMap.set(id, existing);
  });

  return rows.map((row) => {
    const id = normalizeId(row);
    const opening = toNum(row?.opening_balance);
    const earned = earnedMap.get(id) || 0;
    const paid = paymentMap.get(id) || { advance: 0, payment: 0, adjustment: 0 };
    return {
      ...row,
      current_balance: opening + earned + paid.adjustment - paid.advance - paid.payment,
    };
  });
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

const applyFilters = (rows = [], params = {}) => {
  let data = [...rows];
  const name = String(params?.name || "").trim().toLowerCase();
  const status = String(params?.status || "").trim().toLowerCase();
  const category = String(params?.category || "").trim();

  if (name) {
    data = data.filter((row) => String(row?.name || "").toLowerCase().includes(name));
  }

  if (status === "active") data = data.filter((row) => !!row?.isActive);
  if (status === "inactive") data = data.filter((row) => !row?.isActive);
  if (category) data = data.filter((row) => String(row?.category || "Embroidery") === category);

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

const findStaffByIdLocal = async (id) => {
  const target = String(id || "");
  if (!target) return null;
  const overlay = await getOverlay();
  if (overlay[target] && !overlay[target]?._deleted) return overlay[target];
  const all = await getAllBaseStaffs();
  return all.find((row) => normalizeId(row) === target) || null;
};

const refreshAllSnapshotFromCloud = async () => {
  if (!navigator.onLine) return;
  const [listRes, statsRes] = await Promise.all([
    apiClient.get(`${STAFF_URL}?page=1&limit=5000`),
    apiClient.get(`${STAFF_URL}/stats`),
  ]);
  const rows = uniqueById(Array.isArray(listRes?.data?.data) ? listRes.data.data : []);
  await upsertEntitySnapshot(ALL_KEY, rows);
  await upsertEntitySnapshot(STATS_KEY, statsRes?.data || null);
  await upsertEntitySnapshot(
    NAMES_KEY,
    rows
      .map((row) => ({ _id: row?._id, name: row?.name, category: row?.category || "Embroidery", joining_date: row?.joining_date }))
      .filter((row) => row?._id && row?.name)
      .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")))
  );
  logDataSource("IDB", "staffs.snapshot.refreshed", { count: rows.length });
};

const syncCreateSuccess = async (action, serverStaff) => {
  const localId = String(action?.meta?.localId || "");
  const realId = normalizeId(serverStaff);

  await patchOverlay((overlay) => {
    if (localId) delete overlay[localId];
    if (realId) overlay[realId] = { ...serverStaff, _id: realId };
    return overlay;
  });
  await remapPendingSyncEntityId("staffs", localId, realId);
};

const syncUpdateSuccess = async (action, serverStaff) => {
  const id = String(action?.meta?.id || normalizeId(serverStaff));
  if (!id) return;
  await patchOverlay((overlay) => {
    overlay[id] = { ...serverStaff, _id: id };
    return overlay;
  });
};

const syncToggleSuccess = async (action, payload) => {
  const id = String(payload?.id || action?.meta?.id || "");
  if (!id) return;
  await patchOverlay((overlay) => {
    const prev = overlay[id] || {};
    overlay[id] = {
      ...prev,
      _id: id,
      isActive: Boolean(payload?.isActive),
    };
    return overlay;
  });
};

const processStaffQueue = async () => {
  if (syncInFlight) return;
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;

  syncInFlight = true;
  try {
    const actions = await getPendingSyncActions("staffs");
    for (const action of actions) {
      try {
        logDataSource("IDB", "sync.staffs.start", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
        if (action.method === "POST") {
          const res = await apiClient.post(action.url, action.payload);
          const serverStaff = res?.data?.staff || res?.data;
          await syncCreateSuccess(action, serverStaff);
        } else if (action.method === "PUT") {
          const res = await apiClient.put(action.url, action.payload);
          const serverStaff = res?.data?.staff || res?.data;
          await syncUpdateSuccess(action, serverStaff);
        } else if (action.method === "PATCH") {
          const res = await apiClient.patch(action.url);
          await syncToggleSuccess(action, res?.data || {});
        }

        await completeSyncAction(action.id);
        logDataSource("IDB", "sync.staffs.success", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
      } catch (error) {
        await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed");
        logDataSource("IDB", "sync.staffs.failed", {
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
    processStaffQueue().catch(() => null);
  });
};

ensureOnlineSyncHook();

const ensureSyncLoop = () => {
  if (syncLoopAttached || typeof window === "undefined") return;
  syncLoopAttached = true;
  setInterval(() => {
    processStaffQueue().catch(() => null);
  }, 15000);
  window.addEventListener("visibilitychange", () => {
    if (!document.hidden) processStaffQueue().catch(() => null);
  });
};

ensureSyncLoop();

export const fetchStaffsLocalFirst = async (params = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const query = new URLSearchParams({
      page: params.page || 1,
      limit: params.limit || 30,
      ...(params.name && { name: params.name }),
      ...(params.status && { status: params.status }),
      ...(params.category && { category: params.category }),
    }).toString();
    const res = await apiClient.get(`${STAFF_URL}?${query}`);
    return res.data;
  }

  const overlay = await getOverlay();
  const base = await getAllBaseStaffs();
  const merged = withOverlayList(base, overlay);
  const filtered = applyFilters(merged, params);
  const withBalances = await attachStaffBalances(filtered);

  logDataSource("IDB", "staffs.fetch.local", {
    page: Number(params?.page || 1),
    limit: Number(params?.limit || 30),
    count: withBalances.length,
  });

  return toPaginatedResponse(withBalances, params);
};

export const fetchStaffNamesLocalFirst = async (params = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${STAFF_URL}/names`, { params });
    return res.data;
  }

  const overlay = await getOverlay();
  const base = await getAllBaseStaffs();
  const merged = withOverlayList(base, overlay);
  const status = String(params?.status || "").trim().toLowerCase();
  const category = String(params?.category || "").trim();
  const filtered = merged.filter((row) => {
    if (status === "active" && !row?.isActive) return false;
    if (status === "inactive" && row?.isActive) return false;
    if (category && String(row?.category || "Embroidery") !== category) return false;
    return true;
  });
  const data = filtered
    .map((row) => ({
      _id: row?._id,
      name: row?.name,
      category: row?.category || "Embroidery",
      joining_date: row?.joining_date,
      salary: Number(row?.salary || 0),
    }))
    .filter((row) => row?._id && row?.name)
    .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));

  await upsertEntitySnapshot(NAMES_KEY, data);
  logDataSource("IDB", "staffs.names.local", { count: data.length });
  return { data };
};

export const fetchStaffStatsLocalFirst = async () => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${STAFF_URL}/stats`);
    return res.data;
  }

  const overlay = await getOverlay();
  const base = await getAllBaseStaffs();
  const merged = withOverlayList(base, overlay);
  const stats = {
    success: true,
    data: {
      total: merged.length,
      active: merged.filter((row) => !!row?.isActive).length,
      inactive: merged.filter((row) => !row?.isActive).length,
    },
  };

  await upsertEntitySnapshot(STATS_KEY, stats);
  logDataSource("IDB", "staffs.stats.local", stats.data);
  return stats;
};

export const fetchStaffLocalFirst = async (id) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${STAFF_URL}/${id}`);
    return res.data;
  }

  const local = await findStaffByIdLocal(id);
  const enriched = local ? (await attachStaffBalances([local]))[0] : null;
  logDataSource("IDB", "staffs.get.local", { id: String(id || "") });
  if (enriched) return enriched;
  throw new Error("Staff not available locally");
};

export const createStaffLocalFirst = async (payload) => {
  if (offlineAccess.isUnlocked() && navigator.onLine) {
    try {
      const res = await apiClient.post(STAFF_URL, payload);
      const serverStaff = res?.data?.staff || res?.data;
      const realId = normalizeId(serverStaff);
      if (realId) {
        await patchOverlay((overlay) => {
          overlay[realId] = { ...serverStaff, _id: realId };
          return overlay;
        });
      }
      return res.data;
    } catch {
      // Fall back to offline queue path below.
    }
  }

  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.post(STAFF_URL, payload);
    return res.data;
  }

  const localId = `local-staff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const localStaff = {
    _id: localId,
    ...normalizeStaff(payload),
    isActive: true,
    __syncStatus: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await patchOverlay((overlay) => {
    overlay[localId] = localStaff;
    return overlay;
  });

  await queueSyncAction({
    entity: "staffs",
    method: "POST",
    url: STAFF_URL,
    payload: normalizeStaff(payload),
    meta: { localId },
  });

  if (navigator.onLine) await processStaffQueue();
  else processStaffQueue().catch(() => null);
  return { staff: localStaff };
};

export const updateStaffLocalFirst = async (id, payload) => {
  const targetId = resolveIdInput(id) || resolveIdInput(payload?.id) || resolveIdInput(payload?._id);
  if (!targetId) {
    throw new Error("Invalid staff id for update");
  }

  const cleanPayload = { ...normalizeStaff(payload) };
  delete cleanPayload.id;
  delete cleanPayload._id;

  if (offlineAccess.isUnlocked() && navigator.onLine && !isLocalId(targetId)) {
    try {
      const res = await apiClient.put(`${STAFF_URL}/${targetId}`, cleanPayload);
      const serverStaff = res?.data?.staff || res?.data;
      const realId = normalizeId(serverStaff) || targetId;
      await patchOverlay((overlay) => {
        overlay[realId] = { ...serverStaff, _id: realId };
        return overlay;
      });
      return res.data;
    } catch {
      // Fall back to offline queue path below.
    }
  }

  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.put(`${STAFF_URL}/${targetId}`, cleanPayload);
    return res.data;
  }

  const existing = await findStaffByIdLocal(targetId);
  const next = {
    ...(existing || {}),
    ...cleanPayload,
    _id: targetId,
    __syncStatus: "pending",
    updatedAt: new Date().toISOString(),
  };

  await patchOverlay((overlay) => {
    overlay[targetId] = next;
    return overlay;
  });

  await queueSyncAction({
    entity: "staffs",
    method: "PUT",
    url: `${STAFF_URL}/${targetId}`,
    payload: cleanPayload,
    meta: { id: targetId },
  });

  if (navigator.onLine) await processStaffQueue();
  else processStaffQueue().catch(() => null);
  return next;
};

export const toggleStaffStatusLocalFirst = async (id) => {
  const targetId = resolveIdInput(id);
  if (!targetId) {
    throw new Error("Invalid staff id for status toggle");
  }

  if (offlineAccess.isUnlocked() && navigator.onLine && !isLocalId(targetId)) {
    try {
      const res = await apiClient.patch(`${STAFF_URL}/${targetId}/toggle-status`);
      const nextActive =
        typeof res?.data?.isActive === "boolean"
          ? Boolean(res.data.isActive)
          : !Boolean((await findStaffByIdLocal(targetId))?.isActive);
      await patchOverlay((overlay) => {
        const prev = overlay[targetId] || {};
        overlay[targetId] = {
          ...prev,
          _id: targetId,
          isActive: nextActive,
          updatedAt: new Date().toISOString(),
        };
        return overlay;
      });
      return res.data;
    } catch {
      // Fall back to offline queue path below.
    }
  }

  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.patch(`${STAFF_URL}/${targetId}/toggle-status`);
    return res.data;
  }

  const existing = await findStaffByIdLocal(targetId);
  const nextActive = !existing?.isActive;

  await patchOverlay((overlay) => {
    const prev = overlay[targetId] || existing || {};
    overlay[targetId] = {
      ...prev,
      _id: targetId,
      isActive: nextActive,
      __syncStatus: "pending",
      updatedAt: new Date().toISOString(),
    };
    return overlay;
  });

  const method = isLocalId(targetId) ? "PUT" : "PATCH";
  const url = isLocalId(targetId) ? `${STAFF_URL}/${targetId}` : `${STAFF_URL}/${targetId}/toggle-status`;
  const payload = isLocalId(targetId) ? { isActive: nextActive } : null;

  await queueSyncAction({
    entity: "staffs",
    method,
    url,
    payload,
    meta: { id: targetId },
  });

  if (navigator.onLine) await processStaffQueue();
  else processStaffQueue().catch(() => null);
  return { id: targetId, isActive: nextActive };
};

export const refreshStaffsFromCloud = async () => {
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;
  await refreshAllSnapshotFromCloud();
};
