import {
  createCrpRateConfigLocalFirst,
  fetchCrpRateConfigsLocalFirst,
  toggleCrpRateConfigStatusLocalFirst,
  updateCrpRateConfigLocalFirst,
} from "../offline/crpRateConfigsLocalFirst";

export const fetchCrpRateConfigs = (params) => fetchCrpRateConfigsLocalFirst(params);

export const createCrpRateConfig = (data) => createCrpRateConfigLocalFirst(data);

export const updateCrpRateConfig = (id, data) => updateCrpRateConfigLocalFirst(id, data);

export const toggleCrpRateConfigStatus = (id) => toggleCrpRateConfigStatusLocalFirst(id);
