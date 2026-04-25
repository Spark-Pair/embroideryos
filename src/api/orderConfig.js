import {
  createOrderConfigLocalFirst,
  fetchOrderConfigLocalFirst,
  updateOrderConfigLocalFirst,
} from "../offline/orderConfigLocalFirst";

export const fetchOrderConfig = (date) => fetchOrderConfigLocalFirst(date);
export const createOrderConfig = (payload) => createOrderConfigLocalFirst(payload);
export const updateOrderConfig = (payload) => updateOrderConfigLocalFirst(payload);
