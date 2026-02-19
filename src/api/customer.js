// api/customer.js
import { apiClient } from './apiClient';

const CUSTOMER_URL = "/customers";

export const fetchCustomers = async (params = {}) => {
  const queryParams = new URLSearchParams({
    page: params.page || 1,
    limit: params.limit || 30,
    ...(params.name && { name: params.name }),
    ...(params.status && { status: params.status })
  });
  
  const res = await apiClient.get(`${CUSTOMER_URL}?${queryParams}`);
  return res.data;
};

export const fetchCustomerStats = async () => {
  const res = await apiClient.get(`${CUSTOMER_URL}/stats`);
  return res.data;
};

export const fetchCustomer = async (id) => {
  const res = await apiClient.get(`${CUSTOMER_URL}/${id}`);
  return res.data;
};

export const createCustomer = async (data) => {
  const res = await apiClient.post(CUSTOMER_URL, data);
  return res.data;
};

export const updateCustomer = async (id, data) => {
  const res = await apiClient.put(`${CUSTOMER_URL}/${id}`, data);
  return res.data;
};

export const toggleCustomerStatus = async (id) => {
  const res = await apiClient.patch(`${CUSTOMER_URL}/${id}/toggle-status`);
  return res.data;
};