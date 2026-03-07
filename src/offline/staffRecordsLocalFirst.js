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

const STAFF_RECORDS_URL = "/staff-records";
const ALL_KEY = "staffRecords:all";
const STATS_KEY = "staffRecords:stats";
const MONTHS_KEY = "staffRecords:months";
const OVERLAY_KEY = "staffRecords:overlay";

let syncInFlight = false;
let onlineHandlerAttached = false;
let syncLoopAttached = false;

const DEFAULT_CONFIG = {
  stitch_rate: 0.001,
  applique_rate: 1.111,
  on_target_pct: 30,
  after_target_pct: 34,
  target_amount: 900,
  pcs_per_round: 12,
  bonus_rate: 200,
  allowance: 1500,
  off_amount: 300,
  stitch_cap: 5000,
};

const NO_PRODUCTION = new Set(["Absent", "Off", "Close", "Sunday"]);
const NO_AMOUNT = new Set(["Absent", "Close"]);
const NO_BONUS = new Set(["Absent", "Off", "Close", "Sunday"]);

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
    const aTime = toMillis(a?.createdAt) || objectIdToMillis(normalizeId(a));
    const bTime = toMillis(b?.createdAt) || objectIdToMillis(normalizeId(b));
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

const getAllBaseRecords = async () => {
  const all = await getEntitySnapshot(ALL_KEY);
  return uniqueById(Array.isArray(all) ? all : []);
};

const getStaffSnapshot = async () => {
  const staff = await getEntitySnapshot("staffs:all");
  return Array.isArray(staff) ? staff : [];
};

const normalizeAttendance = (attendance) => String(attendance || "").trim();

const calcRow = (row, cfg) => {
  const stitchRaw = Number(row?.d_stitch || 0);
  const pcs = Number(row?.pcs || 0);
  const rounds = Number(row?.rounds || 0);
  const applique = Number(row?.applique || 0);
  const stitchCap = cfg?.stitch_cap ?? DEFAULT_CONFIG.stitch_cap;
  const stitch = stitchRaw > 0 && stitchRaw <= stitchCap ? stitchCap : stitchRaw;

  const stitch_rate = cfg?.stitch_rate ?? DEFAULT_CONFIG.stitch_rate;
  const applique_rate = cfg?.applique_rate ?? DEFAULT_CONFIG.applique_rate;
  const on_target_pct = cfg?.on_target_pct ?? DEFAULT_CONFIG.on_target_pct;
  const after_target_pct = cfg?.after_target_pct ?? DEFAULT_CONFIG.after_target_pct;

  const total_stitch = stitchRaw * rounds;
  const stitch_base = (stitch * stitch_rate * pcs) / 100;
  const applique_base = (applique_rate * applique * pcs) / 100;
  const combined = stitch_base + applique_base;
  const on_target_amt = combined * on_target_pct;
  const after_target_amt = combined * after_target_pct;

  return { total_stitch, on_target_amt, after_target_amt };
};

const calcTotals = (rows, cfg) =>
  rows.reduce(
    (acc, row) => {
      const { total_stitch, on_target_amt, after_target_amt } = calcRow(row, cfg);
      return {
        pcs: acc.pcs + (Number(row?.pcs || 0)),
        rounds: acc.rounds + (Number(row?.rounds || 0)),
        total_stitch: acc.total_stitch + total_stitch,
        on_target_amt: acc.on_target_amt + on_target_amt,
        after_target_amt: acc.after_target_amt + after_target_amt,
      };
    },
    { pcs: 0, rounds: 0, total_stitch: 0, on_target_amt: 0, after_target_amt: 0 }
  );

