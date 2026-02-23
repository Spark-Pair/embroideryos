import React, { useEffect, useMemo, useState } from "react";
import { Printer, Search } from "lucide-react";
import {
  fetchStaffRecords,
  fetchStaffRecordMonths,
} from "../api/staffRecord";
import {
  fetchStaffPaymentMonths,
  fetchStaffPayments,
} from "../api/staffPayment";
import { fetchProductionConfig } from "../api/productionConfig";
import PageHeader from "../components/PageHeader";
import Select from "../components/Select";
import SlipCard from "../components/SalarySlip/SlipCard";
import { useToast } from "../context/ToastContext";
import {
  getMonthKeyFromDate,
  getMonthLabel,
  getPreviousMonthKey,
  isAllowanceEligible,
  mergeAndSortMonths,
  toMonthWindow,
} from "../utils/salarySlip";

const DEFAULT_ALLOWANCE = 1500;

function buildEmptySlip(id, name, month, openingBalance = 0) {
  return {
    id,
    name,
    month,
    amount: 0,
    arrears: 0,
    advance: 0,
    bonusQty: 0,
    bonusAmt: 0,
    adjustment: 0,
    payment: 0,
    allowance: 0,
    recordCount: 0,
    absentCount: 0,
    halfCount: 0,
    openingBalance: Number(openingBalance) || 0,
    total: 0,
  };
}

function applyRecordMetrics(target, rec) {
  const finalAmt = Number(rec.final_amount) || 0;
  const bonusAmt = Number(rec.bonus_amount) || 0;
  const bonusQty = Number(rec.bonus_qty) || 0;
  target.recordCount += 1;
  if (rec.attendance === "Absent") target.absentCount += 1;
  if (rec.attendance === "Half") target.halfCount += 1;
  target.bonusQty += bonusQty;
  target.bonusAmt += bonusAmt;
  target.amount += Math.max(0, finalAmt - bonusAmt);
}

function applyPaymentMetrics(target, payment) {
  const amt = Number(payment.amount) || 0;
  if (payment.type === "advance") target.advance += amt;
  if (payment.type === "adjustment") target.adjustment += amt;
  if (payment.type === "payment") target.payment += amt;
}

function getPaymentInHistory(payment, prevMonthKey, prevMonthEnd) {
  if (typeof payment.month === "string" && payment.month) {
    return payment.month <= prevMonthKey;
  }
  if (payment.date) {
    return new Date(payment.date) <= new Date(prevMonthEnd);
  }
  return false;
}

function updateClosingBalanceWithPayment(closing, key, payment) {
  const amt = Number(payment.amount) || 0;
  if (payment.type === "adjustment") closing[key] += amt;
  if (payment.type === "advance" || payment.type === "payment") closing[key] -= amt;
}

async function buildAllowanceByMonth(monthKeys) {
  const uniqMonths = [...new Set(monthKeys.filter(Boolean))];
  if (uniqMonths.length === 0) return {};

  const entries = await Promise.all(
    uniqMonths.map(async (month) => {
      try {
        const { to } = toMonthWindow(month);
        const cfg = await fetchProductionConfig(to);
        const allowance = Number(cfg?.data?.allowance);
        return [month, Number.isFinite(allowance) ? allowance : DEFAULT_ALLOWANCE];
      } catch {
        return [month, DEFAULT_ALLOWANCE];
      }
    })
  );

  return Object.fromEntries(entries);
}

function buildPreviousClosingBalance({
  historyRecords,
  historyPayments,
  prevMonthKey,
  prevMonthEnd,
  allowanceByMonth,
}) {
  const closingByStaff = {};
  const monthBuckets = {};

  historyRecords.forEach((rec) => {
    const staffId = rec.staff_id?._id ?? rec.staff_id;
    if (!staffId) return;
    const key = String(staffId);
    const monthKey = getMonthKeyFromDate(rec.date);
    if (!monthKey || monthKey > prevMonthKey) return;

    if (closingByStaff[key] === undefined) {
      closingByStaff[key] = Number(rec.staff_id?.opening_balance) || 0;
    }

    const bucketKey = `${key}|${monthKey}`;
    if (!monthBuckets[bucketKey]) {
      monthBuckets[bucketKey] = {
        staffKey: key,
        monthKey,
        finalAmount: 0,
        recordCount: 0,
        absentCount: 0,
        halfCount: 0,
      };
    }

    monthBuckets[bucketKey].finalAmount += Number(rec.final_amount) || 0;
    monthBuckets[bucketKey].recordCount += 1;
    if (rec.attendance === "Absent") monthBuckets[bucketKey].absentCount += 1;
    if (rec.attendance === "Half") monthBuckets[bucketKey].halfCount += 1;
  });

  const sortedBuckets = Object.values(monthBuckets).sort((a, b) =>
    a.monthKey.localeCompare(b.monthKey)
  );

  sortedBuckets.forEach((bucket) => {
    const allowance = allowanceByMonth[bucket.monthKey] ?? DEFAULT_ALLOWANCE;
    const allowed = isAllowanceEligible(bucket) ? allowance : 0;
    closingByStaff[bucket.staffKey] += bucket.finalAmount + allowed;
  });

  historyPayments.forEach((payment) => {
    if (!getPaymentInHistory(payment, prevMonthKey, prevMonthEnd)) return;
    const staffId = payment.staff_id?._id ?? payment.staff_id;
    if (!staffId) return;
    const key = String(staffId);
    if (closingByStaff[key] === undefined) {
      closingByStaff[key] = Number(payment.staff_id?.opening_balance) || 0;
    }
    updateClosingBalanceWithPayment(closingByStaff, key, payment);
  });

  return closingByStaff;
}

