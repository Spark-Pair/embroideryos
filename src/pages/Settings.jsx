import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  ImageUp,
  Plus,
  SlidersHorizontal,
  Wallet,
  Edit3,
  Power,
  Scissors,
  Hash,
} from "lucide-react";
import { fetchProductionConfig, createProductionConfig } from "../api/productionConfig";
import { fetchOrderConfig, createOrderConfig } from "../api/orderConfig";
import {
  fetchMyInvoiceBanner,
  fetchMyMachineOptions,
  fetchMyReferenceData,
  fetchMyRuleData,
  updateMyInvoiceBanner,
  updateMyMachineOptions,
  updateMyReferenceData,
  updateMyRuleData,
  fetchMyInvoiceCounter,
  updateMyInvoiceCounter,
} from "../api/business";
import { fetchMySubscription } from "../api/subscription";
import {
  createExpenseItem,
  fetchExpenseItems,
  toggleExpenseItemStatus,
  updateExpenseItem,
} from "../api/expenseItem";
import {
  createCrpRateConfig,
  fetchCrpRateConfigs,
  toggleCrpRateConfigStatus,
  updateCrpRateConfig,
} from "../api/crpRateConfig";
import { fetchSuppliers } from "../api/supplier";
import PageHeader from "../components/PageHeader";
import ProductionConfigFormModal from "../components/StaffRecord/ProductionConfigFormModal";
import OrderConfigFormModal from "../components/Order/OrderConfigFormModal";
import InvoiceBannerModal from "../components/Invoice/InvoiceBannerModal";
import Modal from "../components/Modal";
import Input from "../components/Input";
import Select from "../components/Select";
import Button from "../components/Button";
import { useToast } from "../context/ToastContext";
import { getModeSummary, getPayoutModeLabel } from "../utils/productionPayout";
import {
  ATTENDANCE_ALLOWANCE_CODES,
  ATTENDANCE_PAY_MODES,
  PAYMENT_EFFECT_MODES,
  defaultAttendanceRules,
  getAccessRules,
  defaultAllowanceRule,
  defaultDisplayPreferences,
  defaultCustomerPaymentMethodRules,
  defaultExpenseTypeRules,
  defaultStaffPaymentTypeRules,
  normalizeRuleData,
} from "../utils/businessRuleData";
import { BUSINESS_ACCESS_ITEMS, defaultAccessRules, normalizeBusinessUserRoles } from "../utils/accessConfig";

const REFERENCE_FIELDS = [
  { key: "staff_categories", label: "Staff Categories", hint: "One per line. Example: Embroidery" },
  { key: "user_roles", label: "User Roles", hint: "One per line. Example: manager" },
  { key: "customer_payment_methods", label: "Customer Payment Methods", hint: "One per line. Example: cash" },
  { key: "supplier_payment_methods", label: "Supplier Payment Methods", hint: "One per line. Example: cheque" },
  { key: "staff_payment_types", label: "Staff Payment Types", hint: "One per line. Example: advance" },
  { key: "order_units", label: "Order Units", hint: "One per line. Use Label|Multiplier, e.g. Dzn|12 or Pcs|1" },
  { key: "crp_categories", label: "CRP Categories", hint: "One per line. Example: Cropping" },
  { key: "bank_suggestions", label: "Bank Suggestions", hint: "One per line. Example: Meezan Bank" },
  { key: "party_suggestions", label: "Party Suggestions", hint: "One per line. Example: Agent" },
];

const emptyReferenceData = () => ({
  attendance_options: [],
  staff_categories: [],
  user_roles: normalizeBusinessUserRoles([]),
  customer_payment_methods: [],
  supplier_payment_methods: [],
  staff_payment_types: [],
  expense_types: [],
  order_units: [],
  crp_categories: [],
  bank_suggestions: [],
  party_suggestions: [],
});

const emptyRuleData = () => ({
  attendance_rules: defaultAttendanceRules(),
  customer_payment_method_rules: defaultCustomerPaymentMethodRules(),
  staff_payment_type_rules: defaultStaffPaymentTypeRules(),
  expense_type_rules: defaultExpenseTypeRules(),
  access_rules: defaultAccessRules(),
  allowance_rule: defaultAllowanceRule(),
  display_preferences: defaultDisplayPreferences(),
});

const toTextareaValue = (list) => (Array.isArray(list) ? list.join("\n") : "");
const fromTextareaValue = (value) =>
  String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
const toReferenceTextareaDraft = (reference = {}) =>
  Object.fromEntries(
    REFERENCE_FIELDS.map((field) => [field.key, toTextareaValue(reference[field.key])])
  );

const fmt = (val, isDate = false) => {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "boolean") return val ? "Enabled" : "Disabled";
  if (isDate) {
    return new Date(val).toLocaleDateString("en-US", {
      day: "numeric", month: "short", year: "numeric",
    });
  }
  return typeof val === "number" ? val.toLocaleString() : val;
};

const PRODUCTION_DISPLAY_FIELDS = [
  { key: "payout_mode", label: "Payout Mode", format: (val) => getPayoutModeLabel(val) },
  { key: "stitch_rate", label: "Stitch Rate" },
  { key: "applique_rate", label: "Applique Rate" },
  { key: "pcs_per_round", label: "PCs Per Round" },
  { key: "off_amount", label: "Off Day Amount" },
  { key: "bonus_rate", label: "Bonus Rate" },
  { key: "allowance", label: "Monthly Allowance" },
  { key: "stitch_cap", label: "Minimum Stitch Cap" },
];

const ORDER_DISPLAY_FIELDS = [
  { key: "stitch_formula_enabled", label: "Stitch Formula" },
];

const describeFormulaRule = (rule = {}) => {
  const limit = rule?.up_to == null || rule?.up_to === "" ? "No max" : `Up to ${rule.up_to}`;
  if (rule?.mode === "fixed") return `${limit}: set design stitches = ${rule.value || 0}`;
  if (rule?.mode === "percent") return `${limit}: actual stitches + ${rule.value || 0}%`;
  return `${limit}: keep actual stitches as design stitches`;
};

const normalizeConfigRows = (value) => {
  const rows = Array.isArray(value) ? value : [value].filter(Boolean);
  return rows.filter((row) => row && (row._id || row.id || row.effective_date));
};

