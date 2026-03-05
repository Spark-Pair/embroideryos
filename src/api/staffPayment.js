import {
  createStaffPaymentLocalFirst,
  fetchStaffPaymentMonthsLocalFirst,
  fetchStaffPaymentStatsLocalFirst,
  fetchStaffPaymentsLocalFirst,
  updateStaffPaymentLocalFirst,
} from "../offline/staffPaymentsLocalFirst";

export const fetchStaffPayments = (params) => fetchStaffPaymentsLocalFirst(params);

export const fetchStaffPaymentStats = () => fetchStaffPaymentStatsLocalFirst();

export const fetchStaffPaymentMonths = () => fetchStaffPaymentMonthsLocalFirst();

export const createStaffPayment = (data) => createStaffPaymentLocalFirst(data);

export const updateStaffPayment = (id, data) => updateStaffPaymentLocalFirst(id, data);
