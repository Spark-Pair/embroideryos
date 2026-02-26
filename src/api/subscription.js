import { apiClient } from "./apiClient";

const SUBSCRIPTION_URL = "/subscriptions";

export const fetchPlans = () =>
  apiClient.get(`${SUBSCRIPTION_URL}/plans`).then((r) => r.data);

export const fetchMySubscription = () =>
  apiClient.get(`${SUBSCRIPTION_URL}/me`).then((r) => r.data);

export const createPlan = (data) =>
  apiClient.post(`${SUBSCRIPTION_URL}/plans`, data).then((r) => r.data);

export const updatePlan = (id, data) =>
  apiClient.put(`${SUBSCRIPTION_URL}/plans/${id}`, data).then((r) => r.data);
