import {
  createCrpStaffRecordLocalFirst,
  deleteCrpStaffRecordLocalFirst,
  fetchCrpStaffRecordsLocalFirst,
  fetchCrpStaffRecordStatsLocalFirst,
  updateCrpStaffRecordLocalFirst,
} from "../offline/crpStaffRecordsLocalFirst";

export const fetchCrpStaffRecords = (params) => fetchCrpStaffRecordsLocalFirst(params);

export const fetchCrpStaffRecordStats = () => fetchCrpStaffRecordStatsLocalFirst();

export const createCrpStaffRecord = (data) => createCrpStaffRecordLocalFirst(data);
export const updateCrpStaffRecord = (id, data) => updateCrpStaffRecordLocalFirst(id, data);

export const deleteCrpStaffRecord = (id) => deleteCrpStaffRecordLocalFirst(id);
