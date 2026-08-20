import {
  createInvoiceLocalFirst,
  fetchInvoiceLocalFirst,
  fetchInvoiceOrderGroupsLocalFirst,
  fetchInvoicesLocalFirst,
  updateInvoiceLocalFirst,
} from "../offline/invoicesLocalFirst";

export const fetchInvoiceOrderGroups = (params) => fetchInvoiceOrderGroupsLocalFirst(params);
export const fetchInvoices = (params) => fetchInvoicesLocalFirst(params);
export const fetchInvoice = (id) => fetchInvoiceLocalFirst(id);
export const createInvoice = (data) => createInvoiceLocalFirst(data);
export const updateInvoice = (id, data) => updateInvoiceLocalFirst(id, data);