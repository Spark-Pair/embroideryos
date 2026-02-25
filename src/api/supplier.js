import { apiClient } from "./apiClient";

const SUPPLIER_URL = "/suppliers";

export const fetchSuppliers = async (params = {}) => {
  const queryParams = new URLSearchParams({
    page: params.page || 1,
    limit: params.limit || 30,
    ...(params.name && { name: params.name }),
    ...(params.status && { status: params.status }),
  });

  const res = await apiClient.get(`${SUPPLIER_URL}?${queryParams}`);
  return res.data;
};

export const fetchSupplierStats = async () => {
  const res = await apiClient.get(`${SUPPLIER_URL}/stats`);
  return res.data;
};

export const fetchSupplier = async (id) => {
  const res = await apiClient.get(`${SUPPLIER_URL}/${id}`);
  return res.data;
};

export const createSupplier = async (data) => {
  const res = await apiClient.post(SUPPLIER_URL, data);
  return res.data;
};

export const updateSupplier = async (id, data) => {
  const res = await apiClient.put(`${SUPPLIER_URL}/${id}`, data);
  return res.data;
};

export const toggleSupplierStatus = async (id) => {
  const res = await apiClient.patch(`${SUPPLIER_URL}/${id}/toggle-status`);
  return res.data;
};