const resolveBaseAmount = ({
  attendance,
  totals,
  salary,
  config,
  forceAfterTargetForNonTarget = false,
  forceFullTargetForNonTarget = false,
}) => {
  const hasSalary = salary != null && salary > 0;
  const perDay = hasSalary ? salary / 30 : 0;
  const perHalfDay = hasSalary ? salary / 60 : 0;
  const targetAmount = config?.target_amount ?? DEFAULT_CONFIG.target_amount;
  const offAmount = config?.off_amount ?? DEFAULT_CONFIG.off_amount;
  const onTargetPct = config?.on_target_pct ?? DEFAULT_CONFIG.on_target_pct;
  const afterTargetPct = config?.after_target_pct ?? DEFAULT_CONFIG.after_target_pct;
  const fullTargetAfterAmount =
    onTargetPct > 0 ? (targetAmount / onTargetPct) * afterTargetPct : targetAmount;

  let base_amount = 0;
  let resolvedAttendance = attendance;

  if (NO_AMOUNT.has(attendance)) {
    base_amount = 0;
  } else if (attendance === "Sunday") {
    base_amount = hasSalary ? perDay : 0;
  } else if (attendance === "Off") {
    base_amount = hasSalary ? perDay : offAmount;
  } else if (attendance === "Half") {
    if (hasSalary) {
      base_amount = perHalfDay;
    } else {
      const productionAmt = totals
        ? (
            forceFullTargetForNonTarget
              ? fullTargetAfterAmount
              : (totals.on_target_amt >= targetAmount || forceAfterTargetForNonTarget)
          ? totals.after_target_amt
          : totals.on_target_amt
          )
        : 0;
      if (totals && totals.on_target_amt >= targetAmount) {
        resolvedAttendance = "Day";
      }
      base_amount = productionAmt;
    }
  } else {
    if (hasSalary) {
      base_amount = perDay;
    } else {
      base_amount = totals
        ? (
            forceFullTargetForNonTarget
              ? fullTargetAfterAmount
              : (totals.on_target_amt >= targetAmount || forceAfterTargetForNonTarget)
          ? totals.after_target_amt
          : totals.on_target_amt
          )
        : 0;
    }
  }

  return { base_amount, resolvedAttendance };
};

