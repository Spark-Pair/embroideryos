import { apiClient } from "./apiClient";

const ORDERS_URL = "/orders";

export const fetchOrders = (params) =>
  apiClient.get(ORDERS_URL, { params }).then((r) => r.data);

export const fetchOrderStats = (params) =>
  apiClient.get(`${ORDERS_URL}/stats`, { params }).then((r) => r.data);

export const fetchOrder = (id) =>
  apiClient.get(`${ORDERS_URL}/${id}`).then((r) => r.data);

export const createOrder = (data) =>
  apiClient.post(ORDERS_URL, data).then((r) => r.data);

export const updateOrder = (id, data) =>
  apiClient.put(`${ORDERS_URL}/${id}`, data).then((r) => r.data);

export const toggleOrderStatus = (id) =>
  apiClient.patch(`${ORDERS_URL}/${id}/toggle-status`).then((r) => r.data);
