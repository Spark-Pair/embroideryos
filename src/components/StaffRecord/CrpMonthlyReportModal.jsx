import { useEffect, useMemo, useState } from "react";
import { Loader2, Printer, Search } from "lucide-react";
import Modal from "../Modal";
import Button from "../Button";
import Select from "../Select";
import { fetchStaff, fetchStaffNames } from "../../api/staff";
import { fetchCrpStaffRecords } from "../../api/crpStaffRecord";
import { fetchStaffPayments } from "../../api/staffPayment";
import { formatDate, formatNumbers } from "../../utils";
import { getPreviousMonthKey, toMonthWindow } from "../../utils/salarySlip";

function getPaymentInHistory(payment, prevMonthKey, prevMonthEnd) {
  if (typeof payment.month === "string" && payment.month) return payment.month <= prevMonthKey;
  if (payment.date) return new Date(payment.date) <= new Date(prevMonthEnd);
  return false;
}

function openPrintWindow({ staffName, monthLabel, summary, rows }) {
  const genDate = new Date().toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });

  const infoItems = [
    { l: "Staff", v: staffName },
    { l: "Month", v: monthLabel },
    { l: "Arrears", v: formatNumbers(summary.arrears, 2) },
    { l: "Total Records", v: formatNumbers(summary.total_records, 0) },
    { l: "Total Amount", v: formatNumbers(summary.total_amount, 2) },
    { l: "Balance", v: formatNumbers(summary.balance, 2) },
  ];

  const infoHtml = infoItems.map(({ l, v }) => `
    <div class="ic">
      <span class="ic-lbl">${l}:</span>
      <span class="ic-val">${v}</span>
    </div>`).join("");

  const rowsHtml = rows.map((row, idx) => `
    <tr class="${idx % 2 === 0 ? "row-even" : "row-odd"}">
      <td class="td-num">${idx + 1}</td>
      <td class="td-date">${formatDate(row.order_date, "DD MMM yyyy")}</td>
      <td>${row.order_description || "-"}</td>
      <td class="r">${formatNumbers(row.quantity_dzn, 2)}</td>
      <td>${row.category || "-"}</td>
      <td>${row.type_name || "-"}</td>
      <td class="r">${formatNumbers(row.rate, 2)}</td>
      <td class="r bold">${formatNumbers(row.total_amount, 2)}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>CRP Report - ${staffName} - ${monthLabel}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @page {
    size: A4 portrait;
    margin: 0.4in 0.4in 0.4in 0.5in;
  }

  @media print {
    html { zoom: 100%; }
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

  .info-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
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
  .ic:nth-child(3n) { border-right: none; }
  .ic:nth-last-child(-n+3) { border-bottom: none; }
  .ic-lbl { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.06em; color: #555; white-space: nowrap; }
  .ic-val { font-weight: 600; color: #111; font-variant-numeric: tabular-nums; }

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
  tr { page-break-inside: avoid; }

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
    border-bottom: 0.5pt solid #e5e7eb;
    vertical-align: middle;
    color: #111;
  }
  td.r { text-align: right; }
  td.bold { font-weight: 600; }
  td.td-num { font-size: 7.5pt; color: #555; }
  td.td-date { white-space: nowrap; font-weight: 500; }

  tr.row-even { background: #fff; }
  tr.row-odd { background: #f3f4f6; }

  tfoot td {
    background: #1e293b;
    color: #fff;
    font-weight: 700;
    border-bottom: none;
    padding: 6pt 5pt;
  }
  tfoot td.r { text-align: right; }

  .print-footer {
    display: flex;
    justify-content: space-between;
    font-size: 7pt;
    color: #555;
    margin-top: 10pt;
    border-top: 0.5pt solid #111;
    padding-top: 5pt;
  }
</style>
</head>
<body>
<div>
  <div class="info-grid">${infoHtml}</div>

  <div class="tbl-wrap">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Date</th>
          <th>Description</th>
          <th class="r">Qty (Dzn)</th>
          <th>Category</th>
          <th>Type</th>
          <th class="r">Rate</th>
          <th class="r">Amount</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" class="r">Total</td>
          <td class="r">${formatNumbers(summary.total_quantity_dzn, 2)}</td>
          <td colspan="3"></td>
          <td class="r">${formatNumbers(summary.total_amount, 2)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <div class="print-footer">
    <span>Generated: ${genDate} - Copyright SparkPair - Confidential</span>
    <span>EmbroideryOS | ${staffName} - ${monthLabel}</span>
  </div>
</div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=960,height=780");
  if (!win) { alert("Pop-up blocked - please allow pop-ups for this site."); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  const closePrintWindow = () => { try { win.close(); } catch { /* no-op */ } };
  const handleAfterPrint = () => setTimeout(closePrintWindow, 100);
  win.addEventListener("afterprint", handleAfterPrint);
  win.onafterprint = handleAfterPrint;
  setTimeout(() => win.print(), 500);
}

export default function CrpMonthlyReportModal({ isOpen, onClose }) {
  const [staffOptions, setStaffOptions] = useState([]);
  const [monthOptions, setMonthOptions] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [generated, setGenerated] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      setLoadingOptions(true);
      try {
        const [staffRes, recordsRes] = await Promise.all([
          fetchStaffNames({ status: "active", category: "Cropping" }),
          fetchCrpStaffRecords({ page: 1, limit: 5000 }),
        ]);

        const staffs = (staffRes?.data || []).map((s) => ({ label: s.name, value: s._id }));

        const monthSet = new Set(
          (recordsRes?.data || [])
            .map((r) => String(r?.month || "").trim())
            .filter(Boolean)
        );
        const months = Array.from(monthSet)
          .sort((a, b) => b.localeCompare(a))
          .map((m) => ({ label: m, value: m }));

        setStaffOptions(staffs);
        setMonthOptions(months);
        setSelectedStaff(staffs[0]?.value || "");
        setSelectedMonth(months[0]?.value || "");
        setRows([]);
        setSummary(null);
        setGenerated(false);
      } catch {
        setStaffOptions([]);
        setMonthOptions([]);
      } finally {
        setLoadingOptions(false);
      }
    })();
  }, [isOpen]);

  const selectedStaffLabel = useMemo(
    () => staffOptions.find((s) => s.value === selectedStaff)?.label || "-",
    [staffOptions, selectedStaff]
  );

  const handleGenerate = async () => {
    if (!selectedStaff || !selectedMonth) return;
    setLoadingReport(true);
    try {
      const prevMonthKey = getPreviousMonthKey(selectedMonth);
      const prevMonthMeta = toMonthWindow(prevMonthKey);

      const [staffRes, currentRes, historyRes, historyPaymentsRes] = await Promise.all([
        fetchStaff(selectedStaff),
        fetchCrpStaffRecords({ page: 1, limit: 5000, month: selectedMonth }),
        fetchCrpStaffRecords({ page: 1, limit: 20000, staff_id: selectedStaff, date_to: prevMonthMeta.to }),
        fetchStaffPayments({ staff_id: selectedStaff, limit: 20000 }),
      ]);

      const currentFiltered = (currentRes?.data || []).filter((r) => {
        const id = String(r?.staff_id?._id || r?.staff_id || "");
        return id === String(selectedStaff);
      });

      const historyRecords = historyRes?.data || [];
      const historyPayments = historyPaymentsRes?.data || [];
      const openingBalance = Number(staffRes?.opening_balance) || 0;

      let historyClosing = openingBalance;
      historyRecords.forEach((rec) => {
        const recMonth = String(rec?.month || "");
        if (recMonth && recMonth <= prevMonthKey) {
          historyClosing += Number(rec?.total_amount || 0);
        }
      });
      historyPayments.forEach((p) => {
        if (!getPaymentInHistory(p, prevMonthKey, prevMonthMeta.to)) return;
        const amt = Number(p.amount) || 0;
        if (p.type === "adjustment") historyClosing += amt;
        if (p.type === "advance" || p.type === "payment") historyClosing -= amt;
      });

      const sorted = [...currentFiltered].sort(
        (a, b) => new Date(a?.order_date || 0) - new Date(b?.order_date || 0)
      );

      const total_quantity_dzn = sorted.reduce((sum, r) => sum + Number(r?.quantity_dzn || 0), 0);
      const total_amount = sorted.reduce((sum, r) => sum + Number(r?.total_amount || 0), 0);

      setRows(sorted);
      setSummary({
        total_records: sorted.length,
        total_quantity_dzn,
        total_amount,
        arrears: historyClosing,
        balance: historyClosing - total_amount,
      });
      setGenerated(true);
    } finally {
      setLoadingReport(false);
    }
  };

  const handlePrint = () => {
    if (!summary) return;
    openPrintWindow({
      staffName: selectedStaffLabel,
      monthLabel: selectedMonth,
      summary,
      rows,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-6xl"
      title="CRP Staff Monthly Report"
      subtitle="Generate month-wise report for cropping staff records"
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <div>
            {generated && rows.length > 0 && (
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="CRP Staff"
            value={selectedStaff}
            onChange={setSelectedStaff}
            options={staffOptions}
            placeholder={loadingOptions ? "Loading staff..." : "Select staff..."}
            disabled={loadingOptions}
          />
          <Select
            label="Month"
            value={selectedMonth}
            onChange={setSelectedMonth}
            options={monthOptions}
            placeholder={loadingOptions ? "Loading months..." : "Select month..."}
            disabled={loadingOptions}
          />
        </div>

        {generated && (
          <>
            {rows.length === 0 || !summary ? (
              <div className="py-14 text-center text-gray-400 text-sm">
                No CRP records found for this staff / month.
              </div>
            ) : (
              <div className="rounded-3xl border border-gray-300 overflow-hidden bg-white shadow-sm p-5 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 border border-gray-300 rounded-2xl overflow-hidden text-sm">
                  {[
                    { l: "Staff", v: selectedStaffLabel },
                    { l: "Month", v: selectedMonth },
                    { l: "Arrears", v: formatNumbers(summary.arrears, 2) },
                    { l: "Total Records", v: formatNumbers(summary.total_records, 0) },
                    { l: "Total Amount", v: formatNumbers(summary.total_amount, 2) },
                    { l: "Balance", v: formatNumbers(summary.balance, 2) },
                  ].map(({ l, v }) => (
                    <div key={l} className="px-4 py-3 flex items-center gap-1.5 border-r border-b border-gray-200 last:border-r-0">
                      <p className="text-xs uppercase tracking-wide text-gray-600 shrink-0">{l}:</p>
                      <p className="font-semibold tabular-nums text-gray-900">{v}</p>
                    </div>
                  ))}
                </div>

                <div className="overflow-auto rounded-xl border border-gray-300">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-800 text-slate-300 uppercase text-xs tracking-wider">
                      <tr>
                        <th className="px-3 py-2.5">#</th>
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5">Description</th>
                        <th className="px-3 py-2.5 text-right">Qty (Dzn)</th>
                        <th className="px-3 py-2.5">Category</th>
                        <th className="px-3 py-2.5">Type</th>
                        <th className="px-3 py-2.5 text-right">Rate</th>
                        <th className="px-3 py-2.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white">
                      {rows.map((row, idx) => (
                        <tr
                          key={row._id || `r-${idx}`}
                          className={idx % 2 === 0 ? "bg-white text-gray-800" : "bg-gray-200/85 text-black"}
                        >
                          <td className="px-2 py-2.5 text-gray-600 text-xs">{idx + 1}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap font-medium">{formatDate(row.order_date, "DD MMM yyyy")}</td>
                          <td className="px-3 py-2.5">{row.order_description || "-"}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatNumbers(row.quantity_dzn, 2)}</td>
                          <td className="px-3 py-2.5">{row.category || "-"}</td>
                          <td className="px-3 py-2.5">{row.type_name || "-"}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatNumbers(row.rate, 2)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{formatNumbers(row.total_amount, 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-800">
                        <td colSpan={3} className="px-3 py-2.5 text-right font-bold tracking-wider text-slate-300 uppercase text-xs">Total</td>
                        <td className="px-3 py-2.5 text-right font-bold text-white tabular-nums">{formatNumbers(summary.total_quantity_dzn, 2)}</td>
                        <td colSpan={3} />
                        <td className="px-3 py-2.5 text-right font-extrabold text-white tabular-nums">{formatNumbers(summary.total_amount, 2)}</td>
                      </tr>
                    </tfoot>
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
