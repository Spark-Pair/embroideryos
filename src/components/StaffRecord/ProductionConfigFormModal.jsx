import { useState } from "react";
import { Check, Plus, Save, Trash2, X } from "lucide-react";
import Modal from "../Modal";
import Button from "../Button";
import Input from "../Input";
import Select from "../Select";

const FIELDS = [
  { key: "stitch_rate", label: "Stitch Rate", hint: "Per stitch multiplier", step: "0.0001", type: "number" },
  { key: "applique_rate", label: "Applique Rate", hint: "Per applique unit rate", step: "0.001", type: "number" },
  { key: "on_target_pct", label: "On Target %", hint: "Multiplier when staff meets daily target", step: "1", type: "number" },
  { key: "after_target_pct", label: "After Target %", hint: "Multiplier for production above target", step: "1", type: "number" },
  { key: "pcs_per_round", label: "PCs Per Round", hint: "How many pieces make one round", step: "1", type: "number" },
  { key: "target_amount", label: "Daily Target Amount", hint: "Target earnings per day", step: "1", type: "number" },
  { key: "off_amount", label: "Off Day Amount", hint: "Amount for non-salary staff on Off days", step: "1", type: "number" },
  { key: "bonus_rate", label: "Bonus Rate", hint: "Default amount per bonus unit (e.g. 200)", step: "1", type: "number" },
  { key: "allowance", label: "Monthly Allowance", hint: "Allowance when monthly attendance criteria pass", step: "1", type: "number" },
  { key: "effective_date", label: "Effective Date", hint: "Config applies from this date onwards", type: "date" },
];

const DEFAULT_STITCH_FORMULA_RULES = [
  { up_to: "4237", mode: "fixed", value: "5000" },
  { up_to: "10000", mode: "percent", value: "18" },
  { up_to: "50000", mode: "percent", value: "10" },
  { up_to: "", mode: "percent", value: "5" },
];

const FORMULA_MODE_OPTIONS = [
  { label: "Fixed", value: "fixed" },
  { label: "Percent", value: "percent" },
  { label: "Identity", value: "identity" },
];

const EMPTY_FORM = {
  stitch_rate: "",
  applique_rate: "",
  on_target_pct: "",
  after_target_pct: "",
  pcs_per_round: "",
  target_amount: "",
  off_amount: "",
  bonus_rate: "",
  allowance: "1500",
  effective_date: "",
  stitch_formula_enabled: true,
  stitch_formula_rules: DEFAULT_STITCH_FORMULA_RULES,
};

