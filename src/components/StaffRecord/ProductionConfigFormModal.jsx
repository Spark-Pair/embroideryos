import { useEffect, useMemo, useState } from "react";
import { Save, X } from "lucide-react";
import Modal from "../Modal";
import Button from "../Button";
import Input from "../Input";
import Select from "../Select";
import {
  EMPTY_PRODUCTION_CONFIG,
  PAYOUT_MODES,
  getPayoutModeOptions,
  normalizeProductionConfig,
} from "../../utils/productionPayout";

const COMMON_FIELDS = [
  { key: "stitch_rate", label: "Stitch Rate", hint: "Per stitch multiplier", step: "0.0001", type: "number" },
  { key: "applique_rate", label: "Applique Rate", hint: "Per applique unit rate", step: "0.001", type: "number" },
  { key: "pcs_per_round", label: "PCs Per Round", hint: "How many pieces make one round", step: "1", type: "number" },
  { key: "off_amount", label: "Off Day Amount", hint: "Amount for non-salary staff on Off days", step: "1", type: "number" },
  { key: "bonus_rate", label: "Bonus Rate", hint: "Default amount per bonus unit", step: "1", type: "number" },
  { key: "allowance", label: "Monthly Allowance", hint: "Allowance when monthly attendance criteria pass", step: "1", type: "number" },
  { key: "stitch_cap", label: "Minimum Stitch Cap", hint: "If design stitch is below this, use this value", step: "1", type: "number" },
  { key: "effective_date", label: "Effective Date", hint: "Config applies from this date onwards", type: "date" },
];

const MODE_FIELDS = {
  [PAYOUT_MODES.TARGET_DUAL_PCT]: [
    { key: "on_target_pct", label: "On Target %", hint: "Multiplier when target is not crossed", step: "1", type: "number" },
    { key: "after_target_pct", label: "After Target %", hint: "Multiplier after crossing target", step: "1", type: "number" },
    { key: "target_amount", label: "Daily Target Amount", hint: "Target earnings per day", step: "1", type: "number" },
  ],
  [PAYOUT_MODES.SINGLE_PCT]: [
    { key: "production_pct", label: "Production %", hint: "Single multiplier for all production", step: "1", type: "number" },
  ],
  [PAYOUT_MODES.SALARY_BONUS_ONLY]: [],
  [PAYOUT_MODES.STITCH_BLOCK_RATE]: [
    { key: "stitch_block_size", label: "Stitch Block Size", hint: "Example: 50000 stitches", step: "1", type: "number" },
    { key: "amount_per_block", label: "Amount Per Block", hint: "Example: 100 rupees per block", step: "1", type: "number" },
  ],
};

const EMPTY_FORM = {
  payout_mode: EMPTY_PRODUCTION_CONFIG.payout_mode,
  stitch_rate: "",
  applique_rate: "",
  on_target_pct: "",
  after_target_pct: "",
  production_pct: "",
  stitch_block_size: "",
  amount_per_block: "",
  pcs_per_round: "",
  target_amount: "",
  off_amount: "",
  bonus_rate: "",
  allowance: "",
  stitch_cap: "",
  effective_date: "",
};

