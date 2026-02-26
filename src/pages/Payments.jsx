import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Banknote, Clock3, Receipt, AlertTriangle } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import TableToolbar from "../components/table/TableToolbar";
import TableSkeleton from "../components/table/TableLoader";
import FilterDrawer from "../components/FilterDrawer";
import Modal from "../components/Modal";
import Input from "../components/Input";
import Select from "../components/Select";
import Button from "../components/Button";
import { useToast } from "../context/ToastContext";
import { formatDate, formatNumbers } from "../utils";
import { fetchBusinesses } from "../api/business";
import { fetchPlans } from "../api/subscription";
import {
  createSubscriptionPayment,
  fetchSubscriptionPaymentStats,
  fetchSubscriptionPayments,
  updateSubscriptionPayment,
} from "../api/subscriptionPayment";

const DEFAULT_PAGINATION = {
  currentPage: 1,
  totalPages: 1,
  totalItems: 0,
  itemsPerPage: 30,
};

const DEFAULT_STATS = {
  month_received: 0,
  month_pending: 0,
  month_total_count: 0,
  expiring_7_days: 0,
};

function PaymentFormModal({ isOpen, onClose, initialData, businesses, plans, onSave }) {
  const isEdit = Boolean(initialData?._id);
  const [formData, setFormData] = useState({
    businessId: "",
    plan: "basic",
    payment_date: "",
    month: "",
    amount: "",
    method: "online",
    status: "received",
    reference_no: "",
    remarks: "",
  });

  useEffect(() => {
    setFormData({
      businessId: initialData?.businessId || "",
      plan: initialData?.plan || "basic",
      payment_date: initialData?.payment_date ? formatDate(initialData.payment_date, "yyyy-mm-dd") : "",
      month: initialData?.month || "",
      amount: initialData?.amount ?? "",
      method: initialData?.method || "online",
      status: initialData?.status || "received",
      reference_no: initialData?.reference_no || "",
      remarks: initialData?.remarks || "",
    });
  }, [initialData, isOpen]);

  const businessOptions = useMemo(
    () => (businesses || []).map((item) => ({ label: item.name, value: item._id })),
    [businesses]
  );
  const planOptions = useMemo(
    () => (plans || []).map((item) => ({ label: item.name, value: item.id })),
    [plans]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-2xl"
      title={isEdit ? "Edit Subscription Payment" : "Add Subscription Payment"}
      subtitle="Track SaaS billing collections and statuses."
      footer={
        <div className="flex gap-3">
          <Button outline variant="secondary" onClick={onClose} className="w-1/3">Cancel</Button>
          <Button
            className="grow"
            onClick={async () => {
              await onSave(formData);
              onClose();
            }}
          >
            {isEdit ? "Save Changes" : "Add Payment"}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Business"
          value={formData.businessId}
          onChange={(value) => setFormData((p) => ({ ...p, businessId: value }))}
          options={businessOptions}
          placeholder="Select business"
        />
        <Select
          label="Plan"
          value={formData.plan}
          onChange={(value) => setFormData((p) => ({ ...p, plan: value }))}
          options={planOptions}
        />
        <Input
          label="Payment Date"
          type="date"
          value={formData.payment_date}
          onChange={(e) => setFormData((p) => ({ ...p, payment_date: e.target.value }))}
        />
        <Input
          label="Month"
          type="month"
          value={formData.month}
          onChange={(e) => setFormData((p) => ({ ...p, month: e.target.value }))}
        />
        <Input
          label="Amount"
          type="number"
          value={formData.amount}
          onChange={(e) => setFormData((p) => ({ ...p, amount: e.target.value }))}
        />
        <Select
          label="Method"
          value={formData.method}
          onChange={(value) => setFormData((p) => ({ ...p, method: value }))}
          options={[
            { label: "Online", value: "online" },
            { label: "Bank", value: "bank" },
            { label: "Cash", value: "cash" },
            { label: "Cheque", value: "cheque" },
          ]}
        />
        <Select
          label="Status"
          value={formData.status}
          onChange={(value) => setFormData((p) => ({ ...p, status: value }))}
          options={[
            { label: "Received", value: "received" },
            { label: "Pending", value: "pending" },
            { label: "Failed", value: "failed" },
            { label: "Refunded", value: "refunded" },
          ]}
        />
        <Input
          label="Reference No"
          value={formData.reference_no}
          onChange={(e) => setFormData((p) => ({ ...p, reference_no: e.target.value }))}
        />
        <div className="md:col-span-2">
          <Input
            label="Remarks"
            value={formData.remarks}
            onChange={(e) => setFormData((p) => ({ ...p, remarks: e.target.value }))}
          />
        </div>
      </div>
    </Modal>
  );
}

export default function Payments() {
  const { showToast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [plans, setPlans] = useState([]);
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [formModal, setFormModal] = useState({ isOpen: false, data: null });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ status: "", plan: "", businessId: "" });
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION);

  const tableScrollRef = useRef(null);

  const loadBusinesses = useCallback(async () => {
    try {
      const res = await fetchBusinesses({ page: 1, limit: 1000 });
      setBusinesses(res?.data || []);
    } catch {
      setBusinesses([]);
    }
  }, []);

  const loadPlans = useCallback(async () => {
    try {
      const res = await fetchPlans();
      setPlans(res?.data || []);
    } catch {
      setPlans([]);
    }
  }, []);

  const loadPayments = useCallback(async (page = 1, activeFilters = filters) => {
    try {
      setLoading(true);
      const [listRes, statsRes] = await Promise.all([
        fetchSubscriptionPayments({ page, limit: 30, month: selectedMonth, ...activeFilters }),
        fetchSubscriptionPaymentStats({ month: selectedMonth }),
      ]);
      setRows(listRes?.data || []);
      setPagination(listRes?.pagination || DEFAULT_PAGINATION);
      setStats(statsRes?.data || DEFAULT_STATS);
    } catch (err) {
      showToast({ type: "error", message: err.response?.data?.message || "Failed to load payments" });
    } finally {
      setLoading(false);
    }
  }, [filters, selectedMonth, showToast]);

  useEffect(() => {
    loadBusinesses();
    loadPlans();
  }, [loadBusinesses, loadPlans]);

  useEffect(() => {
    loadPayments(1, filters);
  }, [loadPayments, filters, selectedMonth]);

  useEffect(() => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [pagination.currentPage]);

  const filterConfig = [
    {
      label: "Business",
      type: "select",
      value: filters.businessId,
      options: [
        { label: "All", value: "" },
        ...businesses.map((b) => ({ label: b.name, value: b._id })),
      ],
      onChange: (val) => setFilters((p) => ({ ...p, businessId: val })),
    },
    {
      label: "Status",
      type: "select",
      value: filters.status,
      options: [
        { label: "All", value: "" },
        { label: "Received", value: "received" },
        { label: "Pending", value: "pending" },
        { label: "Failed", value: "failed" },
        { label: "Refunded", value: "refunded" },
      ],
      onChange: (val) => setFilters((p) => ({ ...p, status: val })),
    },
    {
      label: "Plan",
      type: "select",
      value: filters.plan,
      options: [
        { label: "All", value: "" },
        ...plans.map((p) => ({ label: p.name, value: p.id })),
      ],
      onChange: (val) => setFilters((p) => ({ ...p, plan: val })),
    },
  ];

  return (
    <>
      <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col">
        <PageHeader
          title="SaaS Payments"
          subtitle="Manage subscription billing and payment records."
          actionLabel="Add Payment"
          actionIcon={Plus}
          onAction={() => setFormModal({ isOpen: true, data: null })}
        />

        <div className="flex items-center gap-3 mb-4">
          <label className="text-xs font-medium uppercase tracking-wider text-gray-500">Month</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <StatCard label="Received (Month)" value={formatNumbers(stats.month_received, 2)} icon={Banknote} variant="success" />
          <StatCard label="Pending (Month)" value={formatNumbers(stats.month_pending, 2)} icon={Clock3} variant="warning" />
          <StatCard label="Payments (Month)" value={formatNumbers(stats.month_total_count, 0)} icon={Receipt} />
          <StatCard label="Expiring 7 Days" value={formatNumbers(stats.expiring_7_days, 0)} icon={AlertTriangle} variant="danger" />
        </div>

        <div className="rounded-3xl bg-white border border-gray-300 overflow-hidden flex-1 flex flex-col">
          <TableToolbar
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            onPageChange={(page) => loadPayments(page, filters)}
            onFilter={() => setIsFilterOpen(true)}
          />

          <div ref={tableScrollRef} className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-20 bg-gray-100" style={{ boxShadow: "0 1px 0 0 rgba(209,213,219,1)" }}>
                <tr className="text-sm tracking-wider text-gray-500">
                  <th className="px-5 py-3.5 font-medium">#</th>
                  <th className="px-5 py-3.5 font-medium">Date</th>
                  <th className="px-5 py-3.5 font-medium">Business</th>
                  <th className="px-5 py-3.5 font-medium">Plan</th>
                  <th className="px-5 py-3.5 font-medium">Method</th>
                  <th className="px-5 py-3.5 font-medium">Status</th>
                  <th className="px-5 py-3.5 font-medium text-right">Amount</th>
                  <th className="px-5 py-3.5 font-medium text-right">Action</th>
                </tr>
              </thead>

              {loading ? (
                <TableSkeleton rows={30} columns={8} />
              ) : (
                <tbody className="divide-y divide-gray-200">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-7 py-16 text-center text-sm text-gray-400">No payments found.</td>
                    </tr>
                  ) : (
                    rows.map((row, index) => (
                      <tr key={row._id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-5 py-4 font-medium text-gray-500">
                          {(pagination.currentPage - 1) * pagination.itemsPerPage + index + 1}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-600">{formatDate(row.payment_date, "DD MMM yyyy")}</td>
                        <td className="px-5 py-4 text-sm font-semibold text-gray-800">{row.business_name || "-"}</td>
                        <td className="px-5 py-4 text-sm text-gray-600 capitalize">{row.plan}</td>
                        <td className="px-5 py-4 text-sm text-gray-600 capitalize">{row.method}</td>
                        <td className="px-5 py-4 text-sm text-gray-600 capitalize">{row.status}</td>
                        <td className="px-5 py-4 text-sm font-semibold text-emerald-700 text-right">{formatNumbers(row.amount, 2)}</td>
                        <td className="px-5 py-4 text-right">
                          <button
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100"
                            onClick={() => setFormModal({ isOpen: true, data: row })}
                          >
                            Edit
                          </button>
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

      <PaymentFormModal
        isOpen={formModal.isOpen}
        onClose={() => setFormModal({ isOpen: false, data: null })}
        initialData={formModal.data}
        businesses={businesses}
        plans={plans}
        onSave={async (payload) => {
          try {
            if (formModal.data?._id) {
              await updateSubscriptionPayment(formModal.data._id, payload);
              showToast({ type: "success", message: "Payment updated" });
            } else {
              await createSubscriptionPayment(payload);
              showToast({ type: "success", message: "Payment added" });
            }
            await loadPayments(pagination.currentPage, filters);
          } catch (err) {
            showToast({ type: "error", message: err.response?.data?.message || "Failed to save payment" });
            throw err;
          }
        }}
      />

      <FilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filterConfig}
        onApply={() => {
          loadPayments(1, filters);
          setIsFilterOpen(false);
        }}
        onReset={() => {
          const reset = { status: "", plan: "", businessId: "" };
          setFilters(reset);
          loadPayments(1, reset);
          setIsFilterOpen(false);
        }}
      />
    </>
  );
}
