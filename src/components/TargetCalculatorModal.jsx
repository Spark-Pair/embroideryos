import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import Modal from "./Modal";
import Button from "./Button";
import { SectionHeader } from "./SectionHeader";
import { formatNumbers } from "../utils";
import { fetchProductionConfig } from "../api/productionConfig";
import {
  EMPTY_PRODUCTION_CONFIG,
  calculateProductionRow,
  calculateProductionTotals,
  getModeSummary,
  getProductionAmountLabels,
  getTargetProgress,
  isTargetMode,
  normalizeProductionConfig,
} from "../utils/productionPayout";

// ─── Constants ────────────────────────────────────────────────────────────────

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayInput = () => new Date().toISOString().slice(0, 10);
const emptyRow   = () => ({ _key: crypto.randomUUID(), d_stitch: "", applique: "", pcs: "", rounds: "" });

function calcRow(row, cfg) {
  return calculateProductionRow(row, cfg);
}

function syncPcsRounds(field, value, pcsPerRound) {
  const num = parseFloat(value);
  if (!value || isNaN(num) || num <= 0)
    return { pcs: field === "pcs" ? value : "", rounds: field === "rounds" ? value : "" };
  if (field === "pcs")
    return { pcs: value, rounds: String(Math.ceil(num / pcsPerRound)) };
  return { pcs: String(num * pcsPerRound), rounds: value };
}

function calcTotals(rows, cfg) {
  return calculateProductionTotals(rows, cfg);
}

// ─── Production Row ───────────────────────────────────────────────────────────

