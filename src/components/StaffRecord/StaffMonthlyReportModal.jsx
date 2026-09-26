import { useEffect, useMemo, useState } from "react";
import { Loader2, Printer, Search, RotateCcw } from "lucide-react";
import Modal from "../Modal";
import Button from "../Button";
import Select from "../Select";
import ConfirmModal from "../ConfirmModal";
import { fetchStaff, fetchStaffNames } from "../../api/staff";
import { applyStaffRecordRecalculation, fetchStaffRecordMonths, fetchStaffRecords, previewStaffRecordRecalculation } from "../../api/staffRecord";
import { fetchStaffPayments } from "../../api/staffPayment";
import { fetchAllProductionConfigs, fetchProductionConfig } from "../../api/productionConfig";
import { formatDate, formatNumbers } from "../../utils";
import {
  getMonthKeyFromDate,
  getMonthLabel,
  getPreviousMonthKey,
  isAllowanceEligible,
  toMonthWindow,
} from "../../utils/salarySlip";
import { normalizeAllowanceOverrides, resolveAllowanceAmount } from "../../utils/allowanceOverride";
import { useToast } from "../../context/ToastContext";
const unwrapStaffRecordPreview = (response) => response?.data?.data || response?.data || response || {};

const getComparableProductionAmount = (record, config) => {
  const mode = config?.payout_mode;
  if (mode === "salary_bonus_only") return Number(record?.applique_amount || 0);
  if (mode === "target_dual_pct") {
    const target = Number(config?.target_amount || 0);
    const onTarget = Number(record?.totals?.on_target_amt || 0);
    const targetMet = target > 0 && onTarget >= target;
    const forcedAfter = Boolean(record?.force_after_target_for_non_target || record?.force_full_target_for_non_target);
    const useAfter = targetMet || forcedAfter;
    return Number(useAfter ? record?.totals?.after_target_amt : onTarget) || 0;
  }
  if (mode === "single_pct" || mode === "stitch_block_rate") {
    return Number(record?.totals?.on_target_amt || 0);
  }
  return Number(record?.totals?.on_target_amt || 0);
};

const DEFAULT_ALLOWANCE = 1500;

function formatBonusQtyDisplay(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (Number.isInteger(n)) return String(n);
  const rounded = Math.round(n * 1000) / 1000;
  return String(rounded)
    .replace(/(\.\d*?[1-9])0+$/, "$1")
    .replace(/\.0+$/, "");
}

