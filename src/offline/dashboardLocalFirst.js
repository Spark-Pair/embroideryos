import { apiClient } from "../api/apiClient";
import { getEntitySnapshot, offlineAccess } from "./idb";
import { logDataSource } from "./logger";

const DEFAULT_ALLOWANCE = 1500;

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

const previousMonth = (monthValue) => {
  if (!monthValue) return "";
  const [year, month] = monthValue.split("-").map(Number);
  if (!year || !month) return "";
  const d = new Date(year, month - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const monthKeyFromDate = (value) => {
  const ts = toMillis(value);
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

const isAllowanceEligible = ({ recordCount, absentCount, halfCount }) =>
  recordCount >= 26 && absentCount === 0 && halfCount <= 1;

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

const buildStaffMonthlySummaryLocal = ({ staff, staffRecords, staffPayments, selectedMonth }) => {
  const prevMonthKey = previousMonth(selectedMonth);
  const prevMonthRange = toMonthRange(prevMonthKey);
  const prevMonthEndMillis = toMillis(prevMonthRange?.to);

  const embroideryStaff = (staff || []).filter((row) => String(row?.category || "Embroidery") === "Embroidery");
  if (!embroideryStaff.length) {
    return {
      staff_count: 0,
      active_staff_count: 0,
      staff_with_records: 0,
      record_count: 0,
      work_amount: 0,
      arrears_amount: 0,
      allowance_amount: 0,
      bonus_qty: 0,
      bonus_amount: 0,
      deduction_amount: 0,
      deduction_advance_amount: 0,
      deduction_payment_amount: 0,
      deduction_adjustment_amount: 0,
      balance_amount: 0,
      by_staff: [],
    };
  }

  const summaryByStaff = new Map(
    embroideryStaff.map((row) => [
      String(row?._id || ""),
      {
        staff_id: String(row?._id || ""),
        staff_name: row?.name || "",
        is_active: Boolean(row?.isActive),
        arrears: Number(row?.opening_balance || 0),
        currentRecordCount: 0,
        currentFinal: 0,
        currentBonusQty: 0,
        currentBonusAmt: 0,
        currentAbsent: 0,
        currentHalf: 0,
        currentAllowanceCandidate: null,
        currentDeduction: 0,
        currentAdvance: 0,
        currentPayment: 0,
        currentAdjustment: 0,
      },
    ])
  );

  const historyMonthStats = new Map();

  (staffRecords || []).forEach((rec) => {
    const staffId = String(rec?.staff_id?._id || rec?.staff_id || "");
    if (!summaryByStaff.has(staffId)) return;
    const monthKey = monthKeyFromDate(rec?.date);
    if (!monthKey) return;

    if (monthKey < selectedMonth) {
      const historyKey = `${staffId}::${monthKey}`;
      const prev = historyMonthStats.get(historyKey) || {
        staffId,
        monthKey,
        recordCount: 0,
        absentCount: 0,
        halfCount: 0,
        finalAmount: 0,
        allowanceCandidate: null,
      };
      prev.recordCount += 1;
      if (rec?.attendance === "Absent") prev.absentCount += 1;
      if (rec?.attendance === "Half") prev.halfCount += 1;
      prev.finalAmount += Number(rec?.final_amount || 0);
      const allowance = Number(rec?.config_snapshot?.allowance);
      if (Number.isFinite(allowance) && allowance >= 0) prev.allowanceCandidate = allowance;
      historyMonthStats.set(historyKey, prev);
      return;
    }

    if (monthKey !== selectedMonth) return;

    const current = summaryByStaff.get(staffId);
    current.currentRecordCount += 1;
    current.currentFinal += Number(rec?.final_amount || 0);
    current.currentBonusQty += Number(rec?.bonus_qty || 0);
    current.currentBonusAmt += Number(rec?.bonus_amount || 0);
    if (rec?.attendance === "Absent") current.currentAbsent += 1;
    if (rec?.attendance === "Half") current.currentHalf += 1;
    const allowance = Number(rec?.config_snapshot?.allowance);
    if (Number.isFinite(allowance) && allowance >= 0) current.currentAllowanceCandidate = allowance;
  });

  [...historyMonthStats.values()]
    .sort((a, b) => (a.monthKey === b.monthKey ? a.staffId.localeCompare(b.staffId) : a.monthKey.localeCompare(b.monthKey)))
    .forEach((row) => {
      const current = summaryByStaff.get(row.staffId);
      if (!current) return;
      current.arrears += Number(row.finalAmount || 0);
      if (isAllowanceEligible(row)) {
        current.arrears += Number(row.allowanceCandidate ?? DEFAULT_ALLOWANCE);
      }
    });

  (staffPayments || []).forEach((payment) => {
    const staffId = String(payment?.staff_id?._id || payment?.staff_id || "");
    const current = summaryByStaff.get(staffId);
    if (!current) return;

    const amount = Number(payment?.amount || 0);
    const paymentMonth = typeof payment?.month === "string" && payment.month
      ? payment.month
      : monthKeyFromDate(payment?.date);
    const paymentDateMillis = toMillis(payment?.date);

    const isHistoryPayment = paymentMonth
      ? paymentMonth <= prevMonthKey
      : Boolean(paymentDateMillis && paymentDateMillis <= prevMonthEndMillis);

    if (isHistoryPayment) {
      current.arrears -= amount;
      return;
    }

    if (paymentMonth !== selectedMonth) return;

    current.currentDeduction += amount;
    if (payment?.type === "advance") current.currentAdvance += amount;
    if (payment?.type === "payment") current.currentPayment += amount;
    if (payment?.type === "adjustment") current.currentAdjustment += amount;
  });

  let staffWithRecords = 0;
  const total = {
    staff_count: embroideryStaff.length,
    active_staff_count: embroideryStaff.filter((row) => Boolean(row?.isActive)).length,
    staff_with_records: 0,
    record_count: 0,
    work_amount: 0,
    arrears_amount: 0,
    allowance_amount: 0,
    bonus_qty: 0,
    bonus_amount: 0,
    deduction_amount: 0,
    deduction_advance_amount: 0,
    deduction_payment_amount: 0,
    deduction_adjustment_amount: 0,
    balance_amount: 0,
    by_staff: [],
  };

  summaryByStaff.forEach((row) => {
    if (row.currentRecordCount > 0) staffWithRecords += 1;
    const allowance = isAllowanceEligible({
      recordCount: row.currentRecordCount,
      absentCount: row.currentAbsent,
      halfCount: row.currentHalf,
    })
      ? Number(row.currentAllowanceCandidate ?? DEFAULT_ALLOWANCE)
      : 0;

    const workAmount = row.currentFinal - row.currentBonusAmt;

    total.record_count += row.currentRecordCount;
    total.work_amount += workAmount;
    total.arrears_amount += row.arrears;
    total.allowance_amount += allowance;
    total.bonus_qty += row.currentBonusQty;
    total.bonus_amount += row.currentBonusAmt;
    total.deduction_amount += row.currentDeduction;
    total.deduction_advance_amount += row.currentAdvance;
    total.deduction_payment_amount += row.currentPayment;
    total.deduction_adjustment_amount += row.currentAdjustment;
    const balance = row.arrears + row.currentFinal + allowance - row.currentDeduction;
    total.balance_amount += balance;
    total.by_staff.push({
      staff_id: row.staff_id,
      staff_name: row.staff_name,
      is_active: row.is_active,
      records: row.currentRecordCount,
      work_amount: workAmount,
      arrears_amount: row.arrears,
      allowance_amount: allowance,
      bonus_qty: row.currentBonusQty,
      bonus_amount: row.currentBonusAmt,
      deduction_amount: row.currentDeduction,
      deduction_advance_amount: row.currentAdvance,
      deduction_payment_amount: row.currentPayment,
      deduction_adjustment_amount: row.currentAdjustment,
      balance_amount: balance,
    });
  });

  total.staff_with_records = staffWithRecords;
  total.by_staff.sort((a, b) => String(a?.staff_name || "").localeCompare(String(b?.staff_name || "")));
  return total;
};

export const fetchDashboardSummaryLocalFirst = async (params = {}) => {
  if (!offlineAccess.isUnlocked()) {
    const res = await apiClient.get("/dashboard/summary", { params });
    return res.data;
  }

  const selectedMonth =
    typeof params?.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month)
      ? params.month
      : new Date().toISOString().slice(0, 7);
  const monthRange = toMonthRange(selectedMonth);
  const today = formatYmdLocal(new Date());

  const orders = await getMergedSnapshot("orders:all", "orders:overlay");
  const invoices = await getMergedSnapshot("invoices:all", "invoices:overlay");
  const expenses = await getMergedSnapshot("expenses:all", "expenses:overlay");
  const customerPayments = await getMergedSnapshot("customerPayments:all", "customerPayments:overlay");
  const supplierPayments = await getMergedSnapshot("supplierPayments:all", "supplierPayments:overlay");
  const staffPayments = await getMergedSnapshot("staffPayments:all", "staffPayments:overlay");
  const staffRecords = await getMergedSnapshot("staffRecords:all", "staffRecords:overlay");
  const crpRecords = await getMergedSnapshot("crpStaffRecords:all", "crpStaffRecords:overlay");
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
  const monthStaffRecords = staffRecords.filter((row) => inDateRange(row?.date, monthRange.from, monthRange.to));
  const monthCrpRecords = crpRecords.filter((row) => inDateRange(row?.order_date, monthRange.from, monthRange.to));

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
      staff_records: { count: monthStaffRecords.length, amount: sumBy(monthStaffRecords, "final_amount") },
      crp_records: { count: monthCrpRecords.length, amount: sumBy(monthCrpRecords, "total_amount") },
      staff_summary: buildStaffMonthlySummaryLocal({
        staff,
        staffRecords,
        staffPayments,
        selectedMonth,
      }),
      payment_in: { count: monthCustomerPayments.length, amount: sumBy(monthCustomerPayments, "amount") },
      payment_out: {
        count: monthSupplierPayments.length + monthStaffPayments.length,
        amount: sumBy(monthSupplierPayments, "amount") + sumBy(monthStaffPayments, "amount"),
        supplier: {
          count: monthSupplierPayments.length,
          amount: sumBy(monthSupplierPayments, "amount"),
        },
        staff: {
          count: monthStaffPayments.length,
          amount: sumBy(monthStaffPayments, "amount"),
        },
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

  logDataSource("IDB", "dashboard.summary.local", { month: selectedMonth });
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
