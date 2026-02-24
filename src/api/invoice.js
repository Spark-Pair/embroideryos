import { apiClient } from "./apiClient";

const INVOICES_URL = "/invoices";

export const fetchInvoiceOrderGroups = (params) =>
  apiClient.get(`${INVOICES_URL}/order-groups`, { params }).then((r) => r.data);

export const fetchInvoices = (params) =>
  apiClient.get(INVOICES_URL, { params }).then((r) => r.data);

export const fetchInvoice = (id) =>
  apiClient.get(`${INVOICES_URL}/${id}`).then((r) => r.data);

export const createInvoice = (data) =>
  apiClient.post(INVOICES_URL, data).then((r) => r.data);
