import { apiClient } from "./apiClient";

const EXPENSE_ITEMS_URL = "/expense-items";

export const fetchExpenseItems = (params) =>
  apiClient.get(EXPENSE_ITEMS_URL, { params }).then((r) => r.data);

export const createExpenseItem = (data) =>
  apiClient.post(EXPENSE_ITEMS_URL, data).then((r) => r.data);

export const updateExpenseItem = (id, data) =>
  apiClient.put(`${EXPENSE_ITEMS_URL}/${id}`, data).then((r) => r.data);

export const toggleExpenseItemStatus = (id) =>
  apiClient.patch(`${EXPENSE_ITEMS_URL}/${id}/toggle-status`).then((r) => r.data);
