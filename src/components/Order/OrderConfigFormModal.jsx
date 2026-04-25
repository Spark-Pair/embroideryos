import { useEffect, useState } from "react";
import { Check, Plus, Save, Trash2, X } from "lucide-react";
import Modal from "../Modal";
import Button from "../Button";
import Input from "../Input";
import Select from "../Select";

const FORMULA_MODE_OPTIONS = [
  { label: "Fixed", value: "fixed" },
  { label: "Percent", value: "percent" },
  { label: "Identity", value: "identity" },
];

const LEGACY_FORMULA_RULES = [
  { up_to: "4237", mode: "fixed", value: "5000" },
  { up_to: "10000", mode: "percent", value: "18" },
  { up_to: "50000", mode: "percent", value: "10" },
  { up_to: "", mode: "percent", value: "5" },
];

const EMPTY_FORM = {
  effective_date: "",
  stitch_formula_enabled: false,
  stitch_formula_rules: [],
};

const buildFormFromRecord = (record) => {
  if (!record) return { ...EMPTY_FORM, stitch_formula_rules: [] };
  return {
    effective_date: record?.effective_date ? new Date(record.effective_date).toISOString().slice(0, 10) : "",
    stitch_formula_enabled: Boolean(record?.stitch_formula_enabled),
    stitch_formula_rules: Array.isArray(record?.stitch_formula_rules)
      ? record.stitch_formula_rules.map((rule = {}) => ({
          up_to: rule?.up_to == null ? "" : String(rule.up_to),
          mode: ["fixed", "percent", "identity"].includes(rule?.mode) ? rule.mode : "identity",
          value: rule?.value == null ? "" : String(rule.value),
        }))
      : [],
  };
};

export default function OrderConfigFormModal({ isOpen, onClose, onSave, initialData = null }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(buildFormFromRecord(initialData));
    setErrors({});
  }, [isOpen, initialData]);

  const handleRuleChange = (index, key, value) => {
    setForm((prev) => {
      const nextRules = [...prev.stitch_formula_rules];
      nextRules[index] = { ...nextRules[index], [key]: value };
      return { ...prev, stitch_formula_rules: nextRules };
    });
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

  const removeFormula = () => {
    setForm((prev) => ({
      ...prev,
      stitch_formula_enabled: false,
      stitch_formula_rules: [],
    }));
  };

  const toggleFormula = () => {
    setForm((prev) => ({
      ...prev,
      stitch_formula_enabled: !prev.stitch_formula_enabled,
      stitch_formula_rules:
        !prev.stitch_formula_enabled && prev.stitch_formula_rules.length === 0
          ? [{ up_to: "", mode: "identity", value: "" }]
          : prev.stitch_formula_rules,
    }));
  };

  const loadLegacyFormula = () => {
    setForm((prev) => ({
      ...prev,
      stitch_formula_enabled: true,
      stitch_formula_rules: LEGACY_FORMULA_RULES.map((rule) => ({ ...rule })),
    }));
  };

  const validate = () => {
    const errs = {};
    if (!form.effective_date) errs.effective_date = "Effective Date is required";
    if (form.stitch_formula_enabled) {
      if (!form.stitch_formula_rules.length) {
        errs.stitch_formula_rules = "At least one formula rule is required when formula is enabled";
      } else {
        const hasInvalid = form.stitch_formula_rules.some((rule) => {
          if (!rule.mode) return true;
          if ((rule.mode === "fixed" || rule.mode === "percent") && (rule.value === "" || rule.value == null)) return true;
          return false;
        });
        if (hasInvalid) errs.stitch_formula_rules = "Complete all formula rule values";
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
      await onSave({
        effective_date: form.effective_date,
        stitch_formula_enabled: Boolean(form.stitch_formula_enabled),
        stitch_formula_rules: form.stitch_formula_rules.map((rule) => ({
          up_to: rule.up_to === "" || rule.up_to == null ? null : parseFloat(rule.up_to),
          mode: ["fixed", "percent", "identity"].includes(rule.mode) ? rule.mode : "identity",
          value: rule.mode === "identity" ? 0 : parseFloat(rule.value || 0),
        })),
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !submitting && onClose()}
      maxWidth="max-w-4xl"
      title="Order Config"
      subtitle={initialData ? "Prefilled from your active order config." : "Create a new order configuration record"}
      footer={
        <div className="flex justify-end gap-3">
          <Button outline variant="secondary" icon={X} onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" icon={Save} onClick={handleSave} disabled={submitting} loading={submitting}>Save Config</Button>
        </div>
      }
    >
      <div>
        <Input
          label="Effective Date"
          type="date"
          value={form.effective_date}
          onChange={(e) => setForm((prev) => ({ ...prev, effective_date: e.target.value }))}
          required
        />
        {errors.effective_date && <p className="mt-1 text-xs text-red-500">{errors.effective_date}</p>}
      </div>

      <div className="mt-5 rounded-2xl border border-gray-300 bg-gray-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">Order Stitch Formula</p>
            <p className="text-xs text-gray-500">This is separate from staff-record production config.</p>
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
          <Button size="sm" variant="info" outline icon={Plus} onClick={addRule} disabled={!form.stitch_formula_enabled || submitting}>Add Rule</Button>
          <Button size="sm" variant="secondary" outline onClick={loadLegacyFormula} disabled={submitting}>Load Legacy Formula</Button>
          <Button size="sm" variant="danger" outline onClick={removeFormula} disabled={submitting}>Remove Formula</Button>
        </div>

        {errors.stitch_formula_rules && <p className="mt-2 text-xs text-red-500">{errors.stitch_formula_rules}</p>}

        <div className="mt-3 space-y-2">
          {form.stitch_formula_rules.map((rule, idx) => (
            <div key={`rule-${idx}`} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-3">
                <Input label={idx === 0 ? "Up To" : ""} type="number" min={0} step="1" placeholder="blank = no limit" value={rule.up_to} onChange={(e) => handleRuleChange(idx, "up_to", e.target.value)} required={false} />
              </div>
              <div className="col-span-4">
                <Select label={idx === 0 ? "Mode" : ""} value={rule.mode} onChange={(val) => handleRuleChange(idx, "mode", val)} options={FORMULA_MODE_OPTIONS} placeholder="Select mode" />
              </div>
              <div className="col-span-4">
                <Input label={idx === 0 ? "Value" : ""} type="number" min={0} step="0.01" value={rule.value} onChange={(e) => handleRuleChange(idx, "value", e.target.value)} disabled={rule.mode === "identity"} required={false} />
              </div>
              <div className="col-span-1 pb-1">
                <button type="button" onClick={() => removeRule(idx)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-300 text-gray-500 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {!form.stitch_formula_rules.length && (
            <p className="py-2 text-xs text-gray-500">Formula removed. Orders will keep design stitches equal to actual stitches.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