function normalizePrintStyles() {
  const styleId = "__slip_print_style__";
  document.getElementById(styleId)?.remove();

  const style = document.createElement("style");
  style.id = styleId;
  style.innerHTML = `
    @media print {
      html { zoom: 85%; }
      @page { size: A4 portrait; margin: 0mm; }
      body * { visibility: hidden !important; }
      #salary-slips-print-root,
      #salary-slips-print-root * { visibility: visible !important; }
      #salary-slips-print-root {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: auto !important;
        padding: 8mm !important;
        box-sizing: border-box !important;
        background: white !important;
      }
      #salary-slips-print-root > div {
        display: grid !important;
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 12px !important;
        width: 100% !important;
      }
      #salary-slips-print-root > div > div {
        display: block !important;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
        box-sizing: border-box !important;
        width: 100% !important;
      }
      #salary-slips-print-root .flex {
        display: flex !important;
      }
    }
  `;

  document.head.appendChild(style);
  return styleId;
}

export default function SalarySlipsPage() {
  const { showToast } = useToast();

  const [availableMonths, setAvailableMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [slips, setSlips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMonths, setLoadingMonths] = useState(false);
  const [generated, setGenerated] = useState(false);

  const monthOptions = useMemo(
    () => availableMonths.map((m) => ({ value: m, label: getMonthLabel(m) })),
    [availableMonths]
  );

  useEffect(() => {
    const loadMonths = async () => {
      try {
        setLoadingMonths(true);
        const [recordMonthsRes, paymentMonthsRes] = await Promise.all([
          fetchStaffRecordMonths(),
          fetchStaffPaymentMonths(),
        ]);
        const months = mergeAndSortMonths(
          recordMonthsRes.data || [],
          paymentMonthsRes.data || []
        );
        setAvailableMonths(months);
        setSelectedMonth((prev) => (prev && months.includes(prev) ? prev : (months[0] || "")));
      } catch (err) {
        console.error(err);
        showToast({ type: "error", message: "Failed to load available months" });
      } finally {
        setLoadingMonths(false);
      }
    };

    loadMonths();
  }, [showToast]);

  const handleGenerate = async () => {
    if (!selectedMonth) {
      showToast({ type: "error", message: "No month available to generate slips" });
      return;
    }

    try {
      setLoading(true);
      setGenerated(false);

      const { from, to } = toMonthWindow(selectedMonth);
      const prevMonthKey = getPreviousMonthKey(selectedMonth);
      const prevMonthMeta = toMonthWindow(prevMonthKey);

      const [
        currentRecordsRes,
        currentPaymentsRes,
        historyRecordsRes,
        historyPaymentsRes,
        prevMonthRecordsRes,
        prevMonthPaymentsRes,
      ] = await Promise.all([
        fetchStaffRecords({ date_from: from, date_to: to, limit: 1000 }),
        fetchStaffPayments({ month: selectedMonth, limit: 5000 }),
        fetchStaffRecords({ date_to: prevMonthMeta.to, limit: 20000 }),
        fetchStaffPayments({ limit: 20000 }),
        fetchStaffRecords({ date_from: prevMonthMeta.from, date_to: prevMonthMeta.to, limit: 5000 }),
        fetchStaffPayments({ month: prevMonthKey, limit: 5000 }),
      ]);

      const records = currentRecordsRes.data || [];
      const payments = currentPaymentsRes.data || [];
      const historyRecords = historyRecordsRes.data || [];
      const historyPayments = historyPaymentsRes.data || [];
      const prevMonthRecords = prevMonthRecordsRes.data || [];
      const prevMonthPayments = prevMonthPaymentsRes.data || [];
      const monthLabel = getMonthLabel(selectedMonth);

      const historyMonths = historyRecords
        .map((r) => getMonthKeyFromDate(r.date))
        .filter(Boolean)
        .filter((m) => m <= prevMonthKey);

      const allowanceByMonth = await buildAllowanceByMonth([...historyMonths, selectedMonth]);
      const monthlyAllowance = allowanceByMonth[selectedMonth] ?? DEFAULT_ALLOWANCE;

      const grouped = {};
      const ensureGroup = (id, name, openingBalance = 0) => {
        if (!grouped[id]) grouped[id] = buildEmptySlip(id, name, monthLabel, openingBalance);
        return grouped[id];
      };

      records.forEach((rec) => {
        const id = rec.staff_id?._id ?? rec.staff_id;
        const name = rec.staff_id?.name ?? "Unknown";
        const g = ensureGroup(id, name, rec.staff_id?.opening_balance ?? 0);
        applyRecordMetrics(g, rec);
      });

      payments.forEach((payment) => {
        const id = payment.staff_id?._id ?? payment.staff_id;
        const name = payment.staff_id?.name ?? "Unknown";
        const g = ensureGroup(id, name, payment.staff_id?.opening_balance ?? 0);
        applyPaymentMetrics(g, payment);
      });

      const prevMonthDataStaffs = new Set();
      prevMonthRecords.forEach((rec) => {
        const id = rec.staff_id?._id ?? rec.staff_id;
        if (id) prevMonthDataStaffs.add(String(id));
      });
      prevMonthPayments.forEach((payment) => {
        const id = payment.staff_id?._id ?? payment.staff_id;
        if (id) prevMonthDataStaffs.add(String(id));
      });

      const closingByStaff = buildPreviousClosingBalance({
        historyRecords,
        historyPayments,
        prevMonthKey,
        prevMonthEnd: prevMonthMeta.to,
        allowanceByMonth,
      });

      Object.values(grouped).forEach((g) => {
        const staffKey = String(g.id);
        const previousBalance = prevMonthDataStaffs.has(staffKey)
          ? (closingByStaff[staffKey] ?? g.openingBalance)
          : g.openingBalance;

        g.arrears = previousBalance;
        g.allowance = isAllowanceEligible(g) ? monthlyAllowance : 0;
        g.total = g.amount + g.bonusAmt + g.allowance + g.arrears - g.advance - g.payment - g.adjustment;
      });

      setSlips(Object.values(grouped));
      setGenerated(true);
    } catch (err) {
      console.error(err);
      showToast({ type: "error", message: "Failed to generate salary slips" });
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const styleId = normalizePrintStyles();
    window.print();
    window.addEventListener(
      "afterprint",
      () => document.getElementById(styleId)?.remove(),
      { once: true }
    );
  };

  const grandTotal = slips.reduce((sum, slip) => sum + slip.total, 0);

  return (
    <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col">
      <PageHeader
        title="Salary Slips"
        subtitle="Generate and print monthly salary slips for all staff."
      />

      <div className="bg-white border border-gray-300 rounded-3xl p-6 mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1.5 min-w-64">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Month</label>
          <Select
            value={selectedMonth}
            onChange={setSelectedMonth}
            options={monthOptions}
            placeholder={loadingMonths ? "Loading months..." : "Select month..."}
            disabled={loadingMonths || monthOptions.length === 0}
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || loadingMonths || !selectedMonth}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#127475] text-white rounded-xl text-sm font-semibold hover:bg-teal-700 transition-colors disabled:opacity-60 shadow-sm"
        >
          {loading ? (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : <Search className="w-4 h-4" />}
          {loading ? "Generating..." : "Generate Slips"}
        </button>

        {generated && slips.length > 0 && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-2.5 bg-white border border-[#127475] text-[#127475] rounded-xl text-sm font-semibold hover:bg-teal-50 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print All Slips
          </button>
        )}
      </div>

      {!generated && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-20 bg-white border border-gray-200 rounded-3xl">
          {monthOptions.length === 0 ? (
            <>
              <p className="text-gray-700 font-semibold text-lg">No Month Data Found</p>
              <p className="text-gray-400 text-sm mt-1">Add staff records/payments first to generate slips.</p>
            </>
          ) : (
            <>
              <p className="text-gray-700 font-semibold text-lg">No Slips Generated</p>
              <p className="text-gray-400 text-sm mt-1">Select a month and click "Generate Slips"</p>
            </>
          )}
        </div>
      )}

      {generated && slips.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center py-20 bg-white border border-gray-200 rounded-3xl">
          <p className="text-gray-500 font-medium">No records found for the selected month.</p>
        </div>
      )}

      {generated && slips.length > 0 && (
        <>
          <h1 className="text-2xl font-extrabold text-gray-800 text-center mb-5">
            Salary Slip Preview — {slips.length} slips
          </h1>

          <div id="salary-slips-print-root">
            <div className="grid grid-cols-3 gap-4">
              {slips.map((slip) => (
                <SlipCard key={slip.id} emp={slip} />
              ))}
            </div>
          </div>

          <div className="mt-5 p-4 sm:p-5 bg-white border border-gray-300 rounded-3xl shadow-sm">
            <div className="flex items-center justify-between bg-white border border-gray-400 px-4 py-2 rounded-xl">
              <label className="text-gray-700 tracking-wide">Grand Total Payable Amount</label>
              <div className="text-lg font-bold text-teal-600">
                {grandTotal.toLocaleString()}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
