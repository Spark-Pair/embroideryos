import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Trash2, Loader2, Gift, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import Modal from "../Modal";
import Button from "../Button";
import Input from "../Input";
import Select from "../Select";
import { fetchStaffNames } from "../../api/staff";
import { fetchStaffLastRecord } from "../../api/staffRecord";
import { fetchProductionConfig } from "../../api/productionConfig";
import { FinalAmountCard } from "../FinalAmountCard";
import { SectionHeader } from "../SectionHeader";
import { formatNumbers } from "../../utils";
import { useFormKeyboard } from "../../hooks/useFormKeyboard";
import { useShortcut } from "../../hooks/useShortcuts";
import { isEventMatchingShortcut } from "../../utils/shortcuts";
import { useToast } from "../../context/ToastContext";
import { fetchMyRuleData } from "../../api/business";
import {
  EMPTY_PRODUCTION_CONFIG,
  calculateProductionRow,
  calculateProductionTotals,
  getModeSummary,
  getProductionAmountLabels,
  getTargetProgress,
  isTargetMode,
  normalizeProductionConfig,
  shouldShowProductionAmount,
} from "../../utils/productionPayout";
import {
  ATTENDANCE_PAY_MODES,
  defaultAttendanceRules,
  getAttendanceRule,
  normalizeRuleData,
} from "../../utils/businessRuleData";

// ─── Constants ────────────────────────────────────────────────────────────────

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
  if (lr && !jd) { const n = new Date(lr); n.setDate(n.getDate() + 1); return toDateInput(n); }
  if (lr >= jd)  { const n = new Date(lr); n.setDate(n.getDate() + 1); return toDateInput(n); }
  return toDateInput(jd);
}

// ─── Calculation Engine ───────────────────────────────────────────────────────

function calcRow(row, cfg) {
  return calculateProductionRow(row, cfg);
}

