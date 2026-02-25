import { useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  Building2,
  Calendar,
  MoreVertical,
  Plus,
  Receipt,
  Trash2,
} from "lucide-react";
import { createExpense, deleteExpense, fetchExpenses, fetchExpenseStats } from "../api/expense";
import { fetchExpenseItems } from "../api/expenseItem";
import { fetchSuppliers } from "../api/supplier";
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
import { formatDate, formatNumbers } from "../utils";

const EXPENSE_TYPE_OPTIONS = [
  { label: "Cash Expense", value: "cash" },
  { label: "Supplier Expense", value: "supplier" },
  { label: "Fixed Expense", value: "fixed" },
];

const EXPENSE_TYPE_LABEL = {
  cash: "Cash",
  supplier: "Supplier",
  fixed: "Fixed",
};

const TYPE_BADGE_CLASS = {
  cash: "bg-emerald-100 text-emerald-700",
  supplier: "bg-sky-100 text-sky-700",
  fixed: "bg-violet-100 text-violet-700",
};

function ExpenseEntryModal({ isOpen, onClose, onAction }) {
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
  const [rows, setRows] = useState([{ id: 1, item_name: "", amount: "" }]);
  const [fixedRows, setFixedRows] = useState([]);

  const isFixedMode = formData.expense_type === "fixed";
  const isSupplierMode = formData.expense_type === "supplier";

  useEffect(() => {
    if (!isOpen) return;

    setFormData({
      expense_type: "cash",
      supplier_id: "",
      date: new Date().toISOString().slice(0, 10),
      month: new Date().toISOString().slice(0, 7),
      reference_no: "",
      remarks: "",
    });
    setRows([{ id: 1, item_name: "", amount: "" }]);
    setFixedRows([]);
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
  }, [isOpen]);

  const cashOrSupplierItems = useMemo(
    () => expenseItems.filter((item) => item.expense_type === formData.expense_type),
    [expenseItems, formData.expense_type]
  );

  const fixedItems = useMemo(
    () => expenseItems.filter((item) => item.expense_type === "fixed"),
    [expenseItems]
  );

  useEffect(() => {
    if (!isFixedMode) return;

    setFixedRows(
      fixedItems.map((item) => ({
        id: item._id,
        item_name: item.name,
        amount: item.default_amount ?? 0,
        selected: false,
      }))
    );
  }, [isFixedMode, fixedItems]);

  const itemOptions = cashOrSupplierItems.map((item) => ({ label: item.name, value: item.name }));
  const supplierOptions = suppliers.map((supplier) => ({ label: supplier.name, value: supplier._id }));

  const addRow = () => {
    setRows((prev) => [...prev, { id: Date.now(), item_name: "", amount: "" }]);
  };

  const removeRow = (id) => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((row) => row.id !== id)));
  };

  const payloadItems = isFixedMode
    ? fixedRows
      .filter((row) => row.selected)
      .map((row) => ({ item_name: row.item_name, amount: Number(row.amount) }))
    : rows
      .filter((row) => row.item_name && Number(row.amount) > 0)
      .map((row) => ({ item_name: row.item_name, amount: Number(row.amount) }));

  const isValid =
    (!!formData.expense_type &&
      (isFixedMode ? !!formData.month : !!formData.date) &&
      (!isSupplierMode || !!formData.supplier_id) &&
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
        supplier_id: isSupplierMode ? formData.supplier_id : "",
        date: isFixedMode ? "" : formData.date,
        month: isFixedMode ? formData.month : formData.date.slice(0, 7),
        reference_no: formData.reference_no,
        remarks: formData.remarks,
        items: payloadItems,
      });
      onClose();
    } catch {
      // parent toast handles
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-4xl"
      title="Add Expense"
      subtitle="Record cash, supplier, or fixed expenses"
      footer={
        <div className="w-full flex items-center justify-between gap-3">
          <p className="text-xs text-red-600">{error}</p>
          <div className="flex gap-2">
            <Button variant="secondary" outline onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSave} loading={submitting} disabled={!isValid}>Save Expense</Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-0.5">
        <Select
          label="Expense Type"
          value={formData.expense_type}
          onChange={(value) => setFormData((prev) => ({ ...prev, expense_type: value, supplier_id: "" }))}
          options={EXPENSE_TYPE_OPTIONS}
        />

        {isSupplierMode ? (
          <Select
            label="Supplier"
            value={formData.supplier_id}
            onChange={(value) => setFormData((prev) => ({ ...prev, supplier_id: value }))}
            options={supplierOptions}
            placeholder={loadingOptions ? "Loading suppliers..." : "Select supplier"}
          />
        ) : (
          <Input
            label={isFixedMode ? "Month" : "Date"}
            type={isFixedMode ? "month" : "date"}
            value={isFixedMode ? formData.month : formData.date}
            onChange={(e) => setFormData((prev) => ({ ...prev, [isFixedMode ? "month" : "date"]: e.target.value }))}
          />
        )}

        {!isFixedMode && (
          <Input
            label="Date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
          />
        )}

        <Input
          label="Reference No"
          required={false}
          value={formData.reference_no}
          onChange={(e) => setFormData((prev) => ({ ...prev, reference_no: e.target.value }))}
        />

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
            <Button size="sm" variant="secondary" outline onClick={addRow}>Add Item</Button>
          )}
        </div>

        <div className="p-3 space-y-2 max-h-72 overflow-auto">
          {isFixedMode ? (
            fixedRows.length === 0 ? (
              <p className="text-sm text-gray-400">No fixed expense items found. Add them from Settings.</p>
            ) : (
              fixedRows.map((row, index) => (
                <div key={row.id} className="grid grid-cols-12 gap-2 items-center border border-gray-200 rounded-xl px-3 py-2">
                  <div className="col-span-1">
                    <input
                      type="checkbox"
                      checked={row.selected}
                      onChange={(e) => setFixedRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, selected: e.target.checked } : r)))}
                      className="h-4 w-4"
                    />
                  </div>
                  <div className="col-span-7 text-sm text-gray-700 font-medium">{index + 1}. {row.item_name}</div>
                  <div className="col-span-4">
                    <Input
                      label=""
                      type="number"
                      value={row.amount}
                      onChange={(e) => setFixedRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, amount: e.target.value } : r)))}
                    />
                  </div>
                </div>
              ))
            )
          ) : (
            rows.map((row, index) => (
              <div key={row.id} className="grid grid-cols-12 gap-2 items-end border border-gray-200 rounded-xl px-3 py-2">
                <div className="col-span-6">
                  <Select
                    label={index === 0 ? "Expense / Item" : ""}
                    value={row.item_name}
                    onChange={(value) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, item_name: value } : r)))}
                    options={itemOptions}
                    placeholder={loadingOptions ? "Loading items..." : "Select expense item"}
                  />
                </div>
                <div className="col-span-4">
                  <Input
                    label={index === 0 ? "Amount" : ""}
                    type="number"
                    value={row.amount}
                    onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, amount: e.target.value } : r)))}
                  />
                </div>
                <div className="col-span-2 pb-1">
                  <Button size="sm" variant="danger" outline onClick={() => removeRow(row.id)}>Remove</Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function Expenses() {
  const { showToast } = useToast();

  const [stats, setStats] = useState({ total: 0, total_amount: 0, cash_count: 0, supplier_count: 0, fixed_count: 0 });
  const [expenses, setExpenses] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 30 });
  const [loading, setLoading] = useState(false);
  const [formModal, setFormModal] = useState({ isOpen: false });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", onConfirm: () => {}, variant: "danger" });
  const [activeMenu, setActiveMenu] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ item_name: "", expense_type: "", month: "", date_from: "", date_to: "" });

  const tableScrollRef = useRef(null);

  const loadStats = async () => {
    try {
      const res = await fetchExpenseStats();
      setStats(res?.data || { total: 0, total_amount: 0, cash_count: 0, supplier_count: 0, fixed_count: 0 });
    } catch {
      showToast({ type: "error", message: "Failed to load expense stats" });
    }
  };

  const loadExpenses = async (page = 1, filterParams = filters) => {
    try {
      setLoading(true);
      const res = await fetchExpenses({ page, limit: 30, ...filterParams });
      setExpenses(res.data || []);
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
    if (tableScrollRef.current) tableScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
  }, [pagination.currentPage]);

  return (
    <>
      <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col">
        <PageHeader title="Expenses" subtitle="Record cash, supplier and fixed expenses with item-wise entries." actionLabel="Add Expense" actionIcon={Plus} onAction={() => setFormModal({ isOpen: true })} />

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
          <StatCard label="Total Entries" value={stats.total} icon={Receipt} />
          <StatCard label="Total Amount" value={formatNumbers(stats.total_amount, 2)} icon={Banknote} variant="warning" />
          <StatCard label="Cash" value={stats.cash_count} icon={Banknote} variant="success" />
          <StatCard label="Supplier" value={stats.supplier_count} icon={Building2} variant="normal" />
          <StatCard label="Fixed" value={stats.fixed_count} icon={Calendar} variant="danger" />
        </div>

        <div className="rounded-3xl bg-white border border-gray-300 overflow-hidden flex-1 flex flex-col">
          <TableToolbar currentPage={pagination.currentPage} totalPages={pagination.totalPages} onPageChange={(page) => loadExpenses(page, filters)} onFilter={() => setIsFilterOpen(true)} />

          <div ref={tableScrollRef} className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-20 bg-gray-100" style={{ boxShadow: "0 1px 0 0 rgba(209,213,219,1)" }}>
                <tr className="text-sm tracking-wider text-gray-500">
                  <th className="px-5 py-3.5 font-medium">#</th>
                  <th className="px-5 py-3.5 font-medium">Date</th>
                  <th className="px-5 py-3.5 font-medium">Type</th>
                  <th className="px-5 py-3.5 font-medium">Expense / Item</th>
                  <th className="px-5 py-3.5 font-medium">Supplier</th>
                  <th className="px-5 py-3.5 font-medium">Ref No</th>
                  <th className="px-5 py-3.5 font-medium">Amount</th>
                  <th className="px-5 py-3.5 font-medium">Remarks</th>
                  <th className="px-5 py-3.5 font-medium text-right">Actions</th>
                </tr>
              </thead>

              {loading ? (
                <TableSkeleton rows={30} columns={9} />
              ) : (
                <tbody className="divide-y divide-gray-200">
                  {expenses.length === 0 ? (
                    <tr><td colSpan={9} className="px-7 py-16 text-center text-sm text-gray-400">No expenses found.</td></tr>
                  ) : expenses.map((item, index) => (
                    <tr key={item._id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-5 py-4 text-sm text-gray-500">{(pagination.currentPage - 1) * pagination.itemsPerPage + index + 1}</td>
                      <td className="px-5 py-4 text-sm text-gray-600">{formatDate(item.date, "DD MMM yyyy")}</td>
                      <td className="px-5 py-4 text-sm">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${TYPE_BADGE_CLASS[item.expense_type] || "bg-gray-100 text-gray-700"}`}>
                          {EXPENSE_TYPE_LABEL[item.expense_type] || item.expense_type}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-gray-800">{item.item_name || "-"}</td>
                      <td className="px-5 py-4 text-sm text-gray-600">{item.supplier_name || "-"}</td>
                      <td className="px-5 py-4 text-sm text-gray-600">{item.reference_no || "-"}</td>
                      <td className="px-5 py-4 text-sm text-gray-600 font-semibold">{formatNumbers(item.amount, 2)}</td>
                      <td className="px-5 py-4 text-sm text-gray-500 max-w-[220px] truncate" title={item.remarks || ""}>{item.remarks || "-"}</td>
                      <td className="px-5 py-4 text-right relative">
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
        onClose={() => setFormModal({ isOpen: false })}
        onAction={async (payload) => {
          try {
            await createExpense(payload);
            showToast({ type: "success", message: "Expense saved successfully" });
            loadExpenses(pagination.currentPage, filters);
          } catch (err) {
            showToast({ type: "error", message: err.response?.data?.message || "Failed to save expense" });
            throw err;
          }
        }}
      />

      <FilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={[
          { label: "Expense / Item", type: "text", value: filters.item_name, onChange: (e) => setFilters((prev) => ({ ...prev, item_name: e.target.value })) },
          {
            label: "Expense Type",
            type: "select",
            value: filters.expense_type,
            options: [
              { label: "All", value: "" },
              { label: "Cash", value: "cash" },
              { label: "Supplier", value: "supplier" },
              { label: "Fixed", value: "fixed" },
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
          const reset = { item_name: "", expense_type: "", month: "", date_from: "", date_to: "" };
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
