import { apiClient } from "./apiClient";

const SUPPLIER_PAYMENTS_URL = "/supplier-payments";

export const fetchSupplierPayments = (params) =>
  apiClient.get(SUPPLIER_PAYMENTS_URL, { params }).then((r) => r.data);

export const fetchSupplierPaymentStats = () =>
  apiClient.get(`${SUPPLIER_PAYMENTS_URL}/stats`).then((r) => r.data);

export const fetchSupplierPaymentMonths = () =>
  apiClient.get(`${SUPPLIER_PAYMENTS_URL}/months`).then((r) => r.data);

export const createSupplierPayment = (data) =>
  apiClient.post(SUPPLIER_PAYMENTS_URL, data).then((r) => r.data);
