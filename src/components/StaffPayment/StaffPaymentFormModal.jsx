import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import Modal from "../Modal";
import Button from "../Button";
import Input from "../Input";
import Select from "../Select";
import { fetchStaffNames } from "../../api/staff";
import { fetchMyReferenceData } from "../../api/business";
import { useFormKeyboard } from "../../hooks/useFormKeyboard";
import { useToast } from "../../context/ToastContext";

const todayInput = () => new Date().toISOString().slice(0, 10);
const monthInput = () => new Date().toISOString().slice(0, 7);
const toInputDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");

export default function StaffPaymentFormModal({ isOpen, onClose, onAction, initialData }) {
  const { showToast } = useToast();
  const staffRef = useRef(null);
  const dateRef = useRef(null);
  const monthRef = useRef(null);
  const typeRef = useRef(null);
  const amountRef = useRef(null);
  const remarksRef = useRef(null);

  const [staffList, setStaffList] = useState([]);
  const [referenceData, setReferenceData] = useState({ staff_payment_types: [] });
  const [staffLoading, setStaffLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    id: "",
    staff_id: "",
    date: todayInput(),
    month: monthInput(),
    type: "",
    amount: "",
    remarks: "",
  });
  const mode = formData.id ? "edit" : "add";

  const staffOptions = useMemo(
    () => staffList.map((s) => ({ label: s.name, value: s._id })),
    [staffList]
  );
  const typeOptions = useMemo(
    () => (referenceData.staff_payment_types || []).map((item) => ({ label: item, value: item })),
    [referenceData.staff_payment_types]
  );

  const handleSubmit = async () => {
    if (!formData.staff_id || !formData.date || !formData.month || !formData.type || !formData.amount) {
      showToast({ type: "warning", message: "Please fill all required fields" });
      return;
    }

    setSubmitting(true);
    try {
      const { id, ...rest } = formData;
      await onAction(mode, {
        id: id || undefined,
        ...rest,
        amount: Number(rest.amount),
        remarks: rest.remarks?.trim() ? rest.remarks.trim() : null,
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

    if (initialData?._id) {
      setFormData({
        id: initialData._id,
        staff_id: initialData.staff_id?._id || initialData.staff_id || "",
        date: toInputDate(initialData.date) || todayInput(),
        month: initialData.month || monthInput(),
        type: initialData.type || "",
        amount: initialData.amount ?? "",
        remarks: initialData.remarks || "",
      });
    } else {
      setFormData({
        id: "",
        staff_id: "",
        date: todayInput(),
        month: monthInput(),
        type: "",
        amount: "",
        remarks: "",
      });
    }

    const loadStaffs = async () => {
      setStaffLoading(true);
      try {
        const [res, referenceRes] = await Promise.all([
          fetchStaffNames({ params: { status: "active" } }),
          fetchMyReferenceData().catch(() => ({ reference_data: {} })),
        ]);
        setStaffList(res.data || []);
        setReferenceData(referenceRes?.reference_data || { staff_payment_types: [] });
      } catch {
        setStaffList([]);
        setReferenceData({ staff_payment_types: [] });
        showToast({ type: "error", message: "Failed to load staff list" });
      } finally {
        setStaffLoading(false);
        setTimeout(() => staffRef.current?.focus(), 120);
      }
    };

    loadStaffs();
  }, [isOpen, initialData]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-xl"
      title={mode === "edit" ? "Edit Staff Payment" : "Add Staff Payment"}
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
            {mode === "edit" ? "Update Payment" : "Save Payment"}
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
          options={typeOptions}
          placeholder={typeOptions.length ? "Select type..." : "No types in settings"}
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
