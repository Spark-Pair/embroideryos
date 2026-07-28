import {
  createProductionConfigLocalFirst,
  fetchProductionConfigLocalFirst,
  fetchAllProductionConfigsLocalFirst,
  updateProductionConfigLocalFirst,
} from "../offline/productionConfigLocalFirst";

export const fetchProductionConfig = (date) => fetchProductionConfigLocalFirst(date);
export const fetchAllProductionConfigs = () => fetchAllProductionConfigsLocalFirst();

export const updateProductionConfig = (data) => updateProductionConfigLocalFirst(data);

export const createProductionConfig = (payload) => createProductionConfigLocalFirst(payload);
