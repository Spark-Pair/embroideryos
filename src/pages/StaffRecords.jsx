// pages/StaffRecords.jsx

import React, { useState, useRef, useEffect } from "react";
import { Plus, FileText, Banknote, Gift } from "lucide-react";
import {
  fetchStaffRecords,
  fetchStaffRecordStats,
  createStaffRecord,
  updateStaffRecord,
  toggleStaffRecordStatus,
} from "../api/staffRecord";

import StatCard from "../components/StatCard";
import TableToolbar from "../components/table/TableToolbar";
import StaffRecordDetailsModal from "../components/StaffRecord/StaffRecordDetailsModal";
import StaffRecordFormModal from "../components/StaffRecord/StaffRecordFormModal";
import StaffRecordRow from "../components/StaffRecord/StaffRecordRow";
import FilterDrawer from "../components/FilterDrawer";
import TableSkeleton from "../components/table/TableLoader";
import PageHeader from "../components/PageHeader";
import ConfirmModal from "../components/ConfirmModal";
import { useToast } from "../context/ToastContext";

export default function StaffRecords() {
  const { showToast } = useToast();

  const [stats, setStats] = useState({
    record_count:       0,
    total_final_amount: 0,
    total_bonus_amount: 0,
  });
  const [staffRecords, setStaffRecords] = useState([]);
  const [lastUsed, setLastUsed] = useState({
    staffId: null,
    attendanceHistory: { last: null, secondLast: null },
  });
  const [pagination, setPagination] = useState({
    currentPage:  1,
    totalPages:   1,
    totalItems:   0,
    itemsPerPage: 30,
  });
  const [loading, setLoading] = useState(false);

  // Modals
  const [detailsModal, setDetailsModal] = useState({ isOpen: false, data: null });
  const [formModal,    setFormModal]    = useState({ isOpen: false, data: null });
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false, title: "", message: "", onConfirm: () => {}, variant: "danger",
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [filters, setFilters] = useState({
    name: "", attendance: "", date_from: "", date_to: "",
  });

  const tableScrollRef = useRef(null);

  // ── Loaders ──────────────────────────────────────────────────────────────────

  const loadStats = async (filterParams = filters) => {
    try {
      const res = await fetchStaffRecordStats(filterParams);
      setStats(
        res.data?.amounts ?? {
          record_count:       0,
          total_final_amount: 0,
          total_bonus_amount: 0,
        }
      );
    } catch {
      showToast({ type: "error", message: "Failed to load stats" });
    }
  };

  const loadRecords = async (page = 1, filterParams = filters) => {
    try {
      setLoading(true);
      const res = await fetchStaffRecords({ page, limit: 30, ...filterParams });
      setStaffRecords(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
      loadStats(filterParams);
    } catch {
      showToast({ type: "error", message: "Failed to load staff records" });
    } finally {
      setLoading(false);
    }
  };

  // ── Initial load ──────────────────────────────────────────────────────────────

  useEffect(() => {
    loadRecords();
  }, []);

  useEffect(() => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [pagination.currentPage]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handlePageChange   = (page) => loadRecords(page);
  const handleApplyFilters = () => { loadRecords(1, filters); setIsFilterOpen(false); };
  const handleResetFilters = () => {
    const reset = { name: "", attendance: "", date_from: "", date_to: "" };
    setFilters(reset);
    loadRecords(1, reset);
    setIsFilterOpen(false);
  };

  const handleDetailsAction = (action, data) => {
    if (action === "openEdit") {
      setDetailsModal({ isOpen: false, data: null });
      setFormModal({ isOpen: true, data });
      return;
    }

    if (action === "toggleStatus") {
      setDetailsModal({ isOpen: false, data: null });
      setConfirmModal({
        isOpen:      true,
        title:       data.isActive ? "Deactivate Record" : "Activate Record",
        message:     `Are you sure you want to ${data.isActive ? "deactivate" : "activate"} this record for "${data?.staff_id?.name || "this staff"}"?`,
        variant:     data.isActive ? "danger" : "success",
        confirmText: data.isActive ? "Deactivate" : "Activate",
        onConfirm: async () => {
          try {
            await toggleStaffRecordStatus(data._id);
            loadRecords(pagination.currentPage);
            showToast({ type: "success", message: "Status updated" });
          } catch (err) {
            showToast({ type: "error", message: err.response?.data?.message || "Failed to update status" });
          }
        },
      });
    }
  };

  const handleFormAction = async (action, payload) => {
    try {
      if (action === "add") {
        await createStaffRecord(payload);
        showToast({ type: "success", message: "Record added successfully" });
      } else if (action === "edit") {
        await updateStaffRecord(payload.id, payload);
        showToast({ type: "success", message: "Record updated successfully" });
      }
      loadRecords(pagination.currentPage);
    } catch (err) {
      showToast({ type: "error", message: err.response?.data?.message || "Something went wrong" });
      throw err;
    }
  };

  // ── Filter config ─────────────────────────────────────────────────────────────

  const filterConfig = [
    {
      label:       "Staff Name",
      placeholder: "Search by name",
      type:        "text",
      value:       filters.name,
      onChange:    (e) => setFilters((p) => ({ ...p, name: e.target.value })),
    },
    {
      label:    "Attendance",
      type:     "select",
      value:    filters.attendance,
      options:  [
        { label: "All",     value: "" },
        { label: "Day",     value: "Day" },
        { label: "Night",   value: "Night" },
        { label: "Half",    value: "Half" },
        { label: "Absent",  value: "Absent" },
        { label: "Off",     value: "Off" },
        { label: "Close",   value: "Close" },
        { label: "Sunday",  value: "Sunday" },
      ],
      onChange: (val) => setFilters((p) => ({ ...p, attendance: val })),
    },
    {
      label:    "Date From",
      type:     "date",
      value:    filters.date_from,
      onChange: (e) => setFilters((p) => ({ ...p, date_from: e.target.value })),
    },
    {
      label:    "Date To",
      type:     "date",
      value:    filters.date_to,
      onChange: (e) => setFilters((p) => ({ ...p, date_to: e.target.value })),
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col">
        <PageHeader
          title="Staff Records"
          subtitle="Manage daily attendance and production entries."
          actionLabel="Add Record"
          actionIcon={Plus}
          onAction={() => setFormModal({ isOpen: true, data: null })}
        />

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <StatCard
            label="Total Records"
            value={stats.record_count}
            icon={FileText}
          />
          <StatCard
            label="Total Final Amount"
            value={
              stats.total_final_amount != null
                ? Number(stats.total_final_amount).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : "—"
            }
            icon={Banknote}
            variant="success"
          />
          <StatCard
            label="Total Bonus Amount"
            value={
              stats.total_bonus_amount != null
                ? Number(stats.total_bonus_amount).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : "—"
            }
            icon={Gift}
            variant="warning"
          />
        </div>

        {/* Table */}
        <div className="rounded-3xl bg-white border border-gray-300 overflow-hidden flex-1 flex flex-col">
          <TableToolbar
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            onPageChange={handlePageChange}
            onFilter={() => setIsFilterOpen(true)}
            onExport={() => console.log("Export")}
          />

          <div ref={tableScrollRef} className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead
                className="sticky top-0 z-20 bg-gray-100"
                style={{ boxShadow: "0 1px 0 0 rgba(209,213,219,1)" }}
              >
                <tr className="text-sm tracking-wider text-gray-500">
                  <th className="px-5 py-3.5 font-medium">#</th>
                  <th className="px-5 py-3.5 font-medium">Staff Name</th>
                  <th className="px-5 py-3.5 font-medium">Date</th>
                  <th className="px-5 py-3.5 font-medium">Attendance</th>
                  <th className="px-5 py-3.5 font-medium">PCs / Rounds</th>
                  <th className="px-5 py-3.5 font-medium">Production / Bonus</th>
                  <th className="px-5 py-3.5 font-medium">Final Amount</th>
                  <th className="px-5 py-3.5 font-medium text-right">Actions</th>
                </tr>
              </thead>

              {loading ? (
                <TableSkeleton rows={30} />
              ) : (
                <tbody className="divide-y divide-gray-200">
                  {staffRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-7 py-16 text-center text-sm text-gray-400">
                        No records found.
                      </td>
                    </tr>
                  ) : (
                    staffRecords.map((item, index) => (
                      <StaffRecordRow
                        key={item._id}
                        item={item}
                        index={index}
                        startIndex={(pagination.currentPage - 1) * pagination.itemsPerPage}
                        onView={(data)         => setDetailsModal({ isOpen: true, data })}
                        onEdit={(data)         => setFormModal({ isOpen: true, data })}
                        onToggleStatus={(data) => handleDetailsAction("toggleStatus", data)}
                      />
                    ))
                  )}
                </tbody>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* Modals */}
      <StaffRecordDetailsModal
        isOpen={detailsModal.isOpen}
        initialData={detailsModal.data}
        onClose={() => setDetailsModal({ isOpen: false, data: null })}
        onAction={handleDetailsAction}
      />

      <StaffRecordFormModal
        isOpen={formModal.isOpen}
        initialData={formModal.data}
        onClose={() => setFormModal({ isOpen: false, data: null })}
        onAction={handleFormAction}
        lastUsed={lastUsed}
        setLastUsed={setLastUsed}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((p) => ({ ...p, isOpen: false }))}
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