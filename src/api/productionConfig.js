// api/productionConfig.js

import axios from "axios";

const BASE = "/api/production-config";

export const fetchProductionConfig = () =>
  axios.get(BASE).then((r) => r.data);

export const updateProductionConfig = (data) =>
  axios.put(BASE, data).then((r) => r.data);

export const createProductionConfig = (payload) =>
  api.post("/production-config", payload).then((res) => res.data);