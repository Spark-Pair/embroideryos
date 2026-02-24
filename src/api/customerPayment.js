import { apiClient } from "./apiClient";

const CUSTOMER_PAYMENTS_URL = "/customer-payments";

export const fetchCustomerPayments = (params) =>
  apiClient.get(CUSTOMER_PAYMENTS_URL, { params }).then((r) => r.data);

export const fetchCustomerPaymentStats = () =>
  apiClient.get(`${CUSTOMER_PAYMENTS_URL}/stats`).then((r) => r.data);

export const fetchCustomerPaymentMonths = () =>
  apiClient.get(`${CUSTOMER_PAYMENTS_URL}/months`).then((r) => r.data);

export const createCustomerPayment = (data) =>
  apiClient.post(CUSTOMER_PAYMENTS_URL, data).then((r) => r.data);
