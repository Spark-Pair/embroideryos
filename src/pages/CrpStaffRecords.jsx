import { useEffect, useMemo, useRef, useState } from "react";
import { Banknote, CheckCircle2, Edit3, MoreVertical, Plus, RefreshCcw, Scissors, Search, Trash2 } from "lucide-react";
import {
  createCrpStaffRecord,
  deleteCrpStaffRecord,
  fetchCrpStaffRecords,
  fetchCrpStaffRecordStats,
  updateCrpStaffRecord,
} from "../api/crpStaffRecord";
import { fetchOrders } from "../api/order";
import { fetchStaffNames } from "../api/staff";
import { fetchCrpRateConfigs } from "../api/crpRateConfig";
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
import CrpMonthlyReportModal from "../components/StaffRecord/CrpMonthlyReportModal";
import { useFormKeyboard } from "../hooks/useFormKeyboard";
import { useToast } from "../context/ToastContext";
import { formatDate, formatNumbers } from "../utils";

const CATEGORY_OPTIONS = [
  { label: "Cropping", value: "Cropping" },
  { label: "Press", value: "Press" },
  { label: "Other", value: "Other" },
];

function getMonthDateRange(month) {
  if (!month) return { date_from: "", date_to: "" };
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return { date_from: "", date_to: "" };
  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 0);
  const pad = (n) => String(n).padStart(2, "0");
  return {
    date_from: `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`,
    date_to: `${to.getFullYear()}-${pad(to.getMonth() + 1)}-${pad(to.getDate())}`,
  };
}

function sortOrdersOldestFirst(rows = []) {
  return [...rows].sort((a, b) => {
    const aTime = new Date(a?.date || 0).getTime();
    const bTime = new Date(b?.date || 0).getTime();
    if (aTime !== bTime) return aTime - bTime;
    const aCreated = new Date(a?.createdAt || 0).getTime();
    const bCreated = new Date(b?.createdAt || 0).getTime();
    return aCreated - bCreated;
  });
}

function toQtyDzn(order) {
  if (!order) return 0;
  return order.unit === "Pcs" ? Number(order.quantity || 0) / 12 : Number(order.quantity || 0);
}

