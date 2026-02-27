import {
  createExpenseLocalFirst,
  deleteExpenseLocalFirst,
  fetchExpenseStatsLocalFirst,
  fetchExpensesLocalFirst,
  updateExpenseLocalFirst,
} from "../offline/expensesLocalFirst";

export const fetchExpenses = (params) => fetchExpensesLocalFirst(params);

export const fetchExpenseStats = () => fetchExpenseStatsLocalFirst();

export const createExpense = (data) => createExpenseLocalFirst(data);

export const updateExpense = (id, data) => updateExpenseLocalFirst(id, data);

export const deleteExpense = (id) => deleteExpenseLocalFirst(id);
