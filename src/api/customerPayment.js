import {
  createCustomerPaymentLocalFirst,
  fetchCustomerPaymentMonthsLocalFirst,
  fetchCustomerPaymentStatsLocalFirst,
  fetchCustomerPaymentsLocalFirst,
  updateCustomerPaymentLocalFirst,
} from "../offline/customerPaymentsLocalFirst";

export const fetchCustomerPayments = (params) => fetchCustomerPaymentsLocalFirst(params);

export const fetchCustomerPaymentStats = () => fetchCustomerPaymentStatsLocalFirst();

export const fetchCustomerPaymentMonths = () => fetchCustomerPaymentMonthsLocalFirst();

export const createCustomerPayment = (data) => createCustomerPaymentLocalFirst(data);

export const updateCustomerPayment = (id, data) => updateCustomerPaymentLocalFirst(id, data);
