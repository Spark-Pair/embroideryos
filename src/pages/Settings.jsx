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
} from "lucide-react";
import { fetchProductionConfig, createProductionConfig } from "../api/productionConfig";
import { fetchMyInvoiceBanner, updateMyInvoiceBanner } from "../api/business";
import {
  createExpenseItem,
  fetchExpenseItems,
  toggleExpenseItemStatus,
  updateExpenseItem,
} from "../api/expenseItem";
import { fetchSuppliers } from "../api/supplier";
import PageHeader from "../components/PageHeader";
import ProductionConfigFormModal from "../components/StaffRecord/ProductionConfigFormModal";
import InvoiceBannerModal from "../components/Invoice/InvoiceBannerModal";
import Modal from "../components/Modal";
import Input from "../components/Input";
import Select from "../components/Select";
import Button from "../components/Button";
import { useToast } from "../context/ToastContext";

const fmt = (val, isDate = false) => {
  if (val === null || val === undefined || val === "") return "—";
  if (isDate) {
    return new Date(val).toLocaleDateString("en-US", {
      day: "numeric", month: "short", year: "numeric",
    });
  }
  return typeof val === "number" ? val.toLocaleString() : val;
};

const DISPLAY_FIELDS = [
  { key: "stitch_rate", label: "Stitch Rate" },
  { key: "applique_rate", label: "Applique Rate" },
  { key: "on_target_pct", label: "On Target %" },
  { key: "after_target_pct", label: "After Target %" },
  { key: "pcs_per_round", label: "PCs Per Round" },
  { key: "target_amount", label: "Daily Target Amount" },
  { key: "off_amount", label: "Off Day Amount" },
  { key: "bonus_rate", label: "Bonus Rate" },
  { key: "allowance", label: "Monthly Allowance" },
];

