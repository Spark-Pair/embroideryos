import {
  Edit3, User, Layers, Gift, Lock, CheckCircle2,
  AlertCircle, TrendingUp, CalendarDays, Hash,
  Info,
} from "lucide-react";
import Button from "../Button";
import Modal from "../Modal";
import { formatDate } from "../../utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n, d = 0) =>
  n == null || isNaN(n)
    ? "—"
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const ATTENDANCE_META = {
  Day:    "bg-emerald-100 text-emerald-700 border-emerald-200",
  Night:  "bg-indigo-100  text-indigo-700  border-indigo-200",
  Half:   "bg-amber-100   text-amber-700   border-amber-200",
  Absent: "bg-red-100     text-red-700     border-red-200",
  Off:    "bg-sky-100     text-sky-700     border-sky-200",
  Close:  "bg-gray-100    text-gray-600    border-gray-300",
  Sunday: "bg-violet-100  text-violet-700  border-violet-200",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoGrid({ children, col = 2 }) {
  return <div className={`grid grid-cols-${col}`}>{children}</div>;
}

function InfoCell({ label, value, valueClass = "", fullWidth = false }) {
  return (
    <div className={`flex items-center justify-center gap-1 py-1 border-r last:border-r-0 border-gray-300 ${fullWidth ? "col-span-full" : ""}`}>
      <span className="text-sm font-semibold text-gray-500 tracking-wide">{label}:</span>
      <span className={`text-sm font-semibold text-gray-800 tracking-wide ${valueClass}`}> {value ?? "—"}</span>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, color = "text-gray-500" }) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <Icon className={`h-4 w-4 ${color}`} />
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider leading-0">{title}</span>
      <div className="flex-1 h-px bg-gray-300" />
    </div>
  );
}

function StatBox({ label, value, valueClass = "text-gray-800" }) {
  return (
    <div className="flex flex-col items-center justify-center bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 gap-0.5">
      <span className={`text-lg font-bold tabular-nums ${valueClass}`}>{value}</span>
      <span className="text-[11px] text-gray-400 font-medium text-center leading-tight">{label}</span>
    </div>
  );
}

// ── Production Rows Table ─────────────────────────────────────────────────────

