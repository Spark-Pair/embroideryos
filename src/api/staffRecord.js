import {
  createStaffRecordLocalFirst,
  deleteStaffRecordLocalFirst,
  applyRecalculatedStaffRecordsToLocalOverlay,
  fetchStaffLastRecordLocalFirst,
  fetchStaffRecordLocalFirst,
  fetchStaffRecordMonthsLocalFirst,
  fetchStaffRecordStatsLocalFirst,
  fetchStaffRecordsLocalFirst,
  getPendingStaffRecordSyncCount,
  refreshStaffRecordsSnapshotLocalFirst,
  updateStaffRecordLocalFirst,
} from "../offline/staffRecordsLocalFirst";
import { apiClient } from "./apiClient";

export const fetchStaffRecords = (params) => fetchStaffRecordsLocalFirst(params);

export const fetchStaffRecordStats = (params) => fetchStaffRecordStatsLocalFirst(params);

export const fetchStaffRecordMonths = () => fetchStaffRecordMonthsLocalFirst();

export const fetchStaffLastRecord = (staff_id) => fetchStaffLastRecordLocalFirst(staff_id);

export const fetchStaffRecord = (id) => fetchStaffRecordLocalFirst(id);

export const createStaffRecord = (data) => createStaffRecordLocalFirst(data);

export const updateStaffRecord = (id, data) => updateStaffRecordLocalFirst(id, data);

export const deleteStaffRecord = (id) => deleteStaffRecordLocalFirst(id);

export const previewStaffRecordRecalculation = async (data) => {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("Connect to the internet to preview recalculation.");
  }
  const pendingCount = await getPendingStaffRecordSyncCount();
  if (pendingCount > 0) {
    throw new Error("Sync pending staff records before previewing recalculation.");
  }
  const response = await apiClient.post("/staff-records/recalculation-preview", data);
  return response.data;
};

export const applyStaffRecordRecalculation = async (data) => {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("Connect to the internet to apply recalculation.");
  }
  const pendingCount = await getPendingStaffRecordSyncCount();
  if (pendingCount > 0) {
    throw new Error("Sync pending staff records before applying recalculation.");
  }
  const response = await apiClient.post("/staff-records/recalculation-apply", data);
  try {
    await refreshStaffRecordsSnapshotLocalFirst();
  } catch {
    // The server has already applied the recalculation; a later refresh can update local cache.
  }
  try {
    await applyRecalculatedStaffRecordsToLocalOverlay(response.data?.data?.record_results || []);
  } catch {
    // The server has already applied the recalculation; the cache can refresh later.
  }
  return response.data;
};
