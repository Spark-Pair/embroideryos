import {
  createSupplierLocalFirst,
  fetchSupplierLocalFirst,
  fetchSuppliersLocalFirst,
  fetchSupplierStatsLocalFirst,
  toggleSupplierStatusLocalFirst,
  updateSupplierLocalFirst,
} from "../offline/suppliersLocalFirst";

export const fetchSuppliers = async (params = {}) => fetchSuppliersLocalFirst(params);

export const fetchSupplierStats = async () => fetchSupplierStatsLocalFirst();

export const fetchSupplier = async (id) => fetchSupplierLocalFirst(id);

export const createSupplier = async (data) => createSupplierLocalFirst(data);

export const updateSupplier = async (id, data) => updateSupplierLocalFirst(id, data);

export const toggleSupplierStatus = async (id) => toggleSupplierStatusLocalFirst(id);