function getLocalCalendarDate(dateInput) {
  if (typeof dateInput === "string") {
    const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(dateInput);
}

/* ─────────────────────────────────────────────────────────────
   openPrintWindow
   Builds HTML that exactly mirrors the screen preview design,
   opens in a new window, auto-prints, then closes.
───────────────────────────────────────────────────────────── */
function openPrintWindow({ staffName, monthLabel, summary, reportRows, totalDeduction }) {
  const genDate = new Date().toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });

  /* Info grid items — same as screen */
  const infoItems = [
    { l: "Staff Name",              v: staffName },
    { l: "Month",                   v: monthLabel },
    { l: "Arrears",                 v: formatNumbers(summary.arrears, 2) },
    { l: "Allowance",               v: formatNumbers(summary.allowance, 2) },
    { l: summary.reportBasis === "production" ? "Production Amount" : "Net Salary", v: formatNumbers(summary.net, 2) },
    { l: `Bonus (${summary.bonusQty})`, v: formatNumbers(summary.bonusAmt, 2) },
    { l: "Total Deduction",         v: `-${formatNumbers(totalDeduction, 2)}`, red: true },
    { l: "Balance",                 v: formatNumbers(summary.balance, 2) },
  ];

  const infoHtml = infoItems.map(({ l, v, red }) => `
    <div class="ic">
      <span class="ic-lbl">${l}:</span>
      <span class="ic-val${red ? " red" : ""}">${v}</span>
    </div>`).join("");

  const rowsHtml = reportRows.map((row, idx) => {
    const isProd = row.rowKind === "production";
    return `<tr class="${isProd ? "row-prod" : "row-day"}">
      <td class="td-num">${idx + 1}</td>
      <td class="td-date">${formatDate(row.date, "dd-MMM-YYYY, DDD")}</td>
      <td>${row.typeLabel}</td>
      <td class="r">${row.stitches}</td>
      <td class="r">${row.roundApp}</td>
      <td class="r">${row.ratePct}</td>
      <td class="r">${row.differ}</td>
      <td class="r">${row.totalPcs}</td>
      <td class="r bold">${row.amount}</td>
      <td class="r bold">${row.payment}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Report — ${staffName} — ${monthLabel}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @page {
    size: A4 portrait;
    margin: 0.4in 0.4in 0.4in 0.5in;
  }
    
  @media print {
    html {
      zoom: 100%;
    }
  }

  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 8.5pt;
    color: #111;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    padding: 1pt;
  }

  /* ── Info grid — matches screen grid 4-col ── */
  .info-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    border: 0.75pt solid #111;
    border-radius: 8pt;
    overflow: hidden;
    margin-bottom: 12pt;
    font-size: 8pt;
  }
  .ic {
    padding: 6pt 10pt;
    border-right: 0.75pt solid #111;
    border-bottom: 0.75pt solid #111;
    display: flex;
    align-items: center;
    gap: 4pt;
  }
  .ic:nth-child(4n)        { border-right: none; }
  .ic:nth-last-child(-n+4) { border-bottom: none; }
  .ic-lbl { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.06em; color: #111; white-space: nowrap; }
  .ic-val { font-weight: 600; color: #111; font-variant-numeric: tabular-nums; }
  .ic-val.red { color: #111; }

  /* ── Table ── */
  .tbl-wrap {
    border: 0.75pt solid #111;
    border-radius: 10pt;
    overflow: hidden;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 7.5pt;
    page-break-inside: auto;
  }
  thead { display: table-header-group; }
  tr    { page-break-inside: avoid; }

  th {
    background: #1e293b;
    color: #dee6ef;
    font-size: 7pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 6pt 5pt;
    text-align: left;
    border: none;
  }
  th.r { text-align: right; }

  td {
    padding: 6pt 5pt;
    border-bottom: 0.75pt solid #111; /* divide-y divide-gray-300 */
    vertical-align: middle;
    color: #111;
  }
  td.r    { text-align: right; }
  td.bold { font-weight: 600; }
  td.td-num  { font-size: 7.5pt; }
  td.td-date { white-space: nowrap; font-weight: 500; }

  /* Row types — matches screen exactly */
  tr.row-prod { background: #fff;    color: #1f2937; }
  tr.row-day  { background: #bcbcbc; color: #000; }   /* bg-gray-200/85 */

  tr:nth-last-child(1) td {
    border-bottom: 0px;
  }

  /* ── Print footer ── */
  .print-footer {
    display: flex;
    justify-content: space-between;
    font-size: 7pt;
    color: #111;
    margin-top: 10pt;
    border-top: 0.5pt solid #111;
    padding-top: 5pt;
  }
</style>
</head>
<body>
<div>
  <!-- Info Grid -->
  <div class="info-grid">${infoHtml}</div>

  <!-- Detail Table -->
  <div class="tbl-wrap">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Date</th>
          <th>Atten. / Type</th>
          <th class="r">Stitches</th>
          <th class="r">Round / App.</th>
          <th class="r">Rate %</th>
          <th class="r">Differ.</th>
          <th class="r">Total Pcs</th>
          <th class="r">Amount</th>
          <th class="r">Payment</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>

  <!-- Footer -->
  <div class="print-footer">
    <span>Generated: ${genDate} — © SparkPair · Confidential</span>
    <span>EmbroideryOS | ${staffName} · ${monthLabel}</span>
  </div>

</div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=960,height=780");
  if (!win) { alert("Pop-up blocked — please allow pop-ups for this site."); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  const closePrintWindow = () => {
    try { win.close(); } catch { /* no-op */ }
  };
  const handleAfterPrint = () => setTimeout(closePrintWindow, 100);
  win.addEventListener("afterprint", handleAfterPrint);
  win.onafterprint = handleAfterPrint;
  setTimeout(() => win.print(), 500);
}

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
function getPaymentInHistory(payment, prevMonthKey, prevMonthEnd) {
  if (typeof payment.month === "string" && payment.month) return payment.month <= prevMonthKey;
  if (payment.date) return getLocalCalendarDate(payment.date) <= getLocalCalendarDate(prevMonthEnd);
  return false;
}

async function buildAllowanceByMonth(monthKeys) {
  const unique = [...new Set(monthKeys.filter(Boolean))];
  if (unique.length === 0) return {};
  const entries = await Promise.all(
    unique.map(async (m) => {
      try {
        const { to } = toMonthWindow(m);
        const cfg = await fetchProductionConfig(to);
        const allowance = Number(cfg?.data?.allowance);
        return [m, Number.isFinite(allowance) ? allowance : DEFAULT_ALLOWANCE];
      } catch {
        return [m, DEFAULT_ALLOWANCE];
      }
    })
  );
  return Object.fromEntries(entries);
}

/* ─────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────── */
export default function StaffMonthlyReportModal({ isOpen, onClose }) {
  const { showToast } = useToast();
  const [staffOptions,   setStaffOptions]   = useState([]);
  const [monthOptions,   setMonthOptions]   = useState([]);
  const [selectedStaff,  setSelectedStaff]  = useState("");
  const [selectedMonth,  setSelectedMonth]  = useState("");
  const [reportBasis, setReportBasis] = useState("salary");
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loadingReport,  setLoadingReport]  = useState(false);
  const [records,   setRecords]   = useState([]);
  const [payments,  setPayments]  = useState([]);
  const [summary,   setSummary]   = useState(null);
  const [generated, setGenerated] = useState(false);
  const [productionConfigs, setProductionConfigs] = useState([]);
  const [reportConfigId, setReportConfigId] = useState("");
  const [reportConfigLoading, setReportConfigLoading] = useState(false);
  const [reportConfigError, setReportConfigError] = useState("");
  const [applyPreview, setApplyPreview] = useState(null);
  const [applyPreviewLoading, setApplyPreviewLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyConfirmOpen, setApplyConfirmOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        setLoadingOptions(true);
        const [staffRes, monthsRes, configsRes] = await Promise.all([
          fetchStaffNames({ status: "active", category: "Embroidery" }),
          fetchStaffRecordMonths(),
          fetchAllProductionConfigs().catch(() => ({ data: [] })),
        ]);
        const staffs = (staffRes.data  || [])
          .filter((s) => String(s?.category || "Embroidery") === "Embroidery")
          .map((s) => ({ label: s.name, value: s._id, salary: Number(s.salary) || 0 }));
        const months = (monthsRes.data || []).sort().reverse().map((m) => ({ label: getMonthLabel(m), value: m }));
        const configs = (configsRes.data || []).filter((config) => /^[a-f\d]{24}$/i.test(String(config?._id || "")));
        setStaffOptions(staffs);
        setMonthOptions(months);
        setProductionConfigs(configs);
        setSelectedStaff(staffs[0]?.value || "");
        setSelectedMonth(months[0]?.value || "");
        setReportConfigId("saved");
        setReportConfigError("");
        setReportBasis((staffs[0]?.salary || 0) > 0 ? "salary" : "production");
        setRecords([]); setPayments([]); setSummary(null); setGenerated(false);
      } catch {
        setStaffOptions([]); setMonthOptions([]); setProductionConfigs([]);
      } finally {
        setLoadingOptions(false);
      }
    })();
  }, [isOpen]);

  const selectedStaffLabel = useMemo(
    () => staffOptions.find((s) => s.value === selectedStaff)?.label || "—",
    [staffOptions, selectedStaff]
  );
  const selectedStaffHasSalary = (staffOptions.find((s) => s.value === selectedStaff)?.salary || 0) > 0;

  const handleStaffChange = (staffId) => {
    setSelectedStaff(staffId);
    clearReportPreview();
    const staff = staffOptions.find((s) => s.value === staffId);
    setReportBasis((staff?.salary || 0) > 0 ? "salary" : "production");
    setGenerated(false);
  };
  const handleReportBasisChange = (basis) => {
    clearReportPreview();
    setReportBasis(basis);
    setGenerated(false);
  };

  const clearReportPreview = () => {
    setReportConfigError("");
    setApplyPreview(null);
    setApplyPreviewLoading(false);
  };

  const handlePrepareApply = async () => {
    if (!selectedStaff || !selectedMonth || !reportConfigId || reportConfigId === "saved") return;
    try {
      setApplyPreviewLoading(true);
      setReportConfigError("");
      const response = await previewStaffRecordRecalculation({
        staff_id: selectedStaff,
        month: selectedMonth,
        config_id: reportConfigId,
      });
      const preview = unwrapStaffRecordPreview(response);
      setApplyPreview({
        count: Number(preview.summary?.record_count || 0),
        summary: preview.summary || {},
        records: preview.record_results || [],
        config: preview.config || {},
        applied: false,
      });
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || "Could not prepare recalculation.";
      setReportConfigError(message);
      showToast({ type: "error", message });
    } finally {
      setApplyPreviewLoading(false);
    }
  };

  const handleApplyRecalculation = async () => {
    if (!selectedStaff || !selectedMonth || !reportConfigId || reportConfigId === "saved") return;
    try {
      setApplyLoading(true);
      setReportConfigError("");
      const response = await applyStaffRecordRecalculation({
        staff_id: selectedStaff,
        month: selectedMonth,
        config_id: reportConfigId,
      });
      const result = unwrapStaffRecordPreview(response);
      setApplyPreview({ applied: true, count: Number(result.applied_records || 0) });
      setApplyConfirmOpen(false);
      showToast({ type: "success", message: `Recalculated ${Number(result.applied_records || 0)} saved records.` });
      await handleGenerate();
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || "Could not apply recalculation.";
      setReportConfigError(message);
      showToast({ type: "error", message });
    } finally {
      setApplyLoading(false);
    }
  };

  const handleConfiguredReport = async () => {
    if (!selectedStaff || !selectedMonth || reportConfigId === "saved") return;
    try {
      setReportConfigLoading(true);
      setReportConfigError("");
      await handleGenerate(reportConfigId);
    } catch (error) {
      setReportConfigError(error?.response?.data?.message || error?.message || "Could not calculate the report with this config.");
    } finally {
      setReportConfigLoading(false);
    }
  };
  const handleGenerate = async (configId = "") => {
    if (!selectedStaff || !selectedMonth) return;
    clearReportPreview();
    try {
      setLoadingReport(true);
      const { from, year, month } = toMonthWindow(selectedMonth);
      const to = `${selectedMonth}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
      const prevMonthKey  = getPreviousMonthKey(selectedMonth);
      const prevMonthMeta = toMonthWindow(prevMonthKey);

      const [staffRes, currentRecordsRes, currentPaymentsRes, historyRecordsRes, historyPaymentsRes] =
        await Promise.all([
          fetchStaff(selectedStaff),
          fetchStaffRecords({ staff_id: selectedStaff, date_from: from, date_to: to, limit: 2000 }),
          fetchStaffPayments({ staff_id: selectedStaff, month: selectedMonth, limit: 5000 }),
          fetchStaffRecords({ staff_id: selectedStaff, date_to: prevMonthMeta.to, limit: 20000 }),
          fetchStaffPayments({ staff_id: selectedStaff, limit: 20000 }),
        ]);

      let currentRecords  = currentRecordsRes.data  || [];
      if (configId && configId !== "saved") {
        const recalculationResponse = await previewStaffRecordRecalculation({
          staff_id: selectedStaff,
          month: selectedMonth,
          config_id: configId,
        });
        const recalculationData = unwrapStaffRecordPreview(recalculationResponse);
        const recalculatedById = new Map(
          (recalculationData.record_results || []).map((row) => [String(row._id), row])
        );
        currentRecords = currentRecords.map((record) => {
          const recalculated = recalculatedById.get(String(record._id));
          return recalculated
            ? { ...record, ...recalculated, totals: recalculated.totals ? { ...recalculated.totals, applique_amount: recalculated.applique_amount } : recalculated.totals }
            : record;
        });
      }
      setApplyPreview(configId ? null : { count: currentRecords.length, applied: false });
      const currentPayments = currentPaymentsRes.data || [];
      const historyRecords  = historyRecordsRes.data  || [];
      const historyPayments = historyPaymentsRes.data || [];
      const openingBalance  = Number(staffRes?.opening_balance) || 0;

      const historyMonths = historyRecords
        .map((r) => getMonthKeyFromDate(r.date))
        .filter(Boolean)
        .filter((m) => m <= prevMonthKey);
      const overrideMonths = normalizeAllowanceOverrides(staffRes?.allowance_overrides)
        .map((item) => item.month)
        .filter(Boolean);

      const allowanceByMonth = await buildAllowanceByMonth([...historyMonths, ...overrideMonths, selectedMonth]);
      const monthlyAllowance = allowanceByMonth[selectedMonth] ?? DEFAULT_ALLOWANCE;

      const monthBuckets = {};
      let historyClosing = openingBalance;

      historyRecords.forEach((rec) => {
        const monthKey = getMonthKeyFromDate(rec.date);
        if (!monthKey || monthKey > prevMonthKey) return;
        if (!monthBuckets[monthKey])
          monthBuckets[monthKey] = { recordCount: 0, absentCount: 0, halfCount: 0, finalAmount: 0 };
        monthBuckets[monthKey].recordCount += 1;
        if (rec.attendance === "Absent") monthBuckets[monthKey].absentCount += 1;
        if (rec.attendance === "Half")   monthBuckets[monthKey].halfCount   += 1;
        monthBuckets[monthKey].finalAmount += Number(rec.final_amount) || 0;
      });

      Object.entries(monthBuckets)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([monthKey, data]) => {
          const al = allowanceByMonth[monthKey] ?? DEFAULT_ALLOWANCE;
          historyClosing += data.finalAmount + resolveAllowanceAmount({
            staff: staffRes,
            month: monthKey,
            allowance: al,
            isEligible: isAllowanceEligible(data),
          });
        });

      historyPayments.forEach((p) => {
        if (!getPaymentInHistory(p, prevMonthKey, prevMonthMeta.to)) return;
        const amt = Number(p.amount) || 0;
        if (p.type === "adjustment")                       historyClosing += amt;
        if (p.type === "advance" || p.type === "payment") historyClosing -= amt;
      });

      const currentStats = currentRecords.reduce(
        (acc, rec) => {
          acc.days        += 1;
          acc.pcs         += Number(rec.totals?.pcs)         || 0;
          acc.rounds      += Number(rec.totals?.rounds)       || 0;
          acc.totalStitch += Number(rec.totals?.total_stitch) || 0;
          acc.bonusQty    += Number(rec.bonus_qty)            || 0;
          acc.bonus       += Number(rec.bonus_amount)         || 0;
          acc.final       += Number(rec.final_amount)         || 0;
          acc.recordCount += 1;
          if (rec.attendance === "Absent") acc.absentCount += 1;
          if (rec.attendance === "Half")   acc.halfCount   += 1;
          acc.attendance[rec.attendance] = (acc.attendance[rec.attendance] || 0) + 1;
          return acc;
        },
        { days: 0, pcs: 0, rounds: 0, totalStitch: 0, bonusQty: 0, bonus: 0, final: 0, recordCount: 0, absentCount: 0, halfCount: 0, attendance: {} }
      );
      const productionBaseTotal = currentRecords.reduce((sum, rec) => {
        const onTarget = Number(rec.totals?.on_target_amt) || 0;
        const afterTarget = Number(rec.totals?.after_target_amt) || 0;
        const snapshot = rec.config_snapshot || {};
        if (snapshot.payout_mode === "salary_bonus_only") return sum;
        const targetAmount = Number(snapshot.target_amount) || 0;
        const forceAfter = Boolean(rec.force_after_target_for_non_target) || Boolean(rec.force_full_target_for_non_target);
        const targetMet = targetAmount > 0 && onTarget >= targetAmount;
        const amount = targetMet || forceAfter ? afterTarget : onTarget;
        return sum + amount;
      }, 0);

      const paymentStats = currentPayments.reduce(
        (acc, p) => {
          const amt = Number(p.amount) || 0;
          if (p.type === "advance")    acc.advance    += amt;
          if (p.type === "payment")    acc.payment    += amt;
          if (p.type === "adjustment") acc.adjustment += amt;
          return acc;
        },
        { advance: 0, payment: 0, adjustment: 0 }
      );

      const allowance = resolveAllowanceAmount({
        staff: staffRes,
        month: selectedMonth,
        allowance: monthlyAllowance,
        isEligible: isAllowanceEligible(currentStats),
      });
      const net       = currentStats.final - (currentStats.bonus || 0);
      const balance   =
        currentStats.final + allowance + historyClosing -
        paymentStats.advance - paymentStats.payment - paymentStats.adjustment;

      setRecords(currentRecords);
      setPayments(currentPayments);
      setSummary({
        ...currentStats,
        ...paymentStats,
        allowance,
        arrears:  historyClosing,
        net: reportBasis === "production" ? productionBaseTotal : net,
        productionBaseTotal,
        reportBasis,
        bonusQty: currentStats.bonusQty,
        bonusAmt: currentStats.bonus,
        balance,
      });
      setGenerated(true);
    } finally {
      setLoadingReport(false);
    }
  };

  const reportRows = useMemo(() => {
    const recordRows = records.flatMap((rec) => {
      const rounds      = Number(rec.totals?.rounds)        || 0;
      const pcs         = Number(rec.totals?.pcs)           || 0;
      const totalStitch = Number(rec.totals?.total_stitch)  || 0;
      const amount      = (Number(rec.final_amount) - Number(rec.bonus_amount)) || 0;
      const onTarget    = (rec.production || []).reduce((s, r) => s + (Number(r.on_target_amt)    || 0), 0);
      const afterTarget = (rec.production || []).reduce((s, r) => s + (Number(r.after_target_amt) || 0), 0);
      const cfg         = rec.config_snapshot || {};
      const targetAmt   = Number(cfg.target_amount) || 0;
      const forceAfter =
        Boolean(rec.force_after_target_for_non_target) ||
        Boolean(rec.force_full_target_for_non_target);
      const ratePct =
        onTarget > 0
          ? (targetAmt > 0 && onTarget >= targetAmt) || forceAfter
            ? `${cfg.after_target_pct ?? cfg.on_target_pct ?? 0}%`
            : `(${cfg.on_target_pct ?? 0}%)`
          : "0%";
      const differ =
        afterTarget > 0
          ? afterTarget - (targetAmt / (cfg.on_target_pct || 1)) * (cfg.after_target_pct || 0)
          : 0;
      const productionAmount = (() => {
        const targetAmount = Number(cfg.target_amount) || 0;
        const targetMet = targetAmount > 0 && onTarget >= targetAmount;
        const forceAfter = Boolean(rec.force_after_target_for_non_target) || Boolean(rec.force_full_target_for_non_target);
        return cfg.payout_mode === "salary_bonus_only"
          ? Number(rec.applique_amount ?? onTarget)
          : targetMet || forceAfter ? afterTarget : onTarget;
      })();
      const isOff = rec.attendance === "Close" || rec.attendance === "Off" || rec.attendance === "Sunday";
      const rowBonusQty = Number(rec.bonus_qty) || 0;
      const typeLabel =
        rowBonusQty > 0
          ? `${rec.attendance || "-"} (${formatBonusQtyDisplay(rowBonusQty)})`
          : rec.attendance || "-";

      const prodRows = (rec.production || []).map((prod) => ({
        date:      rec.date,
        sortOrder: 0,
        rowKind:   "production",
        typeLabel: "-",
        stitches:  formatNumbers(prod.d_stitch || 0),
        roundApp:  `${formatNumbers(prod.rounds || 0)} / ${formatNumbers(prod.applique || 0)}`,
        ratePct:   prod.rate_pct != null ? `${prod.rate_pct}` : "-",
        differ:    "-",
        totalPcs:  formatNumbers(prod.pcs || 0),
        appliqueAmount: "-",
        bonusQty: "-",
        bonusAmount: "-",
        amount:    "-",
        payment:   "-",
      }));

      const dayRow = {
        date:      rec.date,
        sortOrder: 1,
        rowKind:   isOff ? "off" : "day",
        typeLabel,
        stitches:  isOff ? "-" : formatNumbers(totalStitch),
        roundApp:  isOff ? "-" : formatNumbers(rounds),
        ratePct:   isOff ? "-" : ratePct,
        differ:    isOff ? "-" : formatNumbers(differ, 2),
        totalPcs:  isOff ? "-" : formatNumbers(pcs),
        appliqueAmount: formatNumbers(
          rec.applique_amount ?? 0,
          2
        ),
        bonusQty: formatNumbers(rowBonusQty, 0),
        bonusAmount: formatNumbers(rec.bonus_amount || 0, 2),
        amount:    formatNumbers(reportBasis === "production" ? productionAmount : amount, 2),
        payment:   "-",
      };

      return [...prodRows, dayRow];
    });

    const paymentRows = payments.map((p) => ({
      date:      p.date,
      sortOrder: 1,
      rowKind:   "payment",
      typeLabel: p.type ? p.type[0].toUpperCase() + p.type.slice(1) : "Payment",
      stitches:  "-", roundApp: "-", ratePct: "-", differ: "-", totalPcs: "-",
      amount:    "-",
      appliqueAmount: "-",
      bonusQty: "-",
      bonusAmount: "-",
      payment:   formatNumbers(p.amount, 2),
    }));

    return [...recordRows, ...paymentRows].sort((a, b) => {
      const d = getLocalCalendarDate(a.date) - getLocalCalendarDate(b.date);
      return d !== 0 ? d : (a.sortOrder || 0) - (b.sortOrder || 0);
    });
  }, [records, payments, reportBasis]);

  const totalDeduction = summary
    ? summary.advance + summary.payment + summary.adjustment
    : 0;

  const handlePrint = () => {
    if (!summary) return;
    openPrintWindow({
      staffName:      selectedStaffLabel,
      monthLabel:     getMonthLabel(selectedMonth),
      summary,
      reportRows,
      totalDeduction,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-6xl"
      title="Staff Monthly Report"
      subtitle="Month-wise Report with print preview."
      footer={
        <div className="flex justify-between items-center gap-3">
          <div>
            {generated && records.length > 0 && (
              <Button variant="secondary" icon={Printer} onClick={handlePrint}>
                Print Report
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button outline variant="secondary" onClick={onClose}>Close</Button>
            <Button
              icon={loadingReport || reportConfigLoading ? Loader2 : Search}
              onClick={() => (reportConfigId !== "saved" ? handleConfiguredReport() : handleGenerate())}
              loading={loadingReport || reportConfigLoading}
              disabled={!selectedStaff || !selectedMonth || loadingOptions}
            >
              {reportConfigId !== "saved" ? "Generate with selected config" : "Generate Report"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            label="Staff" value={selectedStaff} onChange={handleStaffChange}
            options={staffOptions}
            placeholder={loadingOptions ? "Loading staff..." : "Select staff..."}
            disabled={loadingOptions}
          />
          <Select
            label="Month" value={selectedMonth} onChange={(value) => { setSelectedMonth(value); clearReportPreview(); setGenerated(false); }}
            options={monthOptions}
            placeholder={loadingOptions ? "Loading months..." : "Select month..."}
            disabled={loadingOptions}
          />
          <Select
            label="Report config (optional)"
            value={reportConfigId}
            onChange={(value) => { setReportConfigId(value); clearReportPreview(); setGenerated(false); }}
            options={[
              { label: "Use each record's saved config", value: "saved" },
              ...productionConfigs.map((config) => ({
                label: `${config.effective_date ? new Date(config.effective_date).toLocaleDateString() : "No effective date"} · ${String(config.payout_mode || "Target Based").replaceAll("_", " ")} · Applique ${formatNumbers(config.applique_rate || 0, 3)} · Bonus ${formatNumbers(config.bonus_rate || 0, 2)}`,
                value: config._id,
              })),
            ]}
            placeholder="Use saved config"
            disabled={loadingOptions || !productionConfigs.length}
          />
        </div>

        {reportConfigId !== "saved" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3">
            <p className="text-sm text-gray-600">
              {applyPreview?.applied
                ? `Applied to ${formatNumbers(applyPreview.count, 0)} saved records.`
                : applyPreview
                  ? `${formatNumbers(applyPreview.count, 0)} records ready. Review the before/after breakdown below.`
                  : "Preview the affected record count before permanently applying this config to the selected month."}
            </p>
            <div className="flex gap-2">
              <Button
                icon={applyPreview?.applied ? Search : RotateCcw}
                variant={applyPreview?.applied ? "secondary" : "warning"}
                disabled={applyLoading || applyPreviewLoading || reportConfigLoading || applyPreview?.applied || !selectedStaff || !selectedMonth}
                loading={applyLoading || applyPreviewLoading}
                onClick={() => {
                  if (!applyPreview) {
                    handlePrepareApply();
                  } else if (applyPreview.count > 0) {
                    setApplyConfirmOpen(true);
                  }
                }}
              >
                {applyPreview?.applied
                  ? "Applied"
                  : applyPreview
                    ? applyPreview.count > 0 ? "Apply recalculation" : "No records to apply"
                    : "Check records & review"}
              </Button>
            </div>
          </div>
        )}

        {applyPreview?.records && !applyPreview.applied && (
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
              <h3 className="font-semibold text-gray-900">Recalculation details</h3>
              <p className="mt-1 text-xs text-gray-500">Current saved values compared with the selected config. Payments and monthly allowance stay unchanged.</p>
            </div>
            <div className="max-h-[55vh] overflow-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-gray-500 shadow-sm">
                  <tr>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3 text-right">Base</th>
                    <th className="px-3 py-3 text-right">Applique</th>
                    <th className="px-3 py-3 text-right">Bonus qty</th>
                    <th className="px-3 py-3 text-right">Bonus amount</th>
                    <th className="px-3 py-3 text-right">Final</th>
                    <th className="px-3 py-3 text-right">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {applyPreview.records.map((row) => {
                    const before = row.current || {};
                    const change = (Number(row.final_amount) || 0) - (Number(before.final_amount) || 0);
                    return (
                      <tr key={String(row._id)} className="border-t border-gray-100">
                        <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(row.date)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatNumbers(before.base_amount, 2)} → {formatNumbers(row.base_amount, 2)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatNumbers(before.applique_amount, 2)} → {formatNumbers(row.applique_amount, 2)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatNumbers(before.bonus_qty, 2)} → {formatNumbers(row.bonus_qty, 2)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatNumbers(before.bonus_amount, 2)} → {formatNumbers(row.bonus_amount, 2)}</td>
                        <td className="px-3 py-2.5 text-right font-medium tabular-nums">{formatNumbers(before.final_amount, 2)} → {formatNumbers(row.final_amount, 2)}</td>
                        <td className={`px-3 py-2.5 text-right font-medium tabular-nums ${change < 0 ? "text-rose-700" : change > 0 ? "text-emerald-700" : "text-gray-500"}`}>{change > 0 ? "+" : ""}{formatNumbers(change, 2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 border-t border-gray-200 bg-gray-50 font-semibold">
                  <tr>
                    <td className="px-3 py-3">Month total</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatNumbers(applyPreview.summary.current_base_amount, 2)} → {formatNumbers(applyPreview.summary.recalculated_base_amount, 2)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatNumbers(applyPreview.summary.current_applique_amount, 2)} → {formatNumbers(applyPreview.summary.applique_amount, 2)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatNumbers(applyPreview.summary.current_bonus_qty, 2)} → {formatNumbers(applyPreview.summary.recalculated_bonus_qty, 2)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatNumbers(applyPreview.summary.current_bonus, 2)} → {formatNumbers(applyPreview.summary.recalculated_bonus, 2)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatNumbers(applyPreview.summary.current_amount, 2)} → {formatNumbers(applyPreview.summary.recalculated_amount, 2)}</td>
                    <td className={`px-3 py-3 text-right tabular-nums ${Number(applyPreview.summary.difference) < 0 ? "text-rose-700" : "text-emerald-700"}`}>{Number(applyPreview.summary.difference) > 0 ? "+" : ""}{formatNumbers(applyPreview.summary.difference, 2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        {reportConfigError && <p className="text-sm text-rose-700">{reportConfigError}</p>}

        {selectedStaffHasSalary && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Report basis</span>
            <div className="inline-flex rounded-xl border border-gray-300 bg-gray-50 p-1" role="group" aria-label="Report basis">
              <button
                type="button"
                onClick={() => handleReportBasisChange("salary")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${reportBasis === "salary" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
                aria-pressed={reportBasis === "salary"}
              >Salary</button>
              <button
                type="button"
                onClick={() => handleReportBasisChange("production")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${reportBasis === "production" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
                aria-pressed={reportBasis === "production"}
              >Production</button>
            </div>
          </div>
        )}

        {/* ── Screen Preview ── */}
        {generated && (
          <>
            {records.length === 0 || !summary ? (
              <div className="py-14 text-center text-gray-400 text-sm">
                No records found for this staff / month.
              </div>
            ) : (
              <div className="rounded-3xl border border-gray-300 overflow-hidden bg-white shadow-sm p-5 space-y-4">

                {/* Info grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 border border-gray-300 rounded-2xl overflow-hidden text-sm">
                  {[
                    { l: "Staff Name",              v: selectedStaffLabel },
                    { l: "Month",                   v: getMonthLabel(selectedMonth) },
                    { l: "Arrears",                 v: formatNumbers(summary.arrears, 2) },
                    { l: "Allowance",               v: formatNumbers(summary.allowance, 2) },
                    { l: reportBasis === "production" ? "Production Amount" : "Net Salary", v: formatNumbers(summary.net, 2) },
                    { l: `Bonus (${summary.bonusQty})`, v: formatNumbers(summary.bonusAmt, 2) },
                    { l: "Total Deduction",         v: `-${formatNumbers(totalDeduction, 2)}`, red: true },
                    { l: "Balance",                 v: formatNumbers(summary.balance, 2) },
                  ].map(({ l, v, red }) => (
                    <div key={l} className="px-4 py-3 flex items-center gap-1.5 border-r border-b border-gray-200 last:border-r-0">
                      <p className="text-xs uppercase tracking-wide text-gray-600 shrink-0">{l}:</p>
                      <p className={`font-semibold tabular-nums ${red ? "text-rose-800" : "text-gray-900"}`}>{v}</p>
                    </div>
                  ))}
                </div>

                {/* Detail table */}
                <div className="overflow-auto rounded-xl border border-gray-300">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-800 text-slate-300 uppercase text-xs tracking-wider">
                      <tr>
                        <th className="ps-3 py-2.5">#</th>
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5">Atten. / Type</th>
                        <th className="px-3 py-2.5 text-right">Stitches</th>
                        <th className="px-3 py-2.5 text-right">Round / App.</th>
                        <th className="px-3 py-2.5 text-right">Rate %</th>
                        <th className="px-3 py-2.5 text-right">Differ.</th>
                        <th className="px-3 py-2.5 text-right">Total Pcs</th>
                        <th className="px-3 py-2.5 text-right">Applique Amt.</th>
                        <th className="px-3 py-2.5 text-right">Bonus Qty</th>
                        <th className="px-3 py-2.5 text-right">Bonus Amt.</th>
                        <th className="px-3 py-2.5 text-right">Amount</th>
                        <th className="px-3 py-2.5 text-right">Payment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-300">
                      {reportRows.map((row, idx) => (
                        <tr
                          key={`r-${idx}`}
                          className={
                            row.rowKind === "production"
                              ? "bg-white text-gray-800"
                              : "bg-gray-200/85 text-black"
                          }
                        >
                          <td className="px-2 py-2.5 text-gray-600 text-xs">{idx + 1}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap font-medium">
                            {formatDate(row.date, "dd-MMM-YYYY, DDD")}
                          </td>
                          <td className="px-3 py-2.5">{row.typeLabel}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{row.stitches}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{row.roundApp}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{row.ratePct}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{row.differ}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{row.totalPcs}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{row.appliqueAmount}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{row.bonusQty}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{row.bonusAmount}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{row.amount}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{row.payment}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            )}
          </>
        )}
      </div>
      <ConfirmModal
        isOpen={applyConfirmOpen}
        onClose={() => setApplyConfirmOpen(false)}
        onConfirm={handleApplyRecalculation}
        title="Apply recalculation?"
        message={`Permanently recalculate ${formatNumbers(applyPreview?.count || 0, 0)} saved records for ${selectedStaffLabel} in ${getMonthLabel(selectedMonth)} using the selected config? Final amount: ${formatNumbers(applyPreview?.summary?.current_amount, 2)} → ${formatNumbers(applyPreview?.summary?.recalculated_amount, 2)} (${Number(applyPreview?.summary?.difference) > 0 ? "+" : ""}${formatNumbers(applyPreview?.summary?.difference, 2)}). Calculated amounts and manual fixed-amount or bonus overrides will be replaced. Payments and monthly allowances remain unchanged.`}
        confirmText="Apply recalculation"
        cancelText="Cancel"
        variant="warning"
        isLoading={applyLoading}
      />
    </Modal>
  );
}
