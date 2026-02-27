import { apiClient } from "../api/apiClient";
import { getEntitySnapshot, offlineAccess } from "./idb";
import { logDataSource } from "./logger";

const getMergedSnapshot = async (allKey, overlayKey) => {
  const base = await getEntitySnapshot(allKey);
  const overlay = (await getEntitySnapshot(overlayKey)) || {};
  const rows = Array.isArray(base) ? base : [];
  const map = new Map(rows.map((row) => [String(row?._id || row?.id || ""), row]));
  Object.values(overlay || {}).forEach((item) => {
    if (!item) return;
    const id = String(item?._id || item?.id || "");
    if (!id) return;
    if (item._deleted) {
      map.delete(id);
      return;
    }
    const prev = map.get(id) || {};
    map.set(id, { ...prev, ...item, _id: id });
  });
  return Array.from(map.values());
};

const toMillis = (value) => {
  if (!value) return 0;
  const d = new Date(value).getTime();
  return Number.isFinite(d) ? d : 0;
};

const inDateRange = (value, from, to) => {
  const ts = toMillis(value);
  if (!ts) return false;
  if (from && ts < toMillis(from)) return false;
  if (to && ts > toMillis(to)) return false;
  return true;
};

const toMonthRange = (monthValue) => {
  if (!monthValue) return { from: "", to: "" };
  const [year, month] = monthValue.split("-").map(Number);
  if (!year || !month) return { from: "", to: "" };

  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const fmt = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return { from: fmt(first), to: fmt(last) };
};

