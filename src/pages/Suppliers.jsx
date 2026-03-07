import { useEffect, useRef, useState } from "react";
import { Building2, CircleCheck, Plus, XCircle } from "lucide-react";
import {
  createSupplier,
  fetchSupplierStats,
  fetchSuppliers,
  toggleSupplierStatus,
  updateSupplier,
} from "../api/supplier";
import { fetchExpenseItems } from "../api/expenseItem";
import StatCard from "../components/StatCard";
import TableToolbar from "../components/table/TableToolbar";
import SupplierDetailsModal from "../components/Supplier/SupplierDetailsModal";
import SupplierFormModal from "../components/Supplier/SupplierFormModal";
import SupplierRow from "../components/Supplier/SupplierRow";
import FilterDrawer from "../components/FilterDrawer";
import TableSkeleton from "../components/table/TableLoader";
import PageHeader from "../components/PageHeader";
import ConfirmModal from "../components/ConfirmModal";
import { useToast } from "../context/ToastContext";

export default function Suppliers() {
  const { showToast } = useToast();
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
  });
  const [suppliers, setSuppliers] = useState([]);
  const [expenseItemOptions, setExpenseItemOptions] = useState([]);
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

  const tableScrollRef = useRef(null);

  const loadSuppliersStats = async () => {
    try {
      const res = await fetchSupplierStats();
      setStats(res?.data || { total: 0, active: 0, inactive: 0 });
    } catch {
      showToast({
        type: "error",
        message: "Failed to load suppliers stats",
      });
    }
  };

  const loadSuppliers = async (page = 1, filterParams = filters) => {
    try {
      setLoading(true);
      const res = await fetchSuppliers({
        page,
        limit: 30,
        ...filterParams,
      });

      loadSuppliersStats();
      setSuppliers(res?.data || []);
      if (res.pagination) setPagination(res.pagination);
    } catch {
      showToast({
        type: "error",
        message: "Failed to load suppliers",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadExpenseItemOptions = async () => {
    try {
      const res = await fetchExpenseItems({ status: "active" });
      const options = (res?.data || [])
        .filter((item) => item?.expense_type !== "fixed")
        .map((item) => String(item?.name || "").trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
      setExpenseItemOptions(Array.from(new Set(options)));
    } catch {
      setExpenseItemOptions([]);
    }
  };

  useEffect(() => {
    loadSuppliers();
    loadExpenseItemOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [pagination.currentPage]);

  const handlePageChange = (page) => {
    loadSuppliers(page, filters);
  };

  const handleApplyFilters = () => {
    loadSuppliers(1, filters);
    setIsFilterOpen(false);
  };

  const handleResetFilters = () => {
    const resetFilters = { name: "", status: "" };
    setFilters(resetFilters);
    loadSuppliers(1, resetFilters);
    setIsFilterOpen(false);
  };

  const handleSupplierDetailsActions = async (action, data) => {
    try {
      if (action === "openEdit") {
        setDetailsModal({ isOpen: false, data: null });
        setFormModal({ isOpen: true, data });
        return;
      }

      if (action === "toggleStatus") {
        const isActive = data.isActive;

        setConfirmModal({
          isOpen: true,
          title: isActive ? "Deactivate Supplier" : "Activate Supplier",
          message: `Are you sure you want to ${isActive ? "deactivate" : "activate"} "${data.name}"?`,
          variant: isActive ? "danger" : "success",
          confirmText: isActive ? "Deactivate" : "Activate",
          onConfirm: async () => {
            await toggleSupplierStatus(data._id);
            loadSuppliers(pagination.currentPage, filters);
            showToast({
              type: "success",
              message: "Status changed successfully",
            });
          },
        });

        setDetailsModal({ isOpen: false, data: null });
      }
    } catch (err) {
      showToast({
        type: "error",
        message: err.response?.data?.message || "Something went wrong",
      });
    }
  };

  const handleSupplierFormActions = async (action, data) => {
    try {
      const normalizedData = {
        ...data,
        opening_balance:
          data.opening_balance === "" || data.opening_balance == null
            ? 0
            : Number(data.opening_balance),
        assigned_expense_items: Array.isArray(data.assigned_expense_items)
          ? data.assigned_expense_items
          : [],
      };

      if (action === "add") {
        await createSupplier(normalizedData);
        showToast({
          type: "success",
          message: "Supplier added successfully",
        });
      } else if (action === "edit") {
        await updateSupplier(data.id, normalizedData);
        showToast({
          type: "success",
          message: "Supplier edited successfully",
        });
      }

      loadSuppliers(pagination.currentPage, filters);
    } catch (err) {
      showToast({
        type: "error",
        message: err.response?.data?.message || "Something went wrong",
      });
    }
  };

  const filterConfig = [
    {
      label: "Supplier Name",
      placeholder: "Supplier Name",
      type: "text",
      value: filters.name,
      onChange: (e) => setFilters((prev) => ({ ...prev, name: e.target.value })),
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
      onChange: (val) => setFilters((prev) => ({ ...prev, status: val })),
    },
  ];

  return (
    <>
      <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col">
        <PageHeader
          title="Supplier"
          subtitle="Manage all your suppliers effortlessly."
          actionLabel="Add Supplier"
          actionIcon={Plus}
          onAction={() => setFormModal({ isOpen: true })}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <StatCard label="Total Suppliers" value={stats.total} icon={Building2} />
          <StatCard label="Active Suppliers" value={stats.active} icon={CircleCheck} variant="success" />
          <StatCard label="Inactive Suppliers" value={stats.inactive} icon={XCircle} variant="danger" />
        </div>

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
                  <th className="px-7 py-3.5 font-medium">Supplier Name</th>
                  <th className="px-7 py-3.5 font-medium">Current Balance</th>
                  <th className="px-7 py-3.5 font-medium">Status</th>
                  <th className="px-7 py-3.5 font-medium text-right">Actions</th>
                </tr>
              </thead>

              {loading ? (
                <TableSkeleton rows={30} columns={5} />
              ) : (
                <tbody className="divide-y divide-gray-200">
                  {suppliers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-7 py-16 text-center text-sm text-gray-400">
                        No suppliers found.
                      </td>
                    </tr>
                  ) : (
                    suppliers.map((item, index) => (
                      <SupplierRow
                        key={item._id}
                        item={item}
                        index={index}
                        startIndex={(pagination.currentPage - 1) * pagination.itemsPerPage}
                        onView={(data) => setDetailsModal({ isOpen: true, data })}
                        onEdit={(data) => setFormModal({ isOpen: true, data })}
                        onToggleStatus={(data) => handleSupplierDetailsActions("toggleStatus", data)}
                      />
                    ))
                  )}
                </tbody>
              )}
            </table>
          </div>
        </div>
      </div>

      <SupplierDetailsModal
        isOpen={detailsModal.isOpen}
        initialData={detailsModal.data}
        onClose={() => setDetailsModal({ ...detailsModal, isOpen: false })}
        onAction={handleSupplierDetailsActions}
      />

      <SupplierFormModal
        isOpen={formModal.isOpen}
        initialData={formModal.data}
        expenseItemOptions={expenseItemOptions}
        onClose={() => setFormModal({ ...formModal, isOpen: false })}
        onAction={handleSupplierFormActions}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmText={confirmModal.confirmText}
        onConfirm={async () => {
          await confirmModal.onConfirm();
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }}
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
