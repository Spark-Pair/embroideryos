// api/staffRecords.js
import { apiClient } from './apiClient';

const STAFF_RECORDS_URL = "/staff-records";

export const fetchStaffRecords = async (params = {}) => {
  const queryParams = new URLSearchParams({
    page: params.page || 1,
    limit: params.limit || 30,
    ...(params.name && { name: params.name }),
    ...(params.status && { status: params.status })
  });
  
  const res = await apiClient.get(`${STAFF_RECORDS_URL}?${queryParams}`);
  return res.data;
};

export const fetchStaffRecordStats = async () => {
  const res = await apiClient.get(`${STAFF_RECORDS_URL}/stats`);
  return res.data;
};

export const fetchStaffRecord = async (id) => {
  const res = await apiClient.get(`${STAFF_RECORDS_URL}/${id}`);
  return res.data;
};

export const createStaffRecord = async (data) => {
  const res = await apiClient.post(STAFF_RECORDS_URL, data);
  return res.data;
};

export const updateStaffRecord = async (id, data) => {
  const res = await apiClient.put(`${STAFF_RECORDS_URL}/${id}`, data);
  return res.data;
};

export const toggleStaffRecordStatus = async (id) => {
  const res = await apiClient.patch(`${STAFF_RECORDS_URL}/${id}/toggle-status`);
  return res.data;
};