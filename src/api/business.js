// api/business.js
import { apiClient } from './apiClient';

const BUSINESS_URL = "/business";

export const fetchBusinesses = async (params = {}) => {
  const queryParams = new URLSearchParams({
    page: params.page || 1,
    limit: params.limit || 30,
    ...(params.name && { name: params.name }),
    ...(params.status && { status: params.status })
  });
  
  const res = await apiClient.get(`${BUSINESS_URL}?${queryParams}`);
  return res.data;
};

export const fetchBusinessStats = async () => {
  const res = await apiClient.get(`${BUSINESS_URL}/stats`);
  return res.data;
};

export const fetchBusiness = async (id) => {
  const res = await apiClient.get(`${BUSINESS_URL}/${id}`);
  return res.data;
};

export const createBusiness = async (data) => {
  const res = await apiClient.post(BUSINESS_URL, data);
  return res.data;
};

export const updateBusiness = async (id, data) => {
  const res = await apiClient.put(`${BUSINESS_URL}/${id}`, data);
  return res.data;
};

export const toggleBusinessStatus = async (id) => {
  const res = await apiClient.patch(`${BUSINESS_URL}/${id}/toggle-status`);
  return res.data;
};