import { useEffect, useMemo, useState } from "react";
import { Loader2, Printer, Search } from "lucide-react";
import Modal from "../Modal";
import Button from "../Button";
import Select from "../Select";
import { fetchStaffNames } from "../../api/staff";
import { fetchCrpStaffRecords } from "../../api/crpStaffRecord";
import { formatDate, formatNumbers } from "../../utils";

function openPrintWindow({ staffName, monthLabel, summary, rows }) {
  const generatedOn = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const infoItems = [
    { l: "Staff", v: staffName },
    { l: "Month", v: monthLabel },
    { l: "Total Records", v: formatNumbers(summary.total_records, 0) },
    { l: "Total Qty (Dzn)", v: formatNumbers(summary.total_quantity_dzn, 2) },
    { l: "Total Amount", v: formatNumbers(summary.total_amount, 2) },
  ];

  const infoHtml = infoItems
    .map(
      (item) => `
      <div class="info-item">
        <span class="lbl">${item.l}:</span>
        <span class="val">${item.v}</span>
      </div>`
    )
    .join("");

  const rowHtml = rows
    .map(
      (row, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${formatDate(row.order_date, "DD MMM yyyy")}</td>
        <td>${row.order_description || "-"}</td>
        <td class="r">${formatNumbers(row.quantity_dzn, 2)}</td>
        <td>${row.category || "-"}</td>
        <td>${row.type_name || "-"}</td>
        <td class="r">${formatNumbers(row.rate, 2)}</td>
        <td class="r bold">${formatNumbers(row.total_amount, 2)}</td>
      </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>CRP Report - ${staffName} - ${monthLabel}</title>
<style>
  * { box-sizing: border-box; }
  @page { size: A4 portrait; margin: 12mm; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    margin: 0;
    color: #111827;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    font-size: 12px;
  }
  .sheet { width: 100%; }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 12px;
  }
  .title { font-size: 20px; font-weight: 700; }
  .muted { color: #6b7280; font-size: 11px; }
  .info-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    border: 1px solid #d1d5db;
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 12px;
  }
  .info-item {
    border-right: 1px solid #e5e7eb;
    padding: 10px 12px;
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .info-item:last-child { border-right: none; }
  .lbl { color: #6b7280; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
  .val { font-weight: 700; }
  table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #d1d5db;
    border-radius: 12px;
    overflow: hidden;
  }
  thead tr { background: #1f2937; color: #d1d5db; }
  th, td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; text-align: left; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
  td { font-size: 11px; }
  .r { text-align: right; }
  .bold { font-weight: 700; }
  tfoot td {
    background: #111827;
    color: #fff;
    font-weight: 800;
    border-bottom: none;
  }
  .footer {
    margin-top: 10px;
    border-top: 1px solid #d1d5db;
    padding-top: 8px;
    display: flex;
    justify-content: space-between;
    color: #6b7280;
    font-size: 10px;
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      <div>
        <div class="title">CRP Staff Monthly Report</div>
        <div class="muted">Cropping Category Report</div>
      </div>
      <div class="muted">Generated: ${generatedOn}</div>
    </div>

    <div class="info-grid">${infoHtml}</div>

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
      <tbody>${rowHtml}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" class="r">Total</td>
          <td class="r">${formatNumbers(summary.total_quantity_dzn, 2)}</td>
          <td colspan="3"></td>
          <td class="r">${formatNumbers(summary.total_amount, 2)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="footer">
      <span>EmbroideryOS</span>
      <span>${staffName} · ${monthLabel}</span>
    </div>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=1024,height=768");
  if (!win) return;
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

    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        const [staffRes, recordsRes] = await Promise.all([
          fetchStaffNames({ status: "active", category: "Cropping" }),
          fetchCrpStaffRecords({ page: 1, limit: 5000 }),
        ]);

        const staffs = (staffRes?.data || []).map((s) => ({
          label: s.name,
          value: s._id,
        }));

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
    };

    loadOptions();
  }, [isOpen]);

  const selectedStaffLabel = useMemo(
    () => staffOptions.find((s) => s.value === selectedStaff)?.label || "—",
    [staffOptions, selectedStaff]
  );

  const handleGenerate = async () => {
    if (!selectedStaff || !selectedMonth) return;

    setLoadingReport(true);
    try {
      const res = await fetchCrpStaffRecords({ page: 1, limit: 5000, month: selectedMonth });
      const filtered = (res?.data || []).filter((r) => {
        const id = String(r?.staff_id?._id || r?.staff_id || "");
        return id === String(selectedStaff);
      });

      const sorted = [...filtered].sort(
        (a, b) => new Date(a?.order_date || 0).getTime() - new Date(b?.order_date || 0).getTime()
      );

      const total_quantity_dzn = sorted.reduce((sum, r) => sum + Number(r?.quantity_dzn || 0), 0);
      const total_amount = sorted.reduce((sum, r) => sum + Number(r?.total_amount || 0), 0);

      setRows(sorted);
      setSummary({
        total_records: sorted.length,
        total_quantity_dzn,
        total_amount,
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
              <div className="py-14 text-center text-sm text-gray-400">
                No CRP records found for this staff / month.
              </div>
            ) : (
              <div className="rounded-3xl border border-gray-300 overflow-hidden bg-white shadow-sm p-5 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 border border-gray-300 rounded-2xl overflow-hidden text-sm">
                  {[
                    { l: "Staff", v: selectedStaffLabel },
                    { l: "Month", v: selectedMonth },
                    { l: "Total Records", v: formatNumbers(summary.total_records, 0) },
                    { l: "Total Qty (Dzn)", v: formatNumbers(summary.total_quantity_dzn, 2) },
                    { l: "Total Amount", v: formatNumbers(summary.total_amount, 2) },
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
                        <tr key={row._id || `${row.order_id || "r"}-${idx}`} className={idx % 2 === 0 ? "bg-white" : "bg-gray-100"}>
                          <td className="px-3 py-2.5">{idx + 1}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(row.order_date, "DD MMM yyyy")}</td>
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
                        <td colSpan={3} className="px-3 py-2.5 text-right font-bold tracking-wider text-slate-300 uppercase">Total</td>
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
