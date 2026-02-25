import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Banknote,
  Building2,
  FileText,
  Plus,
  Receipt,
  RefreshCcw,
  Users,
  Users2,
} from "lucide-react";
import useAuth from "../hooks/useAuth";
import PageHeader from "../components/PageHeader";
import Button from "../components/Button";
import Input from "../components/Input";
import StatCard from "../components/StatCard";
import TargetCalculatorModal from "../components/TargetCalculatorModal";
import { useToast } from "../context/ToastContext";
import { formatDate, formatNumbers } from "../utils";
import { fetchOrderStats, fetchOrders } from "../api/order";
import { fetchInvoices, fetchInvoiceOrderGroups } from "../api/invoice";
import { fetchCustomerStats } from "../api/customer";
import { fetchStaffStats } from "../api/staff";
import { fetchBusinessStats, fetchBusinesses } from "../api/business";
import { fetchUserStats, fetchUsers } from "../api/user";

function toMonthRange(monthValue) {
  if (!monthValue) return { from: "", to: "" };
  const [year, month] = monthValue.split("-").map(Number);
  if (!year || !month) return { from: "", to: "" };

  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const fmt = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: fmt(first), to: fmt(last) };
}

function SummaryCard({ title, value, sub }) {
  return (
    <div className="rounded-3xl border border-gray-300 bg-white p-5">
      <p className="text-[11px] uppercase tracking-wider text-gray-400 font-medium">{title}</p>
      <p className="text-2xl text-gray-900 mt-1">{value}</p>
      {sub ? <p className="text-xs text-gray-500 mt-1">{sub}</p> : null}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [openTarget, setOpenTarget] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    month: "",
    customer_name: "",
    date_from: "",
    date_to: "",
  });
  const [appliedFilters, setAppliedFilters] = useState({
    customer_name: "",
    date_from: "",
    date_to: "",
  });

  const [ops, setOps] = useState({
    ordersTotal: 0,
    ordersAmount: 0,
    ordersToday: 0,
    amountToday: 0,
    pendingOrders: 0,
    invoicesToday: 0,
    customersActive: 0,
    staffActive: 0,
    recentOrders: [],
    recentInvoices: [],
  });

  const [dev, setDev] = useState({
    businessesTotal: 0,
    businessesActive: 0,
    usersTotal: 0,
    usersActive: 0,
    recentBusinesses: [],
    recentUsers: [],
  });

  const isDeveloper = user?.role === "developer";
  const hasActiveFilter = !!(appliedFilters.customer_name || appliedFilters.date_from || appliedFilters.date_to);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    const from = appliedFilters.date_from || undefined;
    const to = appliedFilters.date_to || undefined;
    const customerName = appliedFilters.customer_name?.trim() || undefined;
    const orderFilter = {
      ...(from && { date_from: from }),
      ...(to && { date_to: to }),
      ...(customerName && { customer_name: customerName }),
    };

    try {
      if (isDeveloper) {
        const [businessStatsRes, userStatsRes, businessesRes, usersRes] = await Promise.all([
          fetchBusinessStats(),
          fetchUserStats(),
          fetchBusinesses({ page: 1, limit: 5 }),
          fetchUsers({ page: 1, limit: 5 }),
        ]);

        const businessStats = businessStatsRes?.data || {};
        const userStats = userStatsRes?.data || {};

        setDev({
          businessesTotal: Number(businessStats.total || 0),
          businessesActive: Number(businessStats.active || 0),
          usersTotal: Number(userStats.total || 0),
          usersActive: Number(userStats.active || 0),
          recentBusinesses: businessesRes?.data || [],
          recentUsers: usersRes?.data || [],
        });
      } else {
        const [
          orderStatsRes,
          orderStatsPeriodRes,
          pendingGroupRes,
          invoicesPeriodRes,
          customerStatsRes,
          staffStatsRes,
          recentOrdersRes,
          recentInvoicesRes,
        ] = await Promise.all([
          fetchOrderStats(),
          fetchOrderStats(orderFilter),
          fetchInvoiceOrderGroups({ ...(customerName && { customer_name: customerName }) }),
          fetchInvoices({ page: 1, limit: 1, ...orderFilter }),
          fetchCustomerStats(),
          fetchStaffStats(),
          fetchOrders({ page: 1, limit: 5, ...orderFilter }),
          fetchInvoices({ page: 1, limit: 5, ...orderFilter }),
        ]);

        const orderStats = orderStatsRes?.data || {};
        const orderStatsPeriod = orderStatsPeriodRes?.data || {};
        const customerStats = customerStatsRes?.data || {};
        const staffStats = staffStatsRes?.data || {};

        const pendingOrders = (pendingGroupRes?.data || []).reduce(
          (sum, group) => sum + Number(group.total_orders || 0),
          0
        );

        setOps({
          ordersTotal: Number(orderStats.total_orders || 0),
          ordersAmount: Number(orderStats.total_amount || 0),
          ordersToday: Number(orderStatsPeriod.total_orders || 0),
          amountToday: Number(orderStatsPeriod.total_amount || 0),
          pendingOrders,
          invoicesToday: Number(invoicesPeriodRes?.pagination?.totalItems || 0),
          customersActive: Number(customerStats.active || 0),
          staffActive: Number(staffStats.active || 0),
          recentOrders: recentOrdersRes?.data || [],
          recentInvoices: recentInvoicesRes?.data || [],
        });
      }
    } catch {
      showToast({ type: "error", message: "Failed to load dashboard data" });
    } finally {
      setLoading(false);
    }
  }, [appliedFilters.customer_name, appliedFilters.date_from, appliedFilters.date_to, isDeveloper, showToast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const welcomeTitle = useMemo(() => {
    if (isDeveloper) return "System Dashboard";
    return "Business Dashboard";
  }, [isDeveloper]);

  return (
    <>
      {openTarget && <TargetCalculatorModal onClose={() => setOpenTarget(false)} />}

      <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col">
        <PageHeader
          title={welcomeTitle}
          subtitle={`Welcome back, ${user?.name || "User"}. Monitor operations and act quickly.`}
          actionLabel="Refresh"
          actionIcon={RefreshCcw}
          onAction={loadDashboard}
        />

        {loading ? (
          <div className="rounded-3xl border border-gray-300 bg-white p-10 text-sm text-gray-500">
            Loading dashboard...
          </div>
        ) : (
          <>
            {isDeveloper ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                  <StatCard label="Businesses" value={dev.businessesTotal} icon={Building2} />
                  <StatCard label="Active Businesses" value={dev.businessesActive} icon={Activity} variant="success" />
                  <StatCard label="Users" value={dev.usersTotal} icon={Users2} />
                  <StatCard label="Active Users" value={dev.usersActive} icon={Users} variant="warning" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="rounded-3xl border border-gray-300 bg-white overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
                      <h3 className="text-sm font-semibold text-gray-800">Recent Businesses</h3>
                    </div>
                    <div className="max-h-[340px] overflow-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-100">
                          <tr className="text-xs uppercase tracking-wider text-gray-500">
                            <th className="px-5 py-3 font-medium">Name</th>
                            <th className="px-5 py-3 font-medium">Owner</th>
                            <th className="px-5 py-3 font-medium">Created</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {dev.recentBusinesses.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="px-5 py-10 text-center text-sm text-gray-400">No businesses found.</td>
                            </tr>
                          ) : (
                            dev.recentBusinesses.map((item) => (
                              <tr key={item._id} className="hover:bg-gray-50/80">
                                <td className="px-5 py-3 text-sm font-medium text-gray-800">{item.name}</td>
                                <td className="px-5 py-3 text-sm text-gray-600">{item.person || "-"}</td>
                                <td className="px-5 py-3 text-sm text-gray-500">{formatDate(item.createdAt, "DD MMM yyyy")}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-gray-300 bg-white overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
                      <h3 className="text-sm font-semibold text-gray-800">Recent Users</h3>
                    </div>
                    <div className="max-h-[340px] overflow-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-100">
                          <tr className="text-xs uppercase tracking-wider text-gray-500">
                            <th className="px-5 py-3 font-medium">Name</th>
                            <th className="px-5 py-3 font-medium">Role</th>
                            <th className="px-5 py-3 font-medium">Created</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {dev.recentUsers.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="px-5 py-10 text-center text-sm text-gray-400">No users found.</td>
                            </tr>
                          ) : (
                            dev.recentUsers.map((item) => (
                              <tr key={item._id} className="hover:bg-gray-50/80">
                                <td className="px-5 py-3 text-sm font-medium text-gray-800">{item.name}</td>
                                <td className="px-5 py-3 text-sm text-gray-600 capitalize">{item.role}</td>
                                <td className="px-5 py-3 text-sm text-gray-500">{formatDate(item.createdAt, "DD MMM yyyy")}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-3xl border border-gray-300 bg-white p-4 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <Input
                      label="Month"
                      type="month"
                      required={false}
                      value={filters.month}
                      onChange={(e) => {
                        const month = e.target.value;
                        const range = toMonthRange(month);
                        setFilters((prev) => ({
                          ...prev,
                          month,
                          date_from: month ? range.from : prev.date_from,
                          date_to: month ? range.to : prev.date_to,
                        }));
                      }}
                    />
                    <Input
                      label="Customer Name"
                      required={false}
                      placeholder="Filter by customer"
                      value={filters.customer_name}
                      onChange={(e) => setFilters((prev) => ({ ...prev, customer_name: e.target.value }))}
                    />
                    <Input
                      label="Date From"
                      type="date"
                      required={false}
                      value={filters.date_from}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          month: "",
                          date_from: e.target.value,
                        }))
                      }
                    />
                    <Input
                      label="Date To"
                      type="date"
                      required={false}
                      value={filters.date_to}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          month: "",
                          date_to: e.target.value,
                        }))
                      }
                    />
                    <div className="flex items-end gap-2">
                      <Button
                        onClick={() =>
                          setAppliedFilters({
                            customer_name: filters.customer_name,
                            date_from: filters.date_from,
                            date_to: filters.date_to,
                          })
                        }
                      >
                        Apply
                      </Button>
                      <Button
                        variant="secondary"
                        outline
                        onClick={() => {
                          setFilters({ month: "", customer_name: "", date_from: "", date_to: "" });
                          setAppliedFilters({ customer_name: "", date_from: "", date_to: "" });
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                  <StatCard label={hasActiveFilter ? "Orders (Filtered)" : "Orders Today"} value={ops.ordersToday} icon={FileText} />
                  <StatCard label={hasActiveFilter ? "Revenue (Filtered)" : "Revenue Today"} value={formatNumbers(ops.amountToday, 2)} icon={Banknote} variant="success" />
                  <StatCard label="Pending Orders" value={ops.pendingOrders} icon={Receipt} variant="warning" />
                  <StatCard label={hasActiveFilter ? "Invoices (Filtered)" : "Invoices Today"} value={ops.invoicesToday} icon={FileText} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                  <SummaryCard title="Total Orders" value={formatNumbers(ops.ordersTotal, 0)} sub="All-time operational count" />
                  <SummaryCard title="Total Amount" value={formatNumbers(ops.ordersAmount, 2)} sub="All-time billed amount" />
                  <SummaryCard title="Active Customers" value={formatNumbers(ops.customersActive, 0)} sub="Currently active customers" />
                  <SummaryCard title="Active Staff" value={formatNumbers(ops.staffActive, 0)} sub="Currently active staff" />
                </div>

                <div className="rounded-3xl border border-gray-300 bg-white p-4 mb-6 flex flex-wrap gap-3">
                  <Button icon={Plus} onClick={() => navigate("/orders")}>Create Order</Button>
                  <Button variant="secondary" outline icon={FileText} onClick={() => navigate("/invoices")}>Open Invoices</Button>
                  <Button variant="secondary" outline icon={Banknote} onClick={() => setOpenTarget(true)}>Target Calculator</Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="rounded-3xl border border-gray-300 bg-white overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-800">Recent Orders</h3>
                      <Button size="sm" variant="secondary" outline onClick={() => navigate("/orders")}>View All</Button>
                    </div>
                    <div className="max-h-[340px] overflow-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-100">
                          <tr className="text-xs uppercase tracking-wider text-gray-500">
                            <th className="px-5 py-3 font-medium">Customer</th>
                            <th className="px-5 py-3 font-medium">Date</th>
                            <th className="px-5 py-3 font-medium text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {ops.recentOrders.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="px-5 py-10 text-center text-sm text-gray-400">No orders found.</td>
                            </tr>
                          ) : (
                            ops.recentOrders.map((item) => (
                              <tr key={item._id} className="hover:bg-gray-50/80">
                                <td className="px-5 py-3 text-sm font-medium text-gray-800">{item.customer_name}</td>
                                <td className="px-5 py-3 text-sm text-gray-600">{formatDate(item.date, "DD MMM yyyy")}</td>
                                <td className="px-5 py-3 text-sm text-right font-semibold text-emerald-700">{formatNumbers(item.total_amount, 2)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-gray-300 bg-white overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-800">Recent Invoices</h3>
                      <Button size="sm" variant="secondary" outline onClick={() => navigate("/invoices")}>View All</Button>
                    </div>
                    <div className="max-h-[340px] overflow-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-100">
                          <tr className="text-xs uppercase tracking-wider text-gray-500">
                            <th className="px-5 py-3 font-medium">Customer</th>
                            <th className="px-5 py-3 font-medium">Date</th>
                            <th className="px-5 py-3 font-medium text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {ops.recentInvoices.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="px-5 py-10 text-center text-sm text-gray-400">No invoices found.</td>
                            </tr>
                          ) : (
                            ops.recentInvoices.map((item) => (
                              <tr key={item._id} className="hover:bg-gray-50/80">
                                <td className="px-5 py-3 text-sm font-medium text-gray-800">{item.customer_name}</td>
                                <td className="px-5 py-3 text-sm text-gray-600">{formatDate(item.invoice_date, "DD MMM yyyy")}</td>
                                <td className="px-5 py-3 text-sm text-right font-semibold text-emerald-700">{formatNumbers(item.total_amount, 2)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
