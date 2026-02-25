import { apiClient } from "./apiClient";

const EXPENSES_URL = "/expenses";

export const fetchExpenses = (params) =>
  apiClient.get(EXPENSES_URL, { params }).then((r) => r.data);

export const fetchExpenseStats = () =>
  apiClient.get(`${EXPENSES_URL}/stats`).then((r) => r.data);

export const createExpense = (data) =>
  apiClient.post(EXPENSES_URL, data).then((r) => r.data);

export const updateExpense = (id, data) =>
  apiClient.put(`${EXPENSES_URL}/${id}`, data).then((r) => r.data);

export const deleteExpense = (id) =>
  apiClient.delete(`${EXPENSES_URL}/${id}`).then((r) => r.data);
