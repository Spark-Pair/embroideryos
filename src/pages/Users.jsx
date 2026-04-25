// pages/Users.jsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Plus, CircleCheck, XCircle, Users2, Globe, Monitor, Smartphone, Tablet, Clock, LogOut } from "lucide-react";
import {
  fetchUsers,
  fetchUserStats,
  fetchLoggedInUsers,
  toggleUserStatus,
  resetUserPassword,
  fetchBusinessUsers,
  fetchBusinessUserStats,
  logoutUserFromAllDevices,
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
import { fetchMyReferenceData, fetchMyRuleData } from "../api/business";
import { hasAccessForRole, normalizeBusinessUserRoles } from "../utils/accessConfig";
import Button from "../components/Button";

const getRelativeTime = (date) => {
  if (!date) return "-";
  const now = new Date();
  const past = new Date(date);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return past.toLocaleDateString();
};

const getDeviceIcon = (device) => {
  const normalized = String(device || "").toLowerCase();
  if (normalized === "mobile") return Smartphone;
  if (normalized === "tablet") return Tablet;
  return Monitor;
};

export default function Users() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const isDeveloper = user?.role === "developer";
  const isReadOnly = Boolean(user?.subscription?.readOnly);
  const [referenceData, setReferenceData] = useState({ user_roles: [] });
  const [ruleData, setRuleData] = useState({ access_rules: [] });
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
  const [activeUsers, setActiveUsers] = useState([]);
  const [activeUsersLoading, setActiveUsersLoading] = useState(false);
  const [busyLogoutUserId, setBusyLogoutUserId] = useState("");
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

  const loadUsersStats = useCallback(async () => {
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
  }, [isDeveloper, showToast]);

  const tableScrollRef = useRef(null);

  const loadActiveUsers = useCallback(async () => {
    if (!isDeveloper) return;

    try {
      setActiveUsersLoading(true);
      const res = await fetchLoggedInUsers();
      setActiveUsers(res.data || []);
    } catch (err) {
      console.error(err);
      showToast({
        type: "error",
        message: "Failed to load logged in users",
      });
    } finally {
      setActiveUsersLoading(false);
    }
  }, [isDeveloper, showToast]);

  // Load users from server
  const loadUsers = useCallback(async (page = 1, filterParams = filters) => {
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
  }, [filters, isDeveloper, loadUsersStats, showToast]);

  // Initial load
  useEffect(() => {
    if (!user) return;
    loadUsers();
  }, [loadUsers, user]);

  useEffect(() => {
    if (!isDeveloper || !user) return;
    loadActiveUsers();
  }, [isDeveloper, loadActiveUsers, user]);

  const canManageUsers = useMemo(() => {
    if (isDeveloper) return false;
    return hasAccessForRole(ruleData, referenceData, "users_manage", user?.role);
  }, [isDeveloper, referenceData, ruleData, user?.role]);

  useEffect(() => {
    if (!canManageUsers) return;
    const loadSubscription = async () => {
      try {
        const res = await fetchMySubscription();
        setSubscription(res?.data || null);
      } catch (err) {
        console.error(err);
      }
    };
    loadSubscription();
  }, [canManageUsers]);

  useEffect(() => {
    if (isDeveloper) return;
    const loadBusinessAccess = async () => {
      try {
        const [referenceRes, ruleRes] = await Promise.all([
          fetchMyReferenceData().catch(() => ({ reference_data: {} })),
          fetchMyRuleData().catch(() => ({ rule_data: {} })),
        ]);
        setReferenceData(referenceRes?.reference_data || { user_roles: [] });
        setRuleData(ruleRes?.rule_data || { access_rules: [] });
      } catch {
        setReferenceData({ user_roles: [] });
        setRuleData({ access_rules: [] });
      }
    };
    loadBusinessAccess();
  }, [isDeveloper]);

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
    if (!canManageUsers) return;
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
    if (!canManageUsers || !Number.isFinite(userLimit)) return false;
    if (userLimit <= 0) return true;
    return stats.total >= userLimit;
  }, [canManageUsers, userLimit, stats.total]);

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
  const canCreateUser = canManageUsers && !isReadOnly && !isLimitReached;
  const userRoleOptions = useMemo(
    () => normalizeBusinessUserRoles(referenceData?.user_roles || []).map((role) => ({
      label: role.charAt(0).toUpperCase() + role.slice(1),
      value: role,
    })),
    [referenceData?.user_roles]
  );

  const activeUserStats = useMemo(() => ({
    totalUsers: activeUsers.length,
    totalSessions: activeUsers.reduce((sum, item) => sum + Number(item.sessionCount || 0), 0),
  }), [activeUsers]);

  const handleLogoutEverywhere = async (targetUser) => {
    setBusyLogoutUserId(targetUser.userId);
    try {
      await logoutUserFromAllDevices(targetUser.userId);
      const isCurrentUser = String(targetUser.userId) === String(user?.id || user?._id || "");

      if (isCurrentUser) {
        showToast({
          type: "success",
          message: "Your account was logged out from all devices",
        });
        await logout();
        return;
      }

      setActiveUsers((prev) => prev.filter((entry) => entry.userId !== targetUser.userId));
      showToast({
        type: "success",
        message: `${targetUser.name} logged out successfully`,
      });
      loadUsersStats();
    } catch (err) {
      console.error(err);
      showToast({
        type: "error",
        message: err.response?.data?.message || "Failed to logout user",
      });
    } finally {
      setBusyLogoutUserId("");
    }
  };

  return (
    <>
      <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col">
        <PageHeader
          title="User"
          subtitle="Manage all your users effortlessly."
          actionLabel={canManageUsers ? "Add User" : undefined}
          onAction={canCreateUser ? () => setFormModal({ isOpen: true }) : undefined}
          actionIcon={Plus}
        />

        {canManageUsers && (
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

        {isDeveloper && (
          <div className="rounded-3xl bg-white border border-gray-300 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800">Currently Logged In</p>
                <p className="text-xs text-gray-500">
                  {activeUserStats.totalUsers} active user{activeUserStats.totalUsers === 1 ? "" : "s"} · {activeUserStats.totalSessions} session{activeUserStats.totalSessions === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                onClick={loadActiveUsers}
                className="text-xs font-medium text-[#127475] hover:text-[#0f6465] text-left sm:text-right"
              >
                Refresh
              </button>
            </div>

            <div className="divide-y divide-gray-200">
              {activeUsersLoading ? (
                <div className="px-6 py-10 text-sm text-gray-500">Loading logged in users...</div>
              ) : activeUsers.length === 0 ? (
                <div className="px-6 py-10 text-sm text-gray-500">No users are currently logged in.</div>
              ) : (
                activeUsers.map((loggedInUser) => {
                  const recentSession = loggedInUser.sessions?.[0] || {};
                  const DeviceIcon = getDeviceIcon(recentSession.device);

                  return (
                    <div key={loggedInUser.userId} className="px-6 py-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                          <DeviceIcon className="w-5 h-5" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900">{loggedInUser.name}</p>
                            <span className="text-xs text-gray-500">@{loggedInUser.username}</span>
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 capitalize">
                              {loggedInUser.role}
                            </span>
                            {!loggedInUser.isActive && (
                              <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                                Inactive user
                              </span>
                            )}
                          </div>

                          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-1.5 text-xs text-gray-600">
                            <p className="flex items-center gap-1.5">
                              <Users2 className="w-3.5 h-3.5 text-gray-400" />
                              {loggedInUser.businessName || "No business"}
                            </p>
                            <p className="flex items-center gap-1.5">
                              <Globe className="w-3.5 h-3.5 text-gray-400" />
                              {loggedInUser.sessionCount} active session{loggedInUser.sessionCount === 1 ? "" : "s"}
                            </p>
                            <p className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-gray-400" />
                              Last active {getRelativeTime(loggedInUser.lastActivity)}
                            </p>
                            <p className="flex items-center gap-1.5">
                              <Monitor className="w-3.5 h-3.5 text-gray-400" />
                              {recentSession.browser || "-"} · {recentSession.os || "-"} · {recentSession.ipAddress || "-"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="danger"
                        size="sm"
                        className="self-start whitespace-nowrap"
                        icon={LogOut}
                        loading={busyLogoutUserId === loggedInUser.userId}
                        onClick={() => handleLogoutEverywhere(loggedInUser)}
                      >
                        Logout User
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

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
        roleOptions={userRoleOptions}
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
