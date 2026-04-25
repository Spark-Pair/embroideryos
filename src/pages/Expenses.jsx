import { useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  Building2,
  Calendar,
  Edit3,
  ListTree,
  MoreVertical,
  Plus,
  Receipt,
  Trash2,
} from "lucide-react";
import { createExpense, deleteExpense, fetchExpenses, fetchExpenseStats, updateExpense } from "../api/expense";
import { fetchExpenseItems } from "../api/expenseItem";
import { fetchSuppliers } from "../api/supplier";
import { fetchMyRuleData } from "../api/business";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import TableToolbar from "../components/table/TableToolbar";
import TableSkeleton from "../components/table/TableLoader";
import FilterDrawer from "../components/FilterDrawer";
import ContextMenu from "../components/ContextMenu";
import Modal from "../components/Modal";
import Input from "../components/Input";
import Select from "../components/Select";
import Button from "../components/Button";
import ConfirmModal from "../components/ConfirmModal";
import { useToast } from "../context/ToastContext";
import { useFormKeyboard } from "../hooks/useFormKeyboard";
import { useShortcut } from "../hooks/useShortcuts";
import { formatDate, formatNumbers } from "../utils";
import { getExpenseTypeRule, normalizeRuleData } from "../utils/businessRuleData";
import { isEventMatchingShortcut } from "../utils/shortcuts";

