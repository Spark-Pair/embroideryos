import { useEffect, useRef, useState } from "react";
import { Banknote, Landmark, Plus, Smartphone, Wrench } from "lucide-react";
import {
  createCustomerPayment,
  fetchCustomerPaymentStats,
  fetchCustomerPayments,
} from "../api/customerPayment";
import StatCard from "../components/StatCard";
import TableToolbar from "../components/table/TableToolbar";
import TableSkeleton from "../components/table/TableLoader";
import FilterDrawer from "../components/FilterDrawer";
import PageHeader from "../components/PageHeader";
import CustomerPaymentFormModal from "../components/CustomerPayment/CustomerPaymentFormModal";
import { useToast } from "../context/ToastContext";
import { formatDate, formatNumbers } from "../utils";

const METHOD_BADGE_CLASS = {
  cash: "bg-emerald-100 text-emerald-700",
  cheque: "bg-amber-100 text-amber-700",
  slip: "bg-sky-100 text-sky-700",
  online: "bg-indigo-100 text-indigo-700",
  adjustment: "bg-violet-100 text-violet-700",
};

const METHOD_LABEL = {
  cash: "Cash",
  cheque: "Cheque",
  slip: "Slip",
  online: "Online",
  adjustment: "Adjustment",
};

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
  const [formModal, setFormModal] = useState({ isOpen: false });
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
      await createCustomerPayment(payload);
      showToast({ type: "success", message: "Customer payment created successfully" });
      setFormModal({ isOpen: false });
      loadPayments(pagination.currentPage, filters);
    } catch (err) {
      showToast({ type: "error", message: err.response?.data?.message || "Failed to create customer payment" });
      throw err;
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
          onAction={() => setFormModal({ isOpen: true })}
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
                  <th className="px-7 py-3.5 font-medium">Reference</th>
                  <th className="px-7 py-3.5 font-medium">Bank/Party</th>
                  <th className="px-7 py-3.5 font-medium">Cheque/Slip Date</th>
                  <th className="px-7 py-3.5 font-medium">Clear Date</th>
                  <th className="px-7 py-3.5 font-medium">Remarks</th>
                </tr>
              </thead>

              {loading ? (
                <TableSkeleton rows={8} columns={10} />
              ) : (
                <tbody>
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-7 py-12 text-center text-gray-500">
                        No customer payments found.
                      </td>
                    </tr>
                  ) : (
                    payments.map((item, index) => (
                      <tr key={item._id} className="border-b border-gray-200/80 hover:bg-gray-50/70">
                        <td className="px-7 py-4 text-sm text-gray-500">
                          {String(index + 1 + (pagination.currentPage - 1) * pagination.itemsPerPage).padStart(2, "0")}
                        </td>
                        <td className="px-7 py-4 text-sm font-medium text-gray-800">
                          {item.customer_id?.name || item.customer_name || "—"}
                        </td>
                        <td className="px-7 py-4 text-sm text-gray-600">{formatDate(item.date, "dd-MMM-YYYY, DDD")}</td>
                        <td className="px-7 py-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${METHOD_BADGE_CLASS[item.method] || "bg-gray-100 text-gray-700"}`}>
                            {METHOD_LABEL[item.method] || item.method}
                          </span>
                        </td>
                        <td className="px-7 py-4 text-sm text-gray-600 font-semibold">{formatNumbers(item.amount, 2)}</td>
                        <td className="px-7 py-4 text-sm text-gray-500">{item.reference_no || "—"}</td>
                        <td className="px-7 py-4 text-sm text-gray-500">{item.bank_name || item.party_name || "—"}</td>
                        <td className="px-7 py-4 text-sm text-gray-500">{item.cheque_date ? formatDate(item.cheque_date, "dd-MMM-YYYY") : "—"}</td>
                        <td className="px-7 py-4 text-sm text-gray-500">{item.clear_date ? formatDate(item.clear_date, "dd-MMM-YYYY") : "—"}</td>
                        <td className="px-7 py-4 text-sm text-gray-500 max-w-[220px] truncate" title={item.remarks || ""}>
                          {item.remarks || "—"}
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

      <CustomerPaymentFormModal
        isOpen={formModal.isOpen}
        onClose={() => setFormModal({ isOpen: false })}
        onAction={handleFormAction}
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
