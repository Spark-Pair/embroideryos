import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Banknote,
  Building2,
  CreditCard,
  Expand,
  FileText,
  Receipt,
  RefreshCcw,
  Users,
  Users2,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import useAuth from "../hooks/useAuth";
import Button from "../components/Button";
import Modal from "../components/Modal";
import StatCard from "../components/StatCard";
import TargetCalculatorModal from "../components/TargetCalculatorModal";
import { useToast } from "../context/ToastContext";
import { formatDate, formatNumbers } from "../utils";
import { fetchBusinessStats, fetchBusinesses } from "../api/business";
import { fetchUserStats, fetchUsers } from "../api/user";
import { fetchDashboardSummary, fetchDashboardTrend } from "../api/dashboard";
import { fetchSubscriptionPaymentStats, fetchSubscriptionPayments } from "../api/subscriptionPayment";
import { fetchSubscriptions } from "../api/subscription.admin";

function formatYmdLocal(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-gray-600 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.dataKey === "orders" ? formatNumbers(Number(p.value || 0), 0) : formatNumbers(Number(p.value || 0), 2)}
        </p>
      ))}
    </div>
  );
}

function TrendChart({ data, height = 130, idPrefix = "trend" }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`${idPrefix}-orders`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0d9488" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`${idPrefix}-expenses`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#e11d48" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`${idPrefix}-out`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`${idPrefix}-in`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
          </linearGradient>
        </defs>

        <XAxis
          dataKey="day"
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => (typeof value === "string" && value.includes("-") ? formatDate(value, "DD MMM") : value)}
        />
        <YAxis hide />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#e5e7eb", strokeWidth: 1 }} />

        <Area type="monotone" dataKey="orders" name="Orders" stroke="#0d9488" strokeWidth={2} fill={`url(#${idPrefix}-orders)`} dot={false} />
        <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#e11d48" strokeWidth={2} fill={`url(#${idPrefix}-expenses)`} dot={false} />
        <Area type="monotone" dataKey="paymentsOut" name="Payment Out" stroke="#f59e0b" strokeWidth={2} fill={`url(#${idPrefix}-out)`} dot={false} />
        <Area type="monotone" dataKey="paymentsIn" name="Payment In" stroke="#16a34a" strokeWidth={2} fill={`url(#${idPrefix}-in)`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function TrendLegend() {
  const items = [
    { label: "Orders", color: "bg-teal-600" },
    { label: "Expenses", color: "bg-rose-600" },
    { label: "Payment Out", color: "bg-amber-500" },
    { label: "Payment In", color: "bg-emerald-600" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-[11px] text-gray-500">
          <span className={`inline-block h-2 w-2 rounded-full ${item.color}`} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function SkeletonBox({ className = "" }) {
  return <div className={`animate-pulse rounded-xl bg-gray-200/80 ${className}`} />;
}

function DashboardLoadingSkeleton({ isDeveloper }) {
  if (isDeveloper) {
    return (
      <div className="space-y-6 pb-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="rounded-3xl border border-gray-300 bg-white p-4">
              <div className="flex items-center gap-4">
                <SkeletonBox className="h-12 w-12 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <SkeletonBox className="h-3 w-24" />
                  <SkeletonBox className="h-6 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="rounded-3xl border border-gray-300 bg-white overflow-hidden">
              <div className="border-b border-gray-300 bg-gray-100 px-5 py-4">
                <SkeletonBox className="h-4 w-36" />
              </div>
              <div className="space-y-3 p-5">
                {Array.from({ length: 5 }).map((__, rIdx) => (
                  <div key={rIdx} className="flex items-center justify-between">
                    <SkeletonBox className="h-3 w-28" />
                    <SkeletonBox className="h-3 w-16" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      <div>
        <SkeletonBox className="mb-3 h-3 w-44" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="rounded-3xl border border-gray-300 bg-white p-4">
              <div className="flex items-center gap-4">
                <SkeletonBox className="h-12 w-12 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <SkeletonBox className="h-3 w-20" />
                  <SkeletonBox className="h-6 w-12" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="rounded-3xl border border-gray-300 bg-white xl:col-span-6 overflow-hidden">
          <div className="border-b border-gray-300 bg-gray-100 px-5 py-4">
            <SkeletonBox className="h-4 w-28" />
          </div>
          <div className="p-4">
            <SkeletonBox className="h-[130px] w-full rounded-2xl" />
          </div>
        </div>

        <div className="rounded-3xl border border-gray-300 bg-white xl:col-span-3 overflow-hidden">
          <div className="border-b border-gray-300 bg-gray-100 px-5 py-4">
            <SkeletonBox className="h-4 w-40" />
          </div>
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <SkeletonBox className="h-3 w-24" />
                <SkeletonBox className="h-3 w-20" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-gray-300 bg-white xl:col-span-3 overflow-hidden">
          <div className="border-b border-gray-300 bg-gray-100 px-5 py-4">
            <SkeletonBox className="h-4 w-28" />
          </div>
          <div className="space-y-4 p-5">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <SkeletonBox className="h-10 w-10 rounded-xl" />
                  <SkeletonBox className="h-3 w-20" />
                </div>
                <SkeletonBox className="h-5 w-8" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="rounded-3xl border border-gray-300 bg-white overflow-hidden">
            <div className="border-b border-gray-300 bg-gray-100 px-5 py-4">
              <SkeletonBox className="h-4 w-32" />
            </div>
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((__, rIdx) => (
                <div key={rIdx} className="flex items-center justify-between">
                  <div className="space-y-1.5">
                    <SkeletonBox className="h-3 w-24" />
                    <SkeletonBox className="h-3 w-20" />
                  </div>
                  <SkeletonBox className="h-3 w-16" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [openTarget, setOpenTarget] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const [cardTrend, setCardTrend] = useState({
    loading: false,
    from: "",
    to: "",
    data: [],
  });

  const [trendModalOpen, setTrendModalOpen] = useState(false);
  const [modalTrendLoading, setModalTrendLoading] = useState(false);
  const [modalTrendRange, setModalTrendRange] = useState("7d");
  const [modalTrend, setModalTrend] = useState({ from: "", to: "", data: [] });
  const [customDateFrom, setCustomDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return formatYmdLocal(d);
  });
  const [customDateTo, setCustomDateTo] = useState(() => formatYmdLocal(new Date()));

  const [ops, setOps] = useState({
    todayOrdersCount: 0,
    todayOrderAmount: 0,
    todayInvoicesCount: 0,
    todayInvoiceAmount: 0,
    todayExpenseCount: 0,
    todayExpenseAmount: 0,
    todayPaymentInCount: 0,
    todayPaymentInAmount: 0,
    todayPaymentOutCount: 0,
    todayPaymentOutAmount: 0,

    monthOrdersCount: 0,
    monthOrderAmount: 0,
    monthInvoicesCount: 0,
    monthInvoiceAmount: 0,
    monthExpenseCount: 0,
    monthExpenseAmount: 0,
    monthPaymentInCount: 0,
    monthPaymentInAmount: 0,
    monthPaymentOutCount: 0,
    monthPaymentOutAmount: 0,

    customersActive: 0,
    staffActive: 0,
    suppliersActive: 0,

    recentOrders: [],
    recentInvoices: [],
    recentExpenses: [],
  });

  const [dev, setDev] = useState({
    businessesTotal: 0,
    businessesActive: 0,
    usersTotal: 0,
    usersActive: 0,
    activeSubscriptions: 0,
    expiringSoon: 0,
    monthReceived: 0,
    monthPending: 0,
    recentBusinesses: [],
    recentUsers: [],
    recentSubscriptions: [],
    recentPayments: [],
  });

  const isDeveloper = user?.role === "developer";

  const loadTrend = useCallback(async (params, target = "card") => {
    try {
      if (target === "card") {
        setCardTrend((prev) => ({ ...prev, loading: true }));
      } else {
        setModalTrendLoading(true);
      }

      const res = await fetchDashboardTrend(params);
      const data = res?.data || {};
      const payload = {
        from: data?.from || "",
        to: data?.to || "",
        data: (data?.trend || []).map((row) => ({...row, orders: Number(row?.orders || 0), expenses: Number(row?.expenses || 0), paymentsIn: Number(row?.paymentsIn || 0), paymentsOut: Number(row?.paymentsOut || 0)})),
      };

      if (target === "card") {
        setCardTrend({ ...payload, loading: false });
      } else {
        setModalTrend(payload);
      }
    } catch {
      showToast({ type: "error", message: "Failed to load trend chart" });
      if (target === "card") {
        setCardTrend((prev) => ({ ...prev, loading: false }));
      }
    } finally {
      if (target === "modal") {
        setModalTrendLoading(false);
      }
    }
  }, [showToast]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      if (isDeveloper) {
        const [bsRes, usRes, bRes, uRes, subRes, spStatsRes, spRes] = await Promise.all([
          fetchBusinessStats(),
          fetchUserStats(),
          fetchBusinesses({ page: 1, limit: 5 }),
          fetchUsers({ page: 1, limit: 5 }),
          fetchSubscriptions({ page: 1, limit: 5 }),
          fetchSubscriptionPaymentStats({ month: selectedMonth }),
          fetchSubscriptionPayments({ page: 1, limit: 5 }),
        ]);

        setDev({
          businessesTotal: Number(bsRes?.data?.total || 0),
          businessesActive: Number(bsRes?.data?.active || 0),
          usersTotal: Number(usRes?.data?.total || 0),
          usersActive: Number(usRes?.data?.active || 0),
          activeSubscriptions: Number(spStatsRes?.data?.active_subscriptions || 0),
          expiringSoon: Number(spStatsRes?.data?.expiring_7_days || 0),
          monthReceived: Number(spStatsRes?.data?.month_received || 0),
          monthPending: Number(spStatsRes?.data?.month_pending || 0),
          recentBusinesses: bRes?.data || [],
          recentUsers: uRes?.data || [],
          recentSubscriptions: subRes?.data || [],
          recentPayments: spRes?.data || [],
        });
      } else {
        const [summaryRes] = await Promise.all([
          fetchDashboardSummary({ month: selectedMonth }),
          loadTrend({ range: "7d" }, "card"),
        ]);

        const data = summaryRes?.data || {};

        setOps({
          todayOrdersCount: Number(data?.today?.orders?.count || 0),
          todayOrderAmount: Number(data?.today?.orders?.amount || 0),
          todayInvoicesCount: Number(data?.today?.invoices?.count || 0),
          todayInvoiceAmount: Number(data?.today?.invoices?.amount || 0),
          todayExpenseCount: Number(data?.today?.expenses?.count || 0),
          todayExpenseAmount: Number(data?.today?.expenses?.amount || 0),
          todayPaymentInCount: Number(data?.today?.payment_in?.count || 0),
          todayPaymentInAmount: Number(data?.today?.payment_in?.amount || 0),
          todayPaymentOutCount: Number(data?.today?.payment_out?.count || 0),
          todayPaymentOutAmount: Number(data?.today?.payment_out?.amount || 0),

          monthOrdersCount: Number(data?.month?.orders?.count || 0),
          monthOrderAmount: Number(data?.month?.orders?.amount || 0),
          monthInvoicesCount: Number(data?.month?.invoices?.count || 0),
          monthInvoiceAmount: Number(data?.month?.invoices?.amount || 0),
          monthExpenseCount: Number(data?.month?.expenses?.count || 0),
          monthExpenseAmount: Number(data?.month?.expenses?.amount || 0),
          monthPaymentInCount: Number(data?.month?.payment_in?.count || 0),
          monthPaymentInAmount: Number(data?.month?.payment_in?.amount || 0),
          monthPaymentOutCount: Number(data?.month?.payment_out?.count || 0),
          monthPaymentOutAmount: Number(data?.month?.payment_out?.amount || 0),

          customersActive: Number(data?.active?.customers || 0),
          suppliersActive: Number(data?.active?.suppliers || 0),
          staffActive: Number(data?.active?.staff || 0),

          recentOrders: data?.recent?.orders || [],
          recentInvoices: data?.recent?.invoices || [],
          recentExpenses: data?.recent?.expenses || [],
        });
      }
    } catch {
      showToast({ type: "error", message: "Failed to load dashboard data" });
    } finally {
      setLoading(false);
    }
  }, [isDeveloper, loadTrend, selectedMonth, showToast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const title = useMemo(() => (isDeveloper ? "System Dashboard" : "Dashboard"), [isDeveloper]);

  const openTrendModal = () => {
    setTrendModalOpen(true);
    setModalTrendRange("7d");
    setModalTrend({
      from: cardTrend.from,
      to: cardTrend.to,
      data: cardTrend.data,
    });
  };

  const handleModalRangeChange = async (nextRange) => {
    setModalTrendRange(nextRange);
    if (nextRange === "custom") return;
    await loadTrend({ range: nextRange }, "modal");
  };

  const handleApplyCustomRange = async () => {
    if (!customDateFrom || !customDateTo) {
      showToast({ type: "error", message: "Select custom from and to dates" });
      return;
    }
    await loadTrend({ range: "custom", date_from: customDateFrom, date_to: customDateTo }, "modal");
  };

  return (
    <>
      {openTarget && <TargetCalculatorModal onClose={() => setOpenTarget(false)} />}

      <Modal
        isOpen={trendModalOpen}
        onClose={() => setTrendModalOpen(false)}
        title="Trend Chart"
        subtitle="Orders, Expenses, Payment Out, Payment In"
        maxWidth="max-w-6xl"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {["7d", "1m", "3m", "6m", "custom"].map((range) => (
              <button
                key={range}
                onClick={() => handleModalRangeChange(range)}
                className={`px-2.5 py-1.5 text-xs rounded-lg border ${
                  modalTrendRange === range
                    ? "bg-teal-50 text-teal-700 border-teal-200"
                    : "bg-white text-gray-500 border-gray-200"
                }`}
              >
                {range === "7d" ? "7D" : range === "1m" ? "1M" : range === "3m" ? "3M" : range === "6m" ? "6M" : "Custom"}
              </button>
            ))}
          </div>

          {modalTrendRange === "custom" && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <Button size="sm" onClick={handleApplyCustomRange}>Apply Custom Range</Button>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-gray-300 bg-white px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <TrendLegend />
              <p className="text-xs text-gray-500">
                {modalTrend.from && modalTrend.to ? `${modalTrend.from} to ${modalTrend.to}` : ""}
              </p>
            </div>

            {modalTrendLoading ? (
              <div className="h-[360px] flex items-center justify-center text-sm text-gray-400">Loading chart...</div>
            ) : (modalTrend.data || []).length === 0 ? (
              <div className="h-[360px] flex items-center justify-center text-sm text-gray-400">No trend data found for selected range.</div>
            ) : (
              <TrendChart data={modalTrend.data} height={360} idPrefix="modal-trend" />
            )}
          </div>
        </div>
      </Modal>

      <div className="relative z-10 mx-auto max-w-7xl h-full flex flex-col">
        <div className="flex justify-between items-start mb-5">
          <div>
            <h1 className="text-3xl font-medium tracking-tight">{title}</h1>
            <p className="text-gray-400 text-sm">Welcome back, {user?.name?.split(" ")[0] || "User"}.</p>
          </div>
          <div className="flex items-center gap-2.5">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:border-teal-400 cursor-pointer"
            />
            {!isDeveloper && (
              <>
                <Button size="sm" variant="secondary" outline icon={CreditCard} onClick={() => setOpenTarget(true)}>
                  Target
                </Button>
              </>
            )}
            <Button size="sm" icon={RefreshCcw} onClick={loadDashboard}>Refresh</Button>
          </div>
        </div>

        {loading ? (
          <DashboardLoadingSkeleton isDeveloper={isDeveloper} />
        ) : isDeveloper ? (
          <div className="space-y-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <StatCard label="Total Businesses" value={dev.businessesTotal} icon={Building2} />
              <StatCard label="Active Businesses" value={dev.businessesActive} icon={Activity} variant="success" />
              <StatCard label="Total Users" value={dev.usersTotal} icon={Users2} />
              <StatCard label="Active Users" value={dev.usersActive} icon={Users} variant="warning" />
              <StatCard label={`Collected (${selectedMonth})`} value={formatNumbers(dev.monthReceived, 2)} icon={Banknote} variant="success" />
              <StatCard label={`Pending (${selectedMonth})`} value={formatNumbers(dev.monthPending, 2)} icon={CreditCard} variant="danger" />
              <StatCard label="Active Subscriptions" value={dev.activeSubscriptions} icon={Receipt} />
              <StatCard label="Expire in 7 Days" value={dev.expiringSoon} icon={Activity} variant="warning" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="rounded-3xl border border-gray-300 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-300 bg-gray-100">
                  <p className="font-medium text-gray-800">Recent SaaS Payments</p>
                  <button onClick={() => navigate("/payments")} className="text-xs font-medium text-teal-600 cursor-pointer">View all</button>
                </div>
                <div className="divide-y divide-gray-200">
                  {dev.recentPayments.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-400">No recent payments.</p>
                  ) : (
                    dev.recentPayments.map((r) => (
                      <div key={r._id} className="flex items-center justify-between px-6 py-3.5">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{r.business_name || "-"}</p>
                          <p className="text-xs text-gray-400">{formatDate(r.payment_date, "DD MMM yyyy")} · {r.plan}</p>
                        </div>
                        <p className="text-sm font-semibold tabular-nums text-emerald-700">{formatNumbers(r.amount, 2)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-gray-300 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-300 bg-gray-100">
                  <p className="font-medium text-gray-800">Recent Subscriptions</p>
                  <button onClick={() => navigate("/subscriptions")} className="text-xs font-medium text-teal-600 cursor-pointer">View all</button>
                </div>
                <div className="divide-y divide-gray-200">
                  {(dev.recentSubscriptions || []).length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-400">No recent records.</p>
                  ) : (
                    (dev.recentSubscriptions || []).map((r) => (
                      <div key={r._id} className="flex items-center justify-between px-6 py-3.5">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{r.business_name || "-"}</p>
                          <p className="text-xs text-gray-400 capitalize">{r.plan || "-"}</p>
                        </div>
                        <p className="text-xs font-semibold tabular-nums text-gray-600 capitalize">{r.status || "-"}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-gray-300 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-300 bg-gray-100">
                  <p className="font-medium text-gray-800">Recent Businesses</p>
                  <button onClick={() => navigate("/businesses")} className="text-xs font-medium text-teal-600 cursor-pointer">View all</button>
                </div>
                <div className="divide-y divide-gray-200">
                  {(dev.recentBusinesses || []).length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-400">No recent businesses.</p>
                  ) : (
                    (dev.recentBusinesses || []).map((r) => (
                      <div key={r._id} className="flex items-center justify-between px-6 py-3.5">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{r.name || "-"}</p>
                          <p className="text-xs text-gray-400">{formatDate(r.registration_date, "DD MMM yyyy")}</p>
                        </div>
                        <p className="text-xs font-semibold tabular-nums text-gray-600">{r.isActive ? "Active" : "Inactive"}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 pb-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-3">Month Overview · {selectedMonth}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
                <StatCard label="Orders" value={ops.monthOrdersCount} icon={FileText} />
                <StatCard label="Invoices" value={ops.monthInvoicesCount} icon={Receipt} variant="success" />
                <StatCard label="Expenses" value={ops.monthExpenseCount} icon={CreditCard} variant="danger" />
                <StatCard label="Payment In" value={ops.monthPaymentInCount} icon={Banknote} variant="success" />
                <StatCard label="Payment Out" value={ops.monthPaymentOutCount} icon={Building2} variant="warning" />
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
              <div className="rounded-3xl border border-gray-300 bg-white xl:col-span-6 overflow-hidden flex flex-col justify-between">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-300 bg-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-800">7-Day Trend</p>
                  </div>
                  <button onClick={openTrendModal} className="text-xs font-medium text-teal-600 cursor-pointer">Open Chart</button>
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div className="px-3 py-2">
                    <TrendLegend />
                  </div>
                  <div className="px-3">
                    {cardTrend.loading ? (
                      <div className="h-[130px] flex items-center justify-center text-sm text-gray-400">Loading chart...</div>
                    ) : (cardTrend.data || []).length === 0 ? (
                      <div className="h-[130px] flex items-center justify-center text-sm text-gray-400">No trend data found.</div>
                    ) : (
                      <TrendChart data={cardTrend.data} idPrefix="card-trend" />
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-gray-300 bg-white overflow-hidden xl:col-span-3">
                <div className="px-5 py-4 border-b border-gray-300 bg-gray-100">
                  <p className="text-sm font-medium text-gray-800">Selected Month Snapshot</p>
                </div>
                <div className="divide-y divide-gray-200">
                  {[
                    { label: "Orders", count: ops.monthOrdersCount, amount: ops.monthOrderAmount, countCls: "text-gray-900" },
                    { label: "Invoices", count: ops.monthInvoicesCount, amount: ops.monthInvoiceAmount, countCls: "text-gray-900" },
                    { label: "Expenses", count: ops.monthExpenseCount, amount: ops.monthExpenseAmount, countCls: "text-rose-500" },
                    { label: "Payment In", count: ops.monthPaymentInCount, amount: ops.monthPaymentInAmount, countCls: "text-emerald-600" },
                    { label: "Payment Out", count: ops.monthPaymentOutCount, amount: ops.monthPaymentOutAmount, countCls: "text-amber-600" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between px-5 py-3">
                      <p className="text-xs text-gray-500">{item.label}</p>
                      <div className="flex items-center gap-5">
                        <p className="text-xs text-gray-400 tabular-nums">{formatNumbers(item.amount, 2)}</p>
                        <p className={`text-sm font-semibold tabular-nums w-4 text-right ${item.countCls}`}>{item.count}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-gray-300 bg-white overflow-hidden xl:col-span-3">
                <div className="px-5 py-4 border-b border-gray-300 bg-gray-100">
                  <p className="text-sm font-medium text-gray-800">Active Entities</p>
                </div>
                <div className="divide-y divide-gray-200">
                  {[
                    { label: "Customers", value: ops.customersActive, icon: Users, iconBg: "bg-teal-100/60", iconText: "text-teal-700" },
                    { label: "Suppliers", value: ops.suppliersActive, icon: Building2, iconBg: "bg-amber-100/60", iconText: "text-amber-700" },
                    { label: "Staff", value: ops.staffActive, icon: Users2, iconBg: "bg-emerald-100/60", iconText: "text-emerald-700" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-4 px-5 py-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.iconBg} ${item.iconText}`}>
                        <item.icon size={18} strokeWidth={1.5} />
                      </div>
                      <p className="text-sm text-gray-500 flex-1">{item.label}</p>
                      <p className="text-2xl font-semibold text-gray-900 tabular-nums">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="rounded-3xl border border-gray-300 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-300 bg-gray-100">
                  <p className="font-medium text-gray-800">Recent Orders</p>
                  <button onClick={() => navigate("/orders")} className="text-xs font-medium text-teal-600 cursor-pointer">View all</button>
                </div>
                <div className="divide-y divide-gray-200">
                  {ops.recentOrders.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-400">No recent orders.</p>
                  ) : (
                    ops.recentOrders.map((r) => (
                      <div key={r._id} className="flex items-center justify-between px-6 py-3.5">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{r.customer_name}</p>
                          <p className="text-xs text-gray-400">{formatDate(r.date, "DD MMM yyyy")}</p>
                        </div>
                        <p className="text-sm font-semibold tabular-nums text-gray-900">{formatNumbers(r.total_amount, 2)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-gray-300 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-300 bg-gray-100">
                  <p className="font-medium text-gray-800">Recent Invoices</p>
                  <button onClick={() => navigate("/invoices")} className="text-xs font-medium text-teal-600 cursor-pointer">View all</button>
                </div>
                <div className="divide-y divide-gray-200">
                  {ops.recentInvoices.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-400">No recent invoices.</p>
                  ) : (
                    ops.recentInvoices.map((r) => (
                      <div key={r._id} className="flex items-center justify-between px-6 py-3.5">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{r.customer_name}</p>
                          <p className="text-xs text-gray-400">{formatDate(r.invoice_date, "DD MMM yyyy")}</p>
                        </div>
                        <p className="text-sm font-semibold tabular-nums text-gray-900">{formatNumbers(r.total_amount, 2)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-gray-300 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-300 bg-gray-100">
                  <p className="font-medium text-gray-800">Recent Expenses</p>
                  <button onClick={() => navigate("/expenses")} className="text-xs font-medium text-teal-600 cursor-pointer">View all</button>
                </div>
                <div className="divide-y divide-gray-200">
                  {ops.recentExpenses.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-400">No recent expenses.</p>
                  ) : (
                    ops.recentExpenses.map((r) => (
                      <div key={r._id} className="flex items-center justify-between px-6 py-3.5">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{r.item_name || "-"}</p>
                          <p className="text-xs text-gray-400 capitalize">{r.expense_type || "-"}</p>
                        </div>
                        <p className="text-sm font-semibold tabular-nums text-rose-500">{formatNumbers(r.amount, 2)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
