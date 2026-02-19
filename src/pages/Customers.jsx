// pages/Customers.jsx
import React, { useState, useRef, useEffect } from "react";
import { Plus, CircleCheck, XCircle, Building2 } from "lucide-react";
import {
  fetchCustomers,
  fetchCustomerStats,
  createCustomer,
  updateCustomer,
  toggleCustomerStatus,
} from "../api/customer";

import StatCard from "../components/StatCard";
import TableToolbar from "../components/table/TableToolbar";
import CustomerDetailsModal from "../components/Customer/CustomerDetailsModal";
import CustomerFormModal from "../components/Customer/CustomerFormModal";
import CustomerRow from "../components/Customer/CustomerRow";
import FilterDrawer from "../components/FilterDrawer";
import TableSkeleton from "../components/table/TableLoader";
import PageHeader from "../components/PageHeader";
import ConfirmModal from "../components/ConfirmModal";
import { useToast } from '../context/ToastContext';

export default function Customers() {
  const { showToast } = useToast();
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
  });
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 30,
  });
  const [loading, setLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    variant: "danger",
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [detailsModal, setDetailsModal] = useState({
    isOpen: false,
    data: null,
  });
  const [formModal, setFormModal] = useState({ isOpen: false, data: null });
  const [filters, setFilters] = useState({
    name: "",
    status: "",
  });

  const loadCustomersStats = async () => {
    try {
      const res = await fetchCustomerStats();

      setStats(res.data);
    } catch (err) {
      console.error(err);
      showToast({
        type: 'error',
        message: 'Failed to load customers stats'
      });
    }
  };

  const tableScrollRef = useRef(null);

  // Load customers from server
  const loadCustomers = async (page = 1, filterParams = filters) => {
    try {
      setLoading(true);
      const res = await fetchCustomers({
        page,
        limit: 30,
        ...filterParams,
      });

      loadCustomersStats();
      setCustomers(res.data);
      setPagination(res.pagination);
    } catch (err) {
      console.error(err);
      showToast({
        type: 'error',
        message: 'Failed to load customers'
      });
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadCustomers();
  }, []);

  // Scroll to top on page change
  useEffect(() => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [pagination.currentPage]);

  const handlePageChange = (page) => {
    loadCustomers(page);
  };

  const handleApplyFilters = () => {
    loadCustomers(1, filters); // Reset to page 1 when filtering
    setIsFilterOpen(false);
  };

  const handleResetFilters = () => {
    const resetFilters = { name: "", status: "" };
    setFilters(resetFilters);
    loadCustomers(1, resetFilters);
    setIsFilterOpen(false);
  };

  const handleCustomerDetailsActions = async (action, data) => {
    try {
      if (action === "openEdit") {
        setDetailsModal({ isOpen: false });
        setFormModal({ isOpen: true, data });
        return;
      } else if (action === "toggleStatus") {
        const isActive = data.isActive;

        setConfirmModal({
          isOpen: true,
          title: isActive ? "Deactivate Customer" : "Activate Customer",
          message: `Are you sure you want to ${
            isActive ? "deactivate" : "activate"
          } "${data.name}"?`,
          variant: isActive ? "danger" : "success",
          confirmText: isActive ? "Deactivate" : "Activate",
          onConfirm: async () => {
            await toggleCustomerStatus(data._id);
            loadCustomers(pagination.currentPage);
            showToast({
              type: 'success',
              message: 'Status chagned successfully'
            });
          },
        });
        setDetailsModal({ isOpen: false });
        return;
      }
    } catch (err) {
      console.error(err);
      showToast({
        type: 'error',
        message: err.response?.data?.message || "Something went wrong"
      });
    }
  };

  const handleCustomerFormActions = async (action, data) => {
    try {
      if (action === "add") {
        await createCustomer(data);

        showToast({
          type: 'success',
          message: "Customer added successfully"
        });
      } else if (action === "edit") {
        await updateCustomer(data.id, data);
        
        showToast({
          type: 'success',
          message: "Customer edited successfully"
        });
      }

      loadCustomers(pagination.currentPage);
    } catch (err) {
      console.error(err);
      showToast({
        type: 'error',
        message: err.response?.data?.message || "Something went wrong"
      });
    }
  };

  const filterConfig = [
    {
      label: "Customer Name",
      placeholder: "Customer Name",
      type: "text",
      value: filters.name,
      onChange: (e) => setFilters(prev => ({ ...prev, name: e.target.value })) // ✅ Fixed
    },
    {
      label: "Status",
      type: "select",
      value: filters.status,
      options: [
        { label: "All", value: "" },
        { label: "Active Only", value: "active" },
        { label: "Inactive Only", value: "inactive" },
      ],
      onChange: (val) => setFilters(prev => ({ ...prev, status: val })) // ✅ This is correct
    },
  ];

  return (
    <>
      <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col">
        <PageHeader
          title="Customer"
          subtitle="Manage all your customers effortlessly."
          actionLabel="Add Customer"
          actionIcon={Plus}
          onAction={() => setFormModal({ isOpen: true })}
        />

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <StatCard
            label="Total Customers"
            value={stats.total}
            icon={Building2}
          />
          <StatCard
            label="Active Customers"
            value={stats.active}
            icon={CircleCheck}
            variant="success"
          />
          <StatCard
            label="Inactive Customers"
            value={stats.inactive}
            icon={XCircle}
            variant="danger"
          />
        </div>

        {/* Table Container */}
        <div className="rounded-3xl bg-white border border-gray-300 overflow-hidden flex-1 flex flex-col">
          <TableToolbar
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            onPageChange={handlePageChange}
            onFilter={() => setIsFilterOpen(true)}
            onExport={() => console.log("Export clicked")}
          />

          <div ref={tableScrollRef} className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead
                className="sticky top-0 z-20 bg-gray-100"
                style={{ boxShadow: "0 1px 0 0 rgba(209,213,219,1)" }}
              >
                <tr className="text-sm tracking-wider text-gray-500">
                  <th className="px-7 py-3.5 font-medium">Id</th>
                  <th className="px-7 py-3.5 font-medium">Customer Name</th>
                  <th className="px-7 py-3.5 font-medium">Person Name</th>
                  <th className="px-7 py-3.5 font-medium">Rate</th>
                  <th className="px-7 py-3.5 font-medium">Status</th>
                  <th className="px-7 py-3.5 font-medium text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              {loading ? (
                <TableSkeleton rows={30} />
              ) : (
                <tbody className="divide-y divide-gray-200">
                  {customers.map((item, index) => (
                    <CustomerRow
                      key={item._id}
                      item={item}
                      index={index}
                      startIndex={
                        (pagination.currentPage - 1) * pagination.itemsPerPage
                      }
                      onView={(data) => setDetailsModal({ isOpen: true, data })}
                      onEdit={(data) => setFormModal({ isOpen: true, data })}
                      onToggleStatus={(data) =>
                        handleCustomerDetailsActions("toggleStatus", data)
                      }
                    />
                  ))}
                </tbody>
              )}
            </table>
          </div>
        </div>
      </div>

      <CustomerDetailsModal
        isOpen={detailsModal.isOpen}
        initialData={detailsModal.data}
        onClose={() => setDetailsModal({ ...detailsModal, isOpen: false })}
        onAction={handleCustomerDetailsActions}
      />

      <CustomerFormModal
        isOpen={formModal.isOpen}
        initialData={formModal.data}
        onClose={() => setFormModal({ ...formModal, isOpen: false })}
        onAction={handleCustomerFormActions}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmText={confirmModal.confirmText}
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
