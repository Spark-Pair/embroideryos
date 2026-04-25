// api/business.js
import {
  createBusinessLocalFirst,
  fetchBusinessesLocalFirst,
  fetchBusinessStatsLocalFirst,
  toggleBusinessStatusLocalFirst,
  updateBusinessLocalFirst,
} from "../offline/adminEntitiesLocalFirst";
import {
  fetchBusinessLocalFirst,
  fetchMyInvoiceBannerLocalFirst,
  fetchMyMachineOptionsLocalFirst,
  fetchMyReferenceDataLocalFirst,
  updateMyInvoiceBannerLocalFirst,
  updateMyMachineOptionsLocalFirst,
  updateMyReferenceDataLocalFirst,
  fetchMyInvoiceCounterLocalFirst,
  updateMyInvoiceCounterLocalFirst,
  fetchMyRuleDataLocalFirst,
  updateMyRuleDataLocalFirst,
} from "../offline/businessLocalFirst";

export const fetchBusinesses = async (params = {}) => {
  return fetchBusinessesLocalFirst(params);
};

export const fetchBusinessStats = async () => {
  return fetchBusinessStatsLocalFirst();
};

export const fetchBusiness = async (id) => {
  return fetchBusinessLocalFirst(id);
};

export const createBusiness = async (data) => {
  return createBusinessLocalFirst(data);
};

export const updateBusiness = async (id, data) => {
  return updateBusinessLocalFirst(id, data);
};

export const toggleBusinessStatus = async (id) => {
  return toggleBusinessStatusLocalFirst(id);
};

export const fetchMyInvoiceBanner = async () => {
  return fetchMyInvoiceBannerLocalFirst();
};

export const updateMyInvoiceBanner = async (invoice_banner_data) => {
  return updateMyInvoiceBannerLocalFirst(invoice_banner_data);
};

export const fetchMyMachineOptions = async () => {
  return fetchMyMachineOptionsLocalFirst();
};

export const updateMyMachineOptions = async (machine_options) => {
  return updateMyMachineOptionsLocalFirst(machine_options);
};

export const fetchMyReferenceData = async () => {
  return fetchMyReferenceDataLocalFirst();
};

export const updateMyReferenceData = async (reference_data) => {
  return updateMyReferenceDataLocalFirst(reference_data);
};

export const fetchMyRuleData = async () => {
  return fetchMyRuleDataLocalFirst();
};

export const updateMyRuleData = async (rule_data) => {
  return updateMyRuleDataLocalFirst(rule_data);
};

export const fetchMyInvoiceCounter = async (params = {}) => {
  return fetchMyInvoiceCounterLocalFirst(params);
};

export const updateMyInvoiceCounter = async (payload) => {
  return updateMyInvoiceCounterLocalFirst(payload);
};
