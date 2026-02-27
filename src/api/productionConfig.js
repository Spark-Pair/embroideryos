import {
  createProductionConfigLocalFirst,
  fetchProductionConfigLocalFirst,
  updateProductionConfigLocalFirst,
} from "../offline/productionConfigLocalFirst";

export const fetchProductionConfig = (date) => fetchProductionConfigLocalFirst(date);

export const updateProductionConfig = (data) => updateProductionConfigLocalFirst(data);

export const createProductionConfig = (payload) => createProductionConfigLocalFirst(payload);
