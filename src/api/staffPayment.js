import {
  createStaffPaymentLocalFirst,
  fetchStaffPaymentMonthsLocalFirst,
  fetchStaffPaymentStatsLocalFirst,
  fetchStaffPaymentsLocalFirst,
} from "../offline/staffPaymentsLocalFirst";

export const fetchStaffPayments = (params) => fetchStaffPaymentsLocalFirst(params);

export const fetchStaffPaymentStats = () => fetchStaffPaymentStatsLocalFirst();

export const fetchStaffPaymentMonths = () => fetchStaffPaymentMonthsLocalFirst();

export const createStaffPayment = (data) => createStaffPaymentLocalFirst(data);