const buildLocalRecordPayload = async (payload) => {
  const attendance = normalizeAttendance(payload?.attendance);
  const staffId = String(payload?.staff_id || payload?.staff_id?._id || "");
  const staffSnapshot = await getStaffSnapshot();
  const staffRow = staffSnapshot.find((row) => String(row?._id || "") === staffId);
  if (staffRow && String(staffRow?.category || "Embroidery") === "Cropping") {
    throw new Error("Cropping staff can only be recorded in CRP Records");
  }
  const salary = Number(staffRow?.salary || 0);

  const configRes = await fetchProductionConfigLocalFirst(payload?.date);
  const config = configRes?.data ? { ...DEFAULT_CONFIG, ...configRes.data } : DEFAULT_CONFIG;

  const hasProduction = attendance && !NO_PRODUCTION.has(attendance);
  const cleanRows = hasProduction ? payload?.production || [] : [];

  const recalculatedRows = cleanRows.map((row) => {
    const { total_stitch, on_target_amt, after_target_amt } = calcRow(row, config);
    return {
      d_stitch: Number(row?.d_stitch || 0),
      applique: Number(row?.applique || 0),
      pcs: Number(row?.pcs || 0),
      rounds: Number(row?.rounds || 0),
      total_stitch,
      on_target_amt,
      after_target_amt,
    };
  });

  const totals = hasProduction && recalculatedRows.length > 0 ? calcTotals(recalculatedRows, config) : null;
  const canUseTargetOverrides = !(salary != null && salary > 0);
  const useFullTargetForNonTarget =
    Boolean(payload?.force_full_target_for_non_target) &&
    canUseTargetOverrides &&
    !(totals && totals.on_target_amt >= (config.target_amount ?? 0));
  const useAfterTargetForNonTarget =
    Boolean(payload?.force_after_target_for_non_target) &&
    canUseTargetOverrides &&
    !useFullTargetForNonTarget;

  const { base_amount, resolvedAttendance } = resolveBaseAmount({
    attendance,
    totals,
    salary,
    config,
    forceAfterTargetForNonTarget: useAfterTargetForNonTarget,
    forceFullTargetForNonTarget: useFullTargetForNonTarget,
  });

  const canHaveBonus = !NO_BONUS.has(resolvedAttendance);
  const effectiveBonusRate =
    payload?.bonus_rate != null ? Number(payload.bonus_rate) : Number(config?.bonus_rate ?? DEFAULT_CONFIG.bonus_rate);
  const effectiveBonusQty = canHaveBonus ? Number(payload?.bonus_qty || 0) : 0;
  const bonus_amount = effectiveBonusQty * effectiveBonusRate;

  const fixAmount = payload?.fix_amount != null ? Number(payload.fix_amount) : null;
  const final_amount = fixAmount != null ? fixAmount : base_amount + bonus_amount;

  return {
    attendance: resolvedAttendance,
    production: recalculatedRows,
    totals,
    base_amount,
    bonus_qty: effectiveBonusQty,
    bonus_rate: effectiveBonusRate,
    bonus_amount,
    fix_amount: fixAmount,
    force_after_target_for_non_target:
      useAfterTargetForNonTarget,
    force_full_target_for_non_target:
      useFullTargetForNonTarget,
    final_amount,
    config_snapshot: {
      stitch_rate: config.stitch_rate,
      applique_rate: config.applique_rate,
      on_target_pct: config.on_target_pct,
      after_target_pct: config.after_target_pct,
      pcs_per_round: config.pcs_per_round,
      target_amount: config.target_amount,
      off_amount: config.off_amount,
      bonus_rate: config.bonus_rate,
      allowance: config.allowance,
    },
    staff_id: staffRow ? { ...staffRow, _id: staffRow._id } : payload?.staff_id,
  };
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

const getEffectivePercent = (row) => {
  if (!row || row?.fix_amount != null) return null;
  const totals = row?.totals;
  if (!totals) return null;
  const onTargetAmount = Number(totals?.on_target_amt || 0);
  if (onTargetAmount <= 0) return null;
  const targetAmount = Number(row?.config_snapshot?.target_amount);
  const targetMet = Number.isFinite(targetAmount)
    ? onTargetAmount >= targetAmount
    : false;
  const forceAfter =
    Boolean(row?.force_after_target_for_non_target) ||
    Boolean(row?.force_full_target_for_non_target);
  const pct = (targetMet || forceAfter)
    ? Number(row?.config_snapshot?.after_target_pct)
    : Number(row?.config_snapshot?.on_target_pct);
  return Number.isFinite(pct) ? pct : null;
};

const applyFilters = (rows = [], params = {}) => {
  let data = [...rows].filter(
    (row) => String(row?.staff_id?.category || "Embroidery") !== "Cropping"
  );
  const attendance = String(params?.attendance || "").trim();
  const percent = String(params?.percent || "").trim();
  const staffId = String(params?.staff_id || "").trim();
  const name = String(params?.name || "").trim().toLowerCase();
  const dateFrom = params?.date_from;
  const dateTo = params?.date_to;

  if (staffId) data = data.filter((row) => String(row?.staff_id?._id || row?.staff_id || "") === staffId);
  if (attendance) data = data.filter((row) => String(row?.attendance || "") === attendance);
  if (percent) {
    const percentNum = Number(percent);
    if (Number.isFinite(percentNum)) {
      data = data.filter((row) => getEffectivePercent(row) === percentNum);
    }
  }
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

const findRecordByIdLocal = async (id) => {
  const target = String(id || "");
  if (!target) return null;
  const overlay = await getOverlay();
  if (overlay[target] && !overlay[target]?._deleted) return overlay[target];
  const all = await getAllBaseRecords();
  return all.find((row) => normalizeId(row) === target) || null;
};

const attachStaffInfo = async (records = []) => {
  const staff = await getStaffSnapshot();
  const staffMap = new Map(staff.map((row) => [String(row?._id || ""), row]));
  return records.map((record) => {
    const staffId = String(record?.staff_id?._id || record?.staff_id || "");
    if (!staffId) return record;
    const staffRow = staffMap.get(staffId);
    if (!staffRow) return record;
    return { ...record, staff_id: { ...staffRow, _id: staffId } };
  });
};

const refreshAllSnapshotFromCloud = async () => {
  if (!navigator.onLine) return;
  const [listRes, statsRes, monthsRes] = await Promise.all([
    apiClient.get(`${STAFF_RECORDS_URL}?page=1&limit=5000`),
    apiClient.get(`${STAFF_RECORDS_URL}/stats`),
    apiClient.get(`${STAFF_RECORDS_URL}/months`),
  ]);
  const rows = uniqueById(Array.isArray(listRes?.data?.data) ? listRes.data.data : []);
  await upsertEntitySnapshot(ALL_KEY, rows);
  await upsertEntitySnapshot(STATS_KEY, statsRes?.data || null);
  await upsertEntitySnapshot(MONTHS_KEY, monthsRes?.data || null);
  logDataSource("IDB", "staffRecords.snapshot.refreshed", { count: rows.length });
};

const syncCreateSuccess = async (action, serverRecord) => {
  const localId = String(action?.meta?.localId || "");
  const realId = normalizeId(serverRecord);

  await patchOverlay((overlay) => {
    if (localId) delete overlay[localId];
    if (realId) overlay[realId] = { ...serverRecord, _id: realId };
    return overlay;
  });
};

const syncUpdateSuccess = async (action, serverRecord) => {
  const id = String(action?.meta?.id || normalizeId(serverRecord));
  if (!id) return;
  await patchOverlay((overlay) => {
    overlay[id] = { ...serverRecord, _id: id };
    return overlay;
  });
};

const syncDeleteSuccess = async (action) => {
  const id = String(action?.meta?.id || "");
  if (!id) return;
  await patchOverlay((overlay) => {
    if (overlay[id]) overlay[id]._deleted = true;
    return overlay;
  });
};

const processStaffRecordQueue = async () => {
  if (syncInFlight) return;
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;

  syncInFlight = true;
  try {
    const actions = await getPendingSyncActions("staffRecords");
    for (const action of actions) {
      try {
        logDataSource("IDB", "sync.staffRecords.start", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
        if (action.method === "POST") {
          const res = await apiClient.post(action.url, action.payload);
          const serverRecord = res?.data?.data || res?.data;
          await syncCreateSuccess(action, serverRecord);
        } else if (action.method === "PUT") {
          const res = await apiClient.put(action.url, action.payload);
          const serverRecord = res?.data?.data || res?.data;
          await syncUpdateSuccess(action, serverRecord);
        } else if (action.method === "DELETE") {
          await apiClient.delete(action.url);
          await syncDeleteSuccess(action);
        }
        await completeSyncAction(action.id);
        logDataSource("IDB", "sync.staffRecords.success", {
          id: action.id,
          method: action.method,
          url: action.url,
        });
      } catch (error) {
        await failSyncAction(action.id, error?.response?.data?.message || error?.message || "sync failed", { statusCode: error?.response?.status });
        logDataSource("IDB", "sync.staffRecords.failed", {
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
    processStaffRecordQueue().catch(() => null);
  });
};

ensureOnlineSyncHook();

const ensureSyncLoop = () => {
  if (syncLoopAttached || typeof window === "undefined") return;
  syncLoopAttached = true;
  setInterval(() => {
    processStaffRecordQueue().catch(() => null);
  }, 15000);
  window.addEventListener("visibilitychange", () => {
    if (!document.hidden) processStaffRecordQueue().catch(() => null);
  });
};

ensureSyncLoop();

export const fetchStaffRecordsLocalFirst = async (params = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(STAFF_RECORDS_URL, { params });
    return res.data;
  }

  const overlay = await getOverlay();
  const base = await getAllBaseRecords();
  const merged = withOverlayList(base, overlay);
  const withStaff = await attachStaffInfo(merged);
  const filtered = applyFilters(withStaff, params);

  logDataSource("IDB", "staffRecords.fetch.local", {
    page: Number(params?.page || 1),
    limit: Number(params?.limit || 30),
    count: filtered.length,
  });

  return toPaginatedResponse(filtered, params);
};

export const fetchStaffRecordStatsLocalFirst = async (params = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${STAFF_RECORDS_URL}/stats`, { params });
    return res.data;
  }

  const overlay = await getOverlay();
  const base = await getAllBaseRecords();
  const merged = withOverlayList(base, overlay);
  const withStaff = await attachStaffInfo(merged);
  const staffId = String(params?.staff_id || "").trim();
  const attendance = String(params?.attendance || "").trim();
  const percent = String(params?.percent || "").trim();
  const dateFrom = params?.date_from;
  const dateTo = params?.date_to;

  const filtered = withStaff.filter((row) => {
    if (String(row?.staff_id?.category || "Embroidery") === "Cropping") return false;
    if (staffId && String(row?.staff_id?._id || row?.staff_id || "") !== staffId) return false;
    if (attendance && String(row?.attendance || "") !== attendance) return false;
    if (percent) {
      const percentNum = Number(percent);
      if (Number.isFinite(percentNum) && getEffectivePercent(row) !== percentNum) return false;
    }
    if (dateFrom || dateTo) return inDateRange(row?.date, dateFrom, dateTo);
    return true;
  });

  const attendanceBreakdown = filtered.reduce((acc, row) => {
    const key = String(row?.attendance || "");
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const amounts = filtered.reduce(
    (acc, row) => {
      acc.total_base_amount += Number(row?.base_amount || 0);
      acc.total_bonus_amount += Number(row?.bonus_amount || 0);
      acc.total_final_amount += Number(row?.final_amount || 0);
      acc.record_count += 1;
      return acc;
    },
    {
      total_base_amount: 0,
      total_bonus_amount: 0,
      total_final_amount: 0,
      record_count: 0,
    }
  );

  const stats = {
    success: true,
    data: {
      attendance: attendanceBreakdown,
      amounts,
    },
  };

  await upsertEntitySnapshot(STATS_KEY, stats);
  logDataSource("IDB", "staffRecords.stats.local", stats.data);
  return stats;
};

export const fetchStaffRecordMonthsLocalFirst = async () => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${STAFF_RECORDS_URL}/months`);
    return res.data;
  }

  const overlay = await getOverlay();
  const base = await getAllBaseRecords();
  const merged = withOverlayList(base, overlay);
  const withStaff = await attachStaffInfo(merged);

  const months = Array.from(
    withStaff.reduce((acc, row) => {
      if (String(row?.staff_id?.category || "Embroidery") === "Cropping") return acc;
      const dt = row?.date ? new Date(row.date) : null;
      if (!dt || Number.isNaN(dt.getTime())) return acc;
      const month = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      acc.add(month);
      return acc;
    }, new Set())
  ).sort((a, b) => (a < b ? 1 : -1));

  const payload = { success: true, data: months };
  await upsertEntitySnapshot(MONTHS_KEY, payload);
  logDataSource("IDB", "staffRecords.months.local", { count: months.length });
  return payload;
};

export const fetchStaffLastRecordLocalFirst = async (staffId) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${STAFF_RECORDS_URL}/last/${staffId}`);
    return res.data;
  }

  const overlay = await getOverlay();
  const base = await getAllBaseRecords();
  const merged = withOverlayList(base, overlay);
  const filtered = merged
    .filter((row) => String(row?.staff_id?._id || row?.staff_id || "") === String(staffId))
    .sort((a, b) => toMillis(b?.date) - toMillis(a?.date));

  const last = filtered[0];
  const payload = {
    success: true,
    data: last ? { last_record_date: last.date, last_attendance: last.attendance } : null,
  };
  logDataSource("IDB", "staffRecords.last.local", { staffId: String(staffId || "") });
  return payload;
};

export const fetchStaffRecordLocalFirst = async (id) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get(`${STAFF_RECORDS_URL}/${id}`);
    return res.data;
  }

  const local = await findRecordByIdLocal(id);
  logDataSource("IDB", "staffRecords.get.local", { id: String(id || "") });
  if (local) return { success: true, data: local };
  throw new Error("Staff record not available locally");
};

export const createStaffRecordLocalFirst = async (payload) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.post(STAFF_RECORDS_URL, payload);
    return res.data;
  }

  const localId = `local-staff-record-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const computed = await buildLocalRecordPayload(payload);
  const localRecord = {
    _id: localId,
    ...payload,
    ...computed,
    __syncStatus: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await patchOverlay((overlay) => {
    overlay[localId] = localRecord;
    return overlay;
  });

  await queueSyncAction({
    entity: "staffRecords",
    method: "POST",
    url: STAFF_RECORDS_URL,
    payload,
    meta: { localId },
  });

  processStaffRecordQueue().catch(() => null);
  return { success: true, data: localRecord };
};

export const updateStaffRecordLocalFirst = async (id, payload) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.put(`${STAFF_RECORDS_URL}/${id}`, payload);
    return res.data;
  }

  const existing = await findRecordByIdLocal(id);
  const computed = await buildLocalRecordPayload({ ...existing, ...payload });
  const next = {
    ...(existing || {}),
    ...payload,
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
    entity: "staffRecords",
    method: "PUT",
    url: `${STAFF_RECORDS_URL}/${id}`,
    payload,
    meta: { id: String(id) },
  });

  processStaffRecordQueue().catch(() => null);
  return { success: true, data: next };
};

export const deleteStaffRecordLocalFirst = async (id) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.delete(`${STAFF_RECORDS_URL}/${id}`);
    return res.data;
  }

  await patchOverlay((overlay) => {
    const prev = overlay[String(id)] || {};
    overlay[String(id)] = { ...prev, _deleted: true };
    return overlay;
  });

  await queueSyncAction({
    entity: "staffRecords",
    method: "DELETE",
    url: `${STAFF_RECORDS_URL}/${id}`,
    payload: null,
    meta: { id: String(id) },
  });

  processStaffRecordQueue().catch(() => null);
  return { success: true };
};

export const refreshStaffRecordsFromCloud = async () => {
  if (!offlineAccess.isUnlocked()) return;
  if (!navigator.onLine) return;
  await refreshAllSnapshotFromCloud();
};
