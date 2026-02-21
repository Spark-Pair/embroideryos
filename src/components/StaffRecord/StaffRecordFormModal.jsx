import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2, Gift, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import Modal from "../Modal";
import Button from "../Button";
import Input from "../Input";
import Select from "../Select";
import { fetchStaffs } from "../../api/staff";
import { fetchStaffLastRecord } from "../../api/staffRecord";
import { fetchProductionConfig } from "../../api/productionConfig";

// ─── Constants ────────────────────────────────────────────────────────────────

const ATTENDANCE_OPTIONS = [
  { label: "Day",    value: "Day" },
  { label: "Night",  value: "Night" },
  { label: "Half",   value: "Half" },
  { label: "Absent", value: "Absent" },
  { label: "Off",    value: "Off" },
  { label: "Close",  value: "Close" },
  { label: "Sunday", value: "Sunday" },
];

const ATTENDANCE_META = {
  Day:    { color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  Night:  { color: "bg-indigo-100  text-indigo-700  border-indigo-200"  },
  Half:   { color: "bg-amber-100   text-amber-700   border-amber-200"   },
  Absent: { color: "bg-red-100     text-red-700     border-red-200"     },
  Off:    { color: "bg-sky-100     text-sky-700     border-sky-200"     },
  Close:  { color: "bg-gray-100    text-gray-600    border-gray-200"    },
  Sunday: { color: "bg-violet-100  text-violet-700  border-violet-200"  },
};

const NO_PRODUCTION = new Set(["Absent", "Off", "Close", "Sunday"]);
const NO_BONUS      = new Set(["Absent", "Close"]);

const DEFAULT_CONFIG = {
  stitch_rate:      0.001,
  applique_rate:    1.111,
  on_target_pct:    30,
  after_target_pct: 34,
  target_amount:    900,
  pcs_per_round:    12,
  bonus_rate:       200,
  off_amount:       300,
  stitch_cap:       5000,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const emptyRow = () => ({
  _key: crypto.randomUUID(),
  d_stitch: "", applique: "", pcs: "", rounds: "",
});

const toDateInput = (d) => d ? new Date(d).toISOString().split("T")[0] : "";

function resolveDate(joiningDate, lastRecordDate) {
  const jd = joiningDate ? new Date(joiningDate) : null;
  const lr = lastRecordDate ? new Date(lastRecordDate) : null;

  if (!jd && !lr) return "";

  if (jd && !lr) return toDateInput(jd);

  if (lr && !jd) {
    const n = new Date(lr);
    n.setDate(n.getDate() + 1);
    return toDateInput(n);
  }

  // ✅ changed condition
  if (lr >= jd) {
    const n = new Date(lr);
    n.setDate(n.getDate() + 1);
    return toDateInput(n);
  }

  return toDateInput(jd);
}

// ─── Calculation Engine ───────────────────────────────────────────────────────

function calcRow(row, cfg) {
  const stitchRaw = parseFloat(row.d_stitch) || 0;
  const pcs       = parseFloat(row.pcs)      || 0;
  const rounds    = parseFloat(row.rounds)   || 0;
  const applique  = parseFloat(row.applique) || 0;
  const stitch    = stitchRaw > 0 && stitchRaw <= (cfg.stitch_cap ?? DEFAULT_CONFIG.stitch_cap)
    ? (cfg.stitch_cap ?? DEFAULT_CONFIG.stitch_cap)
    : stitchRaw;

  const stitch_rate      = cfg.stitch_rate      ?? DEFAULT_CONFIG.stitch_rate;
  const applique_rate    = cfg.applique_rate    ?? DEFAULT_CONFIG.applique_rate;
  const on_target_pct    = cfg.on_target_pct    ?? DEFAULT_CONFIG.on_target_pct;
  const after_target_pct = cfg.after_target_pct ?? DEFAULT_CONFIG.after_target_pct;

  const total_stitch     = stitchRaw * rounds;
  const stitch_base      = stitch * stitch_rate * pcs / 100;
  const applique_base    = applique_rate * applique * pcs / 100;
  const combined         = stitch_base + applique_base;
  const on_target_amt    = combined * on_target_pct;
  const after_target_amt = combined * after_target_pct;

  return { total_stitch, on_target_amt, after_target_amt };
}

function syncPcsRounds(field, value, pcsPerRound) {
  const num = parseFloat(value);
  if (!value || isNaN(num) || num <= 0)
    return { pcs: field === "pcs" ? value : "", rounds: field === "rounds" ? value : "" };
  if (field === "pcs") return { pcs: value, rounds: String(Math.ceil(num / pcsPerRound)) };
  return { pcs: String(num * pcsPerRound), rounds: value };
}

function calcTotals(rows, cfg) {
  return rows.reduce(
    (acc, row) => {
      const { total_stitch, on_target_amt, after_target_amt } = calcRow(row, cfg);
      return {
        pcs:              acc.pcs    + (parseFloat(row.pcs)    || 0),
        rounds:           acc.rounds + (parseFloat(row.rounds) || 0),
        total_stitch:     acc.total_stitch     + total_stitch,
        on_target_amt:    acc.on_target_amt    + on_target_amt,
        after_target_amt: acc.after_target_amt + after_target_amt,
      };
    },
    { pcs: 0, rounds: 0, total_stitch: 0, on_target_amt: 0, after_target_amt: 0 }
  );
}

const fmt = (n, d = 0) =>
  n == null || isNaN(n) ? "—"
  : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ step, title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between border-t border-gray-300 pt-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#127475] text-white text-xs font-bold shrink-0">
          {step}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">{title}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

// ─── Production Row ───────────────────────────────────────────────────────────

function ProductionRow({ row, index, cfg, onChange, onRemove, canRemove }) {
  const { total_stitch, on_target_amt, after_target_amt } = calcRow(row, cfg);

  const handle = (field) => (e) => {
    const val = e.target.value;
    if (field === "pcs" || field === "rounds")
      onChange(row._key, { ...row, ...syncPcsRounds(field, val, cfg.pcs_per_round ?? DEFAULT_CONFIG.pcs_per_round) });
    else
      onChange(row._key, { ...row, [field]: val });
  };

  const ci = "w-full border border-gray-400/85 px-2.5 py-1.5 rounded-lg text-sm focus:ring-2 focus:ring-emerald-300 focus:outline-none bg-gray-50 transition";

  return (
    <tr className="group border-b border-gray-300 hover:bg-emerald-50/30 transition-colors">
      <td className="px-1.5 py-2 text-center text-xs font-medium text-gray-400 w-8">{index + 1}</td>
      <td className="px-1.5 py-2">
        <input type="number" value={row.d_stitch} onChange={handle("d_stitch")} placeholder="0" className={ci} />
      </td>
      <td className="px-1.5 py-2">
        <input type="number" value={row.applique} onChange={handle("applique")} placeholder="0" className={ci} />
      </td>
      <td className="px-1.5 py-2">
        <input type="number" value={row.pcs} onChange={handle("pcs")} placeholder="0" className={ci} />
      </td>
      <td className="px-1.5 py-2">
        <input type="number" value={row.rounds} onChange={handle("rounds")} placeholder="0" className={ci} />
      </td>
      <td className="px-3 py-2 text-right text-sm text-gray-600 tabular-nums">{fmt(total_stitch)}</td>
      <td className="px-3 py-2 text-right text-sm font-medium text-rose-700 tabular-nums">{fmt(on_target_amt, 2)}</td>
      <td className="px-3 py-2 text-right text-sm font-medium text-emerald-700 tabular-nums">{fmt(after_target_amt, 2)}</td>
      <td className="px-3 py-2 text-center w-8">
        <button
          type="button"
          onClick={() => onRemove(row._key)}
          className={`${canRemove ? 'opacity-70 pointer-events-auto group-hover:opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity rounded-lg p-1 text-gray-300 hover:text-red-500 cursor-pointer`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

function TotalsRow({ totals }) {
  return (
    <tr className="border-t border-gray-300 bg-gray-50/80 font-semibold text-sm">
      <td className="px-3.5 py-2.5 text-xs text-gray-500 uppercase tracking-wider" colSpan={3}>Totals</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{fmt(totals.pcs)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{fmt(totals.rounds)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{fmt(totals.total_stitch)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-rose-700">{fmt(totals.on_target_amt, 2)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">{fmt(totals.after_target_amt, 2)}</td>
      <td />
    </tr>
  );
}

// ─── Final Amount Card ────────────────────────────────────────────────────────

function FinalAmountCard({ amount, isFixed, breakdown }) {
  if (!amount && amount !== 0) return null;
  return (
    <div className={`rounded-2xl px-3 py-2.5 border ${isFixed ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
      <div className="flex items-center justify-between px-1.5">
        <div className="flex items-center gap-2">
          {isFixed
            ? <Lock className="h-4 w-4 text-amber-600" />
            : <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          }
          <span className={`text-sm font-semibold ${isFixed ? "text-amber-700" : "text-emerald-700"}`}>
            {isFixed ? "Final Amount (Fixed)" : "Final Amount"}
          </span>
        </div>
        <span className={`text-2xl font-bold tabular-nums ${isFixed ? "text-amber-700" : "text-emerald-700"}`}>
          {fmt(amount, 2)}
        </span>
      </div>
      {breakdown && (
        <div className={`mt-2 p-2 pb-1 border-t ${isFixed ? "border-amber-200" : "border-emerald-200"} flex flex-wrap gap-x-4 gap-y-1`}>
          {breakdown.map((item, i) => (
            <span key={i} className={`text-xs ${isFixed ? "text-amber-600" : "text-emerald-600"}`}>
              {item.label}: <span className="font-semibold">{fmt(item.value, 2)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StaffRecordFormModal({
  isOpen,
  onClose,
  initialData = null,
  onAction,
  lastUsed,
  setLastUsed,
}) {
  const isEdit = !!initialData;

  // ── State ──
  const [cfg,           setCfg]           = useState(DEFAULT_CONFIG);
  const [cfgLoading,    setCfgLoading]    = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [date,          setDate]          = useState("");
  const [attendance,    setAttendance]    = useState("");
  const [rows,          setRows]          = useState([emptyRow()]);
  const [bonusQty,      setBonusQty]      = useState("");
  const [bonusRate,     setBonusRate]     = useState("");
  const [fixAmount,     setFixAmount]     = useState("");
  const [submitting,    setSubmitting]    = useState(false);
  const [staffList,     setStaffList]     = useState([]);
  const [staffLoading,  setStaffLoading]  = useState(false);
  const [dateLoading,   setDateLoading]   = useState(false);
  const [isAutoSelectStaff, setIsAutoSelectStaff] = useState(false);

  // ── Fetch config when date changes ──
  useEffect(() => {
    if (!date) return;
    const load = async () => {
      setCfgLoading(true);
      try {
        const res = await fetchProductionConfig(date);
        const data = res?.data;
        setCfg(data ? { ...DEFAULT_CONFIG, ...data } : DEFAULT_CONFIG);
      } catch {
        setCfg(DEFAULT_CONFIG);
      } finally {
        setCfgLoading(false);
      }
    };
    load();
  }, [date]);

  // ── Reset + load staff on open ──
  useEffect(() => {
    if (!isOpen) return;
    if (!isEdit) {
      setSelectedStaff(null);
      setDate("");
      setAttendance("");
      setRows([emptyRow()]);
      setBonusQty("");
      setBonusRate("");
      setFixAmount("");
      setCfg(DEFAULT_CONFIG);
    }

    const load = async () => {
      setStaffLoading(true);
      try {
        const r = await fetchStaffs({ limit: 200, status: "active" });
        setStaffList(r.data || []);
      } catch {
        setStaffList([]);
      } finally {
        setStaffLoading(false);

        if (lastUsed?.staffId && !isEdit) {
          handleStaffSelect(lastUsed.staffId);
          setIsAutoSelectStaff(true);
        }

        if (lastUsed?.attendanceHistory?.last && !isEdit && lastUsed?.attendanceHistory?.last !== "Sunday") {
          handleAttendance(lastUsed.attendanceHistory.last);
        } else if (lastUsed?.attendanceHistory?.secondLast && !isEdit && lastUsed?.attendanceHistory?.secondLast !== "Sunday") {
          handleAttendance(lastUsed.attendanceHistory.secondLast);
        }
      }
    };
    load();
  }, [isOpen]);

  // ── Pre-fill on edit ──
  useEffect(() => {
    if (!isOpen || !isEdit || !initialData) return;
    setSelectedStaff(initialData.staff_id);
    setDate(toDateInput(initialData.date));
    handleAttendance(initialData.attendance || "");
    setBonusQty(initialData.bonus_qty   ? String(initialData.bonus_qty)   : "");
    setBonusRate(initialData.bonus_rate  ? String(initialData.bonus_rate)  : "");
    setFixAmount(initialData.fix_amount != null ? String(initialData.fix_amount) : "");
    setRows(
      initialData.production?.length
        ? initialData.production.map((r) => ({
            _key: crypto.randomUUID(),
            d_stitch: String(r.d_stitch ?? ""),
            applique: String(r.applique ?? ""),
            pcs:      String(r.pcs      ?? ""),
            rounds:   String(r.rounds   ?? ""),
          }))
        : [emptyRow()]
    );
  }, [isOpen, isEdit, initialData]);

  // ── Auto-set Sunday attendance ──
  useEffect(() => {
    if (!date) return;
    const day = new Date(date).getDay();
    if (day === 0) {
      handleAttendance("Sunday");
    } else if (!isAutoSelectStaff) {
      handleAttendance("");
    }
  }, [date]);

  // ── Staff select ──
  const handleStaffSelect = async (staffId) => {
    setIsAutoSelectStaff(false);
    if (!staffId) { setSelectedStaff(null); setDate(""); return; }
    const staff = staffList.find((s) => s._id === staffId);
    setSelectedStaff(staff);
    setDateLoading(true);
    try {
      const res = await fetchStaffLastRecord(staffId);
      console.log(res);
      
      setDate(resolveDate(staff?.joining_date, res.data?.last_record_date ?? null));
      setLastUsed((prev) => ({ ...prev, staffId }));
    } catch {
      setDate(resolveDate(staff?.joining_date, null));
    } finally {
      setDateLoading(false);
    }
  };

  const handleAttendance = (val) => {
    setAttendance(val);
    setLastUsed((prev) => ({
      ...prev,
      attendanceHistory: {
        last:     val,
        secondLast: prev?.attendanceHistory?.last ?? null,
      },
    }));
  };

  // ── Derived ──
  const showProduction = attendance && !NO_PRODUCTION.has(attendance);
  const showBonus      = attendance && !NO_BONUS.has(attendance);
  const totals         = calcTotals(rows, cfg);

  const handleRowChange = useCallback((key, updated) =>
    setRows((p) => p.map((r) => r._key === key ? updated : r)), []);
  const handleRowRemove = useCallback((key) =>
    setRows((p) => p.filter((r) => r._key !== key)), []);

  // ── Final amount preview ──
  const effectiveBonusRate = parseFloat(bonusRate) || cfg.bonus_rate || DEFAULT_CONFIG.bonus_rate;
  const bonusAmount        = (parseFloat(bonusQty) || 0) * effectiveBonusRate;

  const hasSalary     = selectedStaff?.salary > 0;
  const salary        = selectedStaff?.salary || 0;
  const targetMet     = totals.on_target_amt >= (cfg.target_amount ?? DEFAULT_CONFIG.target_amount);
  const productionAmt = showProduction
    ? (targetMet ? totals.after_target_amt : totals.on_target_amt)
    : 0;

  let previewBase = 0;
  if (attendance === "Absent" || attendance === "Close") {
    previewBase = 0;
  } else if (attendance === "Sunday") {
    previewBase = hasSalary ? salary / 30 : 0;
  } else if (attendance === "Off") {
    previewBase = hasSalary ? salary / 30 : (cfg.off_amount ?? DEFAULT_CONFIG.off_amount);
  } else if (attendance === "Half") {
    previewBase = hasSalary ? salary / 60 : productionAmt;
  } else {
    previewBase = hasSalary ? salary / 30 : productionAmt;
  }

  const previewFinal  = fixAmount !== "" ? parseFloat(fixAmount) || 0 : previewBase + bonusAmount;
  const isFixed       = fixAmount !== "";
  const showFinalCard = attendance !== "";

  const breakdownItems = isFixed
    ? [
        ...(previewBase  > 0 ? [{ label: "Base (ignored)", value: previewBase }]  : []),
        ...(bonusAmount  > 0 ? [{ label: "Bonus (ignored)", value: bonusAmount }] : []),
        { label: "Fix Amount applied", value: parseFloat(fixAmount) || 0 },
      ]
    : [
        ...(previewBase  > 0 ? [{ label: hasSalary ? "Salary-based" : "Production", value: previewBase }] : []),
        ...(bonusAmount  > 0 ? [{ label: "Bonus", value: bonusAmount }] : []),
      ];

  const staffName = typeof selectedStaff === "object"
    ? selectedStaff?.name
    : staffList.find((s) => s._id === selectedStaff)?.name;

  // ── Submit ──
  const handleSubmit = async () => {
    if (!selectedStaff || !date || !attendance) return;
    setSubmitting(true);
    try {
      const staffId = typeof selectedStaff === "object" ? selectedStaff._id : selectedStaff;
      const payload = {
        staff_id:   staffId,
        date,
        attendance,
        production: showProduction
          ? rows.map((r) => ({
              d_stitch: parseFloat(r.d_stitch) || 0,
              applique: parseFloat(r.applique) || 0,
              pcs:      parseFloat(r.pcs)      || 0,
              rounds:   parseFloat(r.rounds)   || 0,
            }))
          : [],
        bonus_qty:  bonusQty  ? parseInt(bonusQty)    : 0,
        bonus_rate: bonusRate ? parseFloat(bonusRate) : null,
        fix_amount: fixAmount ? parseFloat(fixAmount) : null,
      };
      await onAction(isEdit ? "edit" : "add", isEdit ? { id: initialData._id, ...payload } : payload);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Staff Record" : "Add Staff Record"}
      subtitle={isEdit ? `Editing: ${staffName || ""}` : "Fill in details step by step"}
      maxWidth="max-w-4xl"
      footer={
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-400">
            {!selectedStaff && "← Select a staff member to begin"}
            {selectedStaff && !attendance && "← Select attendance type"}
            {selectedStaff && attendance && !isFixed && bonusAmount > 0 && (
              <span className="text-emerald-600 font-medium">
                Base {fmt(previewBase, 2)} + Bonus {fmt(bonusAmount, 2)} = {fmt(previewFinal, 2)}
              </span>
            )}
            {selectedStaff && attendance && isFixed && (
              <span className="text-amber-600 font-medium flex items-center gap-1">
                <Lock className="h-3 w-3" /> Fixed at {fmt(previewFinal, 2)}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" outline onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!selectedStaff || !date || !attendance || submitting}
              loading={submitting}
            >
              {isEdit ? "Save Changes" : "Save Record"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="h-full overflow-scroll px-0.5 grid gap-3">

        {/* ── Step 1: Staff + Date + Attendance ── */}
        <div className="flex flex-col gap-3">
          <SectionHeader
            step="1"
            title="Basic Info"
            subtitle="Select staff, date will fill automatically"
          />
          <div className="grid grid-cols-3 gap-3.5">
            {/* Staff */}
            {isEdit ? (
              <Input label="Staff" value={staffName || ""} readOnly required={false} />
            ) : staffLoading ? (
              <Input icon={<Loader2 className="h-4 w-4 animate-spin" />} label="Staff" placeholder="Loading..." readOnly />
            ) : (
              <Select
                label="Staff"
                value={typeof selectedStaff === "object" ? selectedStaff?._id ?? "" : selectedStaff ?? ""}
                onChange={handleStaffSelect}
                options={staffList.map((s) => ({ label: s.name, value: s._id }))}
                placeholder="Select staff..."
              />
            )}

            {/* Date */}
            <Input
              label="Date"
              icon={cfgLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              placeholder={cfgLoading ? "Loading..." : null}
              type={cfgLoading ? "text" : "date"}
              value={cfgLoading ? "" : date}
              onChange={(e) => setDate(e.target.value)}
              disabled={true}
            />

            {/* Attendance */}
            <Select
              label="Attendance"
              value={attendance}
              onChange={handleAttendance}
              options={ATTENDANCE_OPTIONS}
              placeholder="Select type..."
            />
          </div>
        </div>

        {/* ── Step 2: Production Table ── */}
        {showProduction && (
          <div className="flex flex-col gap-3">
            <SectionHeader
              step="2"
              title="Production Entry"
              subtitle={`Rate: ${cfg.stitch_rate} · Applique: ${cfg.applique_rate} · On Target: ${cfg.on_target_pct}% · After Target: ${cfg.after_target_pct}% · ${cfg.pcs_per_round ?? DEFAULT_CONFIG.pcs_per_round} PCs/Round`}
              right={
                <Button size="sm" variant="primary" outline icon={Plus}
                  onClick={() => setRows((p) => [...p, emptyRow()])}>
                  Add Row
                </Button>
              }
            />

            <div className="overflow-x-auto rounded-xl border border-gray-300">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-300 text-xs font-semibold text-gray-500">
                    <th className="px-1.5 py-2.5 text-center w-8">#</th>
                    <th className="px-1.5 py-2.5 text-left">D. Stitch</th>
                    <th className="px-1.5 py-2.5 text-left">Applique</th>
                    <th className="px-1.5 py-2.5 text-left">PCs</th>
                    <th className="px-1.5 py-2.5 text-left">Rounds</th>
                    <th className="px-3 py-2.5 text-right text-nowrap">Total Stitch</th>
                    <th className="px-3 py-2.5 text-right text-nowrap text-rose-700">({cfg.on_target_pct}%)</th>
                    <th className="px-3 py-2.5 text-right text-nowrap text-emerald-700">({cfg.after_target_pct}%)</th>
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
                      canRemove={rows.length > 1}
                    />
                  ))}
                </tbody>
                <tfoot><TotalsRow totals={totals} /></tfoot>
              </table>
            </div>

            {/* Target status bar */}
            {totals.on_target_amt > 0 && (
              <div className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-xs
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
                      {fmt((cfg.target_amount ?? DEFAULT_CONFIG.target_amount) - totals.on_target_amt, 2)} short
                    </span>
                    {" "}of target · Current:{" "}
                    <span className="font-semibold">{fmt(totals.on_target_amt, 2)}</span>
                    {" "}· Target: {fmt(cfg.target_amount ?? DEFAULT_CONFIG.target_amount, 2)}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Bonus ── */}
        {showBonus && (
          <div className="flex flex-col gap-3">
            <SectionHeader
              step={showProduction ? "3" : "2"}
              title="Bonus"
              subtitle={cfg.bonus_rate
                ? `Default rate: ${cfg.bonus_rate} per bonus — override below if needed`
                : "Enter bonus qty and rate"}
            />
            <div className="flex items-end gap-4">
              <Input
                label="Bonus Qty"
                type="number"
                value={bonusQty}
                onChange={(e) => setBonusQty(e.target.value)}
                placeholder="0"
                step="0.001"
                required={false}
              />
              <div className="grow">
                <Input
                  label={`Per Bonus Rate${cfg.bonus_rate ? ` (default: ${fmt(cfg.bonus_rate, 2)})` : ""}`}
                  type="number"
                  value={bonusRate}
                  onChange={(e) => setBonusRate(e.target.value)}
                  placeholder={String(cfg.bonus_rate ?? DEFAULT_CONFIG.bonus_rate)}
                  required={false}
                />
              </div>
              <Input
                label="Total Bonus Amount"
                icon={<Gift className="h-4 w-4 text-gray-400" />}
                iconPosition="right"
                type="text"
                value={fmt(bonusAmount, 2)}
                disabled={true}
              />
            </div>
          </div>
        )}

        {/* ── Step 4: Fix Amount ── */}
        {attendance && !NO_BONUS.has(attendance) && (
          <div className="flex flex-col gap-3">
            <SectionHeader
              step={showProduction ? "4" : showBonus ? "3" : "2"}
              title="Fix Amount"
              subtitle="Optional — overrides all calculated amounts. Production data is still saved."
            />
            <Input
              label=""
              type="number"
              value={fixAmount}
              showClear={true}
              onChange={(e) => setFixAmount(e.target.value)}
              placeholder="Leave empty to use calculated amount"
              required={false}
            />
            {isFixed && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Fix Amount is active. Base amount and bonus will be ignored for the final total.</span>
              </div>
            )}
          </div>
        )}

        {/* ── Final Amount Card ── */}
        {showFinalCard && (
          <FinalAmountCard
            amount={previewFinal}
            isFixed={isFixed}
            breakdown={breakdownItems}
          />
        )}

      </div>
    </Modal>
  );
}