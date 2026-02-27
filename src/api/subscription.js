import { apiClient } from "./apiClient";
import { fetchMySubscriptionLocalFirst } from "../offline/subscriptionLocalFirst";

const SUBSCRIPTION_URL = "/subscriptions";

export const fetchPlans = () =>
  apiClient.get(`${SUBSCRIPTION_URL}/plans`).then((r) => r.data);

export const fetchMySubscription = () => fetchMySubscriptionLocalFirst();

export const createPlan = (data) =>
  apiClient.post(`${SUBSCRIPTION_URL}/plans`, data).then((r) => r.data);

export const updatePlan = (id, data) =>
  apiClient.put(`${SUBSCRIPTION_URL}/plans/${id}`, data).then((r) => r.data);