function ConfigCard({ record, isActive }) {
  return (
    <div className={`rounded-2xl border bg-white overflow-hidden transition-shadow hover:shadow-sm ${isActive ? "border-gray-900" : "border-gray-200"}`}>
      <div className={`flex items-center justify-between px-5 py-3.5 border-b ${isActive ? "bg-gray-900 border-gray-900" : "bg-gray-50 border-gray-100"}`}>
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className={isActive ? "text-gray-300" : "text-gray-400"} />
          <span className={`text-sm font-medium ${isActive ? "text-white" : "text-gray-700"}`}>{fmt(record.effective_date, true)}</span>
        </div>

        {isActive ? (
          <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white">
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

      <div className="grid grid-cols-2 gap-px bg-gray-100">
        {DISPLAY_FIELDS.map(({ key, label }) => (
          <div key={key} className="bg-white px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">{label}</p>
            <p className="text-sm font-medium text-gray-800">{fmt(record[key])}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsSection({ title, description, icon, action, children }) {
  return (
    <div className="rounded-3xl bg-white border border-gray-300 overflow-hidden">
      <div className="flex items-center justify-between px-7 py-5 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gray-100 border border-gray-200">
            {React.createElement(icon, { size: 17, className: "text-gray-500" })}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
            {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function ConfigCardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden animate-pulse">
      <div className="h-12 bg-gray-100" />
      <div className="grid grid-cols-2 gap-px bg-gray-100">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white px-4 py-3">
            <div className="h-3 w-20 bg-gray-100 rounded mb-1.5" />
            <div className="h-4 w-12 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpenseItemFormModal({ isOpen, onClose, initialData, onSave, variant = "general", generalItemOptions = [] }) {
  const mode = initialData ? "edit" : "add";
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

  const isFixedVariant = variant === "fixed";
  const isSupplierFixed = isFixedVariant && formData.fixed_source === "supplier";
  const supplierOptions = suppliers.map((s) => ({ label: s.name, value: s._id }));
  const calculatedAmount = (Number(formData.default_quantity) || 0) * (Number(formData.default_rate) || 0);
  const fixedItemOptions = useMemo(() => {
    const exists = generalItemOptions.some((opt) => opt.value === formData.name);
    if (!formData.name || exists) return generalItemOptions;
    return [{ label: formData.name, value: formData.name }, ...generalItemOptions];
  }, [generalItemOptions, formData.name]);

  useEffect(() => {
    setFormData({
      id: initialData?._id || "",
      name: initialData?.name || "",
      fixed_source: initialData?.fixed_source || "cash",
      supplier_id: initialData?.supplier_id || "",
      default_quantity: initialData?.default_quantity ?? "",
      default_rate: initialData?.default_rate ?? "",
      default_amount: initialData?.default_amount ?? "",
    });
  }, [initialData, isOpen]);

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
      title={mode === "add" ? (isFixedVariant ? "Add Fixed Expense" : "Add Expense Item") : (isFixedVariant ? "Edit Fixed Expense" : "Edit Expense Item")}
      subtitle={isFixedVariant ? "Configure fixed expense auto-fill fields for Expense modal" : "This item appears in Expense / Item dropdown"}
      maxWidth="max-w-lg"
      footer={
        <div className="flex gap-3">
          <Button outline variant="secondary" onClick={onClose} className="w-1/3">Discard</Button>
          <Button
            className="grow"
            onClick={async () => {
              const payload = isFixedVariant
                ? {
                    id: formData.id,
                    name: formData.name,
                    expense_type: "fixed",
                    fixed_source: formData.fixed_source,
                    supplier_id: formData.fixed_source === "supplier" ? formData.supplier_id : "",
                    default_quantity: Number(formData.default_quantity || 0),
                    default_rate: Number(formData.default_rate || 0),
                    default_amount: formData.default_amount === "" ? calculatedAmount : Number(formData.default_amount),
                  }
                : {
                    id: formData.id,
                    name: formData.name,
                    expense_type: initialData?.expense_type || "general",
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
              onChange={(value) => setFormData((p) => ({ ...p, fixed_source: value, supplier_id: "" }))}
              options={[
                { label: "Cash", value: "cash" },
                { label: "Supplier", value: "supplier" },
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
              type="number"
              value={formData.default_quantity}
              onChange={(e) => setFormData((p) => ({ ...p, default_quantity: e.target.value }))}
            />
            <Input
              label="Rate"
              type="number"
              value={formData.default_rate}
              onChange={(e) => setFormData((p) => ({ ...p, default_rate: e.target.value }))}
            />
            <Input
              label="Amount"
              type="number"
              value={formData.default_amount === "" ? calculatedAmount : formData.default_amount}
              onChange={(e) => setFormData((p) => ({ ...p, default_amount: e.target.value }))}
            />
          </>
        )}
      </div>
    </Modal>
  );
}

export default function SettingsPage() {
  const { showToast } = useToast();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formModal, setFormModal] = useState(false);
  const [invoiceBanner, setInvoiceBanner] = useState("");
  const [bannerModalOpen, setBannerModalOpen] = useState(false);
  const [expenseItems, setExpenseItems] = useState([]);
  const [expenseItemModal, setExpenseItemModal] = useState({ isOpen: false, data: null, variant: "general" });

  const loadConfigs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchProductionConfig();
      const data = Array.isArray(res.data) ? res.data : [res.data].filter(Boolean);
      data.sort((a, b) => new Date(b.effective_date) - new Date(a.effective_date));
      setRecords(data);
    } catch {
      showToast({ type: "error", message: "Failed to load configurations" });
    } finally {
      setLoading(false);
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

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  useEffect(() => {
    const loadInvoiceBanner = async () => {
      try {
        const res = await fetchMyInvoiceBanner();
        setInvoiceBanner(res?.invoice_banner_data || "");
      } catch {
        setInvoiceBanner("");
      }
    };

    loadInvoiceBanner();
    loadExpenseItems();
  }, [loadExpenseItems]);

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

  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const activeRecord = records.find((r) => r.effective_date && new Date(r.effective_date) <= today);

  const handleSaveBanner = async (bannerData) => {
    try {
      const res = await updateMyInvoiceBanner(bannerData);
      setInvoiceBanner(res?.invoice_banner_data || "");
      showToast({ type: "success", message: "Invoice banner updated" });
    } catch (err) {
      showToast({ type: "error", message: err.response?.data?.message || "Failed to update invoice banner" });
      throw err;
    }
  };

  const groupedExpenseItems = useMemo(() => ({
    general: expenseItems.filter((i) => i.expense_type !== "fixed"),
    fixed_cash: expenseItems.filter((i) => i.expense_type === "fixed" && (i.fixed_source === "cash" || !i.fixed_source)),
    fixed_supplier: expenseItems.filter((i) => i.expense_type === "fixed" && i.fixed_source === "supplier"),
  }), [expenseItems]);
  const generalItemOptions = useMemo(
    () => groupedExpenseItems.general.map((item) => ({ label: item.name, value: item.name })),
    [groupedExpenseItems.general]
  );

  return (
    <>
      <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col">
        <PageHeader
          title="Settings"
          subtitle="Manage system configuration and preferences."
        />

        <div className="flex flex-col gap-6 pb-10">
          <SettingsSection
            title="Production Configuration"
            description="Global rates and targets applied to all staff records."
            icon={SlidersHorizontal}
            action={
              <button
                onClick={() => setFormModal(true)}
                className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
              >
                <Plus size={15} />
                Add Config
              </button>
            }
          >
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => <ConfigCardSkeleton key={i} />)}
              </div>
            ) : records.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gray-100 border border-gray-200 mb-3">
                  <SlidersHorizontal size={20} className="text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-600">No configs yet</p>
                <p className="text-xs text-gray-400 mt-1">Click "Add Config" to create your first production configuration.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {records.map((record) => (
                  <ConfigCard key={record._id} record={record} isActive={activeRecord?._id === record._id} />
                ))}
              </div>
            )}
          </SettingsSection>

          <SettingsSection
            title="Expense Items"
            description='Set item names used in "Expense / Item" input of Add Expense form.'
            icon={Wallet}
            action={
              <button
                onClick={() => setExpenseItemModal({ isOpen: true, data: null, variant: "general" })}
                className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
              >
                <Plus size={15} />
                Add Expense Item
              </button>
            }
          >
            <div className="rounded-2xl border border-gray-200 overflow-hidden">
              <div className="max-h-80 overflow-auto divide-y divide-gray-200">
                {groupedExpenseItems.general.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-gray-400">No expense items found.</p>
                ) : groupedExpenseItems.general.map((item) => (
                  <div key={item._id} className="px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{item.name}</p>
                        <span className={`inline-flex mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                          {item.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100"
                          onClick={() => setExpenseItemModal({ isOpen: true, data: item, variant: "general" })}
                          aria-label="Edit expense item"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          className={`p-2 rounded-lg border ${item.isActive ? "border-rose-300 text-rose-600 hover:bg-rose-50" : "border-emerald-300 text-emerald-600 hover:bg-emerald-50"}`}
                          onClick={async () => {
                            try {
                              await toggleExpenseItemStatus(item._id);
                              loadExpenseItems();
                              showToast({ type: "success", message: "Expense item status updated" });
                            } catch (err) {
                              showToast({ type: "error", message: err.response?.data?.message || "Failed to update item status" });
                            }
                          }}
                          aria-label="Toggle expense item status"
                        >
                          <Power size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            title="Fixed Expense"
            description='These auto-fill in Add Expense when Expense Type is "Fixed Expense".'
            icon={Wallet}
            action={
              <button
                onClick={() => setExpenseItemModal({ isOpen: true, data: null, variant: "fixed" })}
                className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
              >
                <Plus size={15} />
                Add Fixed Expense
              </button>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {["fixed_cash", "fixed_supplier"].map((type) => (
                <div key={type} className="rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <p className="text-sm font-semibold text-gray-800">
                      {type === "fixed_cash" ? "Fixed For Cash" : "Fixed For Supplier"}
                    </p>
                  </div>
                  <div className="max-h-80 overflow-auto divide-y divide-gray-200">
                    {groupedExpenseItems[type].length === 0 ? (
                      <p className="px-4 py-5 text-sm text-gray-400">No items found.</p>
                    ) : groupedExpenseItems[type].map((item) => (
                      <div key={item._id} className="px-4 py-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{item.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">Qty: {fmt(item.default_quantity)} | Rate: {fmt(item.default_rate)}</p>
                            <p className="text-xs text-gray-500 mt-0.5">Amount: {fmt(item.default_amount)}</p>
                            {item.fixed_source === "supplier" && (
                              <p className="text-xs text-gray-500 mt-0.5">Supplier: {item.supplier_name || "-"}</p>
                            )}
                            <span className={`inline-flex mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                              {item.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button
                              className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100"
                              onClick={() => setExpenseItemModal({ isOpen: true, data: item, variant: "fixed" })}
                              aria-label="Edit fixed expense"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              className={`p-2 rounded-lg border ${item.isActive ? "border-rose-300 text-rose-600 hover:bg-rose-50" : "border-emerald-300 text-emerald-600 hover:bg-emerald-50"}`}
                              onClick={async () => {
                                try {
                                  await toggleExpenseItemStatus(item._id);
                                  loadExpenseItems();
                                  showToast({ type: "success", message: "Fixed expense status updated" });
                                } catch (err) {
                                  showToast({ type: "error", message: err.response?.data?.message || "Failed to update item status" });
                                }
                              }}
                              aria-label="Toggle fixed expense status"
                            >
                              <Power size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SettingsSection>

          <SettingsSection
            title="Invoice Banner"
            description="This banner appears at the top of invoice preview and print."
            icon={ImageUp}
            action={
              <button
                onClick={() => setBannerModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
              >
                <ImageUp size={15} />
                Manage Banner
              </button>
            }
          >
            {invoiceBanner ? (
              <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
                <img src={invoiceBanner} alt="Current invoice banner" className="w-full max-h-72 object-cover" />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 py-12 flex flex-col items-center justify-center text-gray-400">
                <ImageUp className="h-6 w-6 mb-2" />
                <p className="text-sm font-medium text-gray-500">No invoice banner set</p>
                <p className="text-xs text-gray-400 mt-1">Upload one using the button above.</p>
              </div>
            )}
          </SettingsSection>
        </div>
      </div>

      <ProductionConfigFormModal
        isOpen={formModal}
        onClose={() => setFormModal(false)}
        onSave={handleSave}
      />

      <ExpenseItemFormModal
        isOpen={expenseItemModal.isOpen}
        initialData={expenseItemModal.data}
        variant={expenseItemModal.variant}
        generalItemOptions={generalItemOptions}
        onClose={() => setExpenseItemModal({ isOpen: false, data: null, variant: "general" })}
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
            showToast({ type: "error", message: err.response?.data?.message || "Failed to save expense item" });
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
