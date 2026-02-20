// components/StaffRecord/ProductionConfigFormModal.jsx

import { useState } from "react";
import { Check, Save, X } from "lucide-react";
import Modal from "../Modal";
import Button from "../Button";
import Input from "../Input";

const FIELDS = [
  { key: "stitch_rate",      label: "Stitch Rate",        hint: "Per stitch multiplier",                    step: "0.0001", type: "number" },
  { key: "applique_rate",    label: "Applique Rate",       hint: "Per applique unit rate",                   step: "0.001",  type: "number" },
  { key: "on_target_pct",    label: "On Target %",         hint: "Multiplier when staff meets daily target", step: "1",      type: "number" },
  { key: "after_target_pct", label: "After Target %",      hint: "Multiplier for production above target",   step: "1",      type: "number" },
  { key: "pcs_per_round",    label: "PCs Per Round",       hint: "How many pieces make one round",           step: "1",      type: "number" },
  { key: "target_amount",    label: "Daily Target Amount", hint: "Target earnings per day",                  step: "1",      type: "number" },
  { key: "off_amount",       label: "Off Day Amount",      hint: "Amount for non-salary staff on Off days",  step: "1",      type: "number" },
  { key: "bonus_rate",       label: "Bonus Rate",          hint: "Default amount per bonus unit (e.g. 200)", step: "1",      type: "number" },
  { key: "effective_date",   label: "Effective Date",      hint: "Config applies from this date onwards",    type: "date"   },
];

const EMPTY_FORM = {
  stitch_rate: "", applique_rate: "", on_target_pct: "",
  after_target_pct: "", pcs_per_round: "", target_amount: "",
  off_amount: "", bonus_rate: "", effective_date: "",
};

export default function ProductionConfigFormModal({ isOpen, onClose, onSave }) {
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [errors,     setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleOpen = () => {
    setForm(EMPTY_FORM);
    setErrors({});
  };

  // Input component returns e.target.value — curried per field key
  const handleChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: null }));
  };

  const validate = () => {
    const errs = {};
    FIELDS.forEach(({ key, label }) => {
      const val = form[key];
      if (val === "" || val === null || val === undefined) {
        errs[key] = `${label} is required`;
      }
    });
    return errs;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => {
          const field = FIELDS.find((f) => f.key === k);
          return [k, field?.type === "date" ? v : parseFloat(v)];
        })
      );
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
      maxWidth="max-w-3xl"
      title="Add Config"
      subtitle="Create a new production configuration record"
      footer={
        <div className="flex justify-end gap-3">
          <Button outline={true} variant="secondary" icon={X} onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={Save}
            onClick={handleSave}
            disabled={submitting}
            loading={submitting}
          >
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
              required
              className={errors[field.key] ? "border-red-400 focus:ring-red-200" : ""}
            />
            {errors[field.key] && (
              <p className="text-xs text-red-500 mt-1">{errors[field.key]}</p>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}