function ProductionRowsTable({ rows, snapshot }) {
  if (!rows?.length) return null;

  return (
    <div className="rounded-xl border border-gray-300 overflow-hidden mt-1">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-300 text-xs text-gray-400">
            <th className="px-3 py-2.5 text-center w-8">#</th>
            <th className="px-3 py-2.5 text-right">D. Stitch</th>
            <th className="px-3 py-2.5 text-right">Applique</th>
            <th className="px-3 py-2.5 text-right">PCs</th>
            <th className="px-3 py-2.5 text-right">Rounds</th>
            <th className="px-3 py-2.5 text-right">Total Stitch</th>
            <th className="px-3 py-2.5 text-right text-rose-500">
              ({snapshot?.on_target_pct ?? "—"}%)
            </th>
            <th className="px-3 py-2.5 text-right text-emerald-600">
              ({snapshot?.after_target_pct ?? "—"}%)
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50/60 transition-colors">
              <td className="px-3 py-2.5 text-center text-xs text-gray-400 font-medium">{i + 1}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{fmt(row.d_stitch)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{fmt(row.applique)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-gray-700">{fmt(row.pcs)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{fmt(row.rounds)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{fmt(row.total_stitch)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-rose-600">{fmt(row.on_target_amt, 2)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-emerald-600">{fmt(row.after_target_amt, 2)}</td>
            </tr>
          ))}
        </tbody>
        {/* Totals footer */}
        {rows.length > 1 && (
          <tfoot>
            <tr className="bg-gray-50 border-t border-gray-300 text-sm font-bold text-gray-500">
              <td className="px-3.5 py-2.5 text-left text-gray-400" colSpan={3}>Totals</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">
                {fmt(rows.reduce((s, r) => s + (r.pcs || 0), 0))}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">
                {fmt(rows.reduce((s, r) => s + (r.rounds || 0), 0))}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">
                {fmt(rows.reduce((s, r) => s + (r.total_stitch || 0), 0))}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-rose-600">
                {fmt(rows.reduce((s, r) => s + (r.on_target_amt || 0), 0), 2)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600">
                {fmt(rows.reduce((s, r) => s + (r.after_target_amt || 0), 0), 2)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ─── Final Amount Card ────────────────────────────────────────────────────────

function FinalAmountCard({ amount, isFixed, breakdown }) {
  if (!amount && amount !== 0) return null;
  return (
    <div className={`rounded-2xl px-3 py-2.5 border ${isFixed ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"}`}>
      <div className="flex items-center justify-between px-1.5">
        <div className="flex items-center gap-2">
          {isFixed
            ? <Lock className="h-4 w-4 text-amber-600" />
            : <CheckCircle2 className="h-4 w-4 text-gray-600" />
          }
          <span className={`text-sm font-semibold ${isFixed ? "text-amber-700" : "text-gray-700"}`}>
            {isFixed ? "Final Amount (Fixed)" : "Final Amount"}
          </span>
        </div>
        <span className={`text-2xl font-bold tabular-nums ${isFixed ? "text-amber-700" : "text-gray-700"}`}>
          {fmt(amount, 2)}
        </span>
      </div>
      {breakdown && (
        <div className={`mt-2 p-2 pb-1 border-t ${isFixed ? "border-amber-200" : "border-gray-200"} flex flex-wrap gap-x-4 gap-y-1`}>
          {breakdown.map((item, i) => (
            <span key={i} className={`text-xs ${isFixed ? "text-amber-600" : "text-gray-600"}`}>
              {item.label}: <span className="font-semibold">{fmt(item.value, 2)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function StaffRecordDetailsModal({ isOpen, onClose, initialData, onAction }) {
  if (!initialData) return null;

  const staff          = initialData.staff_id;
  const attendance     = initialData.attendance;
  const totals         = initialData.totals;
  const snapshot       = initialData.config_snapshot;
  const isFixed        = initialData.fix_amount != null;
  const hasBonus       = initialData.bonus_amount > 0;
  const hasProduction  = totals != null && initialData.production?.length > 0;
  const productionRows = initialData.production?.length ?? 0;

  // ── Target logic ──────────────────────────────────────────────────────────
  const targetAmount = snapshot?.target_amount ?? null;
  const targetMet    = totals && targetAmount != null
    ? totals.on_target_amt >= targetAmount
    : false;

  const effectivePct = isFixed ? null : targetMet ? snapshot?.after_target_pct : snapshot?.on_target_pct;
  const effectiveAmt = targetMet ? totals?.after_target_amt : totals?.on_target_amt;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Details"
      subtitle="Complete breakdown of this daily entry"
      maxWidth="max-w-3xl"
      footer={
        <Button
          icon={Edit3}
          variant="secondary"
          className="w-full"
          onClick={() => onAction("openEdit", initialData)}
        >
          Edit Record
        </Button>
      }
    >
      <div className="flex flex-col gap-3 pb-2">

        {/* ── 1. Staff + Date + Attendance ─────────────────────────────────── */}
        <div>
          <SectionHeader icon={Info} title="Basic Info" />
          <InfoGrid col={3}>
            <InfoCell label="Staff Name" value={staff?.name} />
            <InfoCell label="Date" value={formatDate(initialData.date, "dd-MMM-YYYY, DDD")} />
            <InfoCell label="Attendance" value={attendance} />
          </InfoGrid>
        </div>

        {/* ── 2. Production ────────────────────────────────────────────────── */}
        {hasProduction && (
          <div>
            <SectionHeader icon={Layers} title={`Production — ${productionRows} ${productionRows === 1 ? "Row" : "Rows"}`} />

            {/* Individual rows table */}
            <ProductionRowsTable rows={initialData.production} snapshot={snapshot} />

            {/* Target status bar */}
            
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
                  <span className="font-bold">{fmt(totals.after_target_amt, 2)}</span>
                </span>
              ) : (
                <span className="text-amber-700">
                  <span className="font-semibold">
                    {fmt(snapshot.target_amount - totals.on_target_amt, 2)} short
                  </span>
                  {" "}of target · Current:{" "}
                  <span className="font-semibold">{fmt(totals.on_target_amt, 2)}</span>
                  {" "}· Target: {fmt(snapshot.target_amount, 2)}
                </span>
              )}
            </div>

            {/* Effective amount row */}
            {!isFixed && effectivePct != null && (
              <div className="mt-2 flex items-center justify-between px-1">
                <span className="text-xs text-gray-400 font-medium">
                  Effective production amount ({effectivePct}% applied)
                </span>
                <span className="text-sm font-bold text-gray-700 tabular-nums">{fmt(effectiveAmt, 2)}</span>
              </div>
            )}
          </div>
        )}

        {/* ── 3. Bonus ─────────────────────────────────────────────────────── */}
        {hasBonus && (
          <div>
            <SectionHeader icon={Gift} title="Bonus" />
            <InfoGrid col={3}>
              <InfoCell label="Qty" value={fmt(initialData.bonus_qty)} />
              <InfoCell label="Rate / Bonus" value={fmt(initialData.bonus_rate, 2)} />
              <InfoCell label="Total Bonus" value={fmt(initialData.bonus_amount, 2)} />
            </InfoGrid>
          </div>
        )}

        {/* ── 4. Final Amount ───────────────────────────────────────────────── */}
        <FinalAmountCard
          amount={initialData.final_amount}
          isFixed={isFixed}
          breakdown={[
            ...(totals ? [{ label: "Effective Production", value: effectiveAmt }] : []),
            ...(hasBonus ? [{ label: "Bonus Amount", value: initialData.bonus_amount }] : []),
          ]}
        />

        {/* ── 5. Config Snapshot (collapsible) ─────────────────────────────── */}
        {snapshot && (
          <details className="group">
            <summary className="cursor-pointer select-none list-none flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 font-semibold">
              <Hash className="h-3.5 w-3.5" />
              Config at time of entry
              <span className="ml-auto text-gray-300 group-open:rotate-90 transition-transform inline-block text-base leading-none">›</span>
            </summary>
            <div className="mt-3 rounded-xl border border-gray-300 bg-gray-50 overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-gray-200">
                {[
                  { label: "Stitch Rate",        value: snapshot.stitch_rate },
                  { label: "Applique Rate",       value: snapshot.applique_rate },
                  { label: "On Target %",         value: `${snapshot.on_target_pct}%` },
                  { label: "After Target %",      value: `${snapshot.after_target_pct}%` },
                  { label: "Target Amount",       value: fmt(snapshot.target_amount, 2) },
                  { label: "PCs / Round",         value: snapshot.pcs_per_round },
                  { label: "Off Amount",          value: fmt(snapshot.off_amount, 2) },
                  { label: "Default Bonus Rate",  value: fmt(snapshot.bonus_rate, 2) },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-0.5 px-4 py-2.5 border-b border-gray-300 [&:nth-last-child(-n+2)]:border-0"
                  >
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{item.label}</span>
                    <span className="text-sm font-semibold text-gray-700">{item.value ?? "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          </details>
        )}

      </div>
    </Modal>
  );
}