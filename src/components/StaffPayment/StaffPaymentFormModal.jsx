import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import Modal from "../Modal";
import Button from "../Button";
import Input from "../Input";
import Select from "../Select";
import { fetchStaffNames } from "../../api/staff";
import { useFormKeyboard } from "../../hooks/useFormKeyboard";
import { useToast } from "../../context/ToastContext";

const TYPE_OPTIONS = [
  { label: "Advance", value: "advance" },
  { label: "Payment", value: "payment" },
  { label: "Adjustment", value: "adjustment" },
];

const todayInput = () => new Date().toISOString().slice(0, 10);
const monthInput = () => new Date().toISOString().slice(0, 7);

export default function StaffPaymentFormModal({ isOpen, onClose, onAction }) {
  const { showToast } = useToast();
  const staffRef = useRef(null);
  const dateRef = useRef(null);
  const monthRef = useRef(null);
  const typeRef = useRef(null);
  const amountRef = useRef(null);
  const remarksRef = useRef(null);

  const [staffList, setStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    staff_id: "",
    date: todayInput(),
    month: monthInput(),
    type: "",
    amount: "",
    remarks: "",
  });

  const staffOptions = useMemo(
    () => staffList.map((s) => ({ label: s.name, value: s._id })),
    [staffList]
  );

  const handleSubmit = async () => {
    if (!formData.staff_id || !formData.date || !formData.month || !formData.type || !formData.amount) {
      showToast({ type: "warning", message: "Please fill all required fields" });
      return;
    }

    setSubmitting(true);
    try {
      await onAction("add", {
        ...formData,
        amount: Number(formData.amount),
        remarks: formData.remarks?.trim() ? formData.remarks.trim() : null,
      });

      onClose();
    } catch {
      // Toast is handled by parent page
    } finally {
      setSubmitting(false);
    }
  };

  useFormKeyboard({ onEnterSubmit: handleSubmit });

  useEffect(() => {
    if (!isOpen) return;

    setFormData({
      staff_id: "",
      date: todayInput(),
      month: monthInput(),
      type: "",
      amount: "",
      remarks: "",
    });

    const loadStaffs = async () => {
      setStaffLoading(true);
      try {
        const res = await fetchStaffNames({ params: { status: "active" } });
        setStaffList(res.data || []);
      } catch {
        setStaffList([]);
        showToast({ type: "error", message: "Failed to load staff list" });
      } finally {
        setStaffLoading(false);
        setTimeout(() => staffRef.current?.focus(), 120);
      }
    };

    loadStaffs();
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-xl"
      title="Add Staff Payment"
      subtitle="Select staff, date, month, type, amount and optional remarks."
      footer={
        <div className="flex justify-end gap-3">
          <Button outline variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={submitting}
            disabled={!formData.staff_id || !formData.date || !formData.month || !formData.type || !formData.amount}
          >
            Save Payment
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-0.5">
        {staffLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading staff list...
          </div>
        ) : (
          <Select
            ref={staffRef}
            label="Staff"
            value={formData.staff_id}
            onChange={(value) => {
              setFormData((prev) => ({ ...prev, staff_id: value }));
              setTimeout(() => dateRef.current?.focus(), 50);
            }}
            options={staffOptions}
            placeholder="Select staff..."
          />
        )}

        <Input
          ref={dateRef}
          label="Date"
          type="date"
          value={formData.date}
          onChange={(e) => {
            setFormData((prev) => ({ ...prev, date: e.target.value }));
            setTimeout(() => monthRef.current?.focus(), 50);
          }}
        />

        <Input
          ref={monthRef}
          label="Month"
          type="month"
          value={formData.month}
          onChange={(e) => {
            setFormData((prev) => ({ ...prev, month: e.target.value }));
            setTimeout(() => typeRef.current?.focus(), 50);
          }}
        />

        <Select
          ref={typeRef}
          label="Type"
          value={formData.type}
          onChange={(value) => {
            setFormData((prev) => ({ ...prev, type: value }));
            setTimeout(() => amountRef.current?.focus(), 50);
          }}
          options={TYPE_OPTIONS}
          placeholder="Select type..."
        />

        <Input
          ref={amountRef}
          label="Amount"
          type="number"
          min="0"
          step="0.01"
          value={formData.amount}
          onChange={(e) => {
            setFormData((prev) => ({ ...prev, amount: e.target.value }));
          }}
          placeholder="Enter amount"
        />

        <div>
          <label className="block mb-1.5 text-sm text-gray-700">
            Remarks <span className="text-gray-400">(Optional)</span>
          </label>
          <textarea
            ref={remarksRef}
            value={formData.remarks}
            onChange={(e) => setFormData((prev) => ({ ...prev, remarks: e.target.value }))}
            rows={3}
            placeholder="Optional notes..."
            className="w-full border border-gray-400 px-4 py-2 rounded-xl focus:ring-2 focus:ring-teal-300 focus:outline-none bg-gray-50 resize-y"
          />
        </div>
      </div>
    </Modal>
  );
}
