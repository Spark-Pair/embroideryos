import {
  createExpenseItemLocalFirst,
  fetchExpenseItemsLocalFirst,
  toggleExpenseItemStatusLocalFirst,
  updateExpenseItemLocalFirst,
} from "../offline/expenseItemsLocalFirst";

export const fetchExpenseItems = (params) => fetchExpenseItemsLocalFirst(params);

export const createExpenseItem = (data) => createExpenseItemLocalFirst(data);

export const updateExpenseItem = (id, data) => updateExpenseItemLocalFirst(id, data);

export const toggleExpenseItemStatus = (id) => toggleExpenseItemStatusLocalFirst(id);
