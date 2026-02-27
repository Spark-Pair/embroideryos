import {
  createSupplierPaymentLocalFirst,
  fetchSupplierPaymentMonthsLocalFirst,
  fetchSupplierPaymentStatsLocalFirst,
  fetchSupplierPaymentsLocalFirst,
} from "../offline/supplierPaymentsLocalFirst";

export const fetchSupplierPayments = (params) => fetchSupplierPaymentsLocalFirst(params);

export const fetchSupplierPaymentStats = () => fetchSupplierPaymentStatsLocalFirst();

export const fetchSupplierPaymentMonths = () => fetchSupplierPaymentMonthsLocalFirst();

export const createSupplierPayment = (data) => createSupplierPaymentLocalFirst(data);
