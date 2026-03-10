// pages/Users.jsx
import React, { useState, useRef, useEffect, useMemo } from "react";
import { Plus, CircleCheck, XCircle, Users2 } from "lucide-react";
import {
  fetchUsers,
  fetchUserStats,
  toggleUserStatus,
  resetUserPassword,
  fetchBusinessUsers,
  fetchBusinessUserStats,
  toggleBusinessUserStatus,
  resetBusinessUserPassword,
  createBusinessUser,
} from "../api/user";

import StatCard from "../components/StatCard";
import TableToolbar from "../components/table/TableToolbar";
import UserDetailsModal from "../components/User/UserDetailsModal";
import UserRow from "../components/User/UserRow";
import FilterDrawer from "../components/FilterDrawer";
import TableSkeleton from "../components/table/TableLoader";
import PageHeader from "../components/PageHeader";
import ConfirmModal from "../components/ConfirmModal";
import UserPasswordResetModal from "../components/User/UserPasswordResetModal";
import UserFormModal from "../components/User/UserFormModal";
import { useToast } from '../context/ToastContext';
import useAuth from "../hooks/useAuth";
import { fetchMySubscription } from "../api/subscription";

export default function Users() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isDeveloper = user?.role === "developer";
  const isAdmin = user?.role === "admin";
  const isReadOnly = Boolean(user?.subscription?.readOnly);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
  });
  const [subscription, setSubscription] = useState(null);
  const [users, setUsers] = useState([]);
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
  const [passwordResetModal, setPasswordResetModal] = useState({
    isOpen: false,
    userData: null,
  });
  const [formModal, setFormModal] = useState({
    isOpen: false,
  });
  const [creating, setCreating] = useState(false);
  const [filters, setFilters] = useState({
    name: "",
    status: "",
  });

  const loadUsersStats = async () => {
    try {
      const res = isDeveloper ? await fetchUserStats() : await fetchBusinessUserStats();
      setStats(res.data);
    } catch (err) {
      console.error(err);
      showToast({
        type: 'error',
        message: 'Failed to load users stats'
      });
    }
  };

  const tableScrollRef = useRef(null);

  // Load users from server
  const loadUsers = async (page = 1, filterParams = filters) => {
    try {
      setLoading(true);
      const res = isDeveloper
        ? await fetchUsers({
          page,
          limit: 30,
          ...filterParams,
        })
        : await fetchBusinessUsers({
        page,
        limit: 30,
        ...filterParams,
      });

      loadUsersStats();
      setUsers(res.data);
      setPagination(res.pagination);
    } catch (err) {
      console.error(err);
      showToast({
        type: 'error',
        message: 'Failed to load users'
      });
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (!user) return;
    loadUsers();
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    const loadSubscription = async () => {
      try {
        const res = await fetchMySubscription();
        setSubscription(res?.data || null);
      } catch (err) {
        console.error(err);
      }
    };
    loadSubscription();
  }, [isAdmin]);

  // Scroll to top on page change
  useEffect(() => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [pagination.currentPage]);

  const handlePageChange = (page) => {
    loadUsers(page);
  };

  const handleApplyFilters = () => {
    loadUsers(1, filters); // Reset to page 1 when filtering
    setIsFilterOpen(false);
  };

  const handleResetFilters = () => {
    const resetFilters = { name: "", status: "" };
    setFilters(resetFilters);
    loadUsers(1, resetFilters);
    setIsFilterOpen(false);
  };

  const handlePasswordResetSubmit = (data) => {
    setPasswordResetModal({ isOpen: false, userData: null });
    
    setConfirmModal({
      isOpen: true,
      title: "Reset Password",
      message: `Are you sure you want to reset the password for "${data.userData?.name || 'this user'}"? This action cannot be undone.`,
      variant: "warning",
      confirmText: "Reset Password",
      onConfirm: async () => {
        try {
          if (isDeveloper) {
            await resetUserPassword(data.userId, { newPassword: data.newPassword });
          } else {
            await resetBusinessUserPassword(data.userId, { newPassword: data.newPassword });
          }
          showToast({
            type: 'success',
            message: 'Password reset successfully'
          });
          setConfirmModal({ ...confirmModal, isOpen: false });
        } catch (err) {
          console.error(err);
          showToast({
            type: 'success',
            message: err.response?.data?.message || "Failed to reset password"
          });
        }
      },
    });
  };

  const handleUserDetailsActions = async (action, data) => {
    try {
      if (action === "openEdit") {
        setDetailsModal({ isOpen: false });
        setFormModal({ isOpen: true });
        return;
      } else if (action === "toggleStatus") {
        const isActive = data.isActive;

        setConfirmModal({
          isOpen: true,
          title: isActive ? "Deactivate User" : "Activate User",
          message: `Are you sure you want to ${
            isActive ? "deactivate" : "activate"
          } "${data.name}"?`,
          variant: isActive ? "danger" : "success",
          confirmText: isActive ? "Deactivate" : "Activate",
          onConfirm: async () => {
            if (isDeveloper) {
              await toggleUserStatus(data._id);
            } else {
              await toggleBusinessUserStatus(data._id);
            }
            loadUsers(pagination.currentPage);
            showToast({
              type: 'success',
              message: 'Status changed successfully'
            });
          },
        });
        setDetailsModal({ isOpen: false });
        return;
      } else if (action === "resetPassword") {
        setDetailsModal({ isOpen: false });
        setPasswordResetModal({ isOpen: true, userData: data });
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

  const handleCreateUser = async (payload) => {
    if (!isAdmin) return;
    setCreating(true);
    try {
      await createBusinessUser(payload);
      setFormModal({ isOpen: false });
      showToast({
        type: "success",
        message: "User created successfully",
      });
      loadUsers(1);
    } catch (err) {
      console.error(err);
      showToast({
        type: "error",
        message: err.response?.data?.message || "Failed to create user",
      });
    } finally {
      setCreating(false);
    }
  };

  const userLimit = useMemo(() => {
    const limit = Number(subscription?.plan_details?.limits?.users);
    return Number.isFinite(limit) ? limit : null;
  }, [subscription]);

  const isLimitReached = useMemo(() => {
    if (!isAdmin || !Number.isFinite(userLimit)) return false;
    if (userLimit <= 0) return true;
    return stats.total >= userLimit;
  }, [isAdmin, userLimit, stats.total]);

  const filterConfig = [
    {
      label: "User Name",
      placeholder: "User Name",
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

  const showBusinessColumn = isDeveloper;
  const canCreateUser = isAdmin && !isReadOnly && !isLimitReached;

  return (
    <>
      <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col">
        <PageHeader
          title="User"
          subtitle="Manage all your users effortlessly."
          actionLabel={isAdmin ? "Add User" : undefined}
          onAction={canCreateUser ? () => setFormModal({ isOpen: true }) : undefined}
          actionIcon={Plus}
        />

        {isAdmin && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 mb-5 text-xs text-amber-900">
            <div className="flex items-center justify-between gap-2">
              <div>
                Plan user limit: <span className="font-semibold">{Number.isFinite(userLimit) ? userLimit : "-"}</span>
                {" "}·{" "}
                Current users: <span className="font-semibold">{stats.total}</span>
              </div>
              {isReadOnly && (
                <span className="font-semibold text-amber-800">Read-only mode</span>
              )}
            </div>
            {isLimitReached && !isReadOnly && (
              <div className="mt-1 text-[11px] text-amber-800">
                User limit reached. Upgrade your plan to add more users.
              </div>
            )}
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <StatCard
            label="Total Users"
            value={stats.total}
            icon={Users2}
          />
          <StatCard
            label="Active Users"
            value={stats.active}
            icon={CircleCheck}
            variant="success"
          />
          <StatCard
            label="Inactive Users"
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
                  <th className="px-7 py-3.5 font-medium">Name</th>
                  <th className="px-7 py-3.5 font-medium">Username</th>
                  {showBusinessColumn && (
                    <th className="px-7 py-3.5 font-medium">Business Name</th>
                  )}
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
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={showBusinessColumn ? 6 : 5} className="px-7 py-16 text-center text-sm text-gray-400">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    users.map((item, index) => (
                      <UserRow
                        key={item._id}
                        item={item}
                        index={index}
                        startIndex={
                          (pagination.currentPage - 1) * pagination.itemsPerPage
                        }
                        showBusiness={showBusinessColumn}
                        onResetPassword={(data) => setPasswordResetModal({ isOpen: true, userData: data })}
                        onView={(data) => setDetailsModal({ isOpen: true, data })}
                        onToggleStatus={(data) =>
                          handleUserDetailsActions("toggleStatus", data)
                        }
                      />
                    ))
                  )}
                </tbody>
              )}
            </table>
          </div>
        </div>
      </div>

      <UserDetailsModal
        isOpen={detailsModal.isOpen}
        initialData={detailsModal.data}
        onClose={() => setDetailsModal({ ...detailsModal, isOpen: false })}
        onAction={handleUserDetailsActions}
      />

      <UserPasswordResetModal
        isOpen={passwordResetModal.isOpen}
        userData={passwordResetModal.userData}
        onClose={() => setPasswordResetModal({ isOpen: false, userData: null })}
        onSubmit={(data) => handlePasswordResetSubmit({ ...data, userData: passwordResetModal.userData })}
      />

      <UserFormModal
        isOpen={formModal.isOpen}
        onClose={() => setFormModal({ isOpen: false })}
        onSubmit={handleCreateUser}
        loading={creating}
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
