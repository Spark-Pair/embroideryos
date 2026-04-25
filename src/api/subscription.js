import { apiClient } from "./apiClient";
import {
  createPlanLocalFirst,
  fetchPlansLocalFirst,
  updatePlanLocalFirst,
} from "../offline/billingLocalFirst";
import { fetchMySubscriptionLocalFirst } from "../offline/subscriptionLocalFirst";

const SUBSCRIPTION_URL = "/subscriptions";

export const fetchPlans = () => fetchPlansLocalFirst();

export const fetchMySubscription = () => fetchMySubscriptionLocalFirst();

export const createPlan = (data) => createPlanLocalFirst(data);

export const updatePlan = (id, data) => updatePlanLocalFirst(id, data);