function ProductionRow({ row, index, cfg, onChange, onRemove, canRemove, onAddRow, isLast }) {
  const { total_stitch, on_target_amt, after_target_amt } = calcRow(row, cfg);
  const amountLabels = getProductionAmountLabels(cfg);

  const handleFocus = (e) => e.target.select();

  const handle = (field) => (e) => {
    const val = e.target.value;
    if (field === "pcs" || field === "rounds")
      onChange(row._key, { ...row, ...syncPcsRounds(field, val, cfg.pcs_per_round || 0) });
    else
      onChange(row._key, { ...row, [field]: val });
  };

  const handleKeyDown = (field) => (e) => {
    if (!isLast) return;
    if (field !== "pcs" && field !== "rounds") return;
    if (e.key === "Enter") { e.preventDefault(); onAddRow(); }
  };

  const ci = "w-full border border-gray-400/85 px-2.5 py-1.5 rounded-lg text-sm focus:ring-2 focus:ring-emerald-300 focus:outline-none bg-gray-50 transition";

  return (
    <tr className="group border-b border-gray-300 hover:bg-emerald-50/30 transition-colors">
      <td className="px-1.5 py-2 text-center text-xs font-medium text-gray-400 w-8">{index + 1}</td>
      <td className="px-1.5 py-2">
        <input type="number" value={row.d_stitch} onChange={handle("d_stitch")} onFocus={handleFocus} placeholder="0" className={ci} />
      </td>
      <td className="px-1.5 py-2">
        <input type="number" value={row.applique} onChange={handle("applique")} onFocus={handleFocus} placeholder="0" className={ci} />
      </td>
      <td className="px-1.5 py-2">
        <input type="number" value={row.rounds} onChange={handle("rounds")} onFocus={handleFocus} onKeyDown={handleKeyDown("rounds")} placeholder="0" className={ci} />
      </td>
      <td className="px-1.5 py-2">
        <input type="number" value={row.pcs} onChange={handle("pcs")} onFocus={handleFocus} onKeyDown={handleKeyDown("pcs")} placeholder="0" className={ci} />
      </td>
      <td className="px-3 py-2 text-right text-sm text-gray-600 tabular-nums">{formatNumbers(total_stitch, 0)}</td>
      <td className="px-3 py-2 text-right text-sm font-medium text-rose-700 tabular-nums">{formatNumbers(on_target_amt, 2)}</td>
      {amountLabels.secondary && (
        <td className="px-3 py-2 text-right text-sm font-medium text-emerald-700 tabular-nums">{formatNumbers(after_target_amt, 2)}</td>
      )}
      <td className="px-3 py-2 text-center w-8">
        <button
          type="button"
          onClick={() => onRemove(row._key)}
          className={`${canRemove ? "opacity-70 pointer-events-auto group-hover:opacity-100" : "opacity-0 pointer-events-none"} transition-opacity rounded-lg p-1 text-gray-300 hover:text-red-500 cursor-pointer`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

function TotalsRow({ totals, cfg }) {
  const amountLabels = getProductionAmountLabels(cfg);
  return (
    <tr className="border-t border-gray-300 bg-gray-50/80 font-semibold text-sm">
      <td className="px-3.5 py-2.5 text-xs text-gray-500 uppercase tracking-wider" colSpan={3}>Totals</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{formatNumbers(totals.rounds, 0)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{formatNumbers(totals.pcs, 0)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{formatNumbers(totals.total_stitch, 0)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-rose-700">{formatNumbers(totals.on_target_amt, 2)}</td>
      {amountLabels.secondary && (
        <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">{formatNumbers(totals.after_target_amt, 2)}</td>
      )}
      <td />
    </tr>
  );
}



// ─── Main Component ───────────────────────────────────────────────────────────

export default function TargetCalculatorModal({ onClose }) {
  const [cfgDate,    setCfgDate]    = useState(todayInput());
  const [cfg,        setCfg]        = useState(EMPTY_PRODUCTION_CONFIG);
  const [cfgLoading, setCfgLoading] = useState(false);
  const [rows,       setRows]       = useState([emptyRow()]);

  // ── Load config on date change ──
  useEffect(() => {
    if (!cfgDate) return;
    const load = async () => {
      setCfgLoading(true);
      try {
        const res = await fetchProductionConfig(cfgDate);
        setCfg(res?.data ? normalizeProductionConfig(res.data) : normalizeProductionConfig(EMPTY_PRODUCTION_CONFIG));
      } catch {
        setCfg(normalizeProductionConfig(EMPTY_PRODUCTION_CONFIG));
      } finally {
        setCfgLoading(false);
      }
    };
    load();
  }, [cfgDate]);

  const totals = useMemo(() => calcTotals(rows, cfg), [rows, cfg]);
  const amountLabels = getProductionAmountLabels(cfg);
  const targetState = getTargetProgress(totals, cfg);
  const targetAmount = cfg.target_amount || 0;
  const targetMet = targetState.targetMet;
  const targetMode = isTargetMode(cfg);

  // ── Row handlers ──
  const handleRowChange = (key, updated) =>
    setRows((p) => p.map((r) => (r._key === key ? updated : r)));

  const handleRowRemove = (key) =>
    setRows((p) => (p.length <= 1 ? p : p.filter((r) => r._key !== key)));

  const handleAddRow = () => {
    setRows((p) => [...p, emptyRow()]);
    setTimeout(() => {
      const inputs = document.querySelectorAll('input[placeholder="0"]');
      // focus d_stitch of last row — find last group of 4 inputs
      if (inputs.length) inputs[inputs.length - 4]?.focus();
    }, 30);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Target Calculator"
      subtitle="Uses same production calculation as staff record configuration for selected date."
      maxWidth="max-w-4xl"
      footer={
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-400">
            {cfgLoading
              ? <span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Loading config…</span>
              : `Config loaded for ${cfgDate || "—"}`
            }
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" outline onClick={onClose}>Close</Button>
            <Button icon={Plus} onClick={handleAddRow}>Add Row</Button>
          </div>
        </div>
      }
    >
      <div className="h-full overflow-scroll p-0.5 grid gap-3">

        {/* ── Step 1: Config Date + Stats ── */}
        <div className="flex flex-col">
          <SectionHeader
            step="1"
            title="Configuration"
            subtitle="Pick a date to load the production rates for that day"
          />
          <div className="grid grid-cols-5 gap-3">

            {/* Date — styled as a plain field, no Input component wrapper needed */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Config Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={cfgDate}
                  onChange={(e) => setCfgDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 transition"
                />
                {cfgLoading && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-gray-400" />
                )}
              </div>
            </div>

            {/* Read-only config stats — same as Staff Record subtitle info, but as blocks */}
            {[
              { label: "Stitch Rate",    value: formatNumbers(cfg.stitch_rate, 3) },
              { label: "Applique Rate",  value: formatNumbers(cfg.applique_rate, 3) },
              { label: "Payout Mode",    value: getModeSummary(cfg) },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">{label}</label>
                <div className="border border-gray-300 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 bg-gray-50 tabular-nums select-none">
                  {cfgLoading ? <span className="text-gray-300">—</span> : value}
                </div>
              </div>
            ))}

          </div>
        </div>

        {/* ── Step 2: Production Table ── */}
        <div className="flex flex-col">
          <SectionHeader
            step="2"
            title="Production Entry"
            subtitle={`${cfg.pcs_per_round ? `${cfg.pcs_per_round} PCs/Round` : "PCs/Round not set"}${cfg.stitch_cap ? ` · Stitch Cap: ${formatNumbers(cfg.stitch_cap, 0)}` : ""}`}
            right={
              <Button size="sm" variant="primary" outline icon={Plus} onClick={handleAddRow}>
                Add Row
              </Button>
            }
          />

          {cfgLoading ? (
            <div className="rounded-xl border border-gray-300 bg-white py-10 flex items-center justify-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading production configuration…
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-300">
              <table className="w-full min-w-[680px] border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-300 text-xs font-semibold text-gray-500">
                    <th className="px-1.5 py-2.5 text-center w-8">#</th>
                    <th className="px-1.5 py-2.5 text-left">D. Stitch</th>
                    <th className="px-1.5 py-2.5 text-left">Applique</th>
                    <th className="px-1.5 py-2.5 text-left">Rounds</th>
                    <th className="px-1.5 py-2.5 text-left">PCs</th>
                    <th className="px-3 py-2.5 text-right text-nowrap">Total Stitch</th>
                    <th className="px-3 py-2.5 text-right text-nowrap text-rose-600">{amountLabels.primary}</th>
                    {amountLabels.secondary && (
                      <th className="px-3 py-2.5 text-right text-nowrap text-emerald-600">{amountLabels.secondary}</th>
                    )}
                    <th className="px-2 py-2.5 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <ProductionRow
                      key={row._key}
                      row={row}
                      index={idx}
                      cfg={cfg}
                      onChange={handleRowChange}
                      onRemove={handleRowRemove}
                      onAddRow={handleAddRow}
                      isLast={idx === rows.length - 1}
                      canRemove={rows.length > 1}
                    />
                  ))}
                </tbody>
                <tfoot>
                  <TotalsRow totals={totals} cfg={cfg} />
                </tfoot>
              </table>
            </div>
          )}

          {/* ── Target Status Bar ── */}
          {targetMode && totals.on_target_amt > 0 && (
            <div className={`flex items-center mt-2 gap-3 rounded-xl px-4 py-2.5 text-xs
              ${targetMet ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
              {targetMet
                ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                : <AlertCircle  className="h-4 w-4 text-amber-500 shrink-0" />
              }
              {targetMet ? (
                <span className="text-emerald-700">
                  <span className="font-semibold">Target Met</span>
                  {" "}— Effective amount (After Target):{" "}
                  <span className="font-bold">{formatNumbers(totals.after_target_amt, 2)}</span>
                </span>
              ) : (
                <span className="text-amber-700">
                  <span className="font-semibold">
                    {formatNumbers(targetAmount - totals.on_target_amt, 2)} short
                  </span>
                  {" "}of target · Current:{" "}
                  <span className="font-semibold">{formatNumbers(totals.on_target_amt, 2)}</span>
                  {" "}· Target: {formatNumbers(targetAmount, 2)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Summary ── */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: "Total Pcs",    value: formatNumbers(totals.pcs, 0),              color: "text-gray-800" },
            { label: "Total Rounds", value: formatNumbers(totals.rounds, 0),            color: "text-gray-800" },
            { label: "Total Stitch", value: formatNumbers(totals.total_stitch, 0),      color: "text-gray-800" },
            { label: amountLabels.summaryPrimary, value: formatNumbers(totals.on_target_amt, 2), color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200" },
            ...(amountLabels.summarySecondary ? [{ label: amountLabels.summarySecondary, value: formatNumbers(totals.after_target_amt, 2), color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" }] : []),
          ].map(({ label, value, color, bg = "bg-white", border = "border-gray-200" }) => (
            <div key={label} className={`rounded-2xl border ${border} ${bg} px-4 py-3.5`}>
              <p className="text-[10px] uppercase tracking-wider font-medium text-gray-400 mb-1">{label}</p>
              <p className={`text-lg font-semibold tabular-nums ${color}`}>{value}</p>
            </div>
          ))}
        </div>

      </div>
    </Modal>
  );
}
