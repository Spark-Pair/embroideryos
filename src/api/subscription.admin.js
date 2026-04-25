import {
  createSubscriptionLocalFirst,
  fetchSubscriptionsLocalFirst,
  renewSubscriptionLocalFirst,
  updateSubscriptionLocalFirst,
} from "../offline/billingLocalFirst";

export const fetchSubscriptions = (params) => fetchSubscriptionsLocalFirst(params);

export const updateSubscription = (id, payload) => updateSubscriptionLocalFirst(id, payload);

export const createSubscription = (payload) => createSubscriptionLocalFirst(payload);

export const renewSubscription = (id, payload = {}) => renewSubscriptionLocalFirst(id, payload);
