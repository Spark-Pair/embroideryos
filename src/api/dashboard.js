import { fetchDashboardSummaryLocalFirst, fetchDashboardTrendLocalFirst } from "../offline/dashboardLocalFirst";

export const fetchDashboardSummary = (params) => fetchDashboardSummaryLocalFirst(params);

export const fetchDashboardTrend = (params) => fetchDashboardTrendLocalFirst(params);
