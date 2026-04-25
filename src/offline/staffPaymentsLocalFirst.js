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

const STAFF_PAYMENTS_URL = "/staff-payments";
const ALL_KEY = "staffPayments:all";
const STATS_KEY = "staffPayments:stats";
const MONTHS_KEY = "staffPayments:months";
const OVERLAY_KEY = "staffPayments:overlay";

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
    const aTime = toMillis(a?.date) || toMillis(a?.createdAt) || objectIdToMillis(normalizeId(a));
    const bTime = toMillis(b?.date) || toMillis(b?.createdAt) || objectIdToMillis(normalizeId(b));
    return bTime - aTime;
  });

const extractStaffPaymentIdFromUrl = (url = "") => {
  const match = String(url || "").match(/\/staff-payments\/([^/?#]+)/i);
  return match?.[1] ? String(match[1]) : "";
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

const getAllBasePayments = async () => {
  const all = await getEntitySnapshot(ALL_KEY);
  return uniqueById(Array.isArray(all) ? all : []);
};

const getStaffSnapshot = async () => {
  const staff = await getEntitySnapshot("staffs:all");
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

const inDateRange = (value, from, to) => {
  const ts = toMillis(value);
  if (!ts) return false;
  if (from && ts < toMillis(from)) return false;
  if (to && ts > toMillis(to)) return false;
  return true;
};

const applyFilters = (rows = [], params = {}) => {
  let data = [...rows];
  const staffId = String(params?.staff_id || "").trim();
  const type = String(params?.type || "").trim();
  const month = String(params?.month || "").trim();
  const name = String(params?.name || "").trim().toLowerCase();
  const dateFrom = params?.date_from;
  const dateTo = params?.date_to;

  if (staffId) data = data.filter((row) => String(row?.staff_id?._id || row?.staff_id || "") === staffId);
  if (type) data = data.filter((row) => String(row?.type || "") === type);
  if (month) data = data.filter((row) => String(row?.month || "") === month);
  if (dateFrom || dateTo) data = data.filter((row) => inDateRange(row?.date, dateFrom, dateTo));
  if (name) {
    data = data.filter((row) =>
      String(row?.staff_id?.name || "")
        .toLowerCase()
        .includes(name)
    );
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

const patchOverlay = async (patchFn) => {
  const existing = await getOverlay();
  const next = patchFn({ ...existing }) || {};
  await setOverlay(next);
};

const attachStaffInfo = async (payments = []) => {
  const staff = await getStaffSnapshot();
  const staffMap = new Map(staff.map((row) => [String(row?._id || ""), row]));
  return payments.map((payment) => {
    const staffId = String(payment?.staff_id?._id || payment?.staff_id || "");
    if (!staffId) return payment;
    const staffRow = staffMap.get(staffId);
    if (!staffRow) return payment;
    return { ...payment, staff_id: { ...staffRow, _id: staffId } };
  });
};

const refreshAllSnapshotFromCloud = async () => {
  if (!navigator.onLine) return;
  const [listRes, statsRes, monthsRes] = await Promise.all([
    apiClient.get(`${STAFF_PAYMENTS_URL}?page=1&limit=5000`),
    apiClient.get(`${STAFF_PAYMENTS_URL}/stats`),
    apiClient.get(`${STAFF_PAYMENTS_URL}/months`),
  ]);
  const rows = uniqueById(Array.isArray(listRes?.data?.data) ? listRes.data.data : []);
  await upsertEntitySnapshot(ALL_KEY, rows);
  await upsertEntitySnapshot(STATS_KEY, statsRes?.data || null);
  await upsertEntitySnapshot(MONTHS_KEY, monthsRes?.data || null);
  logDataSource("IDB", "staffPayments.snapshot.refreshed", { count: rows.length });
};

const syncCreateSuccess = async (action, serverPayment) => {
  const localId = String(action?.meta?.localId || "");
  const localIds = Array.isArray(action?.meta?.localIds) ? action.meta.localIds : [];
  const realId = normalizeId(serverPayment);

  await patchOverlay((overlay) => {
    if (localId) delete overlay[localId];
    localIds.forEach((id) => {
      if (overlay[id]) delete overlay[id];
    });
    if (realId) overlay[realId] = { ...serverPayment, _id: realId };
    return overlay;
  });
  const idsToRemap = [localId, ...localIds].filter(Boolean);
  if (realId) {
    for (const srcId of idsToRemap) {
      if (!srcId || srcId === realId) continue;
      await remapPendingSyncEntityId("staffPayments", srcId, realId);
    }
  }
};

const syncUpdateSuccess = async (action, serverPayment) => {
  const id = normalizeId(serverPayment) || String(action?.meta?.id || "");
  if (!id) return;
  await patchOverlay((overlay) => {
    overlay[id] = { ...serverPayment, _id: id };
    return overlay;
  });
};

const processStaffPaymentQueue = async () => {
  if (syncInFlight) return;
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;

  syncInFlight = true;
  try {
    const actions = await getPendingSyncActions("staffPayments");
    for (const action of actions) {
      try {
        logDataSource("IDB", "sync.staffPayments.start", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
        if (action.method === "POST") {
          const res = await apiClient.post(action.url, action.payload);
          const serverPayment = res?.data?.data || res?.data;
          await syncCreateSuccess(action, serverPayment);
        } else if (action.method === "PUT") {
          const queuedId = extractStaffPaymentIdFromUrl(action.url);
          if (queuedId.startsWith("local-staff-payment-")) {
            const res = await apiClient.post(STAFF_PAYMENTS_URL, action.payload);
            const serverPayment = res?.data?.data || res?.data;
            await syncCreateSuccess(
              {
                ...action,
                meta: {
                  ...(action?.meta || {}),
                  localId: queuedId,
                  localIds: [queuedId],
                },
              },
              serverPayment
            );
          } else {
            const res = await apiClient.put(action.url, action.payload);
            const serverPayment = res?.data?.data || res?.data;
            await syncUpdateSuccess(action, serverPayment);
          }
        }

        await completeSyncAction(action.id);
        logDataSource("IDB", "sync.staffPayments.success", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
      } catch (error) {
        await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed", { statusCode: error?.response?.status });
        logDataSource("IDB", "sync.staffPayments.failed", {
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
    processStaffPaymentQueue().catch(() => null);
  });
};

ensureOnlineSyncHook();

const ensureSyncLoop = () => {
  if (syncLoopAttached || typeof window === "undefined") return;
  syncLoopAttached = true;
  setInterval(() => {
    processStaffPaymentQueue().catch(() => null);
  }, 15000);
  window.addEventListener("visibilitychange", () => {
    if (!document.hidden) processStaffPaymentQueue().catch(() => null);
  });
};

ensureSyncLoop();

export const fetchStaffPaymentsLocalFirst = async (params = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(STAFF_PAYMENTS_URL, { params });
    return res.data;
  }

  let overlay = await getOverlay();
  let base = await getAllBasePayments();
  let merged = withOverlayList(base, overlay);
  if (!merged.length && typeof navigator !== "undefined" && navigator.onLine) {
    try {
      await refreshAllSnapshotFromCloud();
      overlay = await getOverlay();
      base = await getAllBasePayments();
      merged = withOverlayList(base, overlay);
    } catch {}
  }
  const withStaff = await attachStaffInfo(merged);
  const filtered = applyFilters(withStaff, params);

  logDataSource("IDB", "staffPayments.fetch.local", {
    page: Number(params?.page || 1),
    limit: Number(params?.limit || 30),
    count: filtered.length,
  });

  return toPaginatedResponse(filtered, params);
};

export const fetchStaffPaymentStatsLocalFirst = async () => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${STAFF_PAYMENTS_URL}/stats`);
    return res.data;
  }

  const overlay = await getOverlay();
  const base = await getAllBasePayments();
  const merged = withOverlayList(base, overlay);

  const countsByKey = {};
  const amountsByKey = {};
  const stats = merged.reduce(
    (acc, row) => {
      acc.total += 1;
      const amount = Number(row?.amount || 0);
      acc.total_amount += amount;
      const key = String(row?.type || "").trim();
      if (key) {
        countsByKey[key] = Number(countsByKey[key] || 0) + 1;
        amountsByKey[key] = Number(amountsByKey[key] || 0) + amount;
      }
      return acc;
    },
    {
      total: 0,
      total_amount: 0,
    }
  );

  stats.breakdown = Object.keys(countsByKey)
    .sort((a, b) => countsByKey[b] - countsByKey[a] || a.localeCompare(b))
    .map((key) => ({
      key,
      count: Number(countsByKey[key] || 0),
      amount: Number(amountsByKey[key] || 0),
    }));
  stats.counts_by_key = countsByKey;
  stats.amounts_by_key = amountsByKey;

  const payload = { success: true, data: stats };
  await upsertEntitySnapshot(STATS_KEY, payload);
  logDataSource("IDB", "staffPayments.stats.local", payload.data);
  return payload;
};

export const fetchStaffPaymentMonthsLocalFirst = async () => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${STAFF_PAYMENTS_URL}/months`);
    return res.data;
  }

  const overlay = await getOverlay();
  const base = await getAllBasePayments();
  const merged = withOverlayList(base, overlay);

  const months = Array.from(
    merged.reduce((acc, row) => {
      const month = String(row?.month || "").trim();
      if (month) acc.add(month);
      return acc;
    }, new Set())
  ).sort((a, b) => (a < b ? 1 : -1));

  const payload = { success: true, data: months };
  await upsertEntitySnapshot(MONTHS_KEY, payload);
  logDataSource("IDB", "staffPayments.months.local", { count: months.length });
  return payload;
};

export const createStaffPaymentLocalFirst = async (payload) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.post(STAFF_PAYMENTS_URL, payload);
    return res.data;
  }

  const localId = `local-staff-payment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const staff = await getStaffSnapshot();
  const staffRow = staff.find((row) => String(row?._id || "") === String(payload?.staff_id || ""));
  const localPayment = {
    _id: localId,
    ...payload,
    staff_id: staffRow ? { ...staffRow, _id: staffRow._id } : payload?.staff_id,
    __syncStatus: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await patchOverlay((overlay) => {
    overlay[localId] = localPayment;
    return overlay;
  });

  await queueSyncAction({
    entity: "staffPayments",
    method: "POST",
    url: STAFF_PAYMENTS_URL,
    payload,
    meta: { localId },
  });

  processStaffPaymentQueue().catch(() => null);
  return { success: true, data: localPayment };
};

export const updateStaffPaymentLocalFirst = async (id, payload) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.put(`${STAFF_PAYMENTS_URL}/${id}`, payload);
    return res.data;
  }

  const staff = await getStaffSnapshot();
  const staffRow = staff.find((row) => String(row?._id || "") === String(payload?.staff_id || ""));
  const localPayment = {
    ...(payload || {}),
    _id: String(id),
    staff_id: staffRow ? { ...staffRow, _id: staffRow._id } : payload?.staff_id,
    __syncStatus: "pending",
    updatedAt: new Date().toISOString(),
  };

  await patchOverlay((overlay) => {
    overlay[String(id)] = { ...(overlay[String(id)] || {}), ...localPayment };
    return overlay;
  });

  await queueSyncAction({
    entity: "staffPayments",
    method: "PUT",
    url: `${STAFF_PAYMENTS_URL}/${id}`,
    payload,
    meta: { id: String(id) },
  });

  processStaffPaymentQueue().catch(() => null);
  return { success: true, data: localPayment };
};

export const refreshStaffPaymentsFromCloud = async () => {
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;
  await refreshAllSnapshotFromCloud();
};
