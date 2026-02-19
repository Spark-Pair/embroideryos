/**
 * ProductionConfigModal.jsx
 *
 * View + Edit global production config.
 * Opens in view mode — user clicks Edit to enable fields.
 *
 * Props:
 *   isOpen    boolean
 *   onClose   () => void
 *   config    current config object from DB
 *   onSave    (updatedConfig) => Promise<void>
 */

import { useState, useEffect } from "react";
import { Edit3, Check, X } from "lucide-react";
import Modal from "../Modal";
import Button from "../Button";

const FIELDS = [
  { key: "stitch_rate",      label: "Stitch Rate",        step: "0.0001", hint: "Per stitch multiplier" },
  { key: "applique_rate",    label: "Applique Rate",       step: "0.001",  hint: "Per applique unit rate" },
  { key: "on_target_pct",    label: "On Target %",         step: "1",      hint: "Multiplier for on-target amount" },
  { key: "after_target_pct", label: "After Target %",      step: "1",      hint: "Multiplier for after-target amount" },
  { key: "pcs_per_round",    label: "PCs Per Round",       step: "1",      hint: "How many pieces make one round" },
  { key: "target_amount",    label: "Daily Target Amount", step: "1",      hint: "Target earnings per day" },
  { key: "off_amount",       label: "Off Amount",          step: "1",      hint: "Amount paid to non-salary staff on Off days" },
  { key: "bonus_rate",       label: "Bonus Rate",          step: "1",      hint: "Amount per bonus unit (e.g. 200)" },
  { key: "effective_date",   label: "Effective Date",      step: null,     hint: "Config applies from this date onwards", isDate: true },
,
  { key: "off_amount",       label: "Off Day Amount",      step: "1",      hint: "Amount for non-salary staff on Off days" },
  { key: "bonus_rate",       label: "Per Bonus Rate",      step: "1",      hint: "Default amount per bonus (e.g. 200)" },
];

function ConfigField({ field, value, editing, onChange }) {
  const displayValue = field.isDate && value
    ? new Date(value).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
    : (value ?? "—");

  const inputValue = field.isDate && value
    ? new Date(value).toISOString().split("T")[0]
    : value;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {field.label}
        </label>
        {field.hint && (
          <span className="text-xs text-gray-400">{field.hint}</span>
        )}
      </div>

      {editing ? (
        <input
          type={field.isDate ? "date" : "number"}
          step={field.step ?? undefined}
          value={inputValue ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
          className="
            w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm
            text-gray-800 outline-none transition
            focus:border-blue-500 focus:ring-2 focus:ring-blue-100
          "
        />
      ) : (
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">
          {displayValue}
        </div>
      )}
    </div>
  );
}

export default function ProductionConfigModal({ isOpen, onClose, config, onSave }) {
  const [editing,    setEditing]    = useState(false);
  const [form,       setForm]       = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Sync config → form on open
  useEffect(() => {
    if (isOpen && config) {
      setForm({
        stitch_rate:      config.stitch_rate,
        applique_rate:    config.applique_rate,
        on_target_pct:    config.on_target_pct,
        after_target_pct: config.after_target_pct,
        pcs_per_round:    config.pcs_per_round,
        target_amount:    config.target_amount,
        off_amount:       config.off_amount   ?? 0,
        bonus_rate:       config.bonus_rate   ?? 200,
      });
      setEditing(false);
    }
  }, [isOpen, config]);

  const handleChange = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      // Convert all to numbers before sending
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, parseFloat(v)])
      );
      await onSave(payload);
      setEditing(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    // Reset to original config
    setForm({
      stitch_rate:      config?.stitch_rate,
      applique_rate:    config?.applique_rate,
      on_target_pct:    config?.on_target_pct,
      after_target_pct: config?.after_target_pct,
      pcs_per_round:    config?.pcs_per_round,
      target_amount:    config?.target_amount,
    });
    setEditing(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Production Config"
      subtitle="Global rates and targets applied to all staff"
      footer={
        editing ? (
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              icon={X}
              onClick={handleCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={Check}
              onClick={handleSave}
              disabled={submitting}
              loading={submitting}
            >
              Save Config
            </Button>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button
              variant="secondary"
              icon={Edit3}
              onClick={() => setEditing(true)}
            >
              Edit Config
            </Button>
          </div>
        )
      }
    >
      <div className="grid grid-cols-2 gap-4">
        {FIELDS.map((field) => (
          <ConfigField
            key={field.key}
            field={field}
            value={form[field.key] ?? ""}
            editing={editing}
            onChange={handleChange}
          />
        ))}
      </div>

      {config?.effective_date && (
        <p className="mt-4 text-xs text-gray-400">
          Effective from:{" "}
          {new Date(config.effective_date).toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      )}
    </Modal>
  );
}