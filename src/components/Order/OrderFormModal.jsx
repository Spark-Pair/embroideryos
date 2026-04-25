import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Save, AlertCircle, CheckCircle2, Loader2, Hash, ChevronRight, ChevronLeft, RefreshCw, Layers } from "lucide-react";
import Modal from "../Modal";
import Button from "../Button";
import Input from "../Input";
import Select from "../Select";
import { FinalAmountCard } from "../FinalAmountCard";
import { formatNumbers } from "../../utils";
import { useFormKeyboard } from "../../hooks/useFormKeyboard";
import { useShortcut } from "../../hooks/useShortcuts";
import { formatComboDisplay, isEventMatchingShortcut } from "../../utils/shortcuts";
import { fetchCustomers } from "../../api/customer";
import { useToast } from "../../context/ToastContext";
import { fetchOrderConfig } from "../../api/orderConfig";
import { fetchMyMachineOptions, fetchMyReferenceData } from "../../api/business";

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Order Info"      },
  { id: 2, label: "Stitches & Rate" },
];

// ─── Calculation Engine ───────────────────────────────────────────────────────

function toNum(val) {
  if (val === "" || val == null) return 0;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function roundDown(value, digits = 2) {
  const factor = Math.pow(10, digits);
  return Math.floor(value * factor) / factor;
}

function normalizeFormulaRules(rawRules) {
  if (!Array.isArray(rawRules) || rawRules.length === 0) return [];
  const clean = rawRules
    .map((rule = {}) => {
      const upToRaw = rule?.up_to;
      const up_to = upToRaw === "" || upToRaw == null ? null : Math.max(0, toNum(upToRaw));
      const mode = ["fixed", "percent", "identity"].includes(rule?.mode) ? rule.mode : "identity";
      const value = mode === "identity" ? 0 : Math.max(0, toNum(rule?.value));
      return { up_to, mode, value };
    })
    .sort((a, b) => {
      const av = a.up_to == null ? Number.POSITIVE_INFINITY : a.up_to;
      const bv = b.up_to == null ? Number.POSITIVE_INFINITY : b.up_to;
      return av - bv;
    });
  return clean;
}

function computeDesignStitchesByConfig(actualStitches, config) {
  const s = toNum(actualStitches);
  if (s <= 0) return 0;
  if (config?.stitch_formula_enabled === false) return s;
  const rules = normalizeFormulaRules(config?.stitch_formula_rules);
  if (!rules.length) return s;
  for (const rule of rules) {
    const threshold = rule.up_to == null ? Number.POSITIVE_INFINITY : toNum(rule.up_to);
    if (s > threshold) continue;
    if (rule.mode === "fixed") return Math.max(0, toNum(rule.value));
    if (rule.mode === "percent") return s + (s * toNum(rule.value)) / 100;
    return s;
  }
  return s;
}

function computeCalculatedRate(baseRate, ds, apqChr) {
  if (toNum(ds) <= 0) return 0;
  const raw = toNum(baseRate) * toNum(ds) / 1000 + toNum(apqChr);
  return Math.round(raw * 100) / 100; // standard rounding to 2 decimals
}

function computeStitchRate(rate, ds, apq, apqChr) {
  const d = toNum(ds), r = toNum(rate);
  if (d <= 0 || r <= 0) return 0;
  const base = toNum(apq) === 0 ? r : r - toNum(apqChr);
  return roundDown(base / d * 1000, 2);
}

// Reverse: (rate - apqChr) / stitchRate * 1000 = design stitches
// stitchRate here = customer base rate (same as VBA TxtRate2 formula)
function computeDesignStitchFromRate(rate, stitchRate, apqChr) {
  const r  = toNum(rate);
  const sr = toNum(stitchRate);
  const ac = toNum(apqChr);
  if (r <= 0 || sr <= 0) return 0;
  return roundDown((r - ac) / sr * 1000, 2);
}

function computeQtPcs(qty, unit) {
  const normalizedUnit = String(unit || "").trim().toLowerCase();
  const multiplier = normalizedUnit.includes("dzn") || normalizedUnit.includes("dozen") ? 12 : 1;
  return toNum(qty) * multiplier;
}

function parseUnitOption(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parts = raw.split("|");
  const label = String(parts[0] || "").trim();
  if (!label) return null;
  const multiplier = Math.max(1, Number(parts[1] || 1) || 1);
  return {
    label: `${label} (×${multiplier})`,
    value: raw,
    unitLabel: label,
    multiplier,
  };
}

function computeTotalAmount(rate, qtPcs) {
  return roundDown(toNum(rate) * toNum(qtPcs), 2);
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, completed, onStepClick }) {
  return (
    <div className="flex items-center gap-2 mb-6 bg-gray-50 border border-gray-200 rounded-2xl p-1.5">
      {STEPS.map((step) => {
        const isActive    = step.id === current;
        const isDone      = completed.has(step.id);
        const isClickable = !isActive && (isDone || (step.id === 2 && completed.has(1)));

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => isClickable && onStepClick(step.id)}
            className={`flex items-center gap-2.5 flex-1 px-4 py-2.5 rounded-xl transition-all duration-200 focus:outline-none
              ${isActive
                ? "bg-white shadow-sm border border-gray-200"
                : isClickable
                ? "hover:bg-white/60 cursor-pointer"
                : "cursor-default opacity-50"}`}
          >
            {/* Circle */}
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-all duration-200
              ${isActive
                ? "bg-gray-900 text-white"
                : isDone
                ? "bg-emerald-500 text-white"
                : "bg-gray-200 text-gray-400"}`}
            >
              {isDone && !isActive ? <CheckCircle2 className="h-3.5 w-3.5" /> : step.id}
            </div>

            {/* Label + subtitle */}
            <div className="flex flex-col items-start min-w-0">
              <span className={`text-xs font-semibold leading-tight transition-colors
                ${isActive ? "text-gray-900" : isDone ? "text-emerald-600" : "text-gray-400"}`}>
                {step.label}
              </span>
              <span className="text-[10px] text-gray-400 leading-tight">
                {isDone && !isActive ? "Completed" : isActive ? "In progress" : "Pending"}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Empty form ───────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  customer_id:        "",
  customer_name:      "",
  customer_base_rate: "",
  description:        "",
  date:               "",
  machine_no:         "",
  lot_no:             "",
  unit:               "",
  quantity:           "",
  actual_stitches:    "",
  apq:                "",
  apq_chr:            "",
  rate:               "",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrderFormModal({
  isOpen,
  onClose,
  initialData = null,
  forceAdd    = false,
  onAction,
}) {
  const { showToast } = useToast();
  const isEdit = !!initialData && !forceAdd;

  // ── Refs ──
  const customerRef = useRef(null);
  const dateRef     = useRef(null);
  const machineRef  = useRef(null);
  const descRef     = useRef(null);
  const lotNoRef    = useRef(null);
  const unitRef     = useRef(null);
  const quantityRef = useRef(null);
  const stitchRef   = useRef(null);
  const apqRef      = useRef(null);
  const apqChrRef   = useRef(null);
  const rateRef     = useRef(null);

  // ── State ──
  const [step,             setStep]             = useState(1);
  const [completedSteps,   setCompletedSteps]   = useState(new Set());
  const [form,             setForm]             = useState(EMPTY_FORM);
  const [apqError,         setApqError]         = useState("");
  const [customers,        setCustomers]        = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [machineOptions,   setMachineOptions]   = useState([]);
  const [unitOptions,      setUnitOptions]      = useState([]);
  const [formulaConfig,    setFormulaConfig]    = useState(null);
  const [submitting,       setSubmitting]       = useState(false);
  const [reverseMode,      setReverseMode]      = useState(false);  // rate → stitch calc
  const [twoSide,          setTwoSide]          = useState(false);  // rate×2 only

  const reverseModeShortcut = useShortcut("order_toggle_rate_to_stitch");
  const twoSideShortcut = useShortcut("order_toggle_two_side");

  // Enter on step 2 = submit; on step 1 it's handled per-field
  useFormKeyboard({ onEnterSubmit: step === 2 ? handleSubmit : () => {} });

  const focus = (ref, delay = 40) => setTimeout(() => ref.current?.focus(), delay);

  // ── Load customers → focus customer ──
  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      setCustomersLoading(true);
      try {
        const [customersRes, machinesRes, referenceRes] = await Promise.all([
          fetchCustomers({ status: "active" }),
          fetchMyMachineOptions().catch(() => ({ machine_options: [] })),
          fetchMyReferenceData().catch(() => ({ reference_data: {} })),
        ]);
        setCustomers(customersRes.data || []);
        const machines = Array.isArray(machinesRes?.machine_options) ? machinesRes.machine_options : [];
        setMachineOptions(machines.map((item) => ({ label: item, value: item })));
        const nextUnitOptions = Array.isArray(referenceRes?.reference_data?.order_units)
          ? referenceRes.reference_data.order_units.map(parseUnitOption).filter(Boolean)
          : [];
        setUnitOptions(nextUnitOptions);
      } catch {
        setCustomers([]);
        setMachineOptions([]);
        setUnitOptions([]);
        showToast({ type: "error", message: "Failed to load customers" });
      }
      finally {
        setCustomersLoading(false);
        if (!isEdit) setTimeout(() => customerRef.current?.focus(), 50);
      }
    };
    load();
  }, [isOpen]);

  // ── Reset / pre-fill ──
  useEffect(() => {
    if (!isOpen) return;
    setApqError("");
    if (!initialData) {
      setForm(EMPTY_FORM);
      setStep(1);
      setCompletedSteps(new Set());
      setReverseMode(false);
      setTwoSide(false);
    } else {
      setForm({
        id:                 isEdit ? (initialData._id || "") : "",
        customer_id:        initialData.customer_id        || "",
        customer_name:      initialData.customer_name      || "",
        customer_base_rate: initialData.customer_base_rate ?? "",
        description:        initialData.description         || "",
        date:               initialData.date                || "",
        machine_no:         initialData.machine_no          || "",
        lot_no:             initialData.lot_no              || "",
        unit:               initialData.unit                || "",
        quantity:           initialData.quantity            ?? "",
        actual_stitches:    initialData.actual_stitches     ?? "",
        apq:                initialData.apq                 ?? "",
        apq_chr:            initialData.apq_chr             ?? "",
        rate:               initialData.rate_input ?? initialData.rate ?? "",
      });
      setStep(1);
      setCompletedSteps(new Set([1])); // step 1 already done in edit mode
      setReverseMode(typeof initialData.reverse_mode === "boolean" ? initialData.reverse_mode : false);
      setTwoSide(!!initialData.two_side);
    }
  }, [isOpen, isEdit, initialData]);

  useEffect(() => {
    if (!isOpen || initialData) return;
    if (form.unit || !unitOptions.length) return;
    setForm((prev) => ({ ...prev, unit: unitOptions[0].value }));
  }, [isOpen, initialData, form.unit, unitOptions]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    const loadFormulaConfig = async () => {
      try {
        const res = await fetchOrderConfig(form.date || undefined);
        if (!active) return;
        setFormulaConfig(res?.data || null);
      } catch {
        if (!active) return;
        setFormulaConfig(null);
      }
    };

    loadFormulaConfig();
    return () => {
      active = false;
    };
  }, [isOpen, form.date]);

  // ── Focus first field when step changes ──
  useEffect(() => {
    if (step === 1 && !isEdit) focus(customerRef, 50);
    if (step === 2)            focus(stitchRef, 50);
  }, [step]);

  const toggleReverseMode = useCallback(() => {
    setReverseMode((p) => !p);
    setForm((f) => ({ ...f, actual_stitches: "" }));
  }, []);

  const toggleTwoSide = useCallback(() => {
    setTwoSide((p) => !p);
  }, []);

  useEffect(() => {
    if (!isOpen || step !== 2) return;

    const onKeyDown = (e) => {
      if (e.defaultPrevented || e.repeat) return;

      if (isEventMatchingShortcut(e, reverseModeShortcut)) {
        e.preventDefault();
        toggleReverseMode();
        return;
      }

      if (isEventMatchingShortcut(e, twoSideShortcut)) {
        e.preventDefault();
        toggleTwoSide();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, step, reverseModeShortcut, twoSideShortcut, toggleReverseMode, toggleTwoSide]);

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));

  // ── Step 1 valid ──
  const step1Valid = !!form.customer_id && !!form.date && !!form.machine_no && !!form.unit && toNum(form.quantity) > 0;

  function goToStep2() {
    if (!step1Valid) return;
    setCompletedSteps((p) => new Set([...p, 1]));
    setStep(2);
  }

  function goToStep1() {
    setStep(1);
    focus(quantityRef, 80); // land on quantity so user can edit and press Enter again
  }

  function handleStepClick(id) {
    if (id === 1) goToStep1();
    if (id === 2) goToStep2();
  }

  // ── Step 1 field handlers ──
  const handleCustomerSelect = useCallback((customerId) => {
    if (!customerId) {
      setForm((p) => ({ ...p, customer_id: "", customer_name: "", customer_base_rate: "" }));
      return;
    }
    const c = customers.find((x) => x._id === customerId);
    setForm((p) => ({
      ...p,
      customer_id:        customerId,
      customer_name:      c?.name || "",
      customer_base_rate: c?.rate ?? "",
    }));
    focus(dateRef);
  }, [customers]);

  const handleDateChange  = (e) => setForm((p) => ({ ...p, date: e.target.value }));
  const handleDateKeyDown = (e) => {
    if (e.key === "Enter" && form.date) { e.preventDefault(); focus(machineRef, 0); }
  };

  const handleMachineSelect = useCallback((value) => {
    setForm((p) => ({ ...p, machine_no: value }));
    focus(descRef);
  }, []);

  const handleDescKeyDown  = (e) => {
    if (e.key === "Enter") { e.preventDefault(); focus(lotNoRef, 0); }
  };
  const handleLotNoKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); focus(unitRef, 0); }
  };

  const handleUnitSelect = useCallback((value) => {
    setForm((p) => ({ ...p, unit: value }));
    focus(quantityRef);
  }, []);

  // Quantity Enter → Next (go to step 2)
  const handleQuantityKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); goToStep2(); }
  };

  // ── Step 2 field handlers ──
  const handleStitchKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); focus(apqRef, 0); }
  };

  const handleApqChange = (e) => {
    const raw = e.target.value;
    if (raw === "") { setForm((p) => ({ ...p, apq: "" })); setApqError(""); return; }
    if (!/^\d+$/.test(raw)) return;
    const num = Number(raw);
    if (num > 30) {
      setApqError("Maximum allowed is 30.");
      setForm((p) => ({ ...p, apq: "30" }));
    } else {
      setApqError("");
      setForm((p) => ({ ...p, apq: raw }));
    }
  };
  const handleApqKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); focus(apqChrRef, 0); }
  };

  const handleApqChrChange = (e) => {
    const raw = e.target.value;
    if (raw === "" || /^\d*\.?\d*$/.test(raw))
      setForm((p) => ({ ...p, apq_chr: raw }));
  };
  const handleApqChrKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); focus(rateRef, 0); }
  };

  const handleRateKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); handleSubmit(); }
  };

  // ── Derived values ──

  // 2-side multipliers
  const rateMultiplier = twoSide && !reverseMode ? 2 : 1;  // both on: user entered 2-side rate already

  // Design stitches:
  //   normal mode  → from actual_stitches via tiered markup
  //   reverse mode → from rate / baseRate * 1000 (user skipped stitches, entered rate directly)
  const designStitches = useMemo(() => {
    if (reverseMode) {
      // both on: DS = ((rate/2) - apqChr) / baseRate * 1000
      // reverse only: DS = (rate - apqChr) / baseRate * 1000
      const rateForDs = reverseMode && twoSide ? toNum(form.rate) / 2 : toNum(form.rate);
      const ds = computeDesignStitchFromRate(rateForDs, form.customer_base_rate, form.apq_chr);
      return ds > 0 ? ds : 0;
    }
    return computeDesignStitchesByConfig(form.actual_stitches, formulaConfig);
  }, [reverseMode, twoSide, form.actual_stitches, form.rate, form.customer_base_rate, form.apq_chr, formulaConfig]);

  const effectiveRate = useMemo(() => toNum(form.rate) * rateMultiplier, [form.rate, rateMultiplier]);

  const qtPcs          = useMemo(() => computeQtPcs(form.quantity, form.unit), [form.quantity, form.unit]);
  const selectedUnit = useMemo(
    () => unitOptions.find((item) => item.value === form.unit) || parseUnitOption(form.unit),
    [unitOptions, form.unit]
  );
  const unitLabel = selectedUnit?.unitLabel || form.unit || "Unit";
  const unitMultiplier = selectedUnit?.multiplier || 1;
  const calculatedRate = useMemo(() => computeCalculatedRate(form.customer_base_rate, designStitches, form.apq_chr), [form.customer_base_rate, designStitches, form.apq_chr]);
  const stitchRate     = useMemo(() => computeStitchRate(effectiveRate, designStitches, form.apq, form.apq_chr), [effectiveRate, designStitches, form.apq, form.apq_chr]);
  const totalAmount    = useMemo(() => computeTotalAmount(effectiveRate, qtPcs), [effectiveRate, qtPcs]);

  const stitchStatus = useMemo(() => {
    const sr = toNum(stitchRate), br = toNum(form.customer_base_rate);
    if (!sr || !br) return "neutral";
    return sr < br ? "danger" : "success";
  }, [stitchRate, form.customer_base_rate]);

  const canSubmit = step1Valid;
  const showFinal = canSubmit && toNum(form.rate) > 0;

  // ── Submit ──
  async function handleSubmit() {
    if (submitting) return;
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        apq:             form.apq     === "" ? null : toNum(form.apq),
        apq_chr:         form.apq_chr === "" ? null : toNum(form.apq_chr),
        quantity:        toNum(form.quantity),
        qt_pcs:          qtPcs,
        actual_stitches: toNum(form.actual_stitches),
        design_stitches: designStitches,
        reverse_mode:    reverseMode,
        two_side:        twoSide,
        rate_input:      toNum(form.rate),
        rate:            effectiveRate,
        calculated_rate: calculatedRate,
        stitch_rate:     stitchRate,
        total_amount:    totalAmount,
      };
      await onAction(isEdit ? "edit" : "add", isEdit ? { id: initialData._id, ...payload } : payload);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Order" : "Generate Order"}
      subtitle={isEdit ? `Editing — ${form.customer_name}` : "Fill in details step by step"}
      maxWidth="max-w-4xl"
      footer={
        <div className="flex items-center justify-between w-full">

          {/* ── Left: hint text ── */}
          <div className="text-xs text-gray-400">
            {step === 1 && !form.customer_id                                 && "← Select a customer to begin"}
            {step === 1 && form.customer_id && !form.date                    && "← Set the order date"}
            {step === 1 && form.customer_id && form.date && !form.machine_no && "← Select a machine"}
            {step === 1 && form.customer_id && form.date && form.machine_no && !toNum(form.quantity) && "← Enter quantity"}
            {step === 1 && step1Valid                                        && "Press Enter ↵ or click Next"}
            {step === 2 && !toNum(form.rate)                                 && "← Enter rate to calculate amount"}
            {step === 2 && toNum(form.rate) > 0 && stitchStatus === "danger" && (
              <span className="text-red-600 font-medium flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Stitch rate below customer base
              </span>
            )}
            {step === 2 && toNum(form.rate) > 0 && stitchStatus === "success" && (
              <span className="text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Total: {formatNumbers(totalAmount, 2)}
              </span>
            )}
          </div>

          {/* ── Right: action buttons ── */}
          <div className="flex gap-2.5">
            {step === 1 && (
              <>
                <Button variant="secondary" outline onClick={onClose} disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  iconRight={ChevronRight}
                  onClick={goToStep2}
                  disabled={!step1Valid}
                >
                  Next
                </Button>
              </>
            )}

            {step === 2 && (
              <>
                <Button variant="secondary" outline icon={ChevronLeft} onClick={goToStep1} disabled={submitting}>
                  Back
                </Button>
                <Button
                  icon={Save}
                  onClick={handleSubmit}
                  data-save-btn="true"
                  disabled={!canSubmit || submitting}
                  loading={submitting}
                >
                  {isEdit ? "Save Changes" : "Create Order"}
                </Button>
              </>
            )}
          </div>

        </div>
      }
    >
      <div className="h-full overflow-y-scroll p-0.5 flex flex-col gap-4">

        {/* ── Step Indicator ── */}
        <StepIndicator
          current={step}
          completed={completedSteps}
          onStepClick={handleStepClick}
        />

        {/* ══ Step 1: Order Info ══════════════════════════════════════════ */}
        {step === 1 && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-3.5">
              {customersLoading ? (
                <Input
                  label="Customer"
                  icon={<Loader2 className="h-4 w-4 animate-spin" />}
                  placeholder="Loading..."
                  readOnly
                />
              ) : (
                <Select
                  ref={customerRef}
                  label="Customer"
                  value={form.customer_id}
                  onChange={handleCustomerSelect}
                  options={customers.map((c) => ({ label: c.name, value: c._id }))}
                  placeholder="Select customer..."
                />
              )}
              <Input
                ref={dateRef}
                label="Date"
                type="date"
                value={form.date}
                onChange={handleDateChange}
                onKeyDown={handleDateKeyDown}
                disabled={!form.customer_id}
              />
              <Select
                ref={machineRef}
                label="Machine"
                value={form.machine_no}
                onChange={handleMachineSelect}
                options={machineOptions}
                placeholder={machineOptions.length ? "Select..." : "No machine options in settings"}
                disabled={!form.customer_id}
              />
            </div>

            {form.customer_id && (
              <Input
                label="Customer Base Rate"
                value={form.customer_base_rate !== "" ? formatNumbers(toNum(form.customer_base_rate), 2) : ""}
                readOnly
                required={false}
                icon={<Hash className="h-4 w-4 text-gray-400" />}
                iconPosition="right"
              />
            )}

            <div className="grid grid-cols-3 gap-3.5">
              <Input
                ref={descRef}
                label="Description"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                onKeyDown={handleDescKeyDown}
                placeholder="Design / item description"
                required={false}
                disabled={!form.machine_no}
              />
              <Input
                ref={lotNoRef}
                label="Lot No"
                value={form.lot_no}
                onChange={(e) => setForm((p) => ({ ...p, lot_no: e.target.value }))}
                onKeyDown={handleLotNoKeyDown}
                placeholder="e.g. LOT-001"
                required={false}
                disabled={!form.machine_no}
              />
              <Select
                ref={unitRef}
                label="Unit"
                value={form.unit}
                onChange={handleUnitSelect}
                options={unitOptions}
                placeholder={unitOptions.length ? "Select unit..." : "No units in settings"}
                disabled={!form.machine_no}
              />
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <Input
                ref={quantityRef}
                label={`Quantity (${unitLabel})`}
                type="number"
                value={form.quantity}
                onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                onKeyDown={handleQuantityKeyDown}
                placeholder="0"
                min={0}
                disabled={!form.machine_no}
              />
              <Input
                label={`Pieces (×${unitMultiplier})`}
                value={qtPcs > 0 ? formatNumbers(qtPcs) : ""}
                readOnly
                required={false}
              />
            </div>
          </div>
        )}

        {/* ══ Step 2: Stitches & Rate ══════════════════════════════════════ */}
        {step === 2 && (
          <div className="flex flex-col gap-3">

            {/* ── Mode toggles ── */}
            <div className="flex items-center gap-2">
              {/* Reverse mode: skip stitches, derive from rate */}
              <button
                type="button"
                onClick={toggleReverseMode}
                title={`Shortcut: ${formatComboDisplay(reverseModeShortcut)}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                  ${reverseMode
                    ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                    : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300"}`}
              >
                <RefreshCw className="h-3 w-3" />
                {reverseMode ? "Rate → Stitch (on)" : "Rate → Stitch"}
              </button>

              {/* 2-side: rate×2, stitch÷2 */}
              <button
                type="button"
                onClick={toggleTwoSide}
                title={`Shortcut: ${formatComboDisplay(twoSideShortcut)}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                  ${twoSide
                    ? "bg-amber-50 border-amber-300 text-amber-700"
                    : "bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300"}`}
              >
                <Layers className="h-3 w-3" />
                {twoSide ? "2-Side (on)" : "2-Side"}
              </button>

              {(reverseMode || twoSide) && (
                <span className="text-[10px] text-gray-400 ml-1">
                  {reverseMode && twoSide && "DS = ((rate÷2) − APQ Chr) ÷ base rate × 1000"}
                  {reverseMode && !twoSide && "Design stitches derived from rate"}
                  {!reverseMode && twoSide && "Rate ×2 applied"}
                </span>
              )}
            </div>

            {/* ── Actual Stitches + Design Stitches ── */}
            <div className="grid grid-cols-2 gap-3.5">
              <Input
                ref={stitchRef}
                label="Actual Stitches"
                type="number"
                value={form.actual_stitches}
                onChange={set("actual_stitches")}
                onKeyDown={handleStitchKeyDown}
                placeholder={reverseMode ? "Skipped — derived from rate" : "0"}
                min={0}
                required={false}
                disabled={reverseMode}
              />
              <Input
                label="Design Stitches (auto)"
                value={designStitches > 0 ? String(designStitches) : ""}
                readOnly
                required={false}
              />
            </div>

            {/* ── APQ ── */}
            <div className="grid grid-cols-2 gap-3.5">
              <Input
                ref={apqRef}
                label="APQ"
                value={form.apq}
                onChange={handleApqChange}
                onKeyDown={handleApqKeyDown}
                placeholder="0"
                required={false}
                error={apqError}
              />
              <Input
                ref={apqChrRef}
                label="APQ Charges"
                value={form.apq_chr}
                onChange={handleApqChrChange}
                onKeyDown={handleApqChrKeyDown}
                placeholder="0.00"
                required={false}
              />
            </div>

            {/* ── Rate + Total ── */}
            <div className="grid grid-cols-2 gap-3.5">
              <Input
                ref={rateRef}
                label={`Rate${twoSide ? " (×2 applied)" : ""}`}
                type="number"
                value={form.rate}
                onChange={set("rate")}
                onKeyDown={handleRateKeyDown}
                placeholder="0.00"
                min={0}
                required={false}
              />
              <Input
                label="Total Amount"
                value={totalAmount > 0 ? formatNumbers(totalAmount, 2) : ""}
                readOnly
                required={false}
              />
            </div>

            {/* ── Calculated Rate + Stitch Rate ── */}
            <div className="grid grid-cols-2 gap-3.5">
              <Input
                label="Calculated Rate"
                value={calculatedRate > 0 ? formatNumbers(calculatedRate, 2) : ""}
                readOnly
                required={false}
              />
              <Input
                label="Stitch Rate"
                value={stitchRate > 0 ? formatNumbers(stitchRate, 2) : ""}
                readOnly
                required={false}
              />
            </div>

            {stitchStatus === "danger" && (
              <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Stitch rate is below the customer's base rate. Verify before saving.
              </div>
            )}
            {stitchStatus === "success" && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                Stitch rate meets or exceeds customer base rate.
              </div>
            )}

            {showFinal && (
              <FinalAmountCard
                amount={totalAmount}
                isFixed={false}
                breakdown={[
                  { label: "Pieces",                                                                      value: qtPcs },
                  { label: twoSide ? `Rate (${toNum(form.rate)} ×2)` : "Rate",                           value: effectiveRate },
                  ...(calculatedRate > 0 ? [{ label: "Calculated Rate",                                   value: calculatedRate }] : []),
                  ...(stitchRate > 0     ? [{ label: `Stitch Rate${stitchStatus === "danger" ? " ⚠" : ""}`, value: stitchRate }]  : []),
                ]}
              />
            )}
          </div>
        )}

      </div>
    </Modal>
  );
}