function syncPcsRounds(field, value, pcsPerRound) {
  const num = parseFloat(value);
  if (!value || isNaN(num) || num <= 0)
    return { pcs: field === "pcs" ? value : "", rounds: field === "rounds" ? value : "" };
  if (field === "pcs") return { pcs: value, rounds: String(Math.ceil(num / pcsPerRound)) };
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

  const addRowShortcut = useShortcut("production_add_row"); // ← dynamic

  const handleKeyDown = (field) => (e) => {
    if (!isLast) return;
    if (field !== "pcs" && field !== "rounds") return;
    if (!isEventMatchingShortcut(e, addRowShortcut)) return;

    e.preventDefault();
    onAddRow();
  };

  const ci = "w-full border border-gray-400/85 px-2.5 py-1.5 rounded-lg text-sm focus:ring-2 focus:ring-emerald-300 focus:outline-none bg-gray-50 transition";

  return (
    <tr className="group border-b border-gray-300 hover:bg-emerald-50/30 transition-colors">
      <td className="px-1.5 py-2 text-center text-xs font-medium text-gray-400 w-8">{index + 1}</td>
      <td className="px-1.5 py-2">
        <input type="number" value={row.d_stitch} onChange={handle("d_stitch")} onFocus={handleFocus} data-field="d_stitch" placeholder="0" className={ci} />
      </td>
      <td className="px-1.5 py-2">
        <input type="number" value={row.applique} onChange={handle("applique")} onFocus={handleFocus} data-field="applique" placeholder="0" className={ci} />
      </td>
      <td className="px-1.5 py-2">
        <input type="number" value={row.rounds}   onChange={handle("rounds")}  onFocus={handleFocus} data-field="rounds" onKeyDown={handleKeyDown("rounds")}  placeholder="0" className={ci} />
      </td>
      <td className="px-1.5 py-2">
        <input type="number" value={row.pcs}      onChange={handle("pcs")}      onFocus={handleFocus} data-field="pcs"   onKeyDown={handleKeyDown("pcs")}   placeholder="0" className={ci} />
      </td>
      <td className="px-3 py-2 text-right text-sm text-gray-600 tabular-nums">{formatNumbers(total_stitch)}</td>
      <td className="px-3 py-2 text-right text-sm font-medium text-rose-700 tabular-nums">{formatNumbers(on_target_amt, 2)}</td>
      {amountLabels.secondary && (
        <td className="px-3 py-2 text-right text-sm font-medium text-emerald-700 tabular-nums">{formatNumbers(after_target_amt, 2)}</td>
      )}
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

function TotalsRow({ totals, cfg }) {
  const amountLabels = getProductionAmountLabels(cfg);
  return (
    <tr className="border-t border-gray-300 bg-gray-50/80 font-semibold text-sm">
      <td className="px-3.5 py-2.5 text-xs text-gray-500 uppercase tracking-wider" colSpan={3}>Totals</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{formatNumbers(totals.rounds)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{formatNumbers(totals.pcs)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{formatNumbers(totals.total_stitch)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-rose-700">{formatNumbers(totals.on_target_amt, 2)}</td>
      {amountLabels.secondary && (
        <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">{formatNumbers(totals.after_target_amt, 2)}</td>
      )}
      <td />
    </tr>
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
  const { showToast } = useToast();
  const isEdit = !!initialData;

  // ── Refs for auto-focus flow ──
  const staffRef      = useRef(null);
  const attendanceRef = useRef(null);

  // ── State ──
  const [cfg,           setCfg]           = useState(EMPTY_PRODUCTION_CONFIG);
  const [cfgLoading,    setCfgLoading]    = useState(false);
  const [ruleData,      setRuleData]      = useState({ attendance_rules: [] });
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [date,          setDate]          = useState("");
  const [attendance,    setAttendance]    = useState("");
  const [rows,          setRows]          = useState([emptyRow()]);
  const [bonusQty,      setBonusQty]      = useState("");
  const [bonusRate,     setBonusRate]     = useState("");
  const [fixAmount,     setFixAmount]     = useState("");
  const [forceAfterTargetForNonTarget, setForceAfterTargetForNonTarget] = useState(false);
  const [forceFullTargetForNonTarget, setForceFullTargetForNonTarget] = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [staffList,     setStaffList]     = useState([]);
  const [staffLoading,  setStaffLoading]  = useState(false);
  const [dateLoading,   setDateLoading]   = useState(false);
    
  const autoSelectedRef = useRef(false);

  // ── Global keyboard nav + Enter to submit ──
  useFormKeyboard({ onEnterSubmit: handleSubmit });

  // ── Fetch config when date changes ──
  useEffect(() => {
    if (!date) return;
    const load = async () => {
      setCfgLoading(true);
      try {
        const res = await fetchProductionConfig(date);
        const data = res?.data;
        setCfg(data ? normalizeProductionConfig(data) : normalizeProductionConfig(EMPTY_PRODUCTION_CONFIG));
      } catch {
        setCfg(normalizeProductionConfig(EMPTY_PRODUCTION_CONFIG));
        showToast({ type: "error", message: "Failed to load production config" });
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
      setForceAfterTargetForNonTarget(false);
      setForceFullTargetForNonTarget(false);
      setCfg(EMPTY_PRODUCTION_CONFIG);
      autoSelectedRef.current = false;
    }

    const load = async () => {
      setStaffLoading(true);
      try {
        const [r, ruleRes] = await Promise.all([
          fetchStaffNames({ status: "active", category: "Embroidery" }),
          fetchMyRuleData().catch(() => ({ rule_data: {} })),
        ]);
        const list = r.data || [];
        setStaffList(list);
        setRuleData(ruleRes?.rule_data || { attendance_rules: [] });

        if (!isEdit && lastUsed?.staffId) {
          // Pass list directly — don't rely on stale state
          await handleStaffSelect(lastUsed.staffId, list);
          autoSelectedRef.current = true;
        } else if (!isEdit) {
          setTimeout(() => staffRef.current?.focus(), 150);
        }
      } catch {
        setStaffList([]);
        showToast({ type: "error", message: "Failed to load staff list" });
      } finally {
        setStaffLoading(false);
      }
    };
    load();
  }, [isOpen]);

  useEffect(() => {
    if (!date || isEdit || !autoSelectedRef.current) return;
    
    // Date is now resolved, now apply last used attendance
    const last       = lastUsed?.attendanceHistory?.last;
    const secondLast = lastUsed?.attendanceHistory?.secondLast;

    const dayOfWeek = new Date(date).getDay();
    if (dayOfWeek === 0) {
      handleAttendance("Sunday");
    } else if (last && last !== "Sunday") {
      handleAttendance(last);
      setTimeout(() => {
        const first = document.querySelector('input[data-field="d_stitch"]');
        if (first) first.focus();
      }, 50);
    } else if (secondLast && secondLast !== "Sunday") {
      handleAttendance(secondLast);
      setTimeout(() => {
        const first = document.querySelector('input[data-field="d_stitch"]');
        if (first) first.focus();
      }, 50);
    } else {
      setTimeout(() => attendanceRef.current?.focus(), 50);
    }
  }, [date]); // fires when date resolves after auto-staff-select

  // ── Pre-fill on edit ──
  useEffect(() => {
    if (!isOpen || !isEdit || !initialData) return;
    setSelectedStaff(initialData.staff_id);
    setDate(toDateInput(initialData.date));
    handleAttendance(initialData.attendance || "");
    setBonusQty(initialData.bonus_qty   ? String(initialData.bonus_qty)   : "");
    setBonusRate(initialData.bonus_rate  ? String(initialData.bonus_rate)  : "");
    setFixAmount(initialData.fix_amount != null ? String(initialData.fix_amount) : "");
    setForceAfterTargetForNonTarget(Boolean(initialData.force_after_target_for_non_target));
    setForceFullTargetForNonTarget(Boolean(initialData.force_full_target_for_non_target));
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
    if (!date || isEdit) return;
    if (autoSelectedRef.current) return; // handled by the effect above

    const day = new Date(date).getDay();
    if (day === 0) {
      handleAttendance("Sunday");
    } else {
      // Only clear if manually changed (not auto-selected flow)
      handleAttendance("");
    }
  }, [date]);


  // ── Staff select ──
  const handleStaffSelect = async (staffId, list = staffList) => {
    autoSelectedRef.current = false;
    if (!staffId) { setSelectedStaff(null); setDate(""); return; }

    const staff = list.find((s) => s._id === staffId);
    setSelectedStaff(staff);
    setDateLoading(true);

    setTimeout(() => attendanceRef.current?.focus(), 50);

    try {
      const res = await fetchStaffLastRecord(staffId);
      setDate(resolveDate(staff?.joining_date, res.data?.last_record_date ?? null));
      setLastUsed((prev) => ({ ...prev, staffId }));
    } catch {
      setDate(resolveDate(staff?.joining_date, null));
      showToast({ type: "error", message: "Failed to load last staff record date" });
    } finally {
      setDateLoading(false);
    }
  };

  const handleAttendance = (val) => {
    setAttendance(val);
    setLastUsed((prev) => ({
      ...prev,
      attendanceHistory: {
        last:       val,
        secondLast: prev?.attendanceHistory?.last ?? null,
      },
    }));

    if (!val) return;

    setTimeout(() => {
      // Production visible — d_stitch focus
      if (getAttendanceRule(ruleData, val)?.counts_production) {
        const dStitch = document.querySelector('input[data-field="d_stitch"]');
        if (dStitch) { dStitch.focus(); return; }
      }

      // Koi aur input ho — us pe focus
      const firstInput = document.querySelector(
        'input[data-focus-first="true"]:not([disabled]):not([readonly])'
      );
      if (firstInput) { firstInput.focus(); return; }

      // Kuch nahi — Save button pe focus, Enter se submit hoga
      const saveBtn = document.querySelector('button[data-save-btn="true"]');
      if (saveBtn) saveBtn.focus();
    }, 50);
  };

  // ── Derived ──
  const attendanceRules = normalizeRuleData(ruleData).attendance_rules;
  const attendanceOptions = (attendanceRules.length
    ? attendanceRules
    : defaultAttendanceRules()
  ).map((rule) => ({ label: rule.label, value: rule.label }));
  const attendanceRule = attendance ? getAttendanceRule(ruleData, attendance) : null;
  const showProduction = Boolean(attendanceRule?.counts_production);
  const showBonus      = Boolean(attendanceRule?.allows_bonus);
  const totals         = calcTotals(rows, cfg);
  const amountLabels   = getProductionAmountLabels(cfg);
  const targetState    = getTargetProgress(totals, cfg, {
    force_after_target_for_non_target: forceAfterTargetForNonTarget,
    force_full_target_for_non_target: forceFullTargetForNonTarget,
  });
  const targetMode = isTargetMode(cfg);
  const productionEnabled = shouldShowProductionAmount(cfg);

  const handleRowChange = useCallback((key, updated) =>
    setRows((p) => p.map((r) => r._key === key ? updated : r)), []);
  const handleRowRemove = useCallback((key) =>
    setRows((p) => p.filter((r) => r._key !== key)), []);

  // ── Final amount preview ──
  const effectiveBonusRate = parseFloat(bonusRate) || cfg.bonus_rate || 0;
  const bonusAmount        = (parseFloat(bonusQty) || 0) * effectiveBonusRate;

  const hasSalary     = selectedStaff?.salary > 0;
  const salary        = selectedStaff?.salary || 0;
  const targetMet     = targetState.targetMet;
  const canForceAfterTargetForNonTarget =
    showProduction &&
    targetMode &&
    !hasSalary &&
    totals.on_target_amt > 0 &&
    !targetMet &&
    Boolean(attendanceRule?.counts_production);
  const canForceFullTargetForNonTarget =
    canForceAfterTargetForNonTarget &&
    Number(cfg.on_target_pct || 0) > 0;
  const fullTargetAfterAmount = getTargetProgress(totals, cfg, {
    force_full_target_for_non_target: true,
  }).effectiveAmount;
  const productionAmt = showProduction
    ? (productionEnabled ? targetState.effectiveAmount : 0)
    : 0;

  let previewBase = 0;
  switch (attendanceRule?.pay_mode) {
    case ATTENDANCE_PAY_MODES.ZERO:
      previewBase = 0;
      break;
    case ATTENDANCE_PAY_MODES.SALARY_DAY_OR_OFF_AMOUNT:
      previewBase = hasSalary ? salary / 30 : (cfg.off_amount || 0);
      break;
    case ATTENDANCE_PAY_MODES.SALARY_HALF_OR_PRODUCTION:
      previewBase = hasSalary ? salary / 60 : productionAmt;
      break;
    case ATTENDANCE_PAY_MODES.SALARY_DAY_OR_PRODUCTION:
    default:
      previewBase = hasSalary ? salary / 30 : productionAmt;
      break;
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
  async function handleSubmit() {
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
        bonus_qty:  bonusQty  ? parseFloat(bonusQty)  : 0,
        bonus_rate: bonusRate ? parseFloat(bonusRate)  : null,
        bonus_rate_override: bonusRate ? parseFloat(bonusRate) : null,
        fix_amount: fixAmount ? parseFloat(fixAmount)  : null,
        force_after_target_for_non_target:
          canForceAfterTargetForNonTarget &&
          forceAfterTargetForNonTarget &&
          !(canForceFullTargetForNonTarget && forceFullTargetForNonTarget),
        force_full_target_for_non_target:
          canForceFullTargetForNonTarget &&
          forceFullTargetForNonTarget,
      };
      await onAction(isEdit ? "edit" : "add", isEdit ? { id: initialData._id, ...payload } : payload);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  const handleAddRow = useCallback(() => {
    const newKey = crypto.randomUUID();
    setRows((p) => [...p, { ...emptyRow(), _key: newKey }]);
    setTimeout(() => {
      const inputs = document.querySelectorAll('input[data-field="d_stitch"]');
      if (inputs.length) inputs[inputs.length - 1].focus();
    }, 30);
  }, []);

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
                Base {formatNumbers(previewBase, 2)} + Bonus {formatNumbers(bonusAmount, 2)} = {formatNumbers(previewFinal, 2)}
              </span>
            )}
            {selectedStaff && attendance && isFixed && (
              <span className="text-amber-600 font-medium flex items-center gap-1">
                <Lock className="h-3 w-3" /> Fixed at {formatNumbers(previewFinal, 2)}
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
              data-save-btn="true"
              disabled={!selectedStaff || !date || !attendance || submitting}
              loading={submitting}
            >
              {isEdit ? "Save Changes" : "Save Record"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="h-full overflow-scroll p-0.5 grid gap-3">

        {/* ── Step 1: Staff + Date + Attendance ── */}
        <div className="flex flex-col">
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
                ref={staffRef}
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
              ref={attendanceRef}
              label="Attendance"
              value={attendance}
              onChange={handleAttendance}
              options={attendanceOptions}
              placeholder="Select type..."
              disabled={!date}
            />
          </div>
        </div>

        {/* ── Step 2: Production Table ── */}
        {showProduction && (
          <div className="flex flex-col">
            <SectionHeader
              step="2"
              title="Production Entry"
              subtitle={`${getModeSummary(cfg)}${cfg.pcs_per_round ? ` · ${cfg.pcs_per_round} PCs/Round` : ""}`}
              right={
                <Button size="sm" variant="primary" outline icon={Plus}
                  onClick={handleAddRow}>
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
                    <th className="px-1.5 py-2.5 text-left">Rounds</th>
                    <th className="px-1.5 py-2.5 text-left">PCs</th>
                    <th className="px-3 py-2.5 text-right text-nowrap">Total Stitch</th>
                    <th className="px-3 py-2.5 text-right text-nowrap text-rose-700">{amountLabels.primary}</th>
                    {amountLabels.secondary && (
                      <th className="px-3 py-2.5 text-right text-nowrap text-emerald-700">{amountLabels.secondary}</th>
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
                      onAddRow={handleAddRow}          // ← add
                      isLast={idx === rows.length - 1} // ← add
                      canRemove={rows.length > 1}
                    />
                  ))}
                </tbody>
                <tfoot><TotalsRow totals={totals} cfg={cfg} /></tfoot>
              </table>
            </div>

            {/* Target status bar */}
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
                      {formatNumbers((cfg.target_amount || 0) - totals.on_target_amt, 2)} short
                    </span>
                    {" "}of target · Current:{" "}
                    <span className="font-semibold">{formatNumbers(totals.on_target_amt, 2)}</span>
                    {" "}· Target: {formatNumbers(cfg.target_amount || 0, 2)}
                  </span>
                )}
              </div>
            )}

            {canForceAfterTargetForNonTarget && (
              <label className="mt-2 inline-flex items-center gap-2 text-xs text-gray-700 select-none">
                <input
                  type="checkbox"
                  checked={forceAfterTargetForNonTarget}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setForceAfterTargetForNonTarget(checked);
                    if (checked) setForceFullTargetForNonTarget(false);
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-400"
                />
                <span>
                  Use <span className="font-semibold text-emerald-700">After Target ({cfg.after_target_pct}%)</span> amount even if target is not met
                </span>
              </label>
            )}

            {canForceFullTargetForNonTarget && (
              <label className="mt-1 inline-flex items-center gap-2 text-xs text-gray-700 select-none">
                <input
                  type="checkbox"
                  checked={forceFullTargetForNonTarget}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setForceFullTargetForNonTarget(checked);
                    if (checked) setForceAfterTargetForNonTarget(false);
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-400"
                />
                <span>
                  Complete full target and apply <span className="font-semibold text-emerald-700">After Target ({cfg.after_target_pct}%)</span>{" "}
                  amount: <span className="font-semibold">{formatNumbers(fullTargetAfterAmount, 2)}</span>
                </span>
              </label>
            )}
          </div>
        )}

        {/* ── Step 3: Bonus ── */}
        {showBonus && (
          <div className="flex flex-col">
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
                data-focus-first="true"
                step="0.001"
                required={false}
              />
              <div className="grow">
                <Input
                  label={`Per Bonus Rate${cfg.bonus_rate ? ` (default: ${formatNumbers(cfg.bonus_rate, 2)})` : ""}`}
                  type="number"
                  value={bonusRate}
                  onChange={(e) => setBonusRate(e.target.value)}
                  placeholder={cfg.bonus_rate ? String(cfg.bonus_rate) : ""}
                  required={false}
                />
              </div>
              <Input
                label="Total Bonus Amount"
                icon={<Gift className="h-4 w-4 text-gray-400" />}
                iconPosition="right"
                type="text"
                value={formatNumbers(bonusAmount, 2)}
                disabled={true}
              />
            </div>
          </div>
        )}

        {/* ── Step 4: Fix Amount ── */}
        {showBonus && (
          <div className="flex flex-col">
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
