import { apiClient } from "./apiClient";

const SUBSCRIPTION_URL = "/subscriptions";

export const fetchPlans = () =>
  apiClient.get(`${SUBSCRIPTION_URL}/plans`).then((r) => r.data);

export const fetchMySubscription = () =>
  apiClient.get(`${SUBSCRIPTION_URL}/me`).then((r) => r.data);
