import { useEffect, useState } from "react";
import Modal from "../Modal";
import Button from "../Button";
import Input from "../Input";
import Select from "../Select";
import { formatDate } from "../../utils";

export default function SubscriptionFormModal({ isOpen, onClose, plans, initialData, onSave }) {
  const [formData, setFormData] = useState({
    plan: "trial",
    status: "trial",
    active: true,
    expiresAt: "",
  });

  useEffect(() => {
    setFormData({
      plan: initialData?.plan || "trial",
      status: initialData?.status || "trial",
      active: initialData?.active !== false,
      expiresAt: initialData?.expiresAt ? formatDate(initialData.expiresAt, "yyyy-mm-dd") : "",
    });
  }, [initialData]);

  const planOptions = (plans || []).map((plan) => ({
    label: `${plan.name} (${plan.price})`,
    value: plan.id,
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-xl"
      title="Update Subscription"
      subtitle="Adjust plan and expiry"
      footer={
        <div className="flex gap-3">
          <Button outline variant="secondary" onClick={onClose} className="w-1/3">
            Cancel
          </Button>
          <Button
            className="grow"
            onClick={() => {
              onSave(formData);
              onClose();
            }}
          >
            Save Changes
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Plan"
          value={formData.plan}
          onChange={(value) => setFormData((p) => ({ ...p, plan: value }))}
          options={planOptions}
        />
        <Select
          label="Status"
          value={formData.status}
          onChange={(value) => setFormData((p) => ({ ...p, status: value }))}
          options={[
            { label: "Trial", value: "trial" },
            { label: "Active", value: "active" },
            { label: "Past Due", value: "past_due" },
            { label: "Canceled", value: "canceled" },
            { label: "Expired", value: "expired" },
          ]}
        />
        <Select
          label="Active"
          value={formData.active ? "yes" : "no"}
          onChange={(value) => setFormData((p) => ({ ...p, active: value === "yes" }))}
          options={[
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" },
          ]}
        />
        <Input
          label="Expires At"
          type="date"
          value={formData.expiresAt}
          onChange={(e) => setFormData((p) => ({ ...p, expiresAt: e.target.value }))}
        />
      </div>
    </Modal>
  );
}
