// api/user.js
import { apiClient } from "./apiClient";
import {
  createBusinessUserLocalFirst,
  fetchBusinessUsersLocalFirst,
  fetchBusinessUserStatsLocalFirst,
  fetchUserStatsLocalFirst,
  fetchUsersLocalFirst,
  toggleBusinessUserStatusLocalFirst,
  toggleUserStatusLocalFirst,
} from "../offline/adminEntitiesLocalFirst";

const USER_URL = "/users";

export const fetchUsers = async (params = {}) => {
  return fetchUsersLocalFirst(params);
};

export const fetchUserStats = async () => {
  return fetchUserStatsLocalFirst();
};

export const fetchBusinessUsers = async (params = {}) => {
  return fetchBusinessUsersLocalFirst(params);
};

export const fetchBusinessUserStats = async () => {
  return fetchBusinessUserStatsLocalFirst();
};

export const fetchLoggedInUsers = async () => {
  const res = await apiClient.get(`${USER_URL}/active-sessions`);
  return res.data;
};

export const logoutUserFromAllDevices = async (id) => {
  const res = await apiClient.delete(`${USER_URL}/${id}/active-sessions`);
  return res.data;
};

export const createBusinessUser = async (data) => {
  return createBusinessUserLocalFirst(data);
};

export const resetUserPassword = async (id, data) => {
  const res = await apiClient.patch(`${USER_URL}/${id}/reset-password`, data);
  return res.data;
};

export const toggleUserStatus = async (id) => {
  return toggleUserStatusLocalFirst(id);
};

export const resetBusinessUserPassword = async (id, data) => {
  const res = await apiClient.patch(`${USER_URL}/business/${id}/reset-password`, data);
  return res.data;
};

export const toggleBusinessUserStatus = async (id) => {
  return toggleBusinessUserStatusLocalFirst(id);
};
