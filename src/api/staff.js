// api/staff.js
import {
  createStaffLocalFirst,
  fetchStaffLocalFirst,
  fetchStaffNamesLocalFirst,
  fetchStaffsLocalFirst,
  fetchStaffStatsLocalFirst,
  toggleStaffStatusLocalFirst,
  updateStaffLocalFirst,
} from "../offline/staffLocalFirst";

export const fetchStaffs = async (params = {}) => fetchStaffsLocalFirst(params);

export const fetchStaffNames = async (params) => fetchStaffNamesLocalFirst(params);

export const fetchStaffStats = async () => fetchStaffStatsLocalFirst();

export const fetchStaff = async (id) => fetchStaffLocalFirst(id);

export const createStaff = async (data) => createStaffLocalFirst(data);

export const updateStaff = async (id, data) => updateStaffLocalFirst(id, data);

export const toggleStaffStatus = async (id) => toggleStaffStatusLocalFirst(id);