const evaluateMathExpression = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (!/^[\d+\-*/().\s]+$/.test(raw)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${raw})`)();
    if (!Number.isFinite(result)) return null;
    return Number(result);
  } catch {
    return null;
  }
};

const normalizeNumberString = (value) => {
  if (!Number.isFinite(value)) return "";
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
};

const buildFormFromRecord = (record) => {
  if (!record) return { ...EMPTY_FORM };
  const normalized = normalizeProductionConfig(record);
  return {
    payout_mode: normalized.payout_mode,
    stitch_rate: record?.stitch_rate ?? "",
    applique_rate: record?.applique_rate ?? "",
    on_target_pct: record?.on_target_pct ?? "",
    after_target_pct: record?.after_target_pct ?? "",
    production_pct: record?.production_pct ?? "",
    stitch_block_size: record?.stitch_block_size ?? "",
    amount_per_block: record?.amount_per_block ?? "",
    pcs_per_round: record?.pcs_per_round ?? "",
    target_amount: record?.target_amount ?? "",
    off_amount: record?.off_amount ?? "",
    bonus_rate: record?.bonus_rate ?? "",
    allowance: record?.allowance ?? "",
    stitch_cap: record?.stitch_cap ?? "",
    effective_date: record?.effective_date
      ? new Date(record.effective_date).toISOString().slice(0, 10)
      : "",
  };
};

export default function ProductionConfigFormModal({
  isOpen,
  onClose,
  onSave,
  initialData = null,
  clearEffectiveDateOnOpen = false,
  existingConfigs = [],
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const nextForm = buildFormFromRecord(initialData);
    if (clearEffectiveDateOnOpen) {
      nextForm.effective_date = "";
    }
    setForm(nextForm);
    setErrors({});
  }, [isOpen, initialData, clearEffectiveDateOnOpen]);

  const visibleFields = useMemo(() => {
    const modeSpecific = MODE_FIELDS[form.payout_mode] || [];
    return [...modeSpecific, ...COMMON_FIELDS];
  }, [form.payout_mode]);

  const handleChange = (key) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: null }));
  };

  const handleNumericBlur = (key) => () => {
    const resolved = evaluateMathExpression(form[key]);
    if (resolved === null) return;
    setForm((prev) => ({ ...prev, [key]: normalizeNumberString(resolved) }));
  };

  const handleNumericKeyDown = (key) => (e) => {
    if (e.key !== "Enter") return;
    const resolved = evaluateMathExpression(form[key]);
    if (resolved === null) return;
    e.preventDefault();
    setForm((prev) => ({ ...prev, [key]: normalizeNumberString(resolved) }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: null }));
  };

  const validate = () => {
    const errs = {};
    visibleFields.forEach(({ key, label, type }) => {
      const val = form[key];
      if (val === "" || val === null || val === undefined) {
        errs[key] = `${label} is required`;
        return;
      }
      if (type === "number" && evaluateMathExpression(val) === null) {
        errs[key] = `${label} must be a valid number or math expression`;
      }
    });

    const effectiveDate = String(form.effective_date || "").trim();
    if (effectiveDate) {
      const duplicateConfig = (Array.isArray(existingConfigs) ? existingConfigs : []).find((config) => {
        const configDate = config?.effective_date
          ? new Date(config.effective_date).toISOString().slice(0, 10)
          : "";
        return configDate === effectiveDate;
      });
      if (duplicateConfig) {
        errs.effective_date = "A config already exists for this effective date";
      }
    }

    return errs;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        payout_mode: form.payout_mode,
        effective_date: form.effective_date,
      };

      visibleFields.forEach((field) => {
        if (field.key === "effective_date") return;
        payload[field.key] = evaluateMathExpression(form[field.key]);
      });

      await onSave(payload);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={submitting ? undefined : onClose}
      maxWidth="max-w-4xl"
      title="Production Config"
      subtitle={initialData ? "Prefilled from your active staff-record config. Set a new effective date to create the next config." : "Create a new production configuration record"}
      footer={
        <div className="flex justify-end gap-3">
          <Button outline variant="secondary" icon={X} onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" icon={Save} onClick={handleSave} disabled={submitting} loading={submitting}>
            Save Config
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-x-5 gap-y-4 p-0.5">
        <div className="col-span-2">
          <Select
            label="Payout Mode"
            value={form.payout_mode}
            onChange={(value) => {
              setForm((prev) => ({ ...prev, payout_mode: value }));
              if (errors.payout_mode) setErrors((prev) => ({ ...prev, payout_mode: null }));
            }}
            options={getPayoutModeOptions()}
            placeholder="Select payout mode..."
          />
        </div>

        {visibleFields.map((field) => (
          <div key={field.key} className={field.key === "effective_date" ? "col-span-2" : ""}>
            <Input
              id={field.key}
              name={field.key}
              label={field.label}
              type={field.type === "number" ? "text" : field.type}
              inputMode={field.type === "number" ? "decimal" : undefined}
              step={field.step ?? undefined}
              min={0}
              placeholder={field.type === "number" ? `${field.hint} e.g. 200*12` : field.hint}
              value={form[field.key]}
              onChange={handleChange(field.key)}
              onBlur={field.type === "number" ? handleNumericBlur(field.key) : undefined}
              onKeyDown={field.type === "number" ? handleNumericKeyDown(field.key) : undefined}
              disabled={submitting}
              autocomplete="off"
              required
              className={errors[field.key] ? "border-red-400 focus:ring-red-200" : ""}
            />
            {errors[field.key] && <p className="mt-1 text-xs text-red-500">{errors[field.key]}</p>}
          </div>
        ))}
      </div>
    </Modal>
  );
}