export default function ProductionConfigFormModal({ isOpen, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleOpen = () => {
    setForm(EMPTY_FORM);
    setErrors({});
  };

  const handleChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: null }));
  };

  const handleRuleChange = (index, key, value) => {
    setForm((prev) => {
      const nextRules = [...prev.stitch_formula_rules];
      nextRules[index] = { ...nextRules[index], [key]: value };
      return { ...prev, stitch_formula_rules: nextRules };
    });
    if (errors.stitch_formula_rules) {
      setErrors((prev) => ({ ...prev, stitch_formula_rules: null }));
    }
  };

  const addRule = () => {
    setForm((prev) => ({
      ...prev,
      stitch_formula_enabled: true,
      stitch_formula_rules: [...prev.stitch_formula_rules, { up_to: "", mode: "percent", value: "" }],
    }));
  };

  const removeRule = (index) => {
    setForm((prev) => ({
      ...prev,
      stitch_formula_rules: prev.stitch_formula_rules.filter((_, i) => i !== index),
    }));
  };

  const setDefaultFormula = () => {
    setForm((prev) => ({
      ...prev,
      stitch_formula_enabled: true,
      stitch_formula_rules: DEFAULT_STITCH_FORMULA_RULES,
    }));
  };

  const removeFormula = () => {
    setForm((prev) => ({
      ...prev,
      stitch_formula_enabled: false,
      stitch_formula_rules: [],
    }));
  };

  const toggleFormula = () => {
    setForm((prev) => {
      const enabled = !prev.stitch_formula_enabled;
      return {
        ...prev,
        stitch_formula_enabled: enabled,
        stitch_formula_rules:
          enabled && prev.stitch_formula_rules.length === 0
            ? DEFAULT_STITCH_FORMULA_RULES
            : prev.stitch_formula_rules,
      };
    });
  };

  const validate = () => {
    const errs = {};
    FIELDS.forEach(({ key, label }) => {
      const val = form[key];
      if (val === "" || val === null || val === undefined) {
        errs[key] = `${label} is required`;
      }
    });

    if (form.stitch_formula_enabled) {
      if (!form.stitch_formula_rules.length) {
        errs.stitch_formula_rules = "At least one formula rule is required when formula is enabled";
      } else {
        const hasInvalid = form.stitch_formula_rules.some((rule) => {
          if (!rule.mode) return true;
          if ((rule.mode === "fixed" || rule.mode === "percent") && (rule.value === "" || rule.value == null)) {
            return true;
          }
          return false;
        });
        if (hasInvalid) {
          errs.stitch_formula_rules = "Complete all formula rule values";
        }
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
      const payload = Object.fromEntries(
        Object.entries(form)
          .filter(([k]) => k !== "stitch_formula_enabled" && k !== "stitch_formula_rules")
          .map(([k, v]) => {
            const field = FIELDS.find((f) => f.key === k);
            return [k, field?.type === "date" ? v : parseFloat(v)];
          })
      );

      payload.stitch_formula_enabled = Boolean(form.stitch_formula_enabled);
      payload.stitch_formula_rules = form.stitch_formula_rules.map((rule) => ({
        up_to: rule.up_to === "" || rule.up_to == null ? null : parseFloat(rule.up_to),
        mode: ["fixed", "percent", "identity"].includes(rule.mode) ? rule.mode : "identity",
        value: rule.mode === "identity" ? 0 : parseFloat(rule.value || 0),
      }));

      await onSave(payload);
      onClose();
      setForm(EMPTY_FORM);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      onOpen={handleOpen}
      maxWidth="max-w-4xl"
      title="Add Config"
      subtitle="Create a new production configuration record"
      footer={
        <div className="flex justify-end gap-3">
          <Button outline variant="secondary" icon={X} onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" icon={Save} onClick={handleSave} disabled={submitting} loading={submitting}>
            Save Config
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-x-5 gap-y-4 p-0.5">
        {FIELDS.map((field) => (
          <div key={field.key}>
            <Input
              id={field.key}
              name={field.key}
              label={field.label}
              type={field.type}
              step={field.step ?? undefined}
              min={0}
              placeholder={field.hint}
              value={form[field.key]}
              onChange={handleChange(field.key)}
              disabled={submitting}
              autocomplete="off"
              required
              className={errors[field.key] ? "border-red-400 focus:ring-red-200" : ""}
            />
            {errors[field.key] && <p className="text-xs text-red-500 mt-1">{errors[field.key]}</p>}
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-gray-300 bg-gray-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">Order Stitch Formula</p>
            <p className="text-xs text-gray-500">Enable to apply design-stitch conversion rules on orders.</p>
          </div>
          <Button
            size="sm"
            variant={form.stitch_formula_enabled ? "success" : "secondary"}
            outline={!form.stitch_formula_enabled}
            icon={Check}
            onClick={toggleFormula}
            disabled={submitting}
          >
            {form.stitch_formula_enabled ? "Enabled" : "Disabled"}
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="info" outline icon={Plus} onClick={addRule} disabled={!form.stitch_formula_enabled || submitting}>
            Add Rule
          </Button>
          <Button size="sm" variant="secondary" outline onClick={setDefaultFormula} disabled={submitting}>
            Reset Default Formula
          </Button>
          <Button size="sm" variant="danger" outline onClick={removeFormula} disabled={submitting}>
            Remove Formula
          </Button>
        </div>

        {errors.stitch_formula_rules && (
          <p className="text-xs text-red-500 mt-2">{errors.stitch_formula_rules}</p>
        )}

        <div className="mt-3 space-y-2">
          {form.stitch_formula_rules.map((rule, idx) => (
            <div key={`rule-${idx}`} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-3">
                <Input
                  label={idx === 0 ? "Up To" : ""}
                  type="number"
                  min={0}
                  step="1"
                  placeholder="blank = no limit"
                  value={rule.up_to}
                  onChange={(e) => handleRuleChange(idx, "up_to", e.target.value)}
                  disabled={!form.stitch_formula_enabled || submitting}
                  required={false}
                />
              </div>
              <div className="col-span-4">
                <Select
                  label={idx === 0 ? "Mode" : ""}
                  value={rule.mode}
                  onChange={(val) => handleRuleChange(idx, "mode", val)}
                  options={FORMULA_MODE_OPTIONS}
                  placeholder="Select mode"
                  disabled={!form.stitch_formula_enabled || submitting}
                />
              </div>
              <div className="col-span-4">
                <Input
                  label={idx === 0 ? "Value" : ""}
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder={rule.mode === "percent" ? "%" : rule.mode === "fixed" ? "Fixed value" : "0"}
                  value={rule.value}
                  onChange={(e) => handleRuleChange(idx, "value", e.target.value)}
                  disabled={!form.stitch_formula_enabled || submitting || rule.mode === "identity"}
                  required={false}
                />
              </div>
              <div className="col-span-1 pb-1">
                <button
                  type="button"
                  onClick={() => removeRule(idx)}
                  disabled={!form.stitch_formula_enabled || submitting}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-300 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  title="Remove rule"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}

          {!form.stitch_formula_rules.length && (
            <p className="text-xs text-gray-500 py-2">
              Formula removed. Orders will keep design stitches equal to actual stitches.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
