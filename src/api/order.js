import {
  createOrderLocalFirst,
  fetchOrderLocalFirst,
  fetchOrderStatsLocalFirst,
  fetchOrdersLocalFirst,
  updateOrderLocalFirst,
} from "../offline/ordersLocalFirst";

export const fetchOrders = (params) => fetchOrdersLocalFirst(params);

export const fetchOrderStats = (params) => fetchOrderStatsLocalFirst(params);

export const fetchOrder = (id) => fetchOrderLocalFirst(id);

export const createOrder = (data) => createOrderLocalFirst(data);

export const updateOrder = (id, data) => updateOrderLocalFirst(id, data);
