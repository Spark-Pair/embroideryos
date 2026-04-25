import { useEffect, useRef, useState } from "react";
import { Banknote, CircleDollarSign, Edit3, MoreVertical, Plus, Wrench } from "lucide-react";
import {
  createStaffPayment,
  fetchStaffPaymentStats,
  fetchStaffPayments,
  updateStaffPayment,
} from "../api/staffPayment";
import StatCard from "../components/StatCard";
import TableToolbar from "../components/table/TableToolbar";
import TableSkeleton from "../components/table/TableLoader";
import FilterDrawer from "../components/FilterDrawer";
import PageHeader from "../components/PageHeader";
import ContextMenu from "../components/ContextMenu";
import StaffPaymentFormModal from "../components/StaffPayment/StaffPaymentFormModal";
import { useToast } from "../context/ToastContext";
import { formatDate, formatNumbers } from "../utils";
import { fetchMyReferenceData } from "../api/business";

const STAT_VARIANTS = ["warning", "success", "info", "default"];
const TYPE_BADGE_CLASS = {
  advance: "bg-amber-100 text-amber-700",
  payment: "bg-emerald-100 text-emerald-700",
  adjustment: "bg-sky-100 text-sky-700",
};

export default function StaffPayments() {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    breakdown: [],
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 30,
  });
  const [formModal, setFormModal] = useState({ isOpen: false, initialData: null });
  const [activeMenu, setActiveMenu] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    name: "",
    type: "",
    month: "",
    date_from: "",
    date_to: "",
  });
  const [referenceData, setReferenceData] = useState({ staff_payment_types: [] });

  const tableScrollRef = useRef(null);

  const loadStats = async () => {
    try {
      const res = await fetchStaffPaymentStats();
      setStats(res.data || { total: 0, breakdown: [] });
    } catch {
      showToast({ type: "error", message: "Failed to load staff payment stats" });
    }
  };

  const loadPayments = async (page = 1, filterParams = filters) => {
    try {
      setLoading(true);
      const res = await fetchStaffPayments({ page, limit: 30, ...filterParams });
      setPayments(res.data || []);
      if (res.pagination) setPagination(res.pagination);
      loadStats();
    } catch {
      showToast({ type: "error", message: "Failed to load staff payments" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const res = await fetchMyReferenceData();
        setReferenceData(res?.reference_data || { staff_payment_types: [] });
      } catch {
        setReferenceData({ staff_payment_types: [] });
      }
    };
    loadReferenceData();
  }, []);

  useEffect(() => {
    if (!tableScrollRef.current) return;
    tableScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
  }, [pagination.currentPage]);

  const handlePageChange = (page) => loadPayments(page);
  const handleApplyFilters = () => {
    loadPayments(1, filters);
    setIsFilterOpen(false);
  };
  const handleResetFilters = () => {
    const reset = { name: "", type: "", month: "", date_from: "", date_to: "" };
    setFilters(reset);
    loadPayments(1, reset);
    setIsFilterOpen(false);
  };

  const handleFormAction = async (action, payload) => {
    try {
      if (action === "edit" && payload?.id) {
        const { id, ...updatePayload } = payload;
        await updateStaffPayment(id, updatePayload);
        showToast({ type: "success", message: "Staff payment updated successfully" });
      } else {
        await createStaffPayment(payload);
        showToast({ type: "success", message: "Staff payment created successfully" });
      }
      setFormModal({ isOpen: false, initialData: null });
      loadPayments(pagination.currentPage);
    } catch (err) {
      showToast({ type: "error", message: err.response?.data?.message || "Failed to save payment" });
      throw err;
    }
  };

  const filterConfig = [
    {
      label: "Staff Name",
      type: "text",
      placeholder: "Search by name",
      value: filters.name,
      onChange: (e) => setFilters((prev) => ({ ...prev, name: e.target.value })),
    },
    {
      label: "Type",
      type: "select",
      value: filters.type,
      options: [{ label: "All", value: "" }].concat(
        (referenceData.staff_payment_types || []).map((item) => ({ label: item, value: item }))
      ),
      onChange: (val) => setFilters((prev) => ({ ...prev, type: val })),
    },
    {
      label: "Month",
      type: "month",
      value: filters.month,
      onChange: (e) => setFilters((prev) => ({ ...prev, month: e.target.value })),
    },
    {
      label: "Date From",
      type: "date",
      value: filters.date_from,
      onChange: (e) => setFilters((prev) => ({ ...prev, date_from: e.target.value })),
    },
    {
      label: "Date To",
      type: "date",
      value: filters.date_to,
      onChange: (e) => setFilters((prev) => ({ ...prev, date_to: e.target.value })),
    },
  ];

  const statBreakdown = (referenceData.staff_payment_types || [])
    .map((type) => ({
      key: type,
      count: Number(stats?.counts_by_key?.[type] || 0),
    }))
    .filter((item) => item.key)
    .slice(0, 3);

  return (
    <>
      <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col">
        <PageHeader
          title="Staff Payments"
          subtitle="Track advances, payments, and adjustments for staff."
          actionLabel="Add Payment"
          actionIcon={Plus}
          onAction={() => setFormModal({ isOpen: true, initialData: null })}
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <StatCard label="Total Payments" value={stats.total} icon={Banknote} />
          {statBreakdown.map((item, index) => (
            <StatCard
              key={item.key}
              label={item.key}
              value={item.count}
              icon={index === 2 ? Wrench : CircleDollarSign}
              variant={STAT_VARIANTS[index] || "default"}
            />
          ))}
        </div>

        <div className="rounded-3xl bg-white border border-gray-300 overflow-hidden flex-1 flex flex-col">
          <TableToolbar
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            onPageChange={handlePageChange}
            onFilter={() => setIsFilterOpen(true)}
          />

          <div ref={tableScrollRef} className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead
                className="sticky top-0 z-20 bg-gray-100"
                style={{ boxShadow: "0 1px 0 0 rgba(209,213,219,1)" }}
              >
                <tr className="text-sm tracking-wider text-gray-500">
                  <th className="px-7 py-3.5 font-medium">Id</th>
                  <th className="px-7 py-3.5 font-medium">Staff</th>
                  <th className="px-7 py-3.5 font-medium">Date</th>
                  <th className="px-7 py-3.5 font-medium">Month</th>
                  <th className="px-7 py-3.5 font-medium">Type</th>
                  <th className="px-7 py-3.5 font-medium">Amount</th>
                  <th className="px-7 py-3.5 font-medium">Remarks</th>
                  <th className="px-7 py-3.5 font-medium">Created</th>
                  <th className="px-7 py-3.5 font-medium text-right">Actions</th>
                </tr>
              </thead>

              {loading ? (
                <TableSkeleton rows={8} columns={9} />
              ) : (
                <tbody>
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-7 py-12 text-center text-gray-500">
                        No staff payments found.
                      </td>
                    </tr>
                  ) : (
                    payments.map((item, index) => (
                      <tr key={item._id} className="border-b border-gray-200/80 hover:bg-gray-50/70">
                        <td className="px-7 py-4 text-sm text-gray-500">
                          {String(index + 1 + (pagination.currentPage - 1) * pagination.itemsPerPage).padStart(2, "0")}
                        </td>
                        <td className="px-7 py-4 text-sm font-medium text-gray-800">{item.staff_id?.name || "-"}</td>
                        <td className="px-7 py-4 text-sm text-gray-600">{formatDate(item.date, "dd-MMM-YYYY, DDD")}</td>
                        <td className="px-7 py-4 text-sm text-gray-600">{item.month || "-"}</td>
                        <td className="px-7 py-4">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${TYPE_BADGE_CLASS[item.type] || "bg-gray-100 text-gray-700"}`}>
                            {item.type || "-"}
                          </span>
                        </td>
                        <td className="px-7 py-4 text-sm text-gray-600">{formatNumbers(item.amount, 2) || "0.00"}</td>
                        <td className="px-7 py-4 text-sm text-gray-500">{item.remarks || "-"}</td>
                        <td className="px-7 py-4 text-sm text-gray-500">{formatDate(item.createdAt, "dd-MMM-YYYY, DDD")}</td>
                        <td className="px-7 py-4 text-right relative">
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
                              Edit Payment
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

      <StaffPaymentFormModal
        isOpen={formModal.isOpen}
        onClose={() => setFormModal({ isOpen: false, initialData: null })}
        onAction={handleFormAction}
        initialData={formModal.initialData}
      />

      <FilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filterConfig}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />
    </>
  );
}
