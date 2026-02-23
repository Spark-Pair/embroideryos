import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Save, AlertCircle, CheckCircle2, Loader2, Hash } from "lucide-react";
import Modal from "../Modal";
import Button from "../Button";
import Input from "../Input";
import Select from "../Select";
import { FinalAmountCard } from "../FinalAmountCard";
import { SectionHeader } from "../SectionHeader";
import { formatNumbers } from "../../utils";
import { useFormKeyboard } from "../../hooks/useFormKeyboard";
import { fetchCustomers } from "../../api/customer";

// ─── Constants ────────────────────────────────────────────────────────────────

const MACHINE_OPTIONS = [
  { label: "R1", value: "R1" },
  { label: "R2", value: "R2" },
  { label: "R3", value: "R3" },
  { label: "R4", value: "R4" },
  { label: "R5", value: "R5" },
  { label: "OS", value: "OS" },
];

const UNIT_OPTIONS = [
  { label: "Dozen (×12)", value: "Dzn" },
  { label: "Pieces (×1)", value: "Pcs" },
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

function computeDesignStitches(s) {
  s = toNum(s);
  if (s <= 0)     return 0;
  if (s <= 4237)  return 5000;
  if (s <= 10000) return s + (s * 18 / 100);
  if (s <= 50000) return s + (s * 10 / 100);
  return s + (s * 5 / 100);
}

function computeCalculatedRate(baseRate, ds, apqChr) {
  if (toNum(ds) <= 0) return 0;
  return roundDown(toNum(baseRate) * toNum(ds) / 1000 + toNum(apqChr), 2);
}

function computeStitchRate(rate, ds, apq, apqChr) {
  const d = toNum(ds), r = toNum(rate);
  if (d <= 0 || r <= 0) return 0;
  const base = toNum(apq) === 0 ? r : r - toNum(apqChr);
  return roundDown(base / d * 1000, 2);
}

function computeQtPcs(qty, unit) {
  return unit === "Dzn" ? toNum(qty) * 12 : toNum(qty);
}

function computeTotalAmount(rate, qtPcs) {
  return roundDown(toNum(rate) * toNum(qtPcs), 2);
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Order Info"     },
  { id: 2, label: "Stitches & Rate" },
];

function StepIndicator({ current, completed, onStepClick }) {
  return (
    <div className="flex items-center mb-5">
      {STEPS.map((step, idx) => {
        const isActive    = step.id === current;
        const isDone      = completed.has(step.id);
        const isClickable = isDone && !isActive;
        const isLast      = idx === STEPS.length - 1;

        return (
          <div key={step.id} className="flex items-center flex-1">
            <button
              type="button"
              disabled={!isClickable && !isActive}
              onClick={() => isClickable && onStepClick(step.id)}
              className={`flex flex-col items-center gap-1 flex-shrink-0 focus:outline-none
                ${isClickable ? "cursor-pointer" : "cursor-default"}`}
            >
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-200
                ${isDone && !isActive ? "bg-emerald-500 border-emerald-500 text-white"
                  : isActive          ? "bg-white border-gray-800 text-gray-800"
                  :                     "bg-white border-gray-200 text-gray-300"}`}
              >
                {isDone && !isActive ? <CheckCircle2 className="h-4 w-4" /> : step.id}
              </div>
              <span className={`text-[10px] font-semibold whitespace-nowrap transition-colors
                ${isActive    ? "text-gray-800"
                  : isDone    ? "text-emerald-600"
                  :             "text-gray-300"}`}
              >
                {step.label}
              </span>
            </button>

            {!isLast && (
              <div className={`h-px flex-1 mx-3 mb-3.5 transition-all duration-300
                ${isDone ? "bg-emerald-400" : "bg-gray-200"}`}
              />
            )}
          </div>
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
  unit:               "Dzn",
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
  forceAdd = false,
  onAction,
}) {
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
  const [submitting,       setSubmitting]       = useState(false);

  useFormKeyboard({ onEnterSubmit: handleSubmit });

  const focus = (ref, delay = 40) => setTimeout(() => ref.current?.focus(), delay);

  // ── Load customers → focus customer ──
  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      setCustomersLoading(true);
      try {
        const res = await fetchCustomers({ status: "active" });
        setCustomers(res.data || []);
      } catch { setCustomers([]); }
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
    } else {
      setForm({
        id:                 isEdit ? (initialData._id || "") : "",
        customer_id:        initialData.customer_id       || "",
        customer_name:      initialData.customer_name     || "",
        customer_base_rate: initialData.customer_base_rate ?? "",
        description:        initialData.description        || "",
        date:               initialData.date               || "",
        machine_no:         initialData.machine_no         || "",
        lot_no:             initialData.lot_no             || "",
        unit:               initialData.unit               || "Dzn",
        quantity:           initialData.quantity           ?? "",
        actual_stitches:    initialData.actual_stitches    ?? "",
        apq:                initialData.apq                ?? "",
        apq_chr:            initialData.apq_chr            ?? "",
        rate:               initialData.rate               ?? "",
      });
      // In edit mode both steps are accessible
      setStep(1);
      setCompletedSteps(new Set([1]));
    }
  }, [isOpen, isEdit, initialData]);

  // ── Focus stitchRef when step 2 becomes active ──
  useEffect(() => {
    if (step === 2) focus(stitchRef, 50);
  }, [step]);

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));

  // ── Step 1 valid when all required fields are filled ──
  const step1Valid = !!form.customer_id && !!form.date && !!form.machine_no && toNum(form.quantity) > 0;

  function goToStep2() {
    if (!step1Valid) return;
    setCompletedSteps((p) => new Set([...p, 1]));
    setStep(2);
  }

  function handleStepClick(id) {
    if (id === 1) setStep(1);
    if (id === 2 && step1Valid) goToStep2();
  }

  // ────────────────────────────────────────────────────────────────────────
  // Field handlers — Step 1
  // ────────────────────────────────────────────────────────────────────────

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

  // Quantity Enter → go to step 2
  const handleQuantityKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      goToStep2();
    }
  };

  // ────────────────────────────────────────────────────────────────────────
  // Field handlers — Step 2
  // ────────────────────────────────────────────────────────────────────────

  const handleStitchKeyDown  = (e) => {
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
  const designStitches = useMemo(() => computeDesignStitches(form.actual_stitches), [form.actual_stitches]);
  const qtPcs          = useMemo(() => computeQtPcs(form.quantity, form.unit),       [form.quantity, form.unit]);
  const calculatedRate = useMemo(() => computeCalculatedRate(form.customer_base_rate, designStitches, form.apq_chr), [form.customer_base_rate, designStitches, form.apq_chr]);
  const stitchRate     = useMemo(() => computeStitchRate(form.rate, designStitches, form.apq, form.apq_chr),         [form.rate, designStitches, form.apq, form.apq_chr]);
  const totalAmount    = useMemo(() => computeTotalAmount(form.rate, qtPcs),          [form.rate, qtPcs]);

  const stitchStatus = useMemo(() => {
    const sr = toNum(stitchRate), br = toNum(form.customer_base_rate);
    if (!sr || !br) return "neutral";
    return sr < br ? "danger" : "success";
  }, [stitchRate, form.customer_base_rate]);

  const canSubmit  = step1Valid;
  const showFinal  = canSubmit && toNum(form.rate) > 0;

  // ── Submit ──
  async function handleSubmit() {
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
        rate:            toNum(form.rate),
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
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-400">
            {step === 1 && !form.customer_id                                     && "← Select a customer to begin"}
            {step === 1 && form.customer_id && !form.date                        && "← Set the order date"}
            {step === 1 && form.customer_id && form.date && !form.machine_no     && "← Select a machine"}
            {step === 1 && step1Valid                                            && "Press Enter on Quantity to continue ↵"}
            {step === 2 && !toNum(form.rate)                                     && "← Enter rate to calculate amount"}
            {step === 2 && toNum(form.rate) > 0 && stitchStatus === "danger"  && (
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
          <div className="flex gap-3">
            <Button variant="secondary" outline onClick={onClose} disabled={submitting}>
              Cancel
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
            <SectionHeader
              step="1"
              title="Order Info"
              subtitle="Select customer — base rate fills automatically"
            />

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
                options={MACHINE_OPTIONS}
                placeholder="Select..."
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
                options={UNIT_OPTIONS}
                disabled={!form.machine_no}
              />
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <Input
                ref={quantityRef}
                label={`Quantity (${form.unit})`}
                type="number"
                value={form.quantity}
                onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                onKeyDown={handleQuantityKeyDown}
                placeholder="0"
                min={0}
                disabled={!form.machine_no}
              />
              <Input
                label={`Pieces (×${form.unit === "Dzn" ? "12" : "1"})`}
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
            <SectionHeader
              step="2"
              title="Stitches & Rate"
              subtitle="Actual stitches, APQ and rate — Enter moves to next field"
            />

            <div className="grid grid-cols-2 gap-3.5">
              <Input
                ref={stitchRef}
                label="Actual Stitches"
                type="number"
                value={form.actual_stitches}
                onChange={set("actual_stitches")}
                onKeyDown={handleStitchKeyDown}
                placeholder="0"
                min={0}
                required={false}
              />
              <Input
                label="Design Stitches (auto)"
                value={designStitches > 0 ? formatNumbers(designStitches) : ""}
                readOnly
                required={false}
              />
            </div>

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

            <div className="grid grid-cols-2 gap-3.5">
              <Input
                ref={rateRef}
                label="Rate"
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
                  { label: "Pieces", value: qtPcs },
                  { label: "Rate",   value: toNum(form.rate) },
                  ...(calculatedRate > 0 ? [{ label: "Calculated Rate",                                        value: calculatedRate }] : []),
                  ...(stitchRate > 0     ? [{ label: `Stitch Rate${stitchStatus === "danger" ? " ⚠" : ""}`, value: stitchRate }]     : []),
                ]}
              />
            )}
          </div>
        )}

      </div>
    </Modal>
  );
}
