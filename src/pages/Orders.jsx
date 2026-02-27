import React, { useEffect, useRef, useState } from "react";
import { Plus, FileText, Banknote } from "lucide-react";
import {
  createOrder,
  fetchOrders,
  fetchOrderStats,
  updateOrder,
} from "../api/order";

import StatCard from "../components/StatCard";
import TableToolbar from "../components/table/TableToolbar";
import FilterDrawer from "../components/FilterDrawer";
import TableSkeleton from "../components/table/TableLoader";
import PageHeader from "../components/PageHeader";
import OrderFormModal from "../components/Order/OrderFormModal";
import OrderRow from "../components/Order/OrderRow";
import OrderDetailsModal from "../components/Order/OrderDetailsModal";
import { useToast } from "../context/ToastContext";

export default function Orders() {
  const { showToast } = useToast();
  const toMillis = (value) => {
    if (!value) return 0;
    const d = new Date(value).getTime();
    return Number.isFinite(d) ? d : 0;
  };
  const objectIdToMillis = (id) => {
    const raw = String(id || "");
    if (!/^[a-fA-F0-9]{24}$/.test(raw)) return 0;
    return parseInt(raw.slice(0, 8), 16) * 1000;
  };
  const sortLatestFirst = (rows = []) =>
    [...rows].sort((a, b) => {
      const aTime = toMillis(a?.createdAt) || toMillis(a?.date) || objectIdToMillis(a?._id || a?.id);
      const bTime = toMillis(b?.createdAt) || toMillis(b?.date) || objectIdToMillis(b?._id || b?.id);
      return bTime - aTime;
    });

  const [stats, setStats] = useState({
    total_orders: 0,
    total_amount: 0,
  });
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailsModal, setDetailsModal] = useState({ isOpen: false, data: null });
  const [formModal, setFormModal] = useState({ isOpen: false, data: null });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    customer_name: "",
    machine_no: "",
    date_from: "",
    date_to: "",
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 30,
  });

  const tableScrollRef = useRef(null);

  const loadStats = async (filterParams = filters) => {
    try {
      const res = await fetchOrderStats(filterParams);
      setStats(
        res.data || {
          total_orders: 0,
          total_amount: 0,
        }
      );
    } catch {
      showToast({ type: "error", message: "Failed to load order stats" });
    }
  };

  const loadOrders = async (page = 1, filterParams = filters) => {
    try {
      setLoading(true);
      const res = await fetchOrders({ page, limit: 30, ...filterParams });
      setOrders(sortLatestFirst(res.data || []));
      if (res.pagination) setPagination(res.pagination);
      loadStats(filterParams);
    } catch {
      showToast({ type: "error", message: "Failed to load orders" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [pagination.currentPage]);

  const handlePageChange = (page) => loadOrders(page);
  const handleApplyFilters = () => {
    loadOrders(1, filters);
    setIsFilterOpen(false);
  };
  const handleResetFilters = () => {
    const reset = { customer_name: "", machine_no: "", date_from: "", date_to: "" };
    setFilters(reset);
    loadOrders(1, reset);
    setIsFilterOpen(false);
  };

  const handleOrderFormAction = async (action, payload) => {
    try {
      if (action === "add") {
        await createOrder(payload);
        showToast({ type: "success", message: "Order created successfully" });
      } else if (action === "edit") {
        await updateOrder(payload.id, payload);
        showToast({ type: "success", message: "Order updated successfully" });
      }
      loadOrders(pagination.currentPage);
    } catch (err) {
      showToast({ type: "error", message: err.response?.data?.message || "Something went wrong" });
      throw err;
    }
  };

  const handleOrderDetailsActions = (action, data) => {
    if (action === "openEdit") {
      setDetailsModal({ isOpen: false, data: null });
      setFormModal({ isOpen: true, data, forceAdd: false });
      return;
    }

    if (action === "repeatItem") {
      setDetailsModal({ isOpen: false, data: null });
      setFormModal({ isOpen: true, data, forceAdd: true });
      return;
    }

  };

  const filterConfig = [
    {
      label: "Customer Name",
      placeholder: "Search by customer name",
      type: "text",
      value: filters.customer_name,
      onChange: (e) => setFilters((prev) => ({ ...prev, customer_name: e.target.value })),
    },
    {
      label: "Machine No",
      placeholder: "Search by machine no",
      type: "text",
      value: filters.machine_no,
      onChange: (e) => setFilters((prev) => ({ ...prev, machine_no: e.target.value })),
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
          title="Orders"
          subtitle="Manage embroidery orders and production billing details."
          actionLabel="Generate Order"
          actionIcon={Plus}
          onAction={() => setFormModal({ isOpen: true, data: null, forceAdd: false })}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <StatCard label="Total Orders" value={stats.total_orders} icon={FileText} />
          <StatCard
            label="Total Amount"
            value={Number(stats.total_amount || 0).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            icon={Banknote}
            variant="warning"
          />
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
                  <th className="px-5 py-3.5 font-medium">#</th>
                  <th className="px-5 py-3.5 font-medium">Customer</th>
                  <th className="px-5 py-3.5 font-medium">Date</th>
                  <th className="px-5 py-3.5 font-medium">Lot No</th>
                  <th className="px-5 py-3.5 font-medium">Machine No</th>
                  <th className="px-5 py-3.5 font-medium">Quantity</th>
                  <th className="px-5 py-3.5 font-medium">Rate</th>
                  <th className="px-5 py-3.5 font-medium">Total Amount</th>
                  <th className="px-5 py-3.5 font-medium text-right">Actions</th>
                </tr>
              </thead>

              {loading ? (
                <TableSkeleton rows={30} columns={9} />
              ) : (
                <tbody className="divide-y divide-gray-200">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-7 py-16 text-center text-sm text-gray-400">
                        No orders found.
                      </td>
                    </tr>
                  ) : (
                    orders.map((item, index) => (
                      <OrderRow
                        key={item._id}
                        item={item}
                        index={index}
                        startIndex={(pagination.currentPage - 1) * pagination.itemsPerPage}
                        onView={(data) => setDetailsModal({ isOpen: true, data })}
                        onEdit={(data) => setFormModal({ isOpen: true, data, forceAdd: false })}
                        onRepeat={(data) => setFormModal({ isOpen: true, data, forceAdd: true })}
                      />
                    ))
                  )}
                </tbody>
              )}
            </table>
          </div>
        </div>
      </div>

      <OrderDetailsModal
        isOpen={detailsModal.isOpen}
        initialData={detailsModal.data}
        onClose={() => setDetailsModal({ isOpen: false, data: null })}
        onAction={handleOrderDetailsActions}
      />

      <OrderFormModal
        isOpen={formModal.isOpen}
        initialData={formModal.data}
        forceAdd={!!formModal.forceAdd}
        onClose={() => setFormModal({ isOpen: false, data: null, forceAdd: false })}
        onAction={handleOrderFormAction}
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
