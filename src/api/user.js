// api/user.js
import { apiClient } from "./apiClient";

const USER_URL = "/users";

export const fetchUsers = async (params = {}) => {
  const queryParams = new URLSearchParams({
    page: params.page || 1,
    limit: params.limit || 30,
    ...(params.name && { name: params.name }),
    ...(params.status && { status: params.status })
  });
  
  const res = await apiClient.get(`${USER_URL}?${queryParams}`);
  console.log(res.data);
  
  return res.data;
};

export const fetchUserStats = async () => {
  const res = await apiClient.get(`${USER_URL}/stats`);
  return res.data;
};

export const fetchBusinessUsers = async (params = {}) => {
  const queryParams = new URLSearchParams({
    page: params.page || 1,
    limit: params.limit || 30,
    ...(params.name && { name: params.name }),
    ...(params.status && { status: params.status })
  });

  const res = await apiClient.get(`${USER_URL}/business?${queryParams}`);
  return res.data;
};

export const fetchBusinessUserStats = async () => {
  const res = await apiClient.get(`${USER_URL}/business/stats`);
  return res.data;
};

export const createBusinessUser = async (data) => {
  const res = await apiClient.post(`${USER_URL}/business`, data);
  return res.data;
};

export const resetUserPassword = async (id, data) => {
  const res = await apiClient.patch(`${USER_URL}/${id}/reset-password`, data);
  return res.data;
};

export const toggleUserStatus = async (id) => {
  const res = await apiClient.patch(`${USER_URL}/${id}/toggle-status`);
  return res.data;
};

export const resetBusinessUserPassword = async (id, data) => {
  const res = await apiClient.patch(`${USER_URL}/business/${id}/reset-password`, data);
  return res.data;
};

export const toggleBusinessUserStatus = async (id) => {
  const res = await apiClient.patch(`${USER_URL}/business/${id}/toggle-status`);
  return res.data;
};
