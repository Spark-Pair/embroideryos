import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import Modal from "../Modal";
import Button from "../Button";
import Input from "../Input";
import Select from "../Select";
import { fetchCustomers } from "../../api/customer";
import { useFormKeyboard } from "../../hooks/useFormKeyboard";
import { useToast } from "../../context/ToastContext";

const METHOD_OPTIONS = [
  { label: "Cash", value: "cash" },
  { label: "Cheque", value: "cheque" },
  { label: "Slip", value: "slip" },
  { label: "Online", value: "online" },
  { label: "Adjustment", value: "adjustment" },
];

const BANK_SUGGESTIONS = ["HBL", "UBL", "Meezan Bank", "Allied Bank", "MCB", "Bank Alfalah"];
const PARTY_SUGGESTIONS = ["Party A", "Party B", "Agent", "Courier Office", "Customer Representative"];

const todayInput = () => new Date().toISOString().slice(0, 10);
const monthFromDate = (dateValue) => (dateValue || todayInput()).slice(0, 7);

const needsReference = (method) => method === "online" || method === "cheque" || method === "slip";
const needsBank = (method) => method === "online" || method === "cheque";
const needsParty = (method) => method === "slip";
const needsChequeDates = (method) => method === "cheque" || method === "slip";

export default function CustomerPaymentFormModal({ isOpen, onClose, onAction, initialData }) {
  const { showToast } = useToast();
  const customerRef = useRef(null);
  const dateRef = useRef(null);
  const methodRef = useRef(null);
  const amountRef = useRef(null);

  const [customerList, setCustomerList] = useState([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    id: "",
    customer_id: "",
    date: todayInput(),
    method: "",
    amount: "",
    reference_no: "",
    bank_name: "",
    party_name: "",
    cheque_date: "",
    clear_date: "",
    remarks: "",
  });
  const mode = formData.id ? "edit" : "add";

  const customerOptions = useMemo(
    () => customerList.map((c) => ({ label: `${c.name}${c.person ? ` (${c.person})` : ""}`, value: c._id })),
    [customerList]
  );

  const isValid = useMemo(() => {
    if (!formData.customer_id || !formData.date || !formData.method) return false;

    const amount = Number(formData.amount);
    if (!Number.isFinite(amount) || amount <= 0) return false;

    if (needsReference(formData.method) && !formData.reference_no.trim()) return false;
    if (needsBank(formData.method) && !formData.bank_name.trim()) return false;
    if (needsParty(formData.method) && !formData.party_name.trim()) return false;

    if (needsChequeDates(formData.method)) {
      if (!formData.cheque_date || !formData.clear_date) return false;
      if (new Date(formData.clear_date) < new Date(formData.cheque_date)) return false;
    }

    return true;
  }, [formData]);

  const resetForm = () => {
    setFormData({
      id: "",
      customer_id: "",
      date: todayInput(),
      method: "",
      amount: "",
      reference_no: "",
      bank_name: "",
      party_name: "",
      cheque_date: "",
      clear_date: "",
      remarks: "",
    });
    setError("");
  };

  const setMethod = (method) => {
    setError("");
    setFormData((prev) => {
      const next = { ...prev, method };

      if (!needsReference(method)) next.reference_no = "";
      if (!needsBank(method)) next.bank_name = "";
      if (!needsParty(method)) next.party_name = "";
      if (!needsChequeDates(method)) {
        next.cheque_date = "";
        next.clear_date = "";
      }

      return next;
    });
  };

  const handleSubmit = async () => {
    setError("");

    if (!isValid) {
      const message = "Please fill all required fields for selected method.";
      setError(message);
      showToast({ type: "warning", message });
      return;
    }

    if (needsChequeDates(formData.method) && new Date(formData.clear_date) < new Date(formData.cheque_date)) {
      const message = "Clear date must be greater than or equal to cheque/slip date.";
      setError(message);
      showToast({ type: "warning", message });
      return;
    }

    setSubmitting(true);
    try {
      await onAction(mode, {
        id: formData.id || undefined,
        customer_id: formData.customer_id,
        date: formData.date,
        month: monthFromDate(formData.date),
        method: formData.method,
        amount: Number(formData.amount),
        reference_no: formData.reference_no.trim(),
        bank_name: formData.bank_name.trim(),
        party_name: formData.party_name.trim(),
        cheque_date: formData.cheque_date || null,
        clear_date: formData.clear_date || null,
        remarks: formData.remarks?.trim() || "",
      });

      onClose();
    } catch {
      // Parent toast handles API error
    } finally {
      setSubmitting(false);
    }
  };

  useFormKeyboard({ onEnterSubmit: handleSubmit });

  useEffect(() => {
    if (!isOpen) return;

    const toInputDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");

    if (initialData?._id) {
      setFormData({
        id: initialData._id,
        customer_id: initialData.customer_id?._id || initialData.customer_id || "",
        date: toInputDate(initialData.date) || todayInput(),
        method: initialData.method || "",
        amount: initialData.amount ?? "",
        reference_no: initialData.reference_no || "",
        bank_name: initialData.bank_name || "",
        party_name: initialData.party_name || "",
        cheque_date: toInputDate(initialData.cheque_date),
        clear_date: toInputDate(initialData.clear_date),
        remarks: initialData.remarks || "",
      });
      setError("");
    } else {
      resetForm();
    }

    const loadCustomers = async () => {
      setCustomerLoading(true);
      try {
        const res = await fetchCustomers({ page: 1, limit: 5000, status: "active" });
        setCustomerList(res?.data || []);
      } catch {
        setCustomerList([]);
        showToast({ type: "error", message: "Failed to load customers" });
      } finally {
        setCustomerLoading(false);
        setTimeout(() => customerRef.current?.focus(), 120);
      }
    };

    loadCustomers();
  }, [isOpen, initialData]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-2xl"
      title={mode === "edit" ? "Edit Customer Payment" : "Receive Customer Payment"}
      subtitle="Select customer, date, method and required payment details."
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-red-600">{error}</p>
          <div className="flex gap-3">
            <Button outline variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={submitting} disabled={!isValid}>
              {mode === "edit" ? "Update Payment" : "Save Payment"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-0.5">
        <div className="md:col-span-2">
          {customerLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading customer list...
            </div>
          ) : (
            <Select
              ref={customerRef}
              label="Customer"
              value={formData.customer_id}
              onChange={(value) => {
                setFormData((prev) => ({ ...prev, customer_id: value }));
                setTimeout(() => dateRef.current?.focus(), 50);
              }}
              options={customerOptions}
              placeholder="Select customer..."
            />
          )}
        </div>

        <Input
          ref={dateRef}
          label="Date"
          type="date"
          value={formData.date}
          onChange={(e) => {
            setError("");
            setFormData((prev) => ({ ...prev, date: e.target.value }));
            setTimeout(() => methodRef.current?.focus(), 50);
          }}
        />

        <Select
          ref={methodRef}
          label="Method"
          value={formData.method}
          onChange={(value) => {
            setMethod(value);
            setTimeout(() => amountRef.current?.focus(), 50);
          }}
          options={METHOD_OPTIONS}
          placeholder="Select method..."
        />

        <Input
          ref={amountRef}
          label="Amount"
          type="number"
          min="0"
          step="0.01"
          value={formData.amount}
          onChange={(e) => {
            setError("");
            setFormData((prev) => ({ ...prev, amount: e.target.value }));
          }}
          placeholder="Enter amount"
        />

        {needsReference(formData.method) && (
          <Input
            label="Reference No"
            value={formData.reference_no}
            onChange={(e) => {
              setError("");
              setFormData((prev) => ({ ...prev, reference_no: e.target.value }));
            }}
            placeholder="Enter reference number"
          />
        )}

        {needsBank(formData.method) && (
          <div>
            <Input
              label="Bank Name"
              list="bank-name-suggestions"
              value={formData.bank_name}
              onChange={(e) => {
                setError("");
                setFormData((prev) => ({ ...prev, bank_name: e.target.value }));
              }}
              placeholder="Select or type bank name"
            />
            <datalist id="bank-name-suggestions">
              {BANK_SUGGESTIONS.map((bank) => (
                <option key={bank} value={bank} />
              ))}
            </datalist>
          </div>
        )}

        {needsParty(formData.method) && (
          <div>
            <Input
              label="Party Name"
              list="party-name-suggestions"
              value={formData.party_name}
              onChange={(e) => {
                setError("");
                setFormData((prev) => ({ ...prev, party_name: e.target.value }));
              }}
              placeholder="Select or type party name"
            />
            <datalist id="party-name-suggestions">
              {PARTY_SUGGESTIONS.map((party) => (
                <option key={party} value={party} />
              ))}
            </datalist>
          </div>
        )}

        {needsChequeDates(formData.method) && (
          <Input
            label={formData.method === "slip" ? "Slip Date" : "Cheque Date"}
            type="date"
            value={formData.cheque_date}
            onChange={(e) => {
              setError("");
              setFormData((prev) => ({ ...prev, cheque_date: e.target.value }));
            }}
          />
        )}

        {needsChequeDates(formData.method) && (
          <Input
            label="Clear Date"
            type="date"
            min={formData.cheque_date || undefined}
            value={formData.clear_date}
            onChange={(e) => {
              setError("");
              setFormData((prev) => ({ ...prev, clear_date: e.target.value }));
            }}
          />
        )}

        <div className="md:col-span-2">
          <label className="block mb-1.5 text-sm text-gray-700">
            Remarks <span className="text-gray-400">(Optional)</span>
          </label>
          <textarea
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