function CrpRecordFormModal({ isOpen, onClose, onAction, initialData }) {
  const monthRef = useRef(null);
  const repeatRef = useRef(null);
  const orderDateRef = useRef(null);
  const descriptionRef = useRef(null);
  const quantityRef = useRef(null);
  const staffRef = useRef(null);
  const categoryRef = useRef(null);
  const typeRef = useRef(null);
  const [orders, setOrders] = useState([]);
  const [staffs, setStaffs] = useState([]);
  const [rateConfigs, setRateConfigs] = useState([]);
  const [previousRecords, setPreviousRecords] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [orderSearch, setOrderSearch] = useState("");

  const [formData, setFormData] = useState({
    month: new Date().toISOString().slice(0, 7),
    order_id: "",
    order_date: new Date().toISOString().slice(0, 10),
    order_description: "",
    quantity_dzn: "",
    staff_id: "",
    category: "Cropping",
    type_name: "",
    repeat_record_id: "",
  });
  const isEdit = Boolean(initialData?._id);

  const loadOrdersForMonth = async (monthValue) => {
    if (!isOpen || !monthValue) return;
    setLoadingData(true);
    try {
      const { date_from, date_to } = getMonthDateRange(monthValue);
      const [ordersRes, crpRes] = await Promise.all([
        fetchOrders({ page: 1, limit: 5000, date_from, date_to }),
        fetchCrpStaffRecords({ page: 1, limit: 5000, month: monthValue }),
      ]);
      const orderList = ordersRes?.data || [];
      const crpList = crpRes?.data || [];
      const usedOrderIds = new Set(
        crpList
          .map((record) => String(record?.order_id?._id || record?.order_id || ""))
          .filter(Boolean)
      );

      const prefillOrders = sortOrdersOldestFirst(
        orderList.filter((order) => !usedOrderIds.has(String(order?._id || "")))
      );
      setOrders(prefillOrders);
      setFormData((prev) => (
        prefillOrders.some((order) => String(order._id) === String(prev.order_id))
          ? prev
          : { ...prev, order_id: "" }
      ));
    } catch {
      setOrders([]);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (isEdit && initialData) {
      setFormData({
        month: String(initialData?.month || initialData?.order_date || new Date().toISOString()).slice(0, 7),
        order_id: String(initialData?.order_id?._id || initialData?.order_id || ""),
        order_date: String(initialData?.order_date || "").slice(0, 10),
        order_description: initialData?.order_description || "",
        quantity_dzn: String(Number(initialData?.quantity_dzn || 0)),
        staff_id: String(initialData?.staff_id?._id || initialData?.staff_id || ""),
        category: initialData?.category || "Cropping",
        type_name: initialData?.type_name || "",
        repeat_record_id: "",
      });
    } else {
      setFormData({
        month: new Date().toISOString().slice(0, 7),
        order_id: "",
        order_date: new Date().toISOString().slice(0, 10),
        order_description: "",
        quantity_dzn: "",
        staff_id: "",
        category: "Cropping",
        type_name: "",
        repeat_record_id: "",
      });
    }
    setError("");
    setOrderSearch("");

    const loadInitial = async () => {
      setLoadingData(true);
      try {
        const [staffRes, configRes, recordsRes] = await Promise.all([
          fetchStaffNames({ status: "active", category: "Cropping" }),
          fetchCrpRateConfigs({ status: "active" }),
          fetchCrpStaffRecords({ page: 1, limit: 300 }),
        ]);
        setStaffs(staffRes?.data || []);
        setRateConfigs(configRes?.data || []);
        setPreviousRecords(recordsRes?.data || []);
      } catch {
        setStaffs([]);
        setRateConfigs([]);
        setPreviousRecords([]);
      } finally {
        setLoadingData(false);
      }
    };

    loadInitial();
  }, [isOpen, isEdit, initialData]);

  useEffect(() => {
    if (!isOpen || !formData.month) return;
    loadOrdersForMonth(formData.month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, formData.month]);

  const selectedType = useMemo(
    () => rateConfigs.find((c) => c.category === formData.category && c.type_name === formData.type_name),
    [rateConfigs, formData.category, formData.type_name]
  );

  const qtyDzn = Number(formData.quantity_dzn || 0);
  const rate = Number(selectedType?.rate || 0);
  const totalAmount = qtyDzn * rate;

  const staffOptions = staffs.map((staff) => ({ label: staff.name, value: staff._id }));
  const repeatOptions = [
    { label: "None (No prefill)", value: "" },
    ...previousRecords.map((record) => ({
      label: `${formatDate(record.order_date, "DD MMM yyyy")} · ${record.order_description || "No description"} · ${formatNumbers(record.quantity_dzn, 2)} Dzn`,
      value: record._id,
    })),
  ];

  const typeOptions = rateConfigs
    .filter((cfg) => cfg.category === formData.category)
    .map((cfg) => ({ label: `${cfg.type_name} (Rate: ${formatNumbers(cfg.rate, 2)})`, value: cfg.type_name }));
  const filteredOrders = useMemo(() => {
    const keyword = String(orderSearch || "").trim().toLowerCase();
    if (!keyword) return orders;
    return orders.filter((order) => {
      const haystack = [
        order?.description,
        order?.customer_name,
        order?.lot_no,
        order?.machine_no,
        formatDate(order?.date, "DD MMM yyyy"),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [orders, orderSearch]);
  const selectedOrder = useMemo(
    () => orders.find((order) => String(order?._id) === String(formData.order_id)),
    [orders, formData.order_id]
  );

  const isValid =
    !!formData.order_date &&
    !!formData.staff_id &&
    !!formData.category &&
    !!formData.type_name &&
    rate > 0 &&
    qtyDzn > 0;

  const handleSubmit = async () => {
    if (!isValid || submitting) {
      if (!isValid) setError("Please complete all required fields.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await onAction(isEdit ? "edit" : "add", {
        id: initialData?._id,
        order_id: formData.order_id || null,
        order_date: formData.order_date,
        order_description: formData.order_description,
        staff_id: formData.staff_id,
        category: formData.category,
        type_name: formData.type_name,
        rate,
        quantity_dzn: qtyDzn,
      });
      onClose();
    } catch {
      // parent toast
    } finally {
      setSubmitting(false);
    }
  };

  useFormKeyboard({ onEnterSubmit: handleSubmit });

  const applyOrderPrefill = (order) => {
    if (!order) return;
    const qty = toQtyDzn(order);
    const month = String(order?.date || "").slice(0, 7) || formData.month;
    setFormData((prev) => ({
      ...prev,
      order_id: order._id,
      month,
      order_date: String(order?.date || "").slice(0, 10),
      order_description: order?.description || "",
      quantity_dzn: qty > 0 ? String(Number(qty.toFixed(3))) : "",
    }));
  };

  const applyRepeatPrefill = (recordId) => {
    if (!recordId) {
      setFormData((prev) => ({ ...prev, repeat_record_id: "" }));
      return;
    }
    const rec = previousRecords.find((r) => String(r._id) === String(recordId));
    if (!rec) return;
    setFormData((prev) => ({
      ...prev,
      repeat_record_id: recordId,
      order_id: "",
      month: String(rec?.order_date || "").slice(0, 7) || prev.month,
      order_date: String(rec?.order_date || "").slice(0, 10),
      order_description: rec?.order_description || "",
      quantity_dzn: String(Number(rec?.quantity_dzn || 0)),
      staff_id: String(rec?.staff_id?._id || rec?.staff_id || prev.staff_id || ""),
      category: rec?.category || prev.category,
      type_name: rec?.type_name || prev.type_name,
    }));
  };

  const focusRef = (ref) => {
    setTimeout(() => ref?.current?.focus?.(), 0);
  };

  const focusSaveButton = () => {
    setTimeout(() => {
      const btn = document.querySelector('button[data-save-btn="true"]');
      btn?.focus?.();
    }, 0);
  };

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => monthRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-6xl"
      title={isEdit ? "Edit CRP Record" : "Add CRP Record"}
      subtitle="Order link is optional. You can create CRP record manually."
      footer={
        <div className="w-full flex items-center justify-between gap-3">
          <p className="text-xs text-red-600">{error}</p>
          <div className="flex gap-2">
            <Button variant="secondary" outline onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              data-save-btn="true"
              loading={submitting}
              disabled={!isValid}
            >
              {isEdit ? "Update Record" : "Save Record"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 p-0.5">
        <div className="xl:col-span-2 rounded-2xl border border-gray-300 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Step 1: Optional Order Prefill</h3>
            </div>
            <Button
              variant="secondary"
              outline
              size="sm"
              icon={RefreshCcw}
              onClick={() => loadOrdersForMonth(formData.month)}
              disabled={loadingData}
            >
              Refresh
            </Button>
          </div>

          <div className="p-4 border-b border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                ref={monthRef}
                label="Select Month"
                type="month"
                value={formData.month}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  focusRef(repeatRef);
                }}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, month: e.target.value, order_id: "" }))
                }
              />
              <Input
                label="Search Order"
                icon={<Search className="h-4 w-4 text-gray-400" />}
                placeholder="Description, customer, lot, machine"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                required={false}
                showClear={true}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <p className="text-xs text-gray-500">
                Showing <span className="font-semibold text-gray-700">{filteredOrders.length}</span> available orders
              </p>
              {formData.order_id && (
                <button
                  type="button"
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                  onClick={() => setFormData((prev) => ({ ...prev, order_id: "" }))}
                >
                  Clear selected order (manual mode)
                </button>
              )}
            </div>
            {selectedOrder && (
              <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Order selected. Auto-filled values right side me editable hain.
              </div>
            )}
          </div>

          <div className="max-h-[56vh] overflow-auto p-4 space-y-2.5">
            {loadingData && <p className="text-sm text-gray-500">Loading orders...</p>}
            {!loadingData && orders.length === 0 && (
              <p className="text-sm text-gray-500">
                No orders found for this month. You can still create CRP record manually.
              </p>
            )}
            {!loadingData && orders.length > 0 && filteredOrders.length === 0 && (
              <p className="text-sm text-gray-500">
                Search se koi order match nahi hua.
              </p>
            )}

            {!loadingData &&
              filteredOrders.map((order) => {
                const isSelected = String(formData.order_id) === String(order._id);
                const qty = toQtyDzn(order);
                return (
                  <button
                    key={order._id}
                    type="button"
                    onClick={() => applyOrderPrefill(order)}
                    className={`w-full text-left rounded-xl border px-3.5 py-2.5 transition focus:outline-none focus:ring-2 focus:ring-teal-300 ${
                      isSelected
                        ? "border-teal-400 bg-teal-50"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 leading-snug break-words">
                          {order.description || "No description"}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Date: {formatDate(order.date, "DD MMM yyyy")} • Customer: {order.customer_name || "---"}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Lot: {order.lot_no || "---"} • Machine: {order.machine_no || "---"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-emerald-700">
                          {formatNumbers(order.total_amount, 2)}
                        </p>
                        <p className="text-sm font-semibold text-gray-800 mt-0.5">
                          Qty: {formatNumbers(qty, 3)} Dzn
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-300 bg-white p-4 h-fit">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-800">Step 1: Optional Order Prefill</h3>
          </div>
          <div className="space-y-3">
            <Select
              ref={repeatRef}
              label="Repeat Previous Record"
              value={formData.repeat_record_id}
              onChange={(value) => {
                applyRepeatPrefill(value);
                focusRef(orderDateRef);
              }}
              options={repeatOptions}
              placeholder="Select previous record..."
              disabled={loadingData || repeatOptions.length === 0}
            />
            <Input
              ref={orderDateRef}
              label="Order Date"
              type="date"
              value={formData.order_date}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                focusRef(descriptionRef);
              }}
              onChange={(e) => setFormData((prev) => ({ ...prev, order_date: e.target.value }))}
            />
            <Input
              ref={descriptionRef}
              label="Description"
              value={formData.order_description}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                focusRef(quantityRef);
              }}
              onChange={(e) => setFormData((prev) => ({ ...prev, order_description: e.target.value }))}
              required={false}
            />
            <Input
              ref={quantityRef}
              label="Quantity (Dzn)"
              type="number"
              step="0.001"
              min="0"
              value={formData.quantity_dzn}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                focusRef(staffRef);
              }}
              onChange={(e) => setFormData((prev) => ({ ...prev, quantity_dzn: e.target.value }))}
            />

            <Select
              ref={staffRef}
              label="Staff (Cropping)"
              value={formData.staff_id}
              onChange={(value) => {
                setFormData((prev) => ({ ...prev, staff_id: value }));
                focusRef(categoryRef);
              }}
              options={staffOptions}
              placeholder={loadingData ? "Loading staff..." : "Select staff"}
            />

            <Select
              ref={categoryRef}
              label="Category"
              value={formData.category}
              onChange={(value) => {
                setFormData((prev) => ({ ...prev, category: value, type_name: "" }));
                focusRef(typeRef);
              }}
              options={CATEGORY_OPTIONS}
            />

            <Select
              ref={typeRef}
              label="Type"
              value={formData.type_name}
              onChange={(value) => {
                setFormData((prev) => ({ ...prev, type_name: value }));
                focusSaveButton();
              }}
              options={typeOptions}
              placeholder="Select type"
            />

            <Input
              label="Rate"
              value={rate ? formatNumbers(rate, 2) : ""}
              readOnly
              required={false}
            />
            <Input
              label="Total Amount"
              value={totalAmount ? formatNumbers(totalAmount, 2) : ""}
              readOnly
              required={false}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function CrpStaffRecords() {
  const { showToast } = useToast();

  const [stats, setStats] = useState({ total_records: 0, total_quantity_dzn: 0, total_amount: 0 });
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 30 });
  const [loading, setLoading] = useState(false);
  const [formModal, setFormModal] = useState({ isOpen: false, initialData: null });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", onConfirm: () => {}, variant: "danger" });
  const [activeMenu, setActiveMenu] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [reportModal, setReportModal] = useState(false);
  const [filters, setFilters] = useState({ month: "", category: "", type_name: "", date_from: "", date_to: "" });

  const tableScrollRef = useRef(null);

  const loadStats = async () => {
    try {
      const res = await fetchCrpStaffRecordStats();
      setStats(res?.data || { total_records: 0, total_quantity_dzn: 0, total_amount: 0 });
    } catch {
      showToast({ type: "error", message: "Failed to load CRP stats" });
    }
  };

  const loadRecords = async (page = 1, filterParams = filters) => {
    try {
      setLoading(true);
      const res = await fetchCrpStaffRecords({ page, limit: 30, ...filterParams });
      setRecords(res?.data || []);
      if (res?.pagination) setPagination(res.pagination);
      loadStats();
    } catch {
      showToast({ type: "error", message: "Failed to load CRP records" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tableScrollRef.current) tableScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
  }, [pagination.currentPage]);

  return (
    <>
      <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col">
        <PageHeader
          title="CRP Staff Records"
          subtitle="Manage CRP records with optional order link, manual entry, and repeat prefill"
          actionLabel="Add CRP Record"
          actionIcon={Plus}
          onAction={() => setFormModal({ isOpen: true, initialData: null })}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <StatCard label="Total Records" value={stats.total_records} icon={Scissors} />
          <StatCard label="Total Qty (Dzn)" value={formatNumbers(stats.total_quantity_dzn, 2)} icon={Scissors} variant="warning" />
          <StatCard label="Total Amount" value={formatNumbers(stats.total_amount, 2)} icon={Banknote} variant="success" />
        </div>

        <div className="rounded-3xl bg-white border border-gray-300 overflow-hidden flex-1 flex flex-col">
          <TableToolbar
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            onPageChange={(page) => loadRecords(page, filters)}
            onFilter={() => setIsFilterOpen(true)}
            onReport={() => setReportModal(true)}
          />

          <div ref={tableScrollRef} className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-20 bg-gray-100" style={{ boxShadow: "0 1px 0 0 rgba(209,213,219,1)" }}>
                <tr className="text-sm tracking-wider text-gray-500">
                  <th className="px-5 py-3.5 font-medium">#</th>
                  <th className="px-5 py-3.5 font-medium">Date</th>
                  <th className="px-5 py-3.5 font-medium">Description</th>
                  <th className="px-5 py-3.5 font-medium">Qty (Dzn)</th>
                  <th className="px-5 py-3.5 font-medium">Staff</th>
                  <th className="px-5 py-3.5 font-medium">Category</th>
                  <th className="px-5 py-3.5 font-medium">Type</th>
                  <th className="px-5 py-3.5 font-medium">Rate</th>
                  <th className="px-5 py-3.5 font-medium">Amount</th>
                  <th className="px-5 py-3.5 font-medium text-right">Actions</th>
                </tr>
              </thead>

              {loading ? (
                <TableSkeleton rows={30} columns={10} />
              ) : (
                <tbody className="divide-y divide-gray-200">
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-7 py-16 text-center text-sm text-gray-400">
                        No CRP records found.
                      </td>
                    </tr>
                  ) : (
                    records.map((item, index) => (
                      <tr key={item._id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-5 py-4 text-sm text-gray-500">{(pagination.currentPage - 1) * pagination.itemsPerPage + index + 1}</td>
                        <td className="px-5 py-4 text-sm text-gray-600">{formatDate(item.order_date, "DD MMM yyyy")}</td>
                        <td className="px-5 py-4 text-sm text-gray-800">{item.order_description || "-"}</td>
                        <td className="px-5 py-4 text-sm text-gray-600">{formatNumbers(item.quantity_dzn, 2)}</td>
                        <td className="px-5 py-4 text-sm text-gray-700">{item.staff_name || item.staff_id?.name || "-"}</td>
                        <td className="px-5 py-4 text-sm text-gray-600">{item.category}</td>
                        <td className="px-5 py-4 text-sm text-gray-600">{item.type_name}</td>
                        <td className="px-5 py-4 text-sm text-gray-600">{formatNumbers(item.rate, 2)}</td>
                        <td className="px-5 py-4 text-sm font-semibold text-gray-800">{formatNumbers(item.total_amount, 2)}</td>
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
                                setFormModal({ isOpen: true, initialData: item });
                                setActiveMenu(null);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl text-gray-700 hover:bg-gray-100 cursor-pointer"
                            >
                              <Edit3 size={16} strokeWidth={2.5} />
                              Edit Record
                            </button>
                            <button
                              onClick={() => {
                                setConfirmModal({
                                  isOpen: true,
                                  title: "Delete CRP Record",
                                  message: "Are you sure you want to delete this record?",
                                  variant: "danger",
                                  onConfirm: async () => {
                                    await deleteCrpStaffRecord(item._id);
                                    loadRecords(pagination.currentPage, filters);
                                    showToast({ type: "success", message: "CRP record deleted successfully" });
                                  },
                                });
                                setActiveMenu(null);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl text-rose-500 hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 size={16} strokeWidth={2.5} />
                              Delete Record
                            </button>
                          </ContextMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              )}
            </table>
          </div>
        </div>
      </div>

      <CrpRecordFormModal
        isOpen={formModal.isOpen}
        onClose={() => setFormModal({ isOpen: false, initialData: null })}
        initialData={formModal.initialData}
        onAction={async (action, payload) => {
          try {
            if (action === "edit" && payload?.id) {
              const { id, ...updatePayload } = payload;
              await updateCrpStaffRecord(id, updatePayload);
              showToast({ type: "success", message: "CRP record updated successfully" });
            } else {
              await createCrpStaffRecord(payload);
              showToast({ type: "success", message: "CRP record saved successfully" });
            }
            loadRecords(pagination.currentPage, filters);
          } catch (err) {
            showToast({ type: "error", message: err.response?.data?.message || "Failed to save CRP record" });
            throw err;
          }
        }}
      />

      <FilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={[
          { label: "Month", type: "month", value: filters.month, onChange: (e) => setFilters((prev) => ({ ...prev, month: e.target.value })) },
          {
            label: "Category",
            type: "select",
            value: filters.category,
            options: [{ label: "All", value: "" }, ...CATEGORY_OPTIONS],
            onChange: (v) => setFilters((prev) => ({ ...prev, category: v })),
          },
          { label: "Type", type: "text", value: filters.type_name, onChange: (e) => setFilters((prev) => ({ ...prev, type_name: e.target.value })) },
          { label: "Date From", type: "date", value: filters.date_from, onChange: (e) => setFilters((prev) => ({ ...prev, date_from: e.target.value })) },
          { label: "Date To", type: "date", value: filters.date_to, onChange: (e) => setFilters((prev) => ({ ...prev, date_to: e.target.value })) },
        ]}
        onApply={() => {
          loadRecords(1, filters);
          setIsFilterOpen(false);
        }}
        onReset={() => {
          const reset = { month: "", category: "", type_name: "", date_from: "", date_to: "" };
          setFilters(reset);
          loadRecords(1, reset);
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

      <CrpMonthlyReportModal
        isOpen={reportModal}
        onClose={() => setReportModal(false)}
      />
    </>
  );
}
