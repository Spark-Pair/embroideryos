import { apiClient } from './apiClient';

const PRODUCTION_CONFIG_URL = "/production-configs";

export const fetchProductionConfig = (date) =>
  apiClient.get(PRODUCTION_CONFIG_URL, { params: date ? { date } : {} }).then((r) => r.data);

export const updateProductionConfig = (data) =>
  apiClient.put(PRODUCTION_CONFIG_URL, data).then((r) => r.data);

export const createProductionConfig = (payload) =>
  apiClient.post(PRODUCTION_CONFIG_URL, payload).then((res) => res.data);