const evaluateMathExpression = (raw) => {
  const expr = String(raw || "").trim();
  if (!expr) return null;
  if (!/^[0-9+\-*/().\s]+$/.test(expr)) return null;
  try {
    const result = Function(`"use strict"; return (${expr});`)();
    if (!Number.isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
};

const toCleanNumberString = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  if (Number.isInteger(num)) return String(num);
  return String(Number(num.toFixed(6))).replace(/\.0+$/, "");
};

const getExpenseBadgeClass = (rule) => {
  if (rule?.is_fixed) return "bg-violet-100 text-violet-700";
  if (rule?.requires_supplier) return "bg-sky-100 text-sky-700";
  return "bg-emerald-100 text-emerald-700";
};

const UNIFIED_FIXED_RULE = {
  key: "fixed",
  label: "Fixed",
  is_fixed: true,
  requires_supplier: false,
};

function ExpenseEntryModal({ isOpen, onClose, onAction, initialExpense = null, ruleData }) {
  const expenseTypeRef = useRef(null);
  const supplierRef = useRef(null);
  const dateRef = useRef(null);
  const monthRef = useRef(null);
  const referenceRef = useRef(null);
  const itemRefs = useRef({});
  const qtyRefs = useRef({});
  const addRowShortcut = useShortcut("production_add_row");
  const [expenseItems, setExpenseItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    expense_type: "cash",
    supplier_id: "",
    date: new Date().toISOString().slice(0, 10),
    month: new Date().toISOString().slice(0, 7),
    reference_no: "",
    remarks: "",
  });
  const [rows, setRows] = useState([{ id: 1, item_name: "", quantity: "", rate: "" }]);
  const [pendingFocusItemRowId, setPendingFocusItemRowId] = useState(null);
  const isEditMode = Boolean(initialExpense?._id);
  const normalizedRuleData = useMemo(() => normalizeRuleData(ruleData || {}), [ruleData]);
  const expenseTypeRules = useMemo(() => {
    const rules = normalizedRuleData.expense_type_rules || [];
    const nonFixedRules = rules.filter((rule) => !rule?.is_fixed);
    return rules.some((rule) => rule?.is_fixed)
      ? [...nonFixedRules, UNIFIED_FIXED_RULE]
      : nonFixedRules;
  }, [normalizedRuleData]);
  const selectedExpenseRule = useMemo(() => {
    if (String(formData.expense_type || "").trim().toLowerCase() === "fixed") return UNIFIED_FIXED_RULE;
    return getExpenseTypeRule(normalizedRuleData, formData.expense_type);
  }, [normalizedRuleData, formData.expense_type]);
  const isFixedMode = Boolean(selectedExpenseRule?.is_fixed);
  const isSupplierMode = Boolean(selectedExpenseRule?.requires_supplier);
  const hasSelectedFixedSupplier = isFixedMode && Boolean(formData.supplier_id);

  useEffect(() => {
    if (!isOpen) return;

    const expenseDate = initialExpense?.date
      ? new Date(initialExpense.date).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const expenseMonth = initialExpense?.month || expenseDate.slice(0, 7);
    const existingItems =
      Array.isArray(initialExpense?.items) && initialExpense.items.length > 0
        ? initialExpense.items
        : initialExpense
          ? [{
              item_name: initialExpense.item_name || "",
              quantity: initialExpense.total_quantity ?? initialExpense.quantity ?? "",
              rate: initialExpense.rate ?? "",
            }]
          : [];

    setFormData({
      expense_type: initialExpense?.fixed_source ? "fixed" : (initialExpense?.expense_type || expenseTypeRules[0]?.key || "cash"),
      supplier_id: initialExpense?.supplier_id || "",
      date: expenseDate,
      month: expenseMonth,
      reference_no: initialExpense?.reference_no || "",
      remarks: initialExpense?.remarks || "",
    });
    setRows(
      existingItems.length > 0
        ? existingItems.map((row, idx) => ({
            id: Date.now() + idx + 1,
            item_name: row?.item_name || "",
            quantity: row?.quantity ?? "",
            rate: row?.rate ?? "",
          }))
        : [{ id: 1, item_name: "", quantity: "", rate: "" }]
    );
    setPendingFocusItemRowId(null);
    setError("");

    const load = async () => {
      setLoadingOptions(true);
      try {
        const [itemsRes, suppliersRes] = await Promise.all([
          fetchExpenseItems({ status: "active" }),
          fetchSuppliers({ page: 1, limit: 5000, status: "active" }),
        ]);

        setExpenseItems(itemsRes?.data || []);
        setSuppliers(suppliersRes?.data || []);
      } catch {
        setExpenseItems([]);
        setSuppliers([]);
      } finally {
        setLoadingOptions(false);
      }
    };

    load();
    setTimeout(() => {
      expenseTypeRef.current?.focus();
    }, 120);
  }, [isOpen, initialExpense, expenseTypeRules]);

  const currentTypeItems = useMemo(
    () =>
      expenseItems.filter((item) => {
        const itemExpenseType = String(item?.expense_type || "").trim();
        const itemFixedSource = String(item?.fixed_source || "").trim().toLowerCase();
        if (isFixedMode) {
          return itemExpenseType === "fixed" && Boolean(itemFixedSource);
        }
        return !itemFixedSource;
      }),
    [expenseItems, isFixedMode]
  );
  const selectableExpenseItems = useMemo(() => {
    if (isFixedMode) return currentTypeItems;
    return expenseItems.filter((item) => {
      const itemRule = getExpenseTypeRule(normalizedRuleData, item.expense_type);
      return !itemRule?.is_fixed;
    });
  }, [currentTypeItems, expenseItems, isFixedMode, normalizedRuleData]);

  const selectedSupplierAssignedItems = useMemo(() => {
    if (!isSupplierMode || isFixedMode || !formData.supplier_id) return [];
    const supplier = suppliers.find((s) => String(s?._id || "") === String(formData.supplier_id));
    const assigned = Array.isArray(supplier?.assigned_expense_items)
      ? supplier.assigned_expense_items
      : [];
    return assigned
      .map((v) => String(v || "").trim())
      .filter(Boolean);
  }, [isSupplierMode, isFixedMode, formData.supplier_id, suppliers]);

  const allowedSupplierItemSet = useMemo(
    () => new Set(selectedSupplierAssignedItems),
    [selectedSupplierAssignedItems]
  );

  const itemOptions = useMemo(() => {
    const base = selectableExpenseItems
      .filter((item) => {
        if (!isSupplierMode || isFixedMode) return true;
        return allowedSupplierItemSet.has(String(item?.name || "").trim());
      })
      .reduce((acc, item) => {
        const name = String(item?.name || "").trim();
        if (!name) return acc;
        if (acc.some((opt) => opt.value.toLowerCase() === name.toLowerCase())) return acc;
        acc.push({
          label: item.name,
          value: item.name,
        });
        return acc;
      }, []);
    const seen = new Set(base.map((opt) => opt.value));
    rows.forEach((row) => {
      const name = String(row?.item_name || "").trim();
      if (!name || seen.has(name)) return;
      seen.add(name);
      base.unshift({ label: name, value: name });
    });
    return base;
  }, [selectableExpenseItems, rows, isSupplierMode, isFixedMode, allowedSupplierItemSet]);
  const supplierOptions = useMemo(
    () =>
      [...suppliers]
        .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), undefined, { sensitivity: "base" }))
        .map((supplier) => ({ label: supplier.name, value: supplier._id })),
    [suppliers]
  );
  const selectedFixedSupplierName = useMemo(() => {
    if (!isFixedMode || !formData.supplier_id) return "";
    const supplier = suppliers.find((s) => String(s._id) === String(formData.supplier_id));
    return supplier?.name || "";
  }, [isFixedMode, suppliers, formData.supplier_id]);

  const addRow = ({ focusItem = false } = {}) => {
    if (isFixedMode) return;
    const newId = Date.now();
    setRows((prev) => [...prev, { id: newId, item_name: "", quantity: "", rate: "" }]);
    if (focusItem) setPendingFocusItemRowId(newId);
    return newId;
  };

  useEffect(() => {
    if (!pendingFocusItemRowId) return;
    let tries = 0;
    const maxTries = 8;
    const focusWhenReady = () => {
      const el = itemRefs.current[pendingFocusItemRowId];
      if (el && typeof el.focus === "function") {
        const active = document.activeElement;
        if (active && active !== document.body && typeof active.blur === "function") {
          active.blur();
        }
        el.focus();
        setTimeout(() => el.focus(), 0);
        setPendingFocusItemRowId(null);
        return;
      }
      tries += 1;
      if (tries >= maxTries) {
        setPendingFocusItemRowId(null);
        return;
      }
      setTimeout(focusWhenReady, 60);
    };
    setTimeout(focusWhenReady, 0);
  }, [pendingFocusItemRowId, rows]);

  const removeRow = (id) => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((row) => row.id !== id)));
  };

  const payloadItems = rows
    .filter((row) => row.item_name && Number(row.quantity) > 0 && Number(row.rate) > 0)
    .map((row) => {
      const quantity = Number(row.quantity);
      const rate = Number(row.rate);
      return {
        item_name: row.item_name,
        quantity,
        rate,
        amount: quantity * rate,
      };
    });

  const totalQuantity = payloadItems.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  const totalAmount = payloadItems.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const isValid =
    (!!formData.expense_type &&
      (isFixedMode ? !!formData.month : !!formData.date) &&
      (!(isSupplierMode && !isFixedMode) || !!formData.supplier_id) &&
      payloadItems.length > 0);

  const handleSave = async () => {
    if (!isValid) {
      setError("Please fill all required fields and at least one valid item.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      await onAction({
        expense_type: formData.expense_type,
        supplier_id: (isSupplierMode || isFixedMode) ? formData.supplier_id : "",
        date: isFixedMode ? new Date().toISOString().slice(0, 10) : formData.date,
        month: isFixedMode ? formData.month : formData.date.slice(0, 7),
        reference_no: formData.reference_no,
        remarks: formData.remarks,
        items: payloadItems,
      }, initialExpense?._id || null);
      onClose();
    } catch {
      // parent toast handles
    } finally {
      setSubmitting(false);
    }
  };

  const focusAfterExpenseType = (nextType) => {
    const nextRule = String(nextType || "").trim().toLowerCase() === "fixed"
      ? UNIFIED_FIXED_RULE
      : getExpenseTypeRule(normalizedRuleData, nextType);
    setTimeout(() => {
      if (nextRule?.requires_supplier && !nextRule?.is_fixed) {
        supplierRef.current?.focus();
        return;
      }
      if (nextRule?.is_fixed) {
        monthRef.current?.focus();
        return;
      }
      dateRef.current?.focus();
    }, 140);
  };

  useFormKeyboard({
    onEnterSubmit: () => {
      if (!isOpen) return;
      handleSave();
    },
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-4xl"
      title={isEditMode ? "Edit Expense" : "Add Expense"}
      subtitle={isEditMode ? "Update expense details and items" : "Record business-defined expense entries"}
      footer={
        <div className="w-full flex items-center justify-between gap-3">
          <p className="text-xs text-red-600">{error}</p>
          <div className="flex gap-2">
            <Button variant="secondary" outline onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSave} loading={submitting} disabled={!isValid}>
              {isEditMode ? "Update Expense" : "Save Expense"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-0.5">
        <Select
          ref={expenseTypeRef}
          label="Expense Type"
          value={formData.expense_type}
          onChange={(value) => {
            setFormData((prev) => ({ ...prev, expense_type: value, supplier_id: "" }));
            setRows([{ id: 1, item_name: "", quantity: "", rate: "" }]);
            focusAfterExpenseType(value);
          }}
          options={expenseTypeRules.map((rule) => ({ label: rule.label, value: rule.key }))}
        />

        {isSupplierMode && !isFixedMode && (
          <Select
            ref={supplierRef}
            label="Supplier"
            value={formData.supplier_id}
            onChange={(value) => {
              setFormData((prev) => ({ ...prev, supplier_id: value }));
              setRows([{ id: 1, item_name: "", quantity: "", rate: "" }]);
              setPendingFocusItemRowId(null);
              setTimeout(() => dateRef.current?.focus(), 120);
            }}
            options={supplierOptions}
            placeholder={loadingOptions ? "Loading suppliers..." : "Select supplier"}
          />
        )}

        {isFixedMode && (
          <Input
            label="Fixed For"
            value={hasSelectedFixedSupplier ? "Supplier" : "Cash"}
            readOnly
            required={false}
          />
        )}

        {isFixedMode && hasSelectedFixedSupplier && (
          <Input
            label="Supplier"
            value={selectedFixedSupplierName}
            placeholder=""
            readOnly
            required={false}
          />
        )}

        {!isFixedMode && (
          <Input
            ref={dateRef}
            label="Date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
          />
        )}

        {isFixedMode && (
          <Input
            ref={monthRef}
            label="Month"
            type="month"
            value={formData.month}
            onChange={(e) => setFormData((prev) => ({ ...prev, month: e.target.value }))}
          />
        )}

        {!isFixedMode && (
          <Input
            label="Reference No"
            ref={referenceRef}
            required={false}
            value={formData.reference_no}
            onChange={(e) => setFormData((prev) => ({ ...prev, reference_no: e.target.value }))}
          />
        )}

        <div className="md:col-span-2">
          <label className="block mb-1.5 text-sm text-gray-700">Remarks <span className="text-gray-400">(Optional)</span></label>
          <textarea
            value={formData.remarks}
            onChange={(e) => setFormData((prev) => ({ ...prev, remarks: e.target.value }))}
            rows={2}
            className="w-full border border-gray-400 px-4 py-2 rounded-xl focus:ring-2 focus:ring-teal-300 focus:outline-none bg-gray-50 resize-y"
          />
        </div>
      </div>

      <div className="mt-4 border border-gray-300 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">
            {isFixedMode ? "Fixed Expense Items" : "Expense Items"}
          </p>
          {!isFixedMode && (
            <Button
              size="sm"
              variant="secondary"
              outline
              onClick={() => addRow({ focusItem: true })}
            >
              Add Item
            </Button>
          )}
        </div>

        <div className="p-3 space-y-2 max-h-72 overflow-auto">
          {itemOptions.length === 0 ? (
            <p className="text-sm text-gray-400">
              No {isFixedMode ? "fixed " : ""}expense items found. Add them from Settings.
            </p>
          ) : rows.map((row, index) => (
            <div key={row.id} className="grid grid-cols-12 gap-2 items-end border border-gray-200 rounded-xl px-3 py-2">
              <div className="col-span-5">
                <Select
                  ref={(el) => {
                    itemRefs.current[row.id] = el;
                  }}
                  label={index === 0 ? "Expense / Item" : ""}
                  value={row.item_name}
                  onChange={(value) => {
                    setRows((prev) => prev.map((r) => {
                      if (r.id !== row.id) return r;
                      const selected = currentTypeItems.find((i) => i.name === value);
                      if (isFixedMode && selected) {
                        const nextSupplierId = String(selected?.fixed_source || "").trim().toLowerCase() === "supplier"
                          ? String(selected?.supplier_id || "")
                          : "";
                        setFormData((prevForm) => ({
                          ...prevForm,
                          supplier_id: nextSupplierId,
                        }));
                        return {
                          ...r,
                          item_name: value,
                          quantity: selected.default_quantity ?? "",
                          rate: selected.default_rate ?? "",
                        };
                      }
                      return { ...r, item_name: value };
                    }));
                    setTimeout(() => qtyRefs.current[row.id]?.focus(), 90);
                  }}
                  options={itemOptions}
                  placeholder={loadingOptions ? "Loading items..." : "Select expense item"}
                />
              </div>
              <div className="col-span-2">
                <Input
                  ref={(el) => {
                    qtyRefs.current[row.id] = el;
                  }}
                  label={index === 0 ? "Quantity" : ""}
                  type="text"
                  value={row.quantity}
                  onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, quantity: e.target.value } : r)))}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== "=") return;
                    e.preventDefault();
                    const answer = evaluateMathExpression(row.quantity);
                    if (answer == null) return;
                    const computed = toCleanNumberString(answer);
                    setRows((prev) =>
                      prev.map((r) => (r.id === row.id ? { ...r, quantity: computed } : r))
                    );
                  }}
                />
              </div>
              <div className="col-span-2">
                <Input
                  label={index === 0 ? "Rate" : ""}
                  type="number"
                  value={row.rate}
                  onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, rate: e.target.value } : r)))}
                  onKeyDown={(e) => {
                    if (!isEventMatchingShortcut(e, addRowShortcut)) return;
                    if (isFixedMode) return;
                    e.preventDefault();
                    addRow({ focusItem: true });
                  }}
                />
              </div>
              <div className="col-span-2">
                <Input
                  label={index === 0 ? "Amount" : ""}
                  value={formatNumbers(Number(row.quantity || 0) * Number(row.rate || 0), 2)}
                  readOnly
                  required={false}
                />
              </div>
              <div className="col-span-1 pb-1">
                {!isFixedMode && (
                  <Button size="sm" variant="danger" outline onClick={() => removeRow(row.id)}>X</Button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-2.5 flex items-center justify-end gap-6">
          <p className="text-sm text-gray-600">
            Total Qty: <span className="font-semibold text-gray-900">{formatNumbers(totalQuantity, 2)}</span>
          </p>
          <p className="text-sm text-gray-600">
            Total Amount: <span className="font-semibold text-gray-900">{formatNumbers(totalAmount, 2)}</span>
          </p>
        </div>
      </div>
    </Modal>
  );
}

