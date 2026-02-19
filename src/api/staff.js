// api/staff.js
import { apiClient } from './apiClient';

const STAFF_URL = "/staffs";

export const fetchStaffs = async (params = {}) => {
  const queryParams = new URLSearchParams({
    page: params.page || 1,
    limit: params.limit || 30,
    ...(params.name && { name: params.name }),
    ...(params.status && { status: params.status })
  });
  
  const res = await apiClient.get(`${STAFF_URL}?${queryParams}`);
  return res.data;
};

export const fetchStaffStats = async () => {
  const res = await apiClient.get(`${STAFF_URL}/stats`);
  return res.data;
};

export const fetchStaff = async (id) => {
  const res = await apiClient.get(`${STAFF_URL}/${id}`);
  return res.data;
};

export const createStaff = async (data) => {
  const res = await apiClient.post(STAFF_URL, data);
  return res.data;
};

export const updateStaff = async (id, data) => {
  const res = await apiClient.put(`${STAFF_URL}/${id}`, data);
  return res.data;
};

export const toggleStaffStatus = async (id) => {
  const res = await apiClient.patch(`${STAFF_URL}/${id}/toggle-status`);
  return res.data;
};