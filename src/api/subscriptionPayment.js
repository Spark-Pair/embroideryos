import { apiClient } from "./apiClient";

const SUBSCRIPTION_PAYMENTS_URL = "/subscription-payments";

export const fetchSubscriptionPayments = (params) =>
  apiClient.get(SUBSCRIPTION_PAYMENTS_URL, { params }).then((r) => r.data);

export const fetchSubscriptionPaymentStats = (params) =>
  apiClient.get(`${SUBSCRIPTION_PAYMENTS_URL}/stats`, { params }).then((r) => r.data);

export const createSubscriptionPayment = (data) =>
  apiClient.post(SUBSCRIPTION_PAYMENTS_URL, data).then((r) => r.data);

export const updateSubscriptionPayment = (id, data) =>
  apiClient.put(`${SUBSCRIPTION_PAYMENTS_URL}/${id}`, data).then((r) => r.data);