// ── ConfigCard ──────────────────────────────────────────────────────────────
// Active card uses a teal accent to stay consistent with app's primary color.
function ProductionConfigCard({ record, isActive }) {
  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-shadow hover:shadow-sm bg-white ${
        isActive ? "border-teal-600" : "border-gray-300"
      }`}
    >
      <div
        className={`flex items-center justify-between px-5 py-3.5 border-b ${
          isActive
            ? "bg-teal-700 border-teal-700"
            : "bg-gray-100 border-gray-300"
        }`}
      >
        <div className="flex items-center gap-2">
          <CalendarDays
            size={14}
            className={isActive ? "text-teal-200" : "text-gray-400"}
          />
          <span
            className={`text-sm font-medium ${
              isActive ? "text-white" : "text-gray-700"
            }`}
          >
            {fmt(record.effective_date, true)}
          </span>
        </div>

        {isActive ? (
          <span className="flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium text-white">
            <CheckCircle2 size={11} />
            Active
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500">
            <Clock size={11} />
            History
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-px bg-gray-200">
        {PRODUCTION_DISPLAY_FIELDS.map(({ key, label, format }) => (
          <div key={key} className="bg-white px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">{label}</p>
            <p className="text-sm font-medium text-gray-800">
              {fmt(typeof format === "function" ? format(record[key], record) : record[key])}
            </p>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-200 bg-white px-4 py-3">
        <p className="text-xs text-gray-400 mb-2">Mode Summary</p>
        <p className="text-sm text-gray-700">{getModeSummary(record)}</p>
      </div>
    </div>
  );
}

function OrderConfigCard({ record, isActive }) {
  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-shadow hover:shadow-sm bg-white ${
        isActive ? "border-teal-600" : "border-gray-300"
      }`}
    >
      <div
        className={`flex items-center justify-between px-5 py-3.5 border-b ${
          isActive
            ? "bg-teal-700 border-teal-700"
            : "bg-gray-100 border-gray-300"
        }`}
      >
        <div className="flex items-center gap-2">
          <CalendarDays
            size={14}
            className={isActive ? "text-teal-200" : "text-gray-400"}
          />
          <span
            className={`text-sm font-medium ${
              isActive ? "text-white" : "text-gray-700"
            }`}
          >
            {fmt(record.effective_date, true)}
          </span>
        </div>

        {isActive ? (
          <span className="flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium text-white">
            <CheckCircle2 size={11} />
            Active
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500">
            <Clock size={11} />
            History
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-px bg-gray-200">
        {ORDER_DISPLAY_FIELDS.map(({ key, label }) => (
          <div key={key} className="bg-white px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">{label}</p>
            <p className="text-sm font-medium text-gray-800">{fmt(record[key])}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-200 bg-white px-4 py-3">
        <p className="text-xs text-gray-400 mb-2">Order Formula Rules</p>
        {!record?.stitch_formula_enabled ? (
          <p className="text-sm text-gray-600">
            Formula disabled. Orders keep `design stitches = actual stitches`.
          </p>
        ) : Array.isArray(record?.stitch_formula_rules) && record.stitch_formula_rules.length > 0 ? (
          <div className="space-y-1.5">
            {record.stitch_formula_rules.map((rule, index) => (
              <p key={`${record?._id || "record"}-rule-${index}`} className="text-sm text-gray-700">
                {index + 1}. {describeFormulaRule(rule)}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-amber-700">
            Formula enabled but no rules are saved. Orders will keep `design stitches = actual stitches` until rules are added.
          </p>
        )}
      </div>
    </div>
  );
}

// ── SettingsSection ──────────────────────────────────────────────────────────
// Matches Dashboard / SalarySlips card pattern:
//   rounded-3xl · border-gray-300 · header bg-gray-100 border-b border-gray-300
function SettingsSection({ title, description, icon, action, children }) {
  return (
    <div className="rounded-3xl bg-white border border-gray-300 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-300 bg-gray-100">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-gray-200">
            {React.createElement(icon, { size: 17, className: "text-gray-500" })}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
            {description && (
              <p className="text-xs text-gray-400 mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────────
function ConfigCardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-300 overflow-hidden animate-pulse">
      <div className="h-12 bg-gray-100" />
      <div className="grid grid-cols-2 gap-px bg-gray-200">
        {Array.from({ length: PRODUCTION_DISPLAY_FIELDS.length }).map((_, i) => (
          <div key={i} className="bg-white px-4 py-3">
            <div className="h-3 w-20 bg-gray-100 rounded mb-1.5" />
            <div className="h-4 w-12 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Primary action button (teal) ─────────────────────────────────────────────
// Replaces the old gray-900 buttons to match app's teal primary CTA.
function AddButton({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl bg-[#127475] px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
    >
      <Plus size={15} />
      {children}
    </button>
  );
}

function RuleCheckbox({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-gray-700">
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-400"
      />
      <span>{label}</span>
    </label>
  );
}

function RuleRowCard({ title, children, onRemove }) {
  return (
    <div className="rounded-2xl border border-gray-300 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-gray-800">{title}</p>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
        >
          Remove
        </button>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// ── ExpenseItemFormModal ────────────────────────────────────────────────────
function ExpenseItemFormModal({
  isOpen,
  onClose,
  initialData,
  onSave,
  expenseTypeRule = null,
  generalItemOptions = [],
}) {
  const mode = initialData ? "edit" : "add";
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
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    fixed_source: "cash",
    supplier_id: "",
    default_quantity: "",
    default_rate: "",
    default_amount: "",
  });
  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  const selectedRule = expenseTypeRule || { key: "cash", label: "Expense (Cash)", is_fixed: false, requires_supplier: false };
  const isFixedVariant = Boolean(selectedRule?.is_fixed);
  const isSupplierFixed = Boolean(selectedRule?.requires_supplier);
  const supplierOptions = suppliers.map((s) => ({ label: s.name, value: s._id }));
  const calculatedAmount =
    (Number(formData.default_quantity) || 0) * (Number(formData.default_rate) || 0);

  const fixedItemOptions = useMemo(() => {
    const exists = generalItemOptions.some((opt) => opt.value === formData.name);
    if (!formData.name || exists) return generalItemOptions;
    return [{ label: formData.name, value: formData.name }, ...generalItemOptions];
  }, [generalItemOptions, formData.name]);

  useEffect(() => {
    setFormData({
      id: initialData?._id || "",
      name: initialData?.name || "",
      fixed_source: initialData?.fixed_source || (isSupplierFixed ? "supplier" : "cash"),
      supplier_id: initialData?.supplier_id || "",
      default_quantity: initialData?.default_quantity ?? "",
      default_rate: initialData?.default_rate ?? "",
      default_amount: initialData?.default_amount ?? "",
    });
  }, [initialData, isOpen, isSupplierFixed]);

  useEffect(() => {
    if (!isOpen || !isFixedVariant) return;
    const loadSuppliers = async () => {
      setLoadingSuppliers(true);
      try {
        const res = await fetchSuppliers({ page: 1, limit: 5000, status: "active" });
        setSuppliers(res?.data || []);
      } catch {
        setSuppliers([]);
      } finally {
        setLoadingSuppliers(false);
      }
    };
    loadSuppliers();
  }, [isOpen, isFixedVariant]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        mode === "add"
          ? isFixedVariant ? "Add Fixed Expense" : "Add Expense Item"
          : isFixedVariant ? "Edit Fixed Expense" : "Edit Expense Item"
      }
      subtitle={
      isFixedVariant
          ? `Configure auto-fill fields for ${selectedRule?.label || "fixed expense"}`
          : "This item appears in Expense / Item dropdown"
      }
      maxWidth="max-w-lg"
      footer={
        <div className="flex gap-3">
          <Button outline variant="secondary" onClick={onClose} className="w-1/3">
            Discard
          </Button>
          <Button
            className="grow"
            onClick={async () => {
              const payload = isFixedVariant
                ? {
                    id: formData.id,
                    name: formData.name,
                    expense_type: selectedRule?.key || "fixed_cash",
                    fixed_source: isFixedVariant ? (isSupplierFixed ? "supplier" : "cash") : "",
                    supplier_id: isSupplierFixed ? formData.supplier_id : "",
                    default_quantity: Number(formData.default_quantity || 0),
                    default_rate: Number(formData.default_rate || 0),
                    default_amount:
                      formData.default_amount === ""
                        ? calculatedAmount
                        : Number(formData.default_amount),
                  }
                : {
                    id: formData.id,
                    name: formData.name,
                    expense_type: selectedRule?.key || initialData?.expense_type || "cash",
                    fixed_source: "",
                    supplier_id: "",
                    default_quantity: 0,
                    default_rate: 0,
                    default_amount: 0,
                  };

              await onSave(mode === "add" ? "add" : "edit", payload);
              onClose();
            }}
          >
            {mode === "add" ? "Create" : "Save Changes"}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 p-0.5">
        {isFixedVariant ? (
          <Select
            label="Expense Item"
            value={formData.name}
            onChange={(value) => setFormData((p) => ({ ...p, name: value }))}
            options={fixedItemOptions}
            placeholder="Select expense item"
          />
        ) : (
          <Input
            label="Item Name"
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            capitalize
          />
        )}

        {isFixedVariant && (
          <>
            <Select
              label="Fixed For"
              value={formData.fixed_source}
              onChange={(value) =>
                setFormData((p) => ({ ...p, fixed_source: value, supplier_id: "" }))
              }
              options={[
                { label: isSupplierFixed ? "Supplier" : "Cash", value: isSupplierFixed ? "supplier" : "cash" },
              ]}
            />

            {isSupplierFixed && (
              <Select
                label="Supplier"
                value={formData.supplier_id}
                onChange={(value) => setFormData((p) => ({ ...p, supplier_id: value }))}
                options={supplierOptions}
                placeholder={loadingSuppliers ? "Loading suppliers..." : "Select supplier"}
              />
            )}

            <Input
              label="Quantity"
              type="text"
              value={formData.default_quantity}
              onChange={(e) =>
                setFormData((p) => ({ ...p, default_quantity: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== "=") return;
                e.preventDefault();
                const calculated = evaluateMathExpression(formData.default_quantity);
                if (calculated === null) return;
                setFormData((p) => ({
                  ...p,
                  default_quantity: normalizeNumberString(calculated),
                }));
              }}
            />
            <Input
              label="Rate"
              type="number"
              value={formData.default_rate}
              onChange={(e) =>
                setFormData((p) => ({ ...p, default_rate: e.target.value }))
              }
            />
            <Input
              label="Amount"
              type="number"
              value={
                formData.default_amount === "" ? calculatedAmount : formData.default_amount
              }
              onChange={(e) =>
                setFormData((p) => ({ ...p, default_amount: e.target.value }))
              }
            />
          </>
        )}
      </div>
    </Modal>
  );
}

function CrpRateFormModal({ isOpen, onClose, initialData, onSave, categoryOptions = [] }) {
  const mode = initialData ? "edit" : "add";
  const [formData, setFormData] = useState({
    id: "",
    category: "",
    type_name: "",
    rate: "",
  });

  useEffect(() => {
    setFormData({
      id: initialData?._id || "",
      category: initialData?.category || categoryOptions[0]?.value || "",
      type_name: initialData?.type_name || "",
      rate: initialData?.rate ?? "",
    });
  }, [initialData, isOpen, categoryOptions]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "add" ? "Add CRP Type Rate" : "Edit CRP Type Rate"}
      subtitle="Manage category/type wise rates for cropping records"
      maxWidth="max-w-lg"
      footer={
        <div className="flex gap-3">
          <Button outline variant="secondary" onClick={onClose} className="w-1/3">
            Discard
          </Button>
          <Button
            className="grow"
            onClick={async () => {
              await onSave(mode === "add" ? "add" : "edit", {
                ...formData,
                rate: Number(formData.rate || 0),
              });
              onClose();
            }}
          >
            {mode === "add" ? "Create" : "Save Changes"}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 p-0.5">
        <Select
          label="Category"
          value={formData.category}
          onChange={(value) => setFormData((p) => ({ ...p, category: value }))}
          options={categoryOptions}
          placeholder={categoryOptions.length ? "Select category..." : "No CRP categories in settings"}
        />
        <Input
          label="Type"
          value={formData.type_name}
          onChange={(e) => setFormData((p) => ({ ...p, type_name: e.target.value }))}
          capitalize
        />
        <Input
          label="Rate"
          type="number"
          value={formData.rate}
          onChange={(e) => setFormData((p) => ({ ...p, rate: e.target.value }))}
        />
      </div>
    </Modal>
  );
}

// ── SettingsPage ─────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { showToast } = useToast();

  const [records, setRecords] = useState([]);
  const [orderRecords, setOrderRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [formModal, setFormModal] = useState(false);
  const [orderFormModal, setOrderFormModal] = useState(false);
  const [invoiceBanner, setInvoiceBanner] = useState("");
  const [machineOptions, setMachineOptions] = useState([]);
  const [machineOptionInput, setMachineOptionInput] = useState("");
  const [machineOptionsLoading, setMachineOptionsLoading] = useState(false);
  const [savingMachineOptions, setSavingMachineOptions] = useState(false);
  const [referenceData, setReferenceData] = useState(emptyReferenceData());
  const [referenceDataDraft, setReferenceDataDraft] = useState(emptyReferenceData());
  const [referenceTextDraft, setReferenceTextDraft] = useState(() =>
    toReferenceTextareaDraft(emptyReferenceData())
  );
  const [referenceDataLoading, setReferenceDataLoading] = useState(false);
  const [savingReferenceData, setSavingReferenceData] = useState(false);
  const [ruleData, setRuleData] = useState(emptyRuleData());
  const [ruleDataDraft, setRuleDataDraft] = useState(emptyRuleData());
  const [ruleDataLoading, setRuleDataLoading] = useState(false);
  const [savingRuleData, setSavingRuleData] = useState(false);
  const [bannerModalOpen, setBannerModalOpen] = useState(false);
  const [invoiceCounter, setInvoiceCounter] = useState(null);
  const [invoiceCounterInput, setInvoiceCounterInput] = useState("");
  const [invoiceCounterLoading, setInvoiceCounterLoading] = useState(false);
  const [savingInvoiceCounter, setSavingInvoiceCounter] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [expenseItems, setExpenseItems] = useState([]);
  const [crpRateConfigs, setCrpRateConfigs] = useState([]);
  const [expenseItemModal, setExpenseItemModal] = useState({
    isOpen: false,
    data: null,
    typeKey: "cash",
  });
  const [crpRateModal, setCrpRateModal] = useState({ isOpen: false, data: null });

  const loadConfigs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchProductionConfig();
      const data = normalizeConfigRows(res.data);
      data.sort((a, b) => new Date(b.effective_date) - new Date(a.effective_date));
      setRecords(data);
    } catch {
      showToast({ type: "error", message: "Failed to load configurations" });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadOrderConfigs = useCallback(async () => {
    try {
      setOrderLoading(true);
      const res = await fetchOrderConfig();
      const data = normalizeConfigRows(res.data);
      data.sort((a, b) => new Date(b.effective_date) - new Date(a.effective_date));
      setOrderRecords(data);
    } catch {
      showToast({ type: "error", message: "Failed to load order configurations" });
    } finally {
      setOrderLoading(false);
    }
  }, [showToast]);

  const loadExpenseItems = useCallback(async () => {
    try {
      const res = await fetchExpenseItems();
      setExpenseItems(res?.data || []);
    } catch {
      showToast({ type: "error", message: "Failed to load expense items" });
    }
  }, [showToast]);

  const loadMachineOptions = useCallback(async () => {
    try {
      setMachineOptionsLoading(true);
      const res = await fetchMyMachineOptions();
      setMachineOptions(Array.isArray(res?.machine_options) ? res.machine_options : []);
    } catch {
      showToast({ type: "error", message: "Failed to load machine options" });
      setMachineOptions([]);
    } finally {
      setMachineOptionsLoading(false);
    }
  }, [showToast]);

  const loadCrpRateConfigs = useCallback(async () => {
    try {
      const res = await fetchCrpRateConfigs();
      setCrpRateConfigs(res?.data || []);
    } catch {
      showToast({ type: "error", message: "Failed to load CRP type rates" });
    }
  }, [showToast]);

  const loadReferenceData = useCallback(async () => {
    try {
      setReferenceDataLoading(true);
      const res = await fetchMyReferenceData();
      const next = { ...emptyReferenceData(), ...(res?.reference_data || {}) };
      setReferenceData(next);
      setReferenceDataDraft(next);
      setReferenceTextDraft(toReferenceTextareaDraft(next));
    } catch {
      showToast({ type: "error", message: "Failed to load reference data" });
      const fallback = emptyReferenceData();
      setReferenceData(fallback);
      setReferenceDataDraft(fallback);
      setReferenceTextDraft(toReferenceTextareaDraft(fallback));
    } finally {
      setReferenceDataLoading(false);
    }
  }, [showToast]);

  const loadRuleData = useCallback(async () => {
    try {
      setRuleDataLoading(true);
      const [ruleRes, referenceRes] = await Promise.all([
        fetchMyRuleData(),
        fetchMyReferenceData().catch(() => ({ reference_data: {} })),
      ]);
      const nextReference = { ...emptyReferenceData(), ...(referenceRes?.reference_data || {}) };
      const next = normalizeRuleData(ruleRes?.rule_data || {}, nextReference);
      setRuleData(next);
      setRuleDataDraft(next);
    } catch {
      showToast({ type: "error", message: "Failed to load rule data" });
      const fallback = emptyRuleData();
      setRuleData(fallback);
      setRuleDataDraft(fallback);
    } finally {
      setRuleDataLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  useEffect(() => {
    loadOrderConfigs();
  }, [loadOrderConfigs]);

  useEffect(() => {
    const loadInvoiceBanner = async () => {
      try {
        const res = await fetchMyInvoiceBanner();
        setInvoiceBanner(res?.invoice_banner_data || "");
      } catch {
        setInvoiceBanner("");
      }
    };

    const loadInvoiceCounter = async () => {
      try {
        setInvoiceCounterLoading(true);
        const res = await fetchMyInvoiceCounter();
        setInvoiceCounter(res || null);
        setInvoiceCounterInput(String(res?.last_invoice_no ?? 0));
      } catch {
        setInvoiceCounter(null);
        setInvoiceCounterInput("0");
      } finally {
        setInvoiceCounterLoading(false);
      }
    };

    const loadSubscription = async () => {
      try {
        const res = await fetchMySubscription();
        setSubscription(res?.data || null);
      } catch {
        setSubscription(null);
      }
    };

    loadInvoiceBanner();
    loadMachineOptions();
    loadReferenceData();
    loadRuleData();
    loadInvoiceCounter();
    loadExpenseItems();
    loadCrpRateConfigs();
    loadSubscription();
  }, [loadExpenseItems, loadCrpRateConfigs, loadMachineOptions, loadReferenceData, loadRuleData]);

  const handleSave = async (payload) => {
    try {
      await createProductionConfig(payload);
      showToast({ type: "success", message: "Config added successfully" });
      loadConfigs();
    } catch (err) {
      showToast({
        type: "error",
        message: err.response?.data?.message || "Failed to add config",
      });
      throw err;
    }
  };

  const handleSaveOrderConfig = async (payload) => {
    try {
      await createOrderConfig(payload);
      showToast({ type: "success", message: "Order config added successfully" });
      loadOrderConfigs();
    } catch (err) {
      showToast({
        type: "error",
        message: err.response?.data?.message || "Failed to add order config",
      });
      throw err;
    }
  };

  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const activeRecord = records.find(
    (r) => r.effective_date && new Date(r.effective_date) <= today
  );
  const activeOrderRecord = orderRecords.find(
    (r) => r.effective_date && new Date(r.effective_date) <= today
  );

  const handleSaveBanner = async (bannerData) => {
    try {
      const res = await updateMyInvoiceBanner(bannerData);
      setInvoiceBanner(res?.invoice_banner_data || "");
      showToast({ type: "success", message: "Invoice banner updated" });
    } catch (err) {
      showToast({
        type: "error",
        message: err.response?.data?.message || "Failed to update invoice banner",
      });
      throw err;
    }
  };

  const groupedExpenseItems = useMemo(
    () =>
      (ruleData.expense_type_rules || []).reduce((acc, rule) => {
        acc[rule.key] = expenseItems.filter((item) => {
          const itemFixedSource = String(item?.fixed_source || "").trim().toLowerCase();
          if (rule?.is_fixed) {
            return itemFixedSource === (rule.requires_supplier ? "supplier" : "cash");
          }
          return !itemFixedSource;
        });
        return acc;
      }, {}),
    [expenseItems, ruleData.expense_type_rules]
  );

  const sharedRegularExpenseItems = useMemo(() => {
    const rows = expenseItems.filter((item) => {
      const rule = (ruleData.expense_type_rules || []).find((entry) => entry.key === item.expense_type);
      return !rule?.is_fixed;
    });

    const map = new Map();
    rows.forEach((item) => {
      const name = String(item?.name || "").trim();
      const key = name.toLowerCase();
      if (!name || map.has(key)) return;
      map.set(key, item);
    });
    return Array.from(map.values()).sort((a, b) =>
      String(a?.name || "").localeCompare(String(b?.name || ""), undefined, { sensitivity: "base" })
    );
  }, [expenseItems, ruleData.expense_type_rules]);

  const fixedExpenseRules = useMemo(
    () => (ruleData.expense_type_rules || []).filter((rule) => rule?.is_fixed),
    [ruleData.expense_type_rules]
  );

  const generalItemOptions = useMemo(
    () =>
      sharedRegularExpenseItems.map((item) => ({ label: item.name, value: item.name })),
    [sharedRegularExpenseItems]
  );

  const groupedCrpRates = useMemo(
    () =>
      (referenceData.crp_categories || []).reduce((acc, category) => {
        acc[category] = crpRateConfigs.filter((item) => item.category === category);
        return acc;
      }, {}),
    [crpRateConfigs, referenceData.crp_categories]
  );
  const crpCategoryOptions = useMemo(
    () => (referenceData.crp_categories || []).map((item) => ({ label: item, value: item })),
    [referenceData.crp_categories]
  );
  const availableUserRoles = useMemo(
    () => normalizeBusinessUserRoles(referenceDataDraft.user_roles || referenceData.user_roles || []),
    [referenceDataDraft.user_roles, referenceData.user_roles]
  );

  const planDetails = subscription?.plan_details;
  const hasInvoiceBanner = Boolean(planDetails?.features?.invoice_banner);
  const hasInvoiceImageUpload = Boolean(planDetails?.features?.invoice_image_upload);
  const invoiceCanUpdate = Boolean(invoiceCounter?.can_update);
  const invoiceYear = Number(invoiceCounter?.year) || new Date().getFullYear();
  const nextInvoiceNo = Number(invoiceCounter?.next_invoice_no || 1);
  const nextInvoiceLabel = `${invoiceYear}-${String(nextInvoiceNo).padStart(4, "0")}`;
  const normalizedMachineInput = machineOptionInput.trim();

  // ── Shared row renderer for expense item lists ────────────────────────────
  const renderExpenseRow = (item, typeKey) => (
    <div key={item._id} className="px-5 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-800">{item.name}</p>
          {(ruleData.expense_type_rules || []).find((rule) => rule.key === typeKey)?.is_fixed && (
            <>
              <p className="text-xs text-gray-500 mt-0.5">
                Qty: {fmt(item.default_quantity)} · Rate: {fmt(item.default_rate)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Amount: {fmt(item.default_amount)}
              </p>
              {item.fixed_source === "supplier" && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Supplier: {item.supplier_name || "—"}
                </p>
              )}
            </>
          )}
          <span
            className={`inline-flex mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${
              item.isActive
                ? "bg-emerald-100 text-emerald-700"
                : "bg-rose-100 text-rose-700"
            }`}
          >
            {item.isActive ? "Active" : "Inactive"}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <button
            className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
            onClick={() =>
              setExpenseItemModal({ isOpen: true, data: item, typeKey })
            }
            aria-label="Edit"
          >
            <Edit3 size={14} />
          </button>
          <button
            className={`p-2 rounded-lg border transition-colors ${
              item.isActive
                ? "border-rose-300 text-rose-600 hover:bg-rose-50"
                : "border-emerald-300 text-emerald-600 hover:bg-emerald-50"
            }`}
            onClick={async () => {
              try {
                await toggleExpenseItemStatus(item._id);
                loadExpenseItems();
                showToast({ type: "success", message: "Status updated" });
              } catch (err) {
                showToast({
                  type: "error",
                  message: err.response?.data?.message || "Failed to update status",
                });
              }
            }}
            aria-label="Toggle status"
          >
            <Power size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  const renderCrpRateRow = (item) => (
    <div key={item._id} className="px-5 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-800">{item.type_name}</p>
          <p className="text-xs text-gray-500 mt-0.5">Rate: {fmt(item.rate)}</p>
          <span
            className={`inline-flex mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${
              item.isActive
                ? "bg-emerald-100 text-emerald-700"
                : "bg-rose-100 text-rose-700"
            }`}
          >
            {item.isActive ? "Active" : "Inactive"}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <button
            className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
            onClick={() => setCrpRateModal({ isOpen: true, data: item })}
            aria-label="Edit CRP rate"
          >
            <Edit3 size={14} />
          </button>
          <button
            className={`p-2 rounded-lg border transition-colors ${
              item.isActive
                ? "border-rose-300 text-rose-600 hover:bg-rose-50"
                : "border-emerald-300 text-emerald-600 hover:bg-emerald-50"
            }`}
            onClick={async () => {
              try {
                await toggleCrpRateConfigStatus(item._id);
                loadCrpRateConfigs();
                showToast({ type: "success", message: "CRP type rate status updated" });
              } catch (err) {
                showToast({
                  type: "error",
                  message: err.response?.data?.message || "Failed to update status",
                });
              }
            }}
            aria-label="Toggle status"
          >
            <Power size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  const machineOptionExists = machineOptions.some(
    (item) => item.toLowerCase() === normalizedMachineInput.toLowerCase()
  );
  const updateAttendanceRule = (index, patch) => {
    setRuleDataDraft((prev) => ({
      ...prev,
      attendance_rules: prev.attendance_rules.map((rule, idx) => (idx === index ? { ...rule, ...patch } : rule)),
    }));
  };
  const updateCustomerMethodRule = (index, patch) => {
    setRuleDataDraft((prev) => ({
      ...prev,
      customer_payment_method_rules: prev.customer_payment_method_rules.map((rule, idx) =>
        idx === index ? { ...rule, ...patch } : rule
      ),
    }));
  };
  const updateStaffPaymentTypeRule = (index, patch) => {
    setRuleDataDraft((prev) => ({
      ...prev,
      staff_payment_type_rules: prev.staff_payment_type_rules.map((rule, idx) =>
        idx === index ? { ...rule, ...patch } : rule
      ),
    }));
  };
  const updateExpenseTypeRule = (index, patch) => {
    setRuleDataDraft((prev) => ({
      ...prev,
      expense_type_rules: prev.expense_type_rules.map((rule, idx) =>
        idx === index ? { ...rule, ...patch } : rule
      ),
    }));
  };
  const updateAccessRule = (index, patch) => {
    setRuleDataDraft((prev) => ({
      ...prev,
      access_rules: (prev.access_rules || []).map((rule, idx) => (idx === index ? { ...rule, ...patch } : rule)),
    }));
  };
  const updateAllowanceRule = (patch) => {
    setRuleDataDraft((prev) => ({
      ...prev,
      allowance_rule: { ...(prev.allowance_rule || defaultAllowanceRule()), ...patch },
    }));
  };
  const updateDisplayPreferenceLabel = (index, patch) => {
    setRuleDataDraft((prev) => ({
      ...prev,
      display_preferences: {
        ...(prev.display_preferences || defaultDisplayPreferences()),
        label_overrides: (prev.display_preferences?.label_overrides || []).map((entry, idx) =>
          idx === index ? { ...entry, ...patch } : entry
        ),
      },
    }));
  };

  const addMachineOption = () => {
    if (!normalizedMachineInput || machineOptionExists) return;
    setMachineOptions((prev) => [...prev, normalizedMachineInput]);
    setMachineOptionInput("");
  };

  const removeMachineOption = (value) => {
    setMachineOptions((prev) => prev.filter((item) => item !== value));
  };

  return (
    <>
      <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col">
        <PageHeader
          title="Settings"
          subtitle="Manage system configuration and preferences."
        />

        <div className="flex flex-col gap-6 pb-10">
          {/* ── Production Configuration ── */}
          <SettingsSection
            title="Production Configuration"
            description="Business-wise rates and targets applied to your staff records."
            icon={SlidersHorizontal}
            action={
              <AddButton onClick={() => setFormModal(true)}>Add Config</AddButton>
            }
          >
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <ConfigCardSkeleton key={i} />
                ))}
              </div>
            ) : records.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gray-100 border border-gray-200 mb-3">
                  <SlidersHorizontal size={20} className="text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-600">No configs yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Click "Add Config" to create your first production configuration.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {records.map((record, index) => (
                  <ProductionConfigCard
                    key={record._id || record.id || `${record.effective_date || "production"}-${index}`}
                    record={record}
                    isActive={activeRecord?._id === record._id}
                  />
                ))}
              </div>
            )}
          </SettingsSection>

          <SettingsSection
            title="Order Configuration"
            description="Order formulas and default toggles are managed separately from staff production settings."
            icon={Hash}
            action={
              <AddButton onClick={() => setOrderFormModal(true)}>Add Order Config</AddButton>
            }
          >
            {orderLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <ConfigCardSkeleton key={i} />
                ))}
              </div>
            ) : orderRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gray-100 border border-gray-200 mb-3">
                  <Hash size={20} className="text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-600">No order configs yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Click "Add Order Config" to create your first order configuration.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {orderRecords.map((record, index) => (
                  <OrderConfigCard
                    key={record._id || record.id || `${record.effective_date || "order"}-${index}`}
                    record={record}
                    isActive={activeOrderRecord?._id === record._id}
                  />
                ))}
              </div>
            )}
          </SettingsSection>

          <SettingsSection
            title="Order Machines"
            description="Customize which machine options appear in the order form dropdown."
            icon={SlidersHorizontal}
            action={
              <Button
                onClick={async () => {
                  try {
                    setSavingMachineOptions(true);
                    const res = await updateMyMachineOptions(machineOptions);
                    setMachineOptions(Array.isArray(res?.machine_options) ? res.machine_options : machineOptions);
                    showToast({ type: "success", message: "Machine options updated" });
                    loadMachineOptions();
                  } catch (err) {
                    showToast({
                      type: "error",
                      message: err.response?.data?.message || "Failed to update machine options",
                    });
                  } finally {
                    setSavingMachineOptions(false);
                  }
                }}
                disabled={machineOptionsLoading || savingMachineOptions}
                loading={savingMachineOptions}
              >
                Save Machines
              </Button>
            }
          >
            <div className="flex flex-col gap-4">
              <div className="flex gap-3">
                <Input
                  label="Add Machine"
                  value={machineOptionInput}
                  onChange={(e) => setMachineOptionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addMachineOption();
                    }
                  }}
                  placeholder="e.g. R6 or Tajima-1"
                  required={false}
                />
                <div className="pt-7">
                  <Button
                    onClick={addMachineOption}
                    disabled={!normalizedMachineInput || machineOptionExists}
                  >
                    Add
                  </Button>
                </div>
              </div>

              {machineOptionExists && normalizedMachineInput ? (
                <p className="text-xs text-amber-700">This machine already exists in the list.</p>
              ) : null}

              <div className="rounded-2xl border border-gray-300 bg-white p-4">
                {machineOptionsLoading ? (
                  <p className="text-sm text-gray-400">Loading machine options...</p>
                ) : machineOptions.length === 0 ? (
                  <p className="text-sm text-gray-400">No machine options yet. Add at least one machine.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {machineOptions.map((machine) => (
                      <span
                        key={machine}
                        className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm text-gray-700"
                      >
                        {machine}
                        <button
                          type="button"
                          onClick={() => removeMachineOption(machine)}
                          className="text-gray-400 hover:text-red-600"
                          aria-label={`Remove ${machine}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            title="Reference Data"
            description="Manage business-facing dropdown values used across forms."
            icon={SlidersHorizontal}
            action={
              <Button
                onClick={async () => {
                  try {
                    setSavingReferenceData(true);
                    const payload = Object.fromEntries(
                      REFERENCE_FIELDS.map((field) => [
                        field.key,
                        fromTextareaValue(referenceTextDraft[field.key]),
                      ])
                    );
                    const res = await updateMyReferenceData(payload);
                    const next = { ...emptyReferenceData(), ...(res?.reference_data || payload) };
                    setReferenceData(next);
                    setReferenceDataDraft(next);
                    setReferenceTextDraft(toReferenceTextareaDraft(next));
                    showToast({ type: "success", message: "Reference data updated" });
                  } catch (err) {
                    showToast({
                      type: "error",
                      message: err.response?.data?.message || "Failed to update reference data",
                    });
                  } finally {
                    setSavingReferenceData(false);
                  }
                }}
                disabled={referenceDataLoading || savingReferenceData}
                loading={savingReferenceData}
              >
                Save Reference Data
              </Button>
            }
          >
            {referenceDataLoading ? (
              <p className="text-sm text-gray-400">Loading reference data...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {REFERENCE_FIELDS.map((field) => (
                  <div key={field.key} className="rounded-2xl border border-gray-300 bg-white p-4">
                    <label className="mb-2 block text-sm font-medium text-gray-700">{field.label}</label>
                    <textarea
                      rows={5}
                      value={referenceTextDraft[field.key] || ""}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        setReferenceTextDraft((prev) => ({
                          ...prev,
                          [field.key]: nextValue,
                        }));
                        setReferenceDataDraft((prev) => ({
                          ...prev,
                          [field.key]: fromTextareaValue(nextValue),
                        }));
                      }}
                      placeholder={field.hint}
                      className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-300"
                    />
                    <p className="mt-2 text-xs text-gray-400">{field.hint}</p>
                  </div>
                ))}
              </div>
            )}
          </SettingsSection>

          <SettingsSection
            title="Business Rules"
            description="Control attendance behavior, customer payment requirements, and staff payment effects."
            icon={SlidersHorizontal}
            action={
              <Button
                onClick={async () => {
                  try {
                    setSavingRuleData(true);
                    const payload = normalizeRuleData(ruleDataDraft, referenceDataDraft);
                    const res = await updateMyRuleData(payload);
                    const nextRules = normalizeRuleData(res?.rule_data || payload, res?.reference_data || referenceData);
                    const nextReference = { ...emptyReferenceData(), ...(res?.reference_data || referenceData) };
                    setRuleData(nextRules);
                    setRuleDataDraft(nextRules);
                    setReferenceData(nextReference);
                    setReferenceDataDraft(nextReference);
                    showToast({ type: "success", message: "Business rules updated" });
                  } catch (err) {
                    showToast({
                      type: "error",
                      message: err.response?.data?.message || "Failed to update business rules",
                    });
                  } finally {
                    setSavingRuleData(false);
                  }
                }}
                disabled={ruleDataLoading || savingRuleData}
                loading={savingRuleData}
              >
                Save Rules
              </Button>
            }
          >
            {ruleDataLoading ? (
              <p className="text-sm text-gray-400">Loading rule data...</p>
            ) : (
              <div className="space-y-6">
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Attendance Rules</p>
                      <p className="text-xs text-gray-400">Decide production, bonus, pay mode, and allowance behavior per attendance.</p>
                    </div>
                    <Button
                      size="sm"
                      outline
                      onClick={() =>
                        setRuleDataDraft((prev) => ({
                          ...prev,
                          attendance_rules: prev.attendance_rules.concat([
                            {
                              label: "",
                              counts_record: true,
                              counts_production: true,
                              allows_bonus: true,
                              pay_mode: ATTENDANCE_PAY_MODES.SALARY_DAY_OR_PRODUCTION,
                              allowance_code: ATTENDANCE_ALLOWANCE_CODES.NORMAL,
                              upgrade_half_to_day: false,
                            },
                          ]),
                        }))
                      }
                    >
                      Add Attendance
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {ruleDataDraft.attendance_rules.map((rule, index) => (
                      <RuleRowCard
                        key={`attendance-rule-${index}-${rule.label || "new"}`}
                        title={rule.label || `Attendance ${index + 1}`}
                        onRemove={() =>
                          setRuleDataDraft((prev) => ({
                            ...prev,
                            attendance_rules: prev.attendance_rules.filter((_, idx) => idx !== index),
                          }))
                        }
                      >
                        <Input
                          label="Label"
                          value={rule.label}
                          onChange={(e) => updateAttendanceRule(index, { label: e.target.value })}
                          placeholder="e.g. Day"
                          required={false}
                        />
                        <Select
                          label="Pay Mode"
                          value={rule.pay_mode}
                          onChange={(value) => updateAttendanceRule(index, { pay_mode: value })}
                          options={[
                            { label: "Zero", value: ATTENDANCE_PAY_MODES.ZERO },
                            { label: "Salary Day / Production", value: ATTENDANCE_PAY_MODES.SALARY_DAY_OR_PRODUCTION },
                            { label: "Salary Half / Production", value: ATTENDANCE_PAY_MODES.SALARY_HALF_OR_PRODUCTION },
                            { label: "Salary Day / Off Amount", value: ATTENDANCE_PAY_MODES.SALARY_DAY_OR_OFF_AMOUNT },
                          ]}
                        />
                        <Select
                          label="Allowance Category"
                          value={rule.allowance_code}
                          onChange={(value) => updateAttendanceRule(index, { allowance_code: value })}
                          options={[
                            { label: "Normal Day", value: ATTENDANCE_ALLOWANCE_CODES.NORMAL },
                            { label: "Half Day", value: ATTENDANCE_ALLOWANCE_CODES.HALF },
                            { label: "Absent", value: ATTENDANCE_ALLOWANCE_CODES.ABSENT },
                            { label: "Ignore", value: ATTENDANCE_ALLOWANCE_CODES.IGNORE },
                          ]}
                        />
                        <div className="flex flex-wrap gap-4">
                          <RuleCheckbox checked={rule.counts_record} onChange={(value) => updateAttendanceRule(index, { counts_record: value })} label="Counts in month record count" />
                          <RuleCheckbox checked={rule.counts_production} onChange={(value) => updateAttendanceRule(index, { counts_production: value })} label="Shows production entry" />
                          <RuleCheckbox checked={rule.allows_bonus} onChange={(value) => updateAttendanceRule(index, { allows_bonus: value })} label="Allows bonus" />
                          <RuleCheckbox checked={rule.upgrade_half_to_day} onChange={(value) => updateAttendanceRule(index, { upgrade_half_to_day: value })} label="Can upgrade half to day" />
                        </div>
                      </RuleRowCard>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Customer Payment Method Rules</p>
                      <p className="text-xs text-gray-400">Define which extra fields each customer payment method requires.</p>
                    </div>
                    <Button
                      size="sm"
                      outline
                      onClick={() =>
                        setRuleDataDraft((prev) => ({
                          ...prev,
                          customer_payment_method_rules: prev.customer_payment_method_rules.concat([
                            {
                              method: "",
                              requires_reference: false,
                              requires_bank: false,
                              requires_party: false,
                              requires_issue_date: false,
                              allows_clear_date: false,
                            },
                          ]),
                        }))
                      }
                    >
                      Add Method Rule
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {ruleDataDraft.customer_payment_method_rules.map((rule, index) => (
                      <RuleRowCard
                        key={`customer-method-rule-${index}-${rule.method || "new"}`}
                        title={rule.method || `Method ${index + 1}`}
                        onRemove={() =>
                          setRuleDataDraft((prev) => ({
                            ...prev,
                            customer_payment_method_rules: prev.customer_payment_method_rules.filter((_, idx) => idx !== index),
                          }))
                        }
                      >
                        <Input
                          label="Method"
                          value={rule.method}
                          onChange={(e) => updateCustomerMethodRule(index, { method: e.target.value })}
                          placeholder="e.g. cheque"
                          required={false}
                        />
                        <div className="flex flex-wrap gap-4">
                          <RuleCheckbox checked={rule.requires_reference} onChange={(value) => updateCustomerMethodRule(index, { requires_reference: value })} label="Requires reference no" />
                          <RuleCheckbox checked={rule.requires_bank} onChange={(value) => updateCustomerMethodRule(index, { requires_bank: value })} label="Requires bank" />
                          <RuleCheckbox checked={rule.requires_party} onChange={(value) => updateCustomerMethodRule(index, { requires_party: value })} label="Requires party" />
                          <RuleCheckbox checked={rule.requires_issue_date} onChange={(value) => updateCustomerMethodRule(index, { requires_issue_date: value })} label="Requires issue date" />
                          <RuleCheckbox checked={rule.allows_clear_date} onChange={(value) => updateCustomerMethodRule(index, { allows_clear_date: value })} label="Allows clear date" />
                        </div>
                      </RuleRowCard>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Staff Payment Type Rules</p>
                      <p className="text-xs text-gray-400">Control how each staff payment type affects previous balance and current month total.</p>
                    </div>
                    <Button
                      size="sm"
                      outline
                      onClick={() =>
                        setRuleDataDraft((prev) => ({
                          ...prev,
                          staff_payment_type_rules: prev.staff_payment_type_rules.concat([
                            {
                              type: "",
                              history_effect: PAYMENT_EFFECT_MODES.SUBTRACT,
                              current_effect: PAYMENT_EFFECT_MODES.SUBTRACT,
                            },
                          ]),
                        }))
                      }
                    >
                      Add Payment Type
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {ruleDataDraft.staff_payment_type_rules.map((rule, index) => (
                      <RuleRowCard
                        key={`staff-payment-rule-${index}-${rule.type || "new"}`}
                        title={rule.type || `Type ${index + 1}`}
                        onRemove={() =>
                          setRuleDataDraft((prev) => ({
                            ...prev,
                            staff_payment_type_rules: prev.staff_payment_type_rules.filter((_, idx) => idx !== index),
                          }))
                        }
                      >
                        <Input
                          label="Type"
                          value={rule.type}
                          onChange={(e) => updateStaffPaymentTypeRule(index, { type: e.target.value })}
                          placeholder="e.g. advance"
                          required={false}
                        />
                        <Select
                          label="History Effect"
                          value={rule.history_effect}
                          onChange={(value) => updateStaffPaymentTypeRule(index, { history_effect: value })}
                          options={[
                            { label: "Subtract from balance", value: PAYMENT_EFFECT_MODES.SUBTRACT },
                            { label: "Add to balance", value: PAYMENT_EFFECT_MODES.ADD },
                            { label: "Ignore", value: PAYMENT_EFFECT_MODES.IGNORE },
                          ]}
                        />
                        <Select
                          label="Current Month Effect"
                          value={rule.current_effect}
                          onChange={(value) => updateStaffPaymentTypeRule(index, { current_effect: value })}
                          options={[
                            { label: "Subtract from month total", value: PAYMENT_EFFECT_MODES.SUBTRACT },
                            { label: "Add to month total", value: PAYMENT_EFFECT_MODES.ADD },
                            { label: "Ignore", value: PAYMENT_EFFECT_MODES.IGNORE },
                          ]}
                        />
                      </RuleRowCard>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Expense Type Rules</p>
                      <p className="text-xs text-gray-400">Define which expense types exist, their labels, whether they are fixed presets, and whether supplier is required.</p>
                    </div>
                    <Button
                      size="sm"
                      outline
                      onClick={() =>
                        setRuleDataDraft((prev) => ({
                          ...prev,
                          expense_type_rules: prev.expense_type_rules.concat([
                            {
                              key: "",
                              label: "",
                              is_fixed: false,
                              requires_supplier: false,
                            },
                          ]),
                        }))
                      }
                    >
                      Add Expense Type
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {ruleDataDraft.expense_type_rules.map((rule, index) => (
                      <RuleRowCard
                        key={`expense-type-rule-${index}-${rule.key || "new"}`}
                        title={rule.label || rule.key || `Expense Type ${index + 1}`}
                        onRemove={() =>
                          setRuleDataDraft((prev) => ({
                            ...prev,
                            expense_type_rules: prev.expense_type_rules.filter((_, idx) => idx !== index),
                          }))
                        }
                      >
                        <Input
                          label="Key"
                          value={rule.key}
                          onChange={(e) => updateExpenseTypeRule(index, { key: e.target.value.trim().toLowerCase().replace(/\s+/g, "_") })}
                          placeholder="e.g. supplier"
                          required={false}
                        />
                        <Input
                          label="Label"
                          value={rule.label}
                          onChange={(e) => updateExpenseTypeRule(index, { label: e.target.value })}
                          placeholder="e.g. Expense (Supplier)"
                          required={false}
                        />
                        <div className="flex flex-wrap gap-4">
                          <RuleCheckbox checked={rule.is_fixed} onChange={(value) => updateExpenseTypeRule(index, { is_fixed: value })} label="Use month/fixed preset mode" />
                          <RuleCheckbox checked={rule.requires_supplier} onChange={(value) => updateExpenseTypeRule(index, { requires_supplier: value })} label="Requires supplier" />
                        </div>
                      </RuleRowCard>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-gray-800">Access Rules</p>
                    <p className="text-xs text-gray-400">Control which user roles can open each page and whether it appears in the sidebar.</p>
                  </div>
                  <div className="space-y-3">
                    {(ruleDataDraft.access_rules || getAccessRules(ruleDataDraft, referenceDataDraft)).map((rule, index) => (
                      <div key={`access-rule-${rule.key}`} className="rounded-2xl border border-gray-300 bg-white p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{rule.label || BUSINESS_ACCESS_ITEMS.find((item) => item.key === rule.key)?.label || rule.key}</p>
                            <p className="text-xs text-gray-400">{BUSINESS_ACCESS_ITEMS.find((item) => item.key === rule.key)?.path || rule.key}</p>
                          </div>
                          <RuleCheckbox
                            checked={rule.show_in_sidebar !== false}
                            onChange={(value) => updateAccessRule(index, { show_in_sidebar: value })}
                            label="Show in sidebar"
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-4">
                          {availableUserRoles.map((role) => (
                            <RuleCheckbox
                              key={`${rule.key}-${role}`}
                              checked={(rule.roles || []).includes(role)}
                              onChange={(value) => {
                                const current = new Set(rule.roles || []);
                                if (value) current.add(role);
                                else current.delete(role);
                                updateAccessRule(index, { roles: Array.from(current) });
                              }}
                              label={role}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-gray-800">Allowance Eligibility</p>
                    <p className="text-xs text-gray-400">Control when monthly allowance should apply.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Input
                      label="Minimum Records"
                      type="number"
                      value={ruleDataDraft.allowance_rule?.min_records ?? 26}
                      onChange={(e) => updateAllowanceRule({ min_records: Number(e.target.value || 0) })}
                      required={false}
                    />
                    <Input
                      label="Max Absent"
                      type="number"
                      value={ruleDataDraft.allowance_rule?.max_absent ?? 0}
                      onChange={(e) => updateAllowanceRule({ max_absent: Number(e.target.value || 0) })}
                      required={false}
                    />
                    <Input
                      label="Max Half"
                      type="number"
                      value={ruleDataDraft.allowance_rule?.max_half ?? 1}
                      onChange={(e) => updateAllowanceRule({ max_half: Number(e.target.value || 0) })}
                      required={false}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-gray-800">Report Visibility</p>
                    <p className="text-xs text-gray-400">Choose which sections appear on salary slips and dashboard staff summary.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-gray-300 bg-white p-4">
                      <p className="mb-3 text-sm font-medium text-gray-800">Salary Slip Fields</p>
                      <div className="flex flex-wrap gap-4">
                        {[
                          ["arrears", "Arrears"],
                          ["amount", "Amount"],
                          ["bonus", "Bonus"],
                          ["allowance", "Allowance"],
                          ["payments", "Payments"],
                          ["gross_total", "Gross Total"],
                          ["deduction_total", "Deduction Total"],
                          ["net_amount", "Net Amount"],
                        ].map(([key, label]) => (
                          <RuleCheckbox
                            key={key}
                            checked={(ruleDataDraft.display_preferences?.salary_slip_fields || []).includes(key)}
                            onChange={(value) =>
                              setRuleDataDraft((prev) => {
                                const current = new Set(prev.display_preferences?.salary_slip_fields || []);
                                if (value) current.add(key);
                                else current.delete(key);
                                return {
                                  ...prev,
                                  display_preferences: {
                                    ...(prev.display_preferences || defaultDisplayPreferences()),
                                    salary_slip_fields: Array.from(current),
                                  },
                                };
                              })
                            }
                            label={label}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-gray-300 bg-white p-4">
                      <p className="mb-3 text-sm font-medium text-gray-800">Dashboard Staff Columns</p>
                      <div className="flex flex-wrap gap-4">
                        {[
                          ["records", "Records"],
                          ["work", "Work"],
                          ["arrears", "Arrears"],
                          ["allowance", "Allowance"],
                          ["bonus", "Bonus"],
                          ["deductions", "Deductions"],
                          ["balance", "Balance"],
                        ].map(([key, label]) => (
                          <RuleCheckbox
                            key={key}
                            checked={(ruleDataDraft.display_preferences?.dashboard_staff_columns || []).includes(key)}
                            onChange={(value) =>
                              setRuleDataDraft((prev) => {
                                const current = new Set(prev.display_preferences?.dashboard_staff_columns || []);
                                if (value) current.add(key);
                                else current.delete(key);
                                return {
                                  ...prev,
                                  display_preferences: {
                                    ...(prev.display_preferences || defaultDisplayPreferences()),
                                    dashboard_staff_columns: Array.from(current),
                                  },
                                };
                              })
                            }
                            label={label}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Label Overrides</p>
                      <p className="text-xs text-gray-400">Rename common report and print labels for this business.</p>
                    </div>
                    <Button
                      size="sm"
                      outline
                      onClick={() =>
                        setRuleDataDraft((prev) => ({
                          ...prev,
                          display_preferences: {
                            ...(prev.display_preferences || defaultDisplayPreferences()),
                            label_overrides: (prev.display_preferences?.label_overrides || []).concat([{ key: "", label: "" }]),
                          },
                        }))
                      }
                    >
                      Add Label
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {(ruleDataDraft.display_preferences?.label_overrides || []).map((entry, index) => (
                      <RuleRowCard
                        key={`label-override-${index}-${entry.key || "new"}`}
                        title={entry.key || `Label ${index + 1}`}
                        onRemove={() =>
                          setRuleDataDraft((prev) => ({
                            ...prev,
                            display_preferences: {
                              ...(prev.display_preferences || defaultDisplayPreferences()),
                              label_overrides: (prev.display_preferences?.label_overrides || []).filter((_, idx) => idx !== index),
                            },
                          }))
                        }
                      >
                        <Input
                          label="Key"
                          value={entry.key}
                          onChange={(e) => updateDisplayPreferenceLabel(index, { key: e.target.value.trim().toLowerCase().replace(/\s+/g, "_") })}
                          placeholder="e.g. allowance"
                          required={false}
                        />
                        <Input
                          label="Label"
                          value={entry.label}
                          onChange={(e) => updateDisplayPreferenceLabel(index, { label: e.target.value })}
                          placeholder="e.g. Monthly Allowance"
                          required={false}
                        />
                      </RuleRowCard>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </SettingsSection>

          <SettingsSection
            title="Expense Items"
            description='Set item names and fixed presets used in the Add Expense form.'
            icon={Wallet}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-gray-300 overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-gray-100 border-b border-gray-300">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Regular Expense Items</p>
                    <p className="text-xs text-gray-500">
                      Shared item names for both cash and supplier expenses.
                    </p>
                  </div>
                  <AddButton onClick={() => setExpenseItemModal({ isOpen: true, data: null, typeKey: "cash" })}>
                    Add
                  </AddButton>
                </div>
                <div className="max-h-80 overflow-auto divide-y divide-gray-200">
                  {sharedRegularExpenseItems.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-gray-400">No regular items found.</p>
                  ) : (
                    sharedRegularExpenseItems.map((item) => renderExpenseRow(item, item.expense_type))
                  )}
                </div>
              </div>

              {fixedExpenseRules.map((rule) => (
                <div key={rule.key} className="rounded-2xl border border-gray-300 overflow-hidden">
                  <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-gray-100 border-b border-gray-300">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{rule.label}</p>
                      <p className="text-xs text-gray-500">
                        {`Fixed preset · ${rule.requires_supplier ? "Supplier required" : "Cash style"}`}
                      </p>
                    </div>
                    <AddButton onClick={() => setExpenseItemModal({ isOpen: true, data: null, typeKey: rule.key })}>
                      Add
                    </AddButton>
                  </div>
                  <div className="max-h-80 overflow-auto divide-y divide-gray-200">
                    {(groupedExpenseItems[rule.key] || []).length === 0 ? (
                      <p className="px-5 py-4 text-sm text-gray-400">No items found.</p>
                    ) : (
                      (groupedExpenseItems[rule.key] || []).map((item) => renderExpenseRow(item, rule.key))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SettingsSection>

          {/* ── CRP Type Rates ── */}
          <SettingsSection
            title="CRP Type Rates"
            description="Business-wise category/type rates for cropping records."
            icon={Scissors}
            action={
              <AddButton onClick={() => setCrpRateModal({ isOpen: true, data: null })}>
                Add CRP Type Rate
              </AddButton>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(referenceData.crp_categories || []).map((cat) => (
                <div key={cat} className="rounded-2xl border border-gray-300 overflow-hidden">
                  <div className="px-5 py-3.5 bg-gray-100 border-b border-gray-300">
                    <p className="text-sm font-semibold text-gray-800">{cat}</p>
                  </div>
                  <div className="max-h-80 overflow-auto divide-y divide-gray-200">
                    {groupedCrpRates[cat].length === 0 ? (
                      <p className="px-5 py-4 text-sm text-gray-400">No type rates found.</p>
                    ) : (
                      groupedCrpRates[cat].map((item) => renderCrpRateRow(item))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SettingsSection>

          {/* ── Invoice Banner ── */}
          <SettingsSection
            title="Invoice Numbering"
            description="Set starting sequence for invoice numbers. Format: YYYY-0001"
            icon={Hash}
            action={
              <Button
                onClick={async () => {
                  try {
                    setSavingInvoiceCounter(true);
                    const value = Number(invoiceCounterInput);
                    const res = await updateMyInvoiceCounter({
                      year: invoiceYear,
                      last_invoice_no: value,
                    });
                    setInvoiceCounter(res || null);
                    setInvoiceCounterInput(String(res?.last_invoice_no ?? value));
                    showToast({ type: "success", message: "Invoice counter updated" });
                  } catch (err) {
                    showToast({
                      type: "error",
                      message: err.response?.data?.message || "Failed to update invoice counter",
                    });
                  } finally {
                    setSavingInvoiceCounter(false);
                  }
                }}
                disabled={
                  invoiceCounterLoading ||
                  savingInvoiceCounter ||
                  !invoiceCanUpdate ||
                  invoiceCounterInput === "" ||
                  Number(invoiceCounterInput) < 0
                }
              >
                Save Counter
              </Button>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                label="Year"
                value={String(invoiceYear)}
                readOnly
                required={false}
              />
              <Input
                label="Last Invoice No"
                type="number"
                value={invoiceCounterInput}
                onChange={(e) => setInvoiceCounterInput(e.target.value)}
                disabled={invoiceCounterLoading || !invoiceCanUpdate}
                required={false}
              />
              <Input
                label="Next Invoice"
                value={nextInvoiceLabel}
                readOnly
                required={false}
              />
            </div>

            {!invoiceCanUpdate && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Invoice counter locked: invoices already exist for this business.
              </div>
            )}
          </SettingsSection>

          <SettingsSection
            title="Invoice Banner"
            description="This banner appears at the top of invoice preview and print."
            icon={ImageUp}
            action={
              <button
                onClick={() => {
                  if (!hasInvoiceBanner) {
                    showToast({
                      type: "error",
                      message: "Pro or Premium plan required for invoice banner",
                    });
                    return;
                  }
                  setBannerModalOpen(true);
                }}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  hasInvoiceBanner
                    ? "bg-[#127475] text-white hover:bg-teal-700"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed"
                }`}
              >
                <ImageUp size={15} />
                Manage Banner
              </button>
            }
          >
            {planDetails?.name && (
              <div className="mb-3 text-xs text-gray-500">
                Current plan:{" "}
                <span className="font-semibold text-gray-700">{planDetails.name}</span>
              </div>
            )}
            {!hasInvoiceBanner && (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Pro or Premium plan required to upload an invoice banner.
              </div>
            )}
            <div
              className={`mb-3 rounded-xl border px-3 py-2 text-xs ${
                hasInvoiceImageUpload
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              Invoice image upload in invoice generation:{" "}
              {hasInvoiceImageUpload ? "Enabled (Premium)" : "Disabled (Premium required)"}.
            </div>
            {invoiceBanner ? (
              <div className="rounded-2xl border border-gray-300 overflow-hidden bg-white">
                <img
                  src={invoiceBanner}
                  alt="Current invoice banner"
                  className="w-full max-h-72 object-cover"
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 py-12 flex flex-col items-center justify-center text-gray-400">
                <ImageUp className="h-6 w-6 mb-2" />
                <p className="text-sm font-medium text-gray-500">No invoice banner set</p>
                <p className="text-xs text-gray-400 mt-1">
                  Upload one using the button above.
                </p>
              </div>
            )}
          </SettingsSection>
        </div>
      </div>

      {/* ── Modals ── */}
      <ProductionConfigFormModal
        isOpen={formModal}
        onClose={() => setFormModal(false)}
        onSave={handleSave}
        initialData={activeRecord || null}
        clearEffectiveDateOnOpen
        existingConfigs={records}
      />

      <OrderConfigFormModal
        isOpen={orderFormModal}
        onClose={() => setOrderFormModal(false)}
        onSave={handleSaveOrderConfig}
        initialData={activeOrderRecord || null}
      />

      <ExpenseItemFormModal
        isOpen={expenseItemModal.isOpen}
        initialData={expenseItemModal.data}
        expenseTypeRule={(ruleData.expense_type_rules || []).find((rule) => rule.key === expenseItemModal.typeKey) || null}
        generalItemOptions={generalItemOptions}
        onClose={() =>
          setExpenseItemModal({ isOpen: false, data: null, typeKey: "cash" })
        }
        onSave={async (action, payload) => {
          try {
            if (action === "add") {
              await createExpenseItem(payload);
              showToast({ type: "success", message: "Expense item added" });
            } else {
              await updateExpenseItem(payload.id, payload);
              showToast({ type: "success", message: "Expense item updated" });
            }
            loadExpenseItems();
          } catch (err) {
            showToast({
              type: "error",
              message: err.response?.data?.message || "Failed to save expense item",
            });
            throw err;
          }
        }}
      />

      <CrpRateFormModal
        isOpen={crpRateModal.isOpen}
        initialData={crpRateModal.data}
        categoryOptions={crpCategoryOptions}
        onClose={() => setCrpRateModal({ isOpen: false, data: null })}
        onSave={async (action, payload) => {
          try {
            if (action === "add") {
              await createCrpRateConfig(payload);
              showToast({ type: "success", message: "CRP type rate added" });
            } else {
              await updateCrpRateConfig(payload.id, payload);
              showToast({ type: "success", message: "CRP type rate updated" });
            }
            loadCrpRateConfigs();
          } catch (err) {
            showToast({
              type: "error",
              message: err.response?.data?.message || "Failed to save CRP type rate",
            });
            throw err;
          }
        }}
      />

      <InvoiceBannerModal
        isOpen={bannerModalOpen}
        onClose={() => setBannerModalOpen(false)}
        initialBanner={invoiceBanner}
        onSave={handleSaveBanner}
      />
    </>
  );
}
