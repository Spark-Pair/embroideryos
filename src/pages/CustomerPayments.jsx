import { useEffect, useRef, useState } from "react";
import { Banknote, Landmark, Plus, Smartphone, Wrench } from "lucide-react";
import {
  createCustomerPayment,
  fetchCustomerPaymentStats,
  fetchCustomerPayments,
  updateCustomerPayment,
} from "../api/customerPayment";
import StatCard from "../components/StatCard";
import TableToolbar from "../components/table/TableToolbar";
import TableSkeleton from "../components/table/TableLoader";
import FilterDrawer from "../components/FilterDrawer";
import PageHeader from "../components/PageHeader";
import CustomerPaymentFormModal from "../components/CustomerPayment/CustomerPaymentFormModal";
import CustomerPaymentRow from "../components/CustomerPayment/CustomerPaymentRow";
import CustomerPaymentDetailsModal from "../components/CustomerPayment/CustomerPaymentDetailsModal";
import { useToast } from "../context/ToastContext";

export default function CustomerPayments() {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    cash: 0,
    cheque: 0,
    slip: 0,
    online: 0,
    adjustment: 0,
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 30,
  });
  const [formModal, setFormModal] = useState({ isOpen: false, data: null });
  const [detailModal, setDetailModal] = useState({ isOpen: false, payment: null });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    name: "",
    method: "",
    month: "",
    date_from: "",
    date_to: "",
  });

  const tableScrollRef = useRef(null);

  const loadStats = async () => {
    try {
      const res = await fetchCustomerPaymentStats();
      setStats(res.data || { total: 0, cash: 0, cheque: 0, slip: 0, online: 0, adjustment: 0 });
    } catch {
      showToast({ type: "error", message: "Failed to load customer payment stats" });
    }
  };

  const loadPayments = async (page = 1, filterParams = filters) => {
    try {
      setLoading(true);
      const res = await fetchCustomerPayments({ page, limit: 30, ...filterParams });
      setPayments(res.data || []);
      if (res.pagination) setPagination(res.pagination);
      loadStats();
    } catch {
      showToast({ type: "error", message: "Failed to load customer payments" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!tableScrollRef.current) return;
    tableScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
  }, [pagination.currentPage]);

  const handlePageChange = (page) => loadPayments(page, filters);
  const handleApplyFilters = () => {
    loadPayments(1, filters);
    setIsFilterOpen(false);
  };
  const handleResetFilters = () => {
    const reset = { name: "", method: "", month: "", date_from: "", date_to: "" };
    setFilters(reset);
    loadPayments(1, reset);
    setIsFilterOpen(false);
  };

  const handleFormAction = async (_action, payload) => {
    try {
      if (_action === "edit" && payload?.id) {
        await updateCustomerPayment(payload.id, payload);
        showToast({ type: "success", message: "Customer payment updated successfully" });
      } else {
        await createCustomerPayment(payload);
        showToast({ type: "success", message: "Customer payment created successfully" });
      }
      setFormModal({ isOpen: false, data: null });
      loadPayments(pagination.currentPage, filters);
    } catch (err) {
      showToast({ type: "error", message: err.response?.data?.message || "Failed to save customer payment" });
      throw err;
    }
  };

  const handlePaymentDetailsActions = (action, data) => {
    if (action === "openEdit") {
      setDetailModal({ isOpen: false, payment: null });
      setFormModal({ isOpen: true, data });
    }
  };

  const filterConfig = [
    {
      label: "Customer Name",
      type: "text",
      placeholder: "Search by customer name",
      value: filters.name,
      onChange: (e) => setFilters((prev) => ({ ...prev, name: e.target.value })),
    },
    {
      label: "Method",
      type: "select",
      value: filters.method,
      options: [
        { label: "All", value: "" },
        { label: "Cash", value: "cash" },
        { label: "Cheque", value: "cheque" },
        { label: "Slip", value: "slip" },
        { label: "Online", value: "online" },
        { label: "Adjustment", value: "adjustment" },
      ],
      onChange: (val) => setFilters((prev) => ({ ...prev, method: val })),
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

  return (
    <>
      <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col">
        <PageHeader
          title="Customer Payments"
          subtitle="Track received customer payments by method and date."
          actionLabel="Receive Payment"
          actionIcon={Plus}
          onAction={() => setFormModal({ isOpen: true, data: null })}
        />

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
          <StatCard label="Total" value={stats.total} icon={Banknote} />
          <StatCard label="Cash" value={stats.cash} icon={Banknote} variant="success" />
          <StatCard label="Cheque" value={stats.cheque} icon={Landmark} variant="warning" />
          <StatCard label="Online" value={stats.online} icon={Smartphone} variant="info" />
          <StatCard label="Adjustment" value={stats.adjustment} icon={Wrench} variant="default" />
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
                  <th className="px-7 py-3.5 font-medium">Customer</th>
                  <th className="px-7 py-3.5 font-medium">Date</th>
                  <th className="px-7 py-3.5 font-medium">Method</th>
                  <th className="px-7 py-3.5 font-medium">Amount</th>
                  <th className="px-7 py-3.5 font-medium">Remarks</th>
                  <th className="px-7 py-3.5 font-medium text-right">Actions</th>
                </tr>
              </thead>

              {loading ? (
                <TableSkeleton rows={8} columns={7} />
              ) : (
                <tbody className="divide-y divide-gray-200">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-7 py-12 text-center text-gray-500">
                        No customer payments found.
                      </td>
                    </tr>
                  ) : (
                    payments.map((item, index) => (
                      <CustomerPaymentRow
                        key={item._id}
                        item={item}
                        index={index}
                        startIndex={(pagination.currentPage - 1) * pagination.itemsPerPage}
                        onView={(data) => setDetailModal({ isOpen: true, payment: data })}
                        onEdit={(data) => setFormModal({ isOpen: true, data })}
                      />
                    ))
                  )}
                </tbody>
              )}
            </table>
          </div>
        </div>
      </div>

      <CustomerPaymentFormModal
        isOpen={formModal.isOpen}
        initialData={formModal.data}
        onClose={() => setFormModal({ isOpen: false, data: null })}
        onAction={handleFormAction}
      />

      <FilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filterConfig}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />

      <CustomerPaymentDetailsModal
        isOpen={detailModal.isOpen}
        initialData={detailModal.payment}
        onClose={() => setDetailModal({ isOpen: false, payment: null })}
        onAction={handlePaymentDetailsActions}
      />
    </>
  );
}
