import { apiClient } from "./apiClient";

const SUBSCRIPTION_URL = "/subscriptions";

export const fetchSubscriptions = (params) =>
  apiClient.get(SUBSCRIPTION_URL, { params }).then((r) => r.data);

export const updateSubscription = (id, payload) =>
  apiClient.patch(`${SUBSCRIPTION_URL}/${id}`, payload).then((r) => r.data);

export const createSubscription = (payload) =>
  apiClient.post(SUBSCRIPTION_URL, payload).then((r) => r.data);

export const renewSubscription = (id, payload = {}) =>
  apiClient.post(`${SUBSCRIPTION_URL}/${id}/renew`, payload).then((r) => r.data);
