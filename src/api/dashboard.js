import { apiClient } from "./apiClient";

const DASHBOARD_URL = "/dashboard";

export const fetchDashboardSummary = (params) =>
  apiClient.get(`${DASHBOARD_URL}/summary`, { params }).then((r) => r.data);

export const fetchDashboardTrend = (params) =>
  apiClient.get(`${DASHBOARD_URL}/trend`, { params }).then((r) => r.data);
