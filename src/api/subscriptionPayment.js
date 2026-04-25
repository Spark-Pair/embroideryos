import {
  createSubscriptionPaymentLocalFirst,
  fetchSubscriptionPaymentStatsLocalFirst,
  fetchSubscriptionPaymentsLocalFirst,
  updateSubscriptionPaymentLocalFirst,
} from "../offline/billingLocalFirst";

export const fetchSubscriptionPayments = (params) => fetchSubscriptionPaymentsLocalFirst(params);

export const fetchSubscriptionPaymentStats = (params) => fetchSubscriptionPaymentStatsLocalFirst(params);

export const createSubscriptionPayment = (data) => createSubscriptionPaymentLocalFirst(data);

export const updateSubscriptionPayment = (id, data) => updateSubscriptionPaymentLocalFirst(id, data);
