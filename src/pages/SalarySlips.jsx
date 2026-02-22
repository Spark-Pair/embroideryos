// pages/SalarySlips.jsx

import React, { useState } from "react";
import { Printer, Search, ChevronDown } from "lucide-react";
import { fetchStaffRecords } from "../api/staffRecord";
import PageHeader from "../components/PageHeader";
import { useToast } from "../context/ToastContext";
import { formatNumbers } from "../utils";

// ── Month options ─────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const buildMonthOptions = () => {
  const opts = [];
  const now  = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({
      label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    });
  }
  return opts;
};

const MONTH_OPTIONS = buildMonthOptions();

// ── Screen Slip Card — ORIGINAL STYLING, UNTOUCHED ───────────────────────────

function SlipCard({ emp }) {
  const amount   = Number(emp.amount)   || 0;
  const arrears  = Number(emp.arrears)  || 0;
  const advance  = Number(emp.advance)  || 0;
  const bonusQty = Number(emp.bonusQty) || 0;
  const bonusAmt = Number(emp.bonusAmt) || 0;
  const total    = Number(emp.total)    || 0;

  return (
    <div key={emp._id} className="border border-gray-500 rounded-2xl overflow-hidden print-slip break-inside-avoid p-1.5">
        <div className="bg-teal-700/20 py-2.5 px-4.5 flex items-center justify-between rounded-xl">
            <h3 className="font-semibold text-lg tracking-wide text-gray-900 capitalize text-nowrap">{emp.name || 'EMPLOYEE NAME'}</h3>
            <p className="text-teal-800 font-medium text-base text-nowrap">{emp.month}</p>
        </div>

        <div className="p-2 text-sm space-y-2">
            <div className="flex justify-between px-1.5">
                <span className="text-gray-800">Arrears:</span>
                <span className={`font-medium ${arrears < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatNumbers(arrears, 2)}
                </span>
            </div>
            <hr className='border-gray-500'/>
            <div className="flex justify-between px-1.5">
                <span className="text-gray-800">Amount:</span>
                <span className="font-medium text-gray-800">{formatNumbers(amount, 2)}</span>
            </div>
            <hr className='border-gray-500'/>
            <div className="flex justify-between px-1.5">
                <span className="text-gray-800">Bonus ({bonusQty} units):</span>
                <span className="font-medium text-gray-800">{formatNumbers(bonusAmt, 2)}</span>
            </div>
            <hr className='border-gray-500'/>
            <div className="flex justify-between px-1.5">
                <span className="text-gray-800">Advance:</span>
                <span className="font-medium text-red-600">-{formatNumbers(advance, 2)}</span>
            </div>
        </div>
        
        <div className="bg-teal-700/20 py-2 px-3.5 flex items-center justify-between rounded-lg">
            <h3 className="font-semibold tracking-wide text-base text-gray-900 capitalize">Net Amount:</h3>
            <p className="text-teal-800 font-medium text-sm">{formatNumbers(total, 2)}</p>
        </div>

        <div className="mt-2 py-2 px-3 text-sm border border-gray-500 rounded-xl">
            <div className="">
            <span className="font-medium text-gray-700 mr-2 whitespace-nowrap">Payment:</span>
            <div className="line h-5 border-b border-dashed border-gray-600 w-[98%] mx-auto"></div>
            </div>
        </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SalarySlipsPage() {
  const { showToast } = useToast();

  const [filterMode,    setFilterMode]    = useState("month");
  const [selectedMonth, setSelectedMonth] = useState(MONTH_OPTIONS[1].value);
  const [dateFrom,      setDateFrom]      = useState("");
  const [dateTo,        setDateTo]        = useState("");
  const [slips,         setSlips]         = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [generated,     setGenerated]     = useState(false);

  const getMonthLabel = () => {
    if (filterMode === "month") {
      const [yr, mo] = selectedMonth.split("-");
      return `${MONTH_NAMES[parseInt(mo) - 1]} ${yr}`;
    }
    return `${dateFrom} to ${dateTo}`;
  };

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setGenerated(false);

      let from = dateFrom;
      let to   = dateTo;

      if (filterMode === "month") {
        const [yr, mo] = selectedMonth.split("-");
        from = `${yr}-${mo}-01`;
        const lastDay = new Date(parseInt(yr), parseInt(mo), 0).getDate();
        to   = `${yr}-${mo}-${String(lastDay).padStart(2, "0")}`;
      } else {
        if (!from || !to) {
          showToast({ type: "error", message: "Please select both From and To dates" });
          return;
        }
      }

      const res     = await fetchStaffRecords({ date_from: from, date_to: to, limit: 1000 });
      const records = res.data || [];
      const label   = getMonthLabel();

      const grouped = {};
      records.forEach((rec) => {
        const id   = rec.staff_id?._id ?? rec.staff_id;
        const name = rec.staff_id?.name ?? "Unknown";

        if (!grouped[id]) {
          grouped[id] = { id, name, month: label, amount: 0, arrears: 0, advance: 0, bonusQty: 0, bonusAmt: 0, total: 0 };
        }

        const g        = grouped[id];
        const finalAmt = rec.final_amount  ?? 0;
        const bAmt     = rec.bonus_amount  ?? 0;
        const bQty     = rec.bonus_qty     ?? 0;

        g.total    += finalAmt;
        g.bonusQty += bQty;
        g.bonusAmt += bAmt;
        g.amount   += Math.max(0, finalAmt - bAmt);
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

  // ── Print: inject @media print to isolate only the slips grid ───────────────
  const handlePrint = () => {
    const styleId = "__slip_print_style__";
    document.getElementById(styleId)?.remove();

    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
      @media print {
        @page { size: A4 portrait; margin: 8mm; }

        /* Hide everything */
        body * { visibility: hidden !important; }

        /* Show slips root + all its descendants */
        #salary-slips-print-root,
        #salary-slips-print-root * { visibility: visible !important; }

        /* Take over the full page */
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

        /* Force the inner grid to render correctly */
        #salary-slips-print-root > div {
          display: grid !important;
          grid-template-columns: repeat(2, 1fr) !important;
          gap: 12px !important;
          width: 100% !important;
        }

        /* Each slip card — block + no page break inside */
        #salary-slips-print-root > div > div {
          display: block !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
          box-sizing: border-box !important;
          width: 100% !important;
        }

        /* Fix flex rows inside each card */
        #salary-slips-print-root .flex {
          display: flex !important;
        }
      }
    `;
    document.head.appendChild(style);

    window.print();

    window.addEventListener("afterprint", () => {
      document.getElementById(styleId)?.remove();
    }, { once: true });
  };

  const grandTotal = slips.reduce((s, sl) => s + sl.total, 0);

  return (
    <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col">

      <PageHeader
        title="Salary Slips"
        subtitle="Generate and print monthly salary slips for all staff."
      />

      {/* ── Filter Bar ─────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-300 rounded-3xl p-6 mb-6 flex flex-wrap gap-4 items-end">

        {/* Mode toggle */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Filter By</label>
          <div className="flex rounded-xl border border-gray-300 overflow-hidden">
            {[
              { value: "month",     label: "Month"      },
              { value: "dateRange", label: "Date Range" },
            ].map((m) => (
              <button
                key={m.value}
                onClick={() => setFilterMode(m.value)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  filterMode === m.value
                    ? "bg-[#127475] text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {filterMode === "month" ? (
          <div className="flex flex-col gap-1.5 min-w-52">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Month</label>
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full appearance-none border border-gray-300 rounded-xl px-4 py-2 pr-9 text-sm text-gray-800 focus:ring-2 focus:ring-teal-300 focus:outline-none bg-white"
              >
                {MONTH_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        ) : (
          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-teal-300 focus:outline-none" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-teal-300 focus:outline-none" />
            </div>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#127475] text-white rounded-xl text-sm font-semibold hover:bg-teal-700 transition-colors disabled:opacity-60 shadow-sm"
        >
          {loading ? (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
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

      {/* ── States ─────────────────────────────────────────────────────────── */}
      {!generated && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-20 bg-white border border-gray-200 rounded-3xl">
          <p className="text-gray-700 font-semibold text-lg">No Slips Generated</p>
          <p className="text-gray-400 text-sm mt-1">Select a month or date range and click "Generate Slips"</p>
        </div>
      )}

      {generated && slips.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center py-20 bg-white border border-gray-200 rounded-3xl">
          <p className="text-gray-500 font-medium">No records found for the selected period.</p>
        </div>
      )}

      {/* ── Screen Preview ──────────────────────────────────────────────────── */}
      {generated && slips.length > 0 && (
        <>
          <h1 className="text-2xl font-extrabold text-gray-800 text-center mb-5">
            Salary Slip Preview — {slips.length} slips
          </h1>

          {/*
            id="salary-slips-print-root" is what the print CSS targets.
            Same SlipCards, same Tailwind classes — screen and print are identical.
          */}
          <div id="salary-slips-print-root">
            <div className="grid grid-cols-3 gap-4">
              {slips.map((slip) => (
                <SlipCard key={slip.id} emp={slip} />
              ))}
            </div>
          </div>

          {/* Grand Total — screen only, print CSS hides it automatically */}
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