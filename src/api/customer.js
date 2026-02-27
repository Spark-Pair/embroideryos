// api/customer.js
import {
  createCustomerLocalFirst,
  fetchCustomerLocalFirst,
  fetchCustomersLocalFirst,
  fetchCustomerStatsLocalFirst,
  toggleCustomerStatusLocalFirst,
  updateCustomerLocalFirst,
} from "../offline/customersLocalFirst";

export const fetchCustomers = async (params = {}) => fetchCustomersLocalFirst(params);

export const fetchCustomerStats = async () => fetchCustomerStatsLocalFirst();

export const fetchCustomer = async (id) => fetchCustomerLocalFirst(id);

export const createCustomer = async (data) => createCustomerLocalFirst(data);

export const updateCustomer = async (id, data) => updateCustomerLocalFirst(id, data);

export const toggleCustomerStatus = async (id) => toggleCustomerStatusLocalFirst(id);