const formatYmdLocal = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const buildTrendDays = (from, to) => {
  if (!from || !to) return [];
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const days = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push({
      day: formatYmdLocal(cursor),
      orders: 0,
      expenses: 0,
      paymentsIn: 0,
      paymentsOut: 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};

const ensureRange = (range, date_from, date_to) => {
  const now = new Date();
  const end = new Date(now);
  let start = new Date(now);
  if (range === "7d") start.setDate(start.getDate() - 6);
  if (range === "1m") start.setDate(start.getDate() - 29);
  if (range === "3m") start.setDate(start.getDate() - 89);
  if (range === "6m") start.setDate(start.getDate() - 179);
  if (range === "custom" && date_from && date_to) {
    return { from: date_from, to: date_to };
  }
  return { from: formatYmdLocal(start), to: formatYmdLocal(end) };
};

const sumBy = (rows, key) => rows.reduce((sum, row) => sum + Number(row?.[key] || 0), 0);

export const fetchDashboardSummaryLocalFirst = async (params = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get("/dashboard/summary", { params });
    return res.data;
  }

  const monthRange = toMonthRange(params?.month);
  const today = formatYmdLocal(new Date());

  const orders = await getMergedSnapshot("orders:all", "orders:overlay");
  const invoices = await getMergedSnapshot("invoices:all", "invoices:overlay");
  const expenses = await getMergedSnapshot("expenses:all", "expenses:overlay");
  const customerPayments = await getMergedSnapshot("customerPayments:all", "customerPayments:overlay");
  const supplierPayments = await getMergedSnapshot("supplierPayments:all", "supplierPayments:overlay");
  const staffPayments = await getMergedSnapshot("staffPayments:all", "staffPayments:overlay");
  const customers = await getMergedSnapshot("customers:all", "customers:overlay");
  const suppliers = await getMergedSnapshot("suppliers:all", "suppliers:overlay");
  const staff = await getMergedSnapshot("staffs:all", "staffs:overlay");

  const todayOrders = orders.filter((row) => inDateRange(row?.date, today, today));
  const todayInvoices = invoices.filter((row) => inDateRange(row?.invoice_date, today, today));
  const todayExpenses = expenses.filter((row) => inDateRange(row?.date, today, today));
  const todayCustomerPayments = customerPayments.filter((row) => inDateRange(row?.date, today, today));
  const todaySupplierPayments = supplierPayments.filter((row) => inDateRange(row?.date, today, today));
  const todayStaffPayments = staffPayments.filter((row) => inDateRange(row?.date, today, today));

  const monthOrders = orders.filter((row) => inDateRange(row?.date, monthRange.from, monthRange.to));
  const monthInvoices = invoices.filter((row) => inDateRange(row?.invoice_date, monthRange.from, monthRange.to));
  const monthExpenses = expenses.filter((row) => inDateRange(row?.date, monthRange.from, monthRange.to));
  const monthCustomerPayments = customerPayments.filter((row) => inDateRange(row?.date, monthRange.from, monthRange.to));
  const monthSupplierPayments = supplierPayments.filter((row) => inDateRange(row?.date, monthRange.from, monthRange.to));
  const monthStaffPayments = staffPayments.filter((row) => inDateRange(row?.date, monthRange.from, monthRange.to));

  const summary = {
    today: {
      orders: { count: todayOrders.length, amount: sumBy(todayOrders, "total_amount") },
      invoices: { count: todayInvoices.length, amount: sumBy(todayInvoices, "total_amount") },
      expenses: { count: todayExpenses.length, amount: sumBy(todayExpenses, "amount") },
      payment_in: { count: todayCustomerPayments.length, amount: sumBy(todayCustomerPayments, "amount") },
      payment_out: {
        count: todaySupplierPayments.length + todayStaffPayments.length,
        amount: sumBy(todaySupplierPayments, "amount") + sumBy(todayStaffPayments, "amount"),
      },
    },
    month: {
      orders: { count: monthOrders.length, amount: sumBy(monthOrders, "total_amount") },
      invoices: { count: monthInvoices.length, amount: sumBy(monthInvoices, "total_amount") },
      expenses: { count: monthExpenses.length, amount: sumBy(monthExpenses, "amount") },
      payment_in: { count: monthCustomerPayments.length, amount: sumBy(monthCustomerPayments, "amount") },
      payment_out: {
        count: monthSupplierPayments.length + monthStaffPayments.length,
        amount: sumBy(monthSupplierPayments, "amount") + sumBy(monthStaffPayments, "amount"),
      },
    },
    active: {
      customers: customers.filter((c) => Boolean(c?.isActive)).length,
      suppliers: suppliers.filter((s) => Boolean(s?.isActive)).length,
      staff: staff.filter((s) => Boolean(s?.isActive)).length,
    },
    recent: {
      orders: [...orders].sort((a, b) => toMillis(b?.date) - toMillis(a?.date)).slice(0, 5),
      invoices: [...invoices].sort((a, b) => toMillis(b?.invoice_date) - toMillis(a?.invoice_date)).slice(0, 5),
      expenses: [...expenses].sort((a, b) => toMillis(b?.date) - toMillis(a?.date)).slice(0, 5),
    },
  };

  logDataSource("IDB", "dashboard.summary.local", { month: params?.month || "" });
  return { success: true, data: summary };
};

export const fetchDashboardTrendLocalFirst = async (params = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get("/dashboard/trend", { params });
    return res.data;
  }

  const { range = "7d", date_from, date_to } = params || {};
  const { from, to } = ensureRange(range, date_from, date_to);
  const trend = buildTrendDays(from, to);
  const trendMap = new Map(trend.map((row) => [row.day, row]));

  const orders = await getMergedSnapshot("orders:all", "orders:overlay");
  const expenses = await getMergedSnapshot("expenses:all", "expenses:overlay");
  const customerPayments = await getMergedSnapshot("customerPayments:all", "customerPayments:overlay");
  const supplierPayments = await getMergedSnapshot("supplierPayments:all", "supplierPayments:overlay");
  const staffPayments = await getMergedSnapshot("staffPayments:all", "staffPayments:overlay");

  orders.forEach((row) => {
    if (!inDateRange(row?.date, from, to)) return;
    const key = formatYmdLocal(row?.date);
    const bucket = trendMap.get(key);
    if (bucket) bucket.orders += 1;
  });

  expenses.forEach((row) => {
    if (!inDateRange(row?.date, from, to)) return;
    const key = formatYmdLocal(row?.date);
    const bucket = trendMap.get(key);
    if (bucket) bucket.expenses += Number(row?.amount || 0);
  });

  customerPayments.forEach((row) => {
    if (!inDateRange(row?.date, from, to)) return;
    const key = formatYmdLocal(row?.date);
    const bucket = trendMap.get(key);
    if (bucket) bucket.paymentsIn += Number(row?.amount || 0);
  });

  [...supplierPayments, ...staffPayments].forEach((row) => {
    if (!inDateRange(row?.date, from, to)) return;
    const key = formatYmdLocal(row?.date);
    const bucket = trendMap.get(key);
    if (bucket) bucket.paymentsOut += Number(row?.amount || 0);
  });

  logDataSource("IDB", "dashboard.trend.local", { range, from, to });
  return { success: true, data: { from, to, trend: Array.from(trendMap.values()) } };
};
