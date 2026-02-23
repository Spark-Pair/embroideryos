import { apiClient } from "./apiClient";

const STAFF_PAYMENTS_URL = "/staff-payments";

export const fetchStaffPayments = (params) =>
  apiClient.get(STAFF_PAYMENTS_URL, { params }).then((r) => r.data);

export const fetchStaffPaymentStats = () =>
  apiClient.get(`${STAFF_PAYMENTS_URL}/stats`).then((r) => r.data);

export const fetchStaffPaymentMonths = () =>
  apiClient.get(`${STAFF_PAYMENTS_URL}/months`).then((r) => r.data);

export const createStaffPayment = (data) =>
  apiClient.post(STAFF_PAYMENTS_URL, data).then((r) => r.data);
