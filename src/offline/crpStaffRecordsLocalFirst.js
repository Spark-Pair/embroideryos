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

const CRP_STAFF_RECORDS_URL = "/crp-staff-records";
const ALL_KEY = "crpStaffRecords:all";
const STATS_KEY = "crpStaffRecords:stats";
const OVERLAY_KEY = "crpStaffRecords:overlay";

let syncInFlight = false;
let onlineHandlerAttached = false;
let syncLoopAttached = false;

const normalizeCategory = (category) => (String(category || "").trim() === "Packing" ? "Cropping" : category);

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
    const aTime = toMillis(a?.order_date || a?.createdAt) || objectIdToMillis(normalizeId(a));
    const bTime = toMillis(b?.order_date || b?.createdAt) || objectIdToMillis(normalizeId(b));
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

const getAllBase = async () => {
  const all = await getEntitySnapshot(ALL_KEY);
  return uniqueById(Array.isArray(all) ? all : []);
};

const getStaffSnapshot = async () => {
  const staff = await getEntitySnapshot("staffs:names");
  return Array.isArray(staff) ? staff : [];
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

const patchOverlay = async (patchFn) => {
  const existing = await getOverlay();
  const next = patchFn({ ...existing }) || {};
  await setOverlay(next);
};

const refreshAllSnapshotFromCloud = async () => {
  if (!navigator.onLine) return;
  const [listRes, statsRes] = await Promise.all([
    apiClient.get(`${CRP_STAFF_RECORDS_URL}?page=1&limit=5000`),
    apiClient.get(`${CRP_STAFF_RECORDS_URL}/stats`),
  ]);
  const rows = uniqueById(Array.isArray(listRes?.data?.data) ? listRes.data.data : []);
  await upsertEntitySnapshot(ALL_KEY, rows);
  await upsertEntitySnapshot(STATS_KEY, statsRes?.data || null);
};

const syncCreateSuccess = async (action, serverRow) => {
  const localId = String(action?.meta?.localId || "");
  const realId = normalizeId(serverRow);

  await patchOverlay((overlay) => {
    if (localId) delete overlay[localId];
    if (realId) overlay[realId] = { ...serverRow, _id: realId };
    return overlay;
  });
};

const syncUpdateSuccess = async (action, serverRow) => {
  const id = normalizeId(serverRow) || String(action?.meta?.id || "");
  if (!id) return;
  await patchOverlay((overlay) => {
    overlay[id] = { ...serverRow, _id: id };
    return overlay;
  });
};

const processQueue = async () => {
  if (syncInFlight) return;
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;

  syncInFlight = true;
  try {
    const actions = await getPendingSyncActions("crpStaffRecords");
    for (const action of actions) {
      try {
        if (action.method === "POST") {
          const res = await apiClient.post(action.url, action.payload);
          await syncCreateSuccess(action, res?.data?.data || res?.data);
        } else if (action.method === "PUT") {
          const res = await apiClient.put(action.url, action.payload);
          await syncUpdateSuccess(action, res?.data?.data || res?.data);
        } else if (action.method === "DELETE") {
          await apiClient.delete(action.url);
          await patchOverlay((overlay) => {
            delete overlay[String(action?.meta?.id || "")];
            return overlay;
          });
        }

        await completeSyncAction(action.id);
      } catch (error) {
        await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed", { statusCode: error?.response?.status });
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
    processQueue().catch(() => null);
  });
};

ensureOnlineSyncHook();

const ensureSyncLoop = () => {
  if (syncLoopAttached || typeof window === "undefined") return;
  syncLoopAttached = true;
  setInterval(() => {
    processQueue().catch(() => null);
  }, 15000);
  window.addEventListener("visibilitychange", () => {
    if (!document.hidden) processQueue().catch(() => null);
  });
};

ensureSyncLoop();

const applyFilters = (rows = [], params = {}) => {
  let data = [...rows];
  const month = String(params?.month || "").trim();
  const staffId = String(params?.staff_id || "").trim();
  const category = String(normalizeCategory(params?.category) || "").trim();
  const typeName = String(params?.type_name || "").trim().toLowerCase();
  const dateFrom = params?.date_from;
  const dateTo = params?.date_to;

  if (month) data = data.filter((row) => String(row?.month || "") === month);
  if (staffId) data = data.filter((row) => String(row?.staff_id?._id || row?.staff_id || "") === staffId);
  if (category) {
    data = data.filter((row) => String(normalizeCategory(row?.category) || "") === category);
  }
  if (typeName) data = data.filter((row) => String(row?.type_name || "").toLowerCase().includes(typeName));

  if (dateFrom || dateTo) {
    data = data.filter((row) => {
      const ts = toMillis(row?.order_date);
      if (!ts) return false;
      if (dateFrom && ts < toMillis(dateFrom)) return false;
      if (dateTo && ts > toMillis(dateTo)) return false;
      return true;
    });
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

export const fetchCrpStaffRecordsLocalFirst = async (params = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(CRP_STAFF_RECORDS_URL, { params });
    return res.data;
  }

  let overlay = await getOverlay();
  let base = await getAllBase();
  let merged = withOverlayList(base, overlay);
  if (!merged.length && typeof navigator !== "undefined" && navigator.onLine) {
    try {
      await refreshAllSnapshotFromCloud();
      overlay = await getOverlay();
      base = await getAllBase();
      merged = withOverlayList(base, overlay);
    } catch {}
  }
  const filtered = applyFilters(merged, params);
  return toPaginatedResponse(filtered, params);
};

export const fetchCrpStaffRecordStatsLocalFirst = async () => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${CRP_STAFF_RECORDS_URL}/stats`);
    return res.data;
  }

  const overlay = await getOverlay();
  const base = await getAllBase();
  const merged = withOverlayList(base, overlay);

  const data = {
    total_records: merged.length,
    total_quantity_dzn: merged.reduce((sum, row) => sum + Number(row?.quantity_dzn || 0), 0),
    total_amount: merged.reduce((sum, row) => sum + Number(row?.total_amount || 0), 0),
  };

  const payload = { success: true, data };
  if (merged.length > 0 && typeof navigator !== "undefined" && navigator.onLine) {
    apiClient.get(`${CRP_STAFF_RECORDS_URL}/stats`).then((res) => upsertEntitySnapshot(STATS_KEY, res.data || null)).catch(() => null);
  }
  if (!merged.length && typeof navigator !== "undefined" && navigator.onLine) {
    try {
      await refreshAllSnapshotFromCloud();
      return fetchCrpStaffRecordStatsLocalFirst();
    } catch {
      // fall back to empty local payload
    }
  }
  await upsertEntitySnapshot(STATS_KEY, payload);
  return payload;
};

export const createCrpStaffRecordLocalFirst = async (payload) => {
  const normalizedPayload = {
    ...(payload || {}),
    category: normalizeCategory(payload?.category),
  };
  if (!normalizedPayload.month) {
    normalizedPayload.month = String(normalizedPayload.order_date || new Date().toISOString()).slice(0, 7);
  }
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.post(CRP_STAFF_RECORDS_URL, normalizedPayload);
    return res.data;
  }

  const localId = `local-crp-record-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const orders = (await getEntitySnapshot("orders:all")) || [];
  const staffs = (await getEntitySnapshot("staffs:names")) || [];
  const rateConfigs = (await getEntitySnapshot("crpRateConfigs:all")) || [];

  const order = orders.find((row) => String(row?._id || "") === String(normalizedPayload?.order_id || ""));
  const staff = staffs.find((row) => String(row?._id || "") === String(normalizedPayload?.staff_id || ""));
  const rateCfg = rateConfigs.find(
    (row) => normalizeCategory(row?.category) === normalizedPayload?.category && row?.type_name === normalizedPayload?.type_name
  );

  const quantity_dzn = Number(normalizedPayload?.quantity_dzn || (order?.unit === "Pcs" ? Number(order?.quantity || 0) / 12 : Number(order?.quantity || 0)) || 0);
  const rate = Number(normalizedPayload?.rate || rateCfg?.rate || 0);

  const localRow = {
    _id: localId,
    order_id: normalizedPayload?.order_id || null,
    order_date: normalizedPayload?.order_date || order?.date || new Date().toISOString(),
    order_description: normalizedPayload?.order_description || order?.description || "",
    quantity_dzn,
    staff_id: normalizedPayload?.staff_id || null,
    staff_name: staff?.name || "",
    category: normalizedPayload?.category || "",
    type_name: normalizedPayload?.type_name || "",
    rate,
    total_amount: quantity_dzn * rate,
    month: normalizedPayload?.month || String(normalizedPayload?.order_date || order?.date || new Date().toISOString()).slice(0, 7),
    __syncStatus: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await patchOverlay((overlay) => {
    overlay[localId] = localRow;
    return overlay;
  });

  await queueSyncAction({
    entity: "crpStaffRecords",
    method: "POST",
    url: CRP_STAFF_RECORDS_URL,
    payload: normalizedPayload,
    meta: { localId },
  });

  processQueue().catch(() => null);
  return { success: true, data: localRow };
};

export const updateCrpStaffRecordLocalFirst = async (id, payload) => {
  const normalizedPayload = {
    ...(payload || {}),
    category: normalizeCategory(payload?.category),
  };
  if (!normalizedPayload.month) {
    normalizedPayload.month = String(normalizedPayload.order_date || new Date().toISOString()).slice(0, 7);
  }

  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.put(`${CRP_STAFF_RECORDS_URL}/${id}`, normalizedPayload);
    return res.data;
  }

  const staff = await getStaffSnapshot();
  const staffRow = staff.find((row) => String(row?._id || "") === String(normalizedPayload?.staff_id || ""));
  const quantity_dzn = Number(normalizedPayload?.quantity_dzn || 0);
  const rate = Number(normalizedPayload?.rate || 0);
  const localRow = {
    ...(normalizedPayload || {}),
    _id: String(id),
    staff_id: normalizedPayload?.staff_id || null,
    staff_name: staffRow?.name || "",
    quantity_dzn,
    rate,
    total_amount: quantity_dzn * rate,
    month: normalizedPayload.month,
    __syncStatus: "pending",
    updatedAt: new Date().toISOString(),
  };

  await patchOverlay((overlay) => {
    overlay[String(id)] = { ...(overlay[String(id)] || {}), ...localRow };
    return overlay;
  });

  await queueSyncAction({
    entity: "crpStaffRecords",
    method: "PUT",
    url: `${CRP_STAFF_RECORDS_URL}/${id}`,
    payload: normalizedPayload,
    meta: { id: String(id) },
  });

  processQueue().catch(() => null);
  return { success: true, data: localRow };
};

export const deleteCrpStaffRecordLocalFirst = async (id) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.delete(`${CRP_STAFF_RECORDS_URL}/${id}`);
    return res.data;
  }

  await patchOverlay((overlay) => {
    const prev = overlay[String(id)] || {};
    overlay[String(id)] = {
      ...prev,
      _id: String(id),
      _deleted: true,
      __syncStatus: "pending",
      updatedAt: new Date().toISOString(),
    };
    return overlay;
  });

  await queueSyncAction({
    entity: "crpStaffRecords",
    method: "DELETE",
    url: `${CRP_STAFF_RECORDS_URL}/${id}`,
    payload: null,
    meta: { id: String(id) },
  });

  processQueue().catch(() => null);
  return { success: true, id };
};
