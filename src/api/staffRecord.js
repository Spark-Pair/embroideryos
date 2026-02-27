import {
  createStaffRecordLocalFirst,
  deleteStaffRecordLocalFirst,
  fetchStaffLastRecordLocalFirst,
  fetchStaffRecordLocalFirst,
  fetchStaffRecordMonthsLocalFirst,
  fetchStaffRecordStatsLocalFirst,
  fetchStaffRecordsLocalFirst,
  updateStaffRecordLocalFirst,
} from "../offline/staffRecordsLocalFirst";

export const fetchStaffRecords = (params) => fetchStaffRecordsLocalFirst(params);

export const fetchStaffRecordStats = (params) => fetchStaffRecordStatsLocalFirst(params);

export const fetchStaffRecordMonths = () => fetchStaffRecordMonthsLocalFirst();

export const fetchStaffLastRecord = (staff_id) => fetchStaffLastRecordLocalFirst(staff_id);

export const fetchStaffRecord = (id) => fetchStaffRecordLocalFirst(id);

export const createStaffRecord = (data) => createStaffRecordLocalFirst(data);

export const updateStaffRecord = (id, data) => updateStaffRecordLocalFirst(id, data);

export const deleteStaffRecord = (id) => deleteStaffRecordLocalFirst(id);
