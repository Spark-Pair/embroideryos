import { useEffect, useMemo, useState } from "react";
import { Loader2, Printer, Search } from "lucide-react";
import Modal from "../Modal";
import Button from "../Button";
import Select from "../Select";
import { fetchStaff, fetchStaffNames } from "../../api/staff";
import { fetchStaffRecordMonths, fetchStaffRecords } from "../../api/staffRecord";
import { fetchStaffPayments } from "../../api/staffPayment";
import { fetchProductionConfig } from "../../api/productionConfig";
import { formatDate, formatNumbers } from "../../utils";
import {
  getMonthKeyFromDate,
  getMonthLabel,
  getPreviousMonthKey,
  isAllowanceEligible,
  toMonthWindow,
} from "../../utils/salarySlip";

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
    { l: "Net Salary",              v: formatNumbers(summary.net, 2) },
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
    border-bottom: 0.5pt solid #fff; /* divide-y divide-white */
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
    color: #646769;
    margin-top: 10pt;
    border-top: 0.5pt solid #646769;
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
  if (payment.date) return new Date(payment.date) <= new Date(prevMonthEnd);
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
  const [staffOptions,   setStaffOptions]   = useState([]);
  const [monthOptions,   setMonthOptions]   = useState([]);
  const [selectedStaff,  setSelectedStaff]  = useState("");
  const [selectedMonth,  setSelectedMonth]  = useState("");
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loadingReport,  setLoadingReport]  = useState(false);
  const [records,   setRecords]   = useState([]);
  const [payments,  setPayments]  = useState([]);
  const [summary,   setSummary]   = useState(null);
  const [staffData, setStaffData] = useState(null);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        setLoadingOptions(true);
        const [staffRes, monthsRes] = await Promise.all([
          fetchStaffNames({ status: "active", category: "Embroidery" }),
          fetchStaffRecordMonths(),
        ]);
        const staffs = (staffRes.data  || [])
          .filter((s) => String(s?.category || "Embroidery") === "Embroidery")
          .map((s) => ({ label: s.name, value: s._id }));
        const months = (monthsRes.data || []).map((m) => ({ label: getMonthLabel(m), value: m    }));
        setStaffOptions(staffs);
        setMonthOptions(months);
        setSelectedStaff(staffs[0]?.value || "");
        setSelectedMonth(months[0]?.value || "");
        setRecords([]); setPayments([]); setSummary(null); setStaffData(null); setGenerated(false);
      } catch {
        setStaffOptions([]); setMonthOptions([]);
      } finally {
        setLoadingOptions(false);
      }
    })();
  }, [isOpen]);

  const selectedStaffLabel = useMemo(
    () => staffOptions.find((s) => s.value === selectedStaff)?.label || "—",
    [staffOptions, selectedStaff]
  );

  const handleGenerate = async () => {
    if (!selectedStaff || !selectedMonth) return;
    try {
      setLoadingReport(true);
      const { from, to }  = toMonthWindow(selectedMonth);
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

      const currentRecords  = currentRecordsRes.data  || [];
      const currentPayments = currentPaymentsRes.data || [];
      const historyRecords  = historyRecordsRes.data  || [];
      const historyPayments = historyPaymentsRes.data || [];
      const openingBalance  = Number(staffRes?.opening_balance) || 0;

      const historyMonths = historyRecords
        .map((r) => getMonthKeyFromDate(r.date))
        .filter(Boolean)
        .filter((m) => m <= prevMonthKey);

      const allowanceByMonth = await buildAllowanceByMonth([...historyMonths, selectedMonth]);
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
          historyClosing += data.finalAmount + (isAllowanceEligible(data) ? al : 0);
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

      const allowance = isAllowanceEligible(currentStats) ? monthlyAllowance : 0;
      const net       = currentStats.final - (currentStats.bonus || 0);
      const balance   =
        currentStats.final + allowance + historyClosing -
        paymentStats.advance - paymentStats.payment - paymentStats.adjustment;

      setRecords(currentRecords);
      setPayments(currentPayments);
      setStaffData(staffRes);
      setSummary({
        ...currentStats,
        ...paymentStats,
        allowance,
        arrears:  historyClosing,
        net,
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
      const ratePct =
        onTarget > 0
          ? targetAmt > 0 && onTarget >= targetAmt
            ? `${cfg.after_target_pct ?? cfg.on_target_pct ?? 0}%`
            : `(${cfg.on_target_pct ?? 0}%)`
          : "0%";
      const differ =
        afterTarget > 0
          ? afterTarget - (targetAmt / (cfg.on_target_pct || 1)) * (cfg.after_target_pct || 0)
          : 0;
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
        amount:    formatNumbers(amount, 2),
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
      payment:   formatNumbers(p.amount, 2),
    }));

    return [...recordRows, ...paymentRows].sort((a, b) => {
      const d = new Date(a.date) - new Date(b.date);
      return d !== 0 ? d : (a.sortOrder || 0) - (b.sortOrder || 0);
    });
  }, [records, payments]);

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
              icon={loadingReport ? Loader2 : Search}
              onClick={handleGenerate}
              loading={loadingReport}
              disabled={!selectedStaff || !selectedMonth || loadingOptions}
            >
              Generate Report
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Staff" value={selectedStaff} onChange={setSelectedStaff}
            options={staffOptions}
            placeholder={loadingOptions ? "Loading staff..." : "Select staff..."}
            disabled={loadingOptions}
          />
          <Select
            label="Month" value={selectedMonth} onChange={setSelectedMonth}
            options={monthOptions}
            placeholder={loadingOptions ? "Loading months..." : "Select month..."}
            disabled={loadingOptions}
          />
        </div>

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
                    { l: "Net Salary",              v: formatNumbers(summary.net, 2) },
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
                        <th className="px-3 py-2.5 text-right">Amount</th>
                        <th className="px-3 py-2.5 text-right">Payment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white">
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
    </Modal>
  );
}