function ExpenseDetailsModal({ isOpen, onClose, expense, ruleData }) {
  const items = Array.isArray(expense?.items) && expense.items.length > 0
    ? expense.items
    : [{
        item_name: expense?.item_name || "",
        quantity: expense?.total_quantity ?? expense?.quantity ?? 0,
        rate: expense?.rate ?? 0,
        amount: expense?.total_amount ?? expense?.amount ?? 0,
      }];
  const totalQuantity = items.reduce((sum, row) => sum + Number(row?.quantity || 0), 0);
  const totalAmount = items.reduce((sum, row) => sum + Number(row?.amount || 0), 0);
  const expenseRule = getExpenseTypeRule(ruleData || {}, expense?.expense_type);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-3xl"
      title="Expense Details"
      subtitle="Item-wise breakdown"
      footer={
        <div className="w-full flex items-center justify-end">
          <Button variant="secondary" outline onClick={onClose}>Close</Button>
        </div>
      }
    >
      {!expense ? (
        <div className="py-10 text-center text-sm text-gray-400">No details available.</div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="rounded-xl border border-gray-200 px-3 py-2"><span className="text-gray-500">Date</span><p className="font-semibold text-gray-800">{formatDate(expense.date, "DD MMM yyyy")}</p></div>
            <div className="rounded-xl border border-gray-200 px-3 py-2"><span className="text-gray-500">Type</span><p className="font-semibold text-gray-800">{expenseRule?.label || expense?.expense_type}</p></div>
            <div className="rounded-xl border border-gray-200 px-3 py-2"><span className="text-gray-500">Supplier</span><p className="font-semibold text-gray-800">{expense.supplier_name || "-"}</p></div>
            <div className="rounded-xl border border-gray-200 px-3 py-2"><span className="text-gray-500">Ref No</span><p className="font-semibold text-gray-800">{expense.reference_no || "-"}</p></div>
          </div>

          <div className="rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Item</th>
                  <th className="px-4 py-2 text-right font-medium">Qty</th>
                  <th className="px-4 py-2 text-right font-medium">Rate</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, idx) => (
                  <tr key={`${row?.item_name || "item"}-${idx}`} className="border-t border-gray-200">
                    <td className="px-4 py-2 text-gray-800">{row?.item_name || "-"}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{formatNumbers(row?.quantity || 0, 2)}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{formatNumbers(row?.rate || 0, 2)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-900">{formatNumbers(row?.amount || 0, 2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td className="px-4 py-2 font-semibold text-gray-700">Total</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-800">{formatNumbers(totalQuantity, 2)}</td>
                  <td className="px-4 py-2" />
                  <td className="px-4 py-2 text-right font-bold text-gray-900">{formatNumbers(totalAmount, 2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Expenses() {
  const { showToast } = useToast();
  const toMillis = (value) => {
    if (!value) return 0;
    const d = new Date(value).getTime();
    return Number.isFinite(d) ? d : 0;
  };
  const sortLatestFirst = (rows = []) =>
    [...rows].sort((a, b) => {
      const aTime = toMillis(a?.createdAt) || toMillis(a?.date);
      const bTime = toMillis(b?.createdAt) || toMillis(b?.date);
      return bTime - aTime;
    });

  const [stats, setStats] = useState({ total: 0, total_amount: 0, breakdown: [] });
  const [expenses, setExpenses] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 30 });
  const [loading, setLoading] = useState(false);
  const [formModal, setFormModal] = useState({ isOpen: false });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", onConfirm: () => {}, variant: "danger" });
  const [detailsModal, setDetailsModal] = useState({ isOpen: false, expense: null });
  const [activeMenu, setActiveMenu] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ item_name: "", supplier_name: "", expense_type: "", month: "", date_from: "", date_to: "" });
  const [ruleData, setRuleData] = useState({});

  const tableScrollRef = useRef(null);

  const loadStats = async () => {
    try {
      const res = await fetchExpenseStats();
      setStats(res?.data || { total: 0, total_amount: 0, breakdown: [] });
    } catch {
      showToast({ type: "error", message: "Failed to load expense stats" });
    }
  };

  const loadExpenses = async (page = 1, filterParams = filters) => {
    try {
      setLoading(true);
      const res = await fetchExpenses({ page, limit: 30, ...filterParams });
      setExpenses(sortLatestFirst(res.data || []));
      if (res.pagination) setPagination(res.pagination);
      loadStats();
    } catch {
      showToast({ type: "error", message: "Failed to load expenses" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadRuleData = async () => {
      try {
        const res = await fetchMyRuleData();
        setRuleData(res?.rule_data || {});
      } catch {
        setRuleData({});
      }
    };
    loadRuleData();
  }, []);

  useEffect(() => {
    if (tableScrollRef.current) tableScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
  }, [pagination.currentPage]);

  const expenseStatBreakdown = (stats?.breakdown || []).slice(0, 3);
  const expenseTypeRules = useMemo(() => {
    const rules = normalizeRuleData(ruleData || {}).expense_type_rules || [];
    const nonFixedRules = rules.filter((rule) => !rule?.is_fixed);
    return rules.some((rule) => rule?.is_fixed)
      ? [...nonFixedRules, UNIFIED_FIXED_RULE]
      : nonFixedRules;
  }, [ruleData]);

  return (
    <>
      <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col">
        <PageHeader title="Expenses" subtitle="Record business-defined expenses with item-wise entries." actionLabel="Add Expense" actionIcon={Plus} onAction={() => setFormModal({ isOpen: true })} />

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
          <StatCard label="Total Entries" value={stats.total} icon={Receipt} />
          <StatCard label="Total Amount" value={formatNumbers(stats.total_amount, 2)} icon={Banknote} variant="warning" />
          {expenseStatBreakdown.map((item) => {
            const rule = item?.key === "fixed" ? UNIFIED_FIXED_RULE : getExpenseTypeRule(ruleData || {}, item?.key);
            const Icon = rule?.requires_supplier ? Building2 : rule?.is_fixed ? Calendar : Banknote;
            return (
              <StatCard
                key={item.key}
                label={rule?.label || item.key}
                value={Number(item.count || 0)}
                icon={Icon}
                variant={rule?.is_fixed ? "danger" : rule?.requires_supplier ? "normal" : "success"}
              />
            );
          })}
        </div>

        <div className="rounded-3xl bg-white border border-gray-300 overflow-hidden flex-1 flex flex-col">
          <TableToolbar currentPage={pagination.currentPage} totalPages={pagination.totalPages} onPageChange={(page) => loadExpenses(page, filters)} onFilter={() => setIsFilterOpen(true)} />

          <div ref={tableScrollRef} className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-20 bg-gray-100" style={{ boxShadow: "0 1px 0 0 rgba(209,213,219,1)" }}>
                <tr className="text-sm tracking-wider text-gray-500">
                  <th className="px-5 py-3.5 font-medium">#</th>
                  <th className="px-5 py-3.5 font-medium">Date</th>
                  <th className="px-5 py-3.5 font-medium">Supplier</th>
                  <th className="px-5 py-3.5 font-medium">Expense / Item</th>
                  <th className="px-5 py-3.5 font-medium">Type</th>
                  <th className="px-5 py-3.5 font-medium">Rows</th>
                  <th className="px-5 py-3.5 font-medium">Total Qty</th>
                  <th className="px-5 py-3.5 font-medium">Ref No</th>
                  <th className="px-5 py-3.5 font-medium">Total Amount</th>
                  <th className="px-5 py-3.5 font-medium">Remarks</th>
                  <th className="px-5 py-3.5 font-medium text-right">Actions</th>
                </tr>
              </thead>

              {loading ? (
                <TableSkeleton rows={30} columns={11} />
              ) : (
                <tbody className="divide-y divide-gray-200">
                  {expenses.length === 0 ? (
                    <tr><td colSpan={11} className="px-7 py-16 text-center text-sm text-gray-400">No expenses found.</td></tr>
                  ) : expenses.map((item, index) => (
                    <tr
                      key={item._id}
                      className="hover:bg-gray-50/80 transition-colors cursor-pointer"
                      onClick={() => setDetailsModal({ isOpen: true, expense: item })}
                    >
                      <td className="px-5 py-4 text-sm text-gray-500">{(pagination.currentPage - 1) * pagination.itemsPerPage + index + 1}</td>
                      <td className="px-5 py-4 text-sm text-gray-600">{formatDate(item.date, "DD MMM yyyy")}</td>
                      <td className="px-5 py-4 text-sm font-semibold text-gray-800" title={item.supplier_name || ""}>
                        {item.supplier_name || "-"}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-gray-800">{item.item_name || "-"}</td>
                      <td className="px-5 py-4 text-sm">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getExpenseBadgeClass(getExpenseTypeRule(ruleData || {}, item.expense_type)) || "bg-gray-100 text-gray-700"}`}>
                          {getExpenseTypeRule(ruleData || {}, item.expense_type)?.label || item.expense_type}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600">
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                          <ListTree size={12} /> {formatNumbers(item.items_count || (Array.isArray(item.items) ? item.items.length : 1), 0)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600">{formatNumbers((item.total_quantity ?? item.quantity ?? 0), 2)}</td>
                      <td className="px-5 py-4 text-sm text-gray-600">{item.reference_no || "-"}</td>
                      <td className="px-5 py-4 text-sm text-gray-600 font-semibold">{formatNumbers((item.total_amount ?? item.amount ?? 0), 2)}</td>
                      <td className="px-5 py-4 text-sm text-gray-500 max-w-[220px] truncate" title={item.remarks || ""}>{item.remarks || "-"}</td>
                      <td
                        className="px-5 py-4 text-right relative"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => setActiveMenu(activeMenu === item._id ? null : item._id)}
                          className="p-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100"
                          aria-label="Open actions menu"
                        >
                          <MoreVertical size={18} />
                        </button>
                        <ContextMenu isOpen={activeMenu === item._id}>
                          <button
                            onClick={() => {
                              setFormModal({ isOpen: true, expense: item });
                              setActiveMenu(null);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl text-sky-600 hover:bg-sky-50 cursor-pointer"
                          >
                            <Edit3 size={16} strokeWidth={2.5} />
                            Edit Expense
                          </button>
                          <button
                            onClick={() => {
                              setConfirmModal({
                                isOpen: true,
                                title: "Delete Expense",
                                message: `Are you sure you want to delete "${item.item_name}"?`,
                                variant: "danger",
                                onConfirm: async () => {
                                  await deleteExpense(item._id);
                                  loadExpenses(pagination.currentPage, filters);
                                  showToast({ type: "success", message: "Expense deleted successfully" });
                                },
                              });
                              setActiveMenu(null);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl text-rose-500 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 size={16} strokeWidth={2.5} />
                            Delete Expense
                          </button>
                        </ContextMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
        </div>
      </div>

      <ExpenseEntryModal
        isOpen={formModal.isOpen}
        initialExpense={formModal.expense || null}
        ruleData={ruleData}
        onClose={() => setFormModal({ isOpen: false, expense: null })}
        onAction={async (payload, expenseId) => {
          try {
            if (expenseId) {
              await updateExpense(expenseId, payload);
              showToast({ type: "success", message: "Expense updated successfully" });
            } else {
              await createExpense(payload);
              showToast({ type: "success", message: "Expense saved successfully" });
            }
            loadExpenses(pagination.currentPage, filters);
          } catch (err) {
            showToast({
              type: "error",
              message: err.response?.data?.message || (expenseId ? "Failed to update expense" : "Failed to save expense"),
            });
            throw err;
          }
        }}
      />

      <ExpenseDetailsModal
        isOpen={detailsModal.isOpen}
        onClose={() => setDetailsModal({ isOpen: false, expense: null })}
        expense={detailsModal.expense}
        ruleData={ruleData}
      />

      <FilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={[
          { label: "Supplier", type: "text", value: filters.supplier_name, onChange: (e) => setFilters((prev) => ({ ...prev, supplier_name: e.target.value })) },
          { label: "Expense / Item", type: "text", value: filters.item_name, onChange: (e) => setFilters((prev) => ({ ...prev, item_name: e.target.value })) },
          {
            label: "Expense Type",
            type: "select",
            value: filters.expense_type,
            options: [
              { label: "All", value: "" },
              ...expenseTypeRules.map((rule) => ({ label: rule.label, value: rule.key })),
            ],
            onChange: (v) => setFilters((prev) => ({ ...prev, expense_type: v })),
          },
          { label: "Month", type: "month", value: filters.month, onChange: (e) => setFilters((prev) => ({ ...prev, month: e.target.value })) },
          { label: "Date From", type: "date", value: filters.date_from, onChange: (e) => setFilters((prev) => ({ ...prev, date_from: e.target.value })) },
          { label: "Date To", type: "date", value: filters.date_to, onChange: (e) => setFilters((prev) => ({ ...prev, date_to: e.target.value })) },
        ]}
        onApply={() => {
          loadExpenses(1, filters);
          setIsFilterOpen(false);
        }}
        onReset={() => {
          const reset = { item_name: "", supplier_name: "", expense_type: "", month: "", date_from: "", date_to: "" };
          setFilters(reset);
          loadExpenses(1, reset);
          setIsFilterOpen(false);
        }}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        onConfirm={async () => {
          await confirmModal.onConfirm();
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }}
      />
    </>
  );
}
