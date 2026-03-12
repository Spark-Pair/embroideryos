import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Banknote, Building2, CreditCard, FileText, Receipt, RefreshCcw, Users, Users2, } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, } from "recharts";
import useAuth from "../hooks/useAuth";
import Button from "../components/Button";
import Modal from "../components/Modal";
import StatCard from "../components/StatCard";
import Select from "../components/Select";
import Input from "../components/Input";
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
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
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
  const [monthSummaryType, setMonthSummaryType] = useState("summary");
  const [monthSummarySearch, setMonthSummarySearch] = useState("");
  const lastLoadRef = useRef({ month: "", at: 0 });

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
    monthStaffRecordsCount: 0,
    monthStaffRecordsAmount: 0,
    monthCrpRecordsCount: 0,
    monthCrpRecordsAmount: 0,
    monthStaffSummary: {
      staff_count: 0,
      active_staff_count: 0,
      staff_with_records: 0,
      record_count: 0,
      work_amount: 0,
      arrears_amount: 0,
      allowance_amount: 0,
      bonus_qty: 0,
      bonus_amount: 0,
      deduction_amount: 0,
      deduction_advance_amount: 0,
      deduction_payment_amount: 0,
      deduction_adjustment_amount: 0,
      balance_amount: 0,
      by_staff: [],
    },
    monthCustomerSummary: {
      customer_count: 0,
      active_customer_count: 0,
      customer_with_activity: 0,
      billed_amount: 0,
      received_amount: 0,
      arrears_amount: 0,
      balance_amount: 0,
      by_customer: [],
    },
    monthSupplierSummary: {
      supplier_count: 0,
      active_supplier_count: 0,
      supplier_with_activity: 0,
      expense_amount: 0,
      paid_amount: 0,
      arrears_amount: 0,
      balance_amount: 0,
      by_supplier: [],
    },
    monthCrpStaffSummary: {
      staff_count: 0,
      active_staff_count: 0,
      staff_with_activity: 0,
      record_count: 0,
      work_amount: 0,
      arrears_amount: 0,
      deduction_amount: 0,
      balance_amount: 0,
      by_staff: [],
    },

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
          monthStaffRecordsCount: Number(data?.month?.staff_records?.count || 0),
          monthStaffRecordsAmount: Number(data?.month?.staff_records?.amount || 0),
          monthCrpRecordsCount: Number(data?.month?.crp_records?.count || 0),
          monthCrpRecordsAmount: Number(data?.month?.crp_records?.amount || 0),
          monthStaffSummary: {
            staff_count: Number(data?.month?.staff_summary?.staff_count || 0),
            active_staff_count: Number(data?.month?.staff_summary?.active_staff_count || 0),
            staff_with_records: Number(data?.month?.staff_summary?.staff_with_records || 0),
            record_count: Number(data?.month?.staff_summary?.record_count || 0),
            work_amount: Number(data?.month?.staff_summary?.work_amount || 0),
            arrears_amount: Number(data?.month?.staff_summary?.arrears_amount || 0),
            allowance_amount: Number(data?.month?.staff_summary?.allowance_amount || 0),
            bonus_qty: Number(data?.month?.staff_summary?.bonus_qty || 0),
            bonus_amount: Number(data?.month?.staff_summary?.bonus_amount || 0),
            deduction_amount: Number(data?.month?.staff_summary?.deduction_amount || 0),
            deduction_advance_amount: Number(data?.month?.staff_summary?.deduction_advance_amount || 0),
            deduction_payment_amount: Number(data?.month?.staff_summary?.deduction_payment_amount || 0),
            deduction_adjustment_amount: Number(data?.month?.staff_summary?.deduction_adjustment_amount || 0),
            balance_amount: Number(data?.month?.staff_summary?.balance_amount || 0),
            by_staff: Array.isArray(data?.month?.staff_summary?.by_staff)
              ? data.month.staff_summary.by_staff.map((row) => ({
                staff_id: String(row?.staff_id || ""),
                staff_name: row?.staff_name || "-",
                is_active: Boolean(row?.is_active),
                records: Number(row?.records || 0),
                work_amount: Number(row?.work_amount || 0),
                arrears_amount: Number(row?.arrears_amount || 0),
                allowance_amount: Number(row?.allowance_amount || 0),
                bonus_qty: Number(row?.bonus_qty || 0),
                bonus_amount: Number(row?.bonus_amount || 0),
                deduction_amount: Number(row?.deduction_amount || 0),
                deduction_advance_amount: Number(row?.deduction_advance_amount || 0),
                deduction_payment_amount: Number(row?.deduction_payment_amount || 0),
                deduction_adjustment_amount: Number(row?.deduction_adjustment_amount || 0),
                balance_amount: Number(row?.balance_amount || 0),
              }))
              : [],
          },
          monthCustomerSummary: {
            customer_count: Number(data?.month?.customer_summary?.customer_count || 0),
            active_customer_count: Number(data?.month?.customer_summary?.active_customer_count || 0),
            customer_with_activity: Number(data?.month?.customer_summary?.customer_with_activity || 0),
            billed_amount: Number(data?.month?.customer_summary?.billed_amount || 0),
            received_amount: Number(data?.month?.customer_summary?.received_amount || 0),
            arrears_amount: Number((data?.month?.customer_summary?.arrears_amount ?? data?.month?.customer_summary?.opening_amount) || 0),
            balance_amount: Number(data?.month?.customer_summary?.balance_amount || 0),
            by_customer: Array.isArray(data?.month?.customer_summary?.by_customer)
              ? data.month.customer_summary.by_customer.map((row) => ({
                customer_id: String(row?.customer_id || ""),
                customer_name: row?.customer_name || "-",
                is_active: Boolean(row?.is_active),
                arrears_amount: Number((row?.arrears_amount ?? row?.opening_amount) || 0),
                billed_amount: Number(row?.billed_amount || 0),
                received_amount: Number(row?.received_amount || 0),
                balance_amount: Number(row?.balance_amount || 0),
              }))
              : [],
          },
          monthSupplierSummary: {
            supplier_count: Number(data?.month?.supplier_summary?.supplier_count || 0),
            active_supplier_count: Number(data?.month?.supplier_summary?.active_supplier_count || 0),
            supplier_with_activity: Number(data?.month?.supplier_summary?.supplier_with_activity || 0),
            expense_amount: Number(data?.month?.supplier_summary?.expense_amount || 0),
            paid_amount: Number(data?.month?.supplier_summary?.paid_amount || 0),
            arrears_amount: Number((data?.month?.supplier_summary?.arrears_amount ?? data?.month?.supplier_summary?.opening_amount) || 0),
            balance_amount: Number(data?.month?.supplier_summary?.balance_amount || 0),
            by_supplier: Array.isArray(data?.month?.supplier_summary?.by_supplier)
              ? data.month.supplier_summary.by_supplier.map((row) => ({
                supplier_id: String(row?.supplier_id || ""),
                supplier_name: row?.supplier_name || "-",
                is_active: Boolean(row?.is_active),
                arrears_amount: Number((row?.arrears_amount ?? row?.opening_amount) || 0),
                expense_amount: Number(row?.expense_amount || 0),
                paid_amount: Number(row?.paid_amount || 0),
                balance_amount: Number(row?.balance_amount || 0),
              }))
              : [],
          },
          monthCrpStaffSummary: {
            staff_count: Number(data?.month?.crp_staff_summary?.staff_count || 0),
            active_staff_count: Number(data?.month?.crp_staff_summary?.active_staff_count || 0),
            staff_with_activity: Number(data?.month?.crp_staff_summary?.staff_with_activity || 0),
            record_count: Number(data?.month?.crp_staff_summary?.record_count || 0),
            work_amount: Number(data?.month?.crp_staff_summary?.work_amount || 0),
            arrears_amount: Number(data?.month?.crp_staff_summary?.arrears_amount || 0),
            deduction_amount: Number(data?.month?.crp_staff_summary?.deduction_amount || 0),
            balance_amount: Number(data?.month?.crp_staff_summary?.balance_amount || 0),
            by_staff: Array.isArray(data?.month?.crp_staff_summary?.by_staff)
              ? data.month.crp_staff_summary.by_staff.map((row) => ({
                staff_id: String(row?.staff_id || ""),
                staff_name: row?.staff_name || "-",
                is_active: Boolean(row?.is_active),
                records: Number(row?.records || 0),
                arrears_amount: Number(row?.arrears_amount || 0),
                work_amount: Number(row?.work_amount || 0),
                deduction_amount: Number(row?.deduction_amount || 0),
                balance_amount: Number(row?.balance_amount || 0),
              }))
              : [],
          },

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
    const now = Date.now();
    if (
      lastLoadRef.current.month === selectedMonth &&
      now - lastLoadRef.current.at < 1000
    ) {
      return;
    }
    lastLoadRef.current = { month: selectedMonth, at: now };
    loadDashboard();
  }, [loadDashboard, selectedMonth]);

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

  const summarySearch = monthSummarySearch.trim().toLowerCase();
  const filteredStaffSummaryRows = (ops.monthStaffSummary.by_staff || []).filter((row) =>
    String(row?.staff_name || "").toLowerCase().includes(summarySearch)
  );
  const filteredCustomerSummaryRows = (ops.monthCustomerSummary.by_customer || []).filter((row) =>
    String(row?.customer_name || "").toLowerCase().includes(summarySearch)
  );
  const filteredSupplierSummaryRows = (ops.monthSupplierSummary.by_supplier || []).filter((row) =>
    String(row?.supplier_name || "").toLowerCase().includes(summarySearch)
  );
  const filteredCrpSummaryRows = (ops.monthCrpStaffSummary.by_staff || []).filter((row) =>
    String(row?.staff_name || "").toLowerCase().includes(summarySearch)
  );
  const combinedSummaryRows = useMemo(() => {
    const rows = [
      {
        entity: "Staff",
        total_count: Number(ops.monthStaffSummary.record_count || 0),
        work_amount: Number(ops.monthStaffSummary.work_amount || 0),
        arrears_amount: Number(ops.monthStaffSummary.arrears_amount || 0),
        inflow_amount: Number(ops.monthStaffSummary.allowance_amount || 0) + Number(ops.monthStaffSummary.bonus_amount || 0),
        outflow_amount: Number(ops.monthStaffSummary.deduction_amount || 0),
        balance_amount: Number(ops.monthStaffSummary.balance_amount || 0),
      },
      {
        entity: "Customer",
        total_count: Number(ops.monthCustomerSummary.customer_with_activity || 0),
        work_amount: Number(ops.monthCustomerSummary.billed_amount || 0),
        arrears_amount: Number(ops.monthCustomerSummary.arrears_amount || 0),
        inflow_amount: Number(ops.monthCustomerSummary.received_amount || 0),
        outflow_amount: 0,
        balance_amount: Number(ops.monthCustomerSummary.balance_amount || 0),
      },
      {
        entity: "Supplier",
        total_count: Number(ops.monthSupplierSummary.supplier_with_activity || 0),
        work_amount: Number(ops.monthSupplierSummary.expense_amount || 0),
        arrears_amount: Number(ops.monthSupplierSummary.arrears_amount || 0),
        inflow_amount: 0,
        outflow_amount: Number(ops.monthSupplierSummary.paid_amount || 0),
        balance_amount: Number(ops.monthSupplierSummary.balance_amount || 0),
      },
      {
        entity: "CRP Staff",
        total_count: Number(ops.monthCrpStaffSummary.record_count || 0),
        work_amount: Number(ops.monthCrpStaffSummary.work_amount || 0),
        arrears_amount: Number(ops.monthCrpStaffSummary.arrears_amount || 0),
        inflow_amount: 0,
        outflow_amount: Number(ops.monthCrpStaffSummary.deduction_amount || 0),
        balance_amount: Number(ops.monthCrpStaffSummary.balance_amount || 0),
      },
    ];

    const totals = rows.reduce(
      (acc, row) => ({
        total_count: acc.total_count + row.total_count,
        work_amount: acc.work_amount + row.work_amount,
        arrears_amount: acc.arrears_amount + row.arrears_amount,
        inflow_amount: acc.inflow_amount + row.inflow_amount,
        outflow_amount: acc.outflow_amount + row.outflow_amount,
        balance_amount: acc.balance_amount + row.balance_amount,
      }),
      { total_count: 0, work_amount: 0, arrears_amount: 0, inflow_amount: 0, outflow_amount: 0, balance_amount: 0 }
    );

    return { rows, totals };
  }, [ops]);

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
          <div className="flex items-center gap-3">
            <div className="w-[180px]">
              <Input
                type="month"
                name="selected_month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="py-2.5"
                rounded="2xl"
              />
            </div>
            {!isDeveloper && (
              <>
                <Button size="md" className="" variant="secondary" outline icon={CreditCard} onClick={() => setOpenTarget(true)}>
                  Target
                </Button>
              </>
            )}
            {user?.role === "admin" && (
              <Button size="md" className="" variant="secondary" outline icon={Users2} onClick={() => navigate("/users")}>
                Users
              </Button>
            )}
            <Button size="md" className="" icon={RefreshCcw} onClick={loadDashboard}>Refresh</Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <DashboardLoadingSkeleton isDeveloper={isDeveloper} />
          ) : isDeveloper ? (
            <div className="space-y-6 pb-6">
            <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-4">
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
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                <StatCard label="Orders" value={ops.monthOrdersCount} icon={FileText} />
                <StatCard label="Invoices" value={ops.monthInvoicesCount} icon={Receipt} variant="success" />
                <StatCard label="Expenses" value={ops.monthExpenseCount} icon={CreditCard} variant="danger" />
                <StatCard label="Payment In" value={ops.monthPaymentInCount} icon={Banknote} variant="success" />
                <StatCard label="Payment Out" value={ops.monthPaymentOutCount} icon={Building2} variant="warning" />
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
              <div className="rounded-3xl border border-gray-300 bg-white xl:col-span-8 overflow-hidden flex flex-col justify-between">
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

              <div className="rounded-3xl border border-gray-300 bg-white overflow-hidden xl:col-span-4">
                <div className="px-5 py-4 border-b border-gray-300 bg-gray-100">
                  <p className="text-sm font-medium text-gray-800">Selected Month Snapshot</p>
                </div>
                <div className="divide-y divide-gray-200">
                  {[
                    { label: "Orders", count: ops.monthOrdersCount, amount: ops.monthOrderAmount, countCls: "text-gray-900" },
                    { label: "Invoices", count: ops.monthInvoicesCount, amount: ops.monthInvoiceAmount, countCls: "text-gray-900" },
                    { label: "Staff Records", count: ops.monthStaffRecordsCount, amount: ops.monthStaffRecordsAmount, countCls: "text-indigo-700" },
                    { label: "CRP Records", count: ops.monthCrpRecordsCount, amount: ops.monthCrpRecordsAmount, countCls: "text-cyan-700" },
                    { label: "Expenses", count: ops.monthExpenseCount, amount: ops.monthExpenseAmount, countCls: "text-rose-500" },
                    { label: "Payment In", count: ops.monthPaymentInCount, amount: ops.monthPaymentInAmount, countCls: "text-emerald-600" },
                    { label: "Payment Out (Supplier + Staff)", count: ops.monthPaymentOutCount, amount: ops.monthPaymentOutAmount, countCls: "text-amber-600" },
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
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
              <div className="rounded-3xl border border-gray-300 bg-white overflow-hidden xl:col-span-12">
                <div className="px-5 py-4 border-b border-gray-300 bg-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Month Summary ({selectedMonth})</p>
                    <p className="text-xs text-gray-500">
                      {monthSummaryType === "summary" && "Combined summary of Staff, Customer, Supplier and CRP"}
                      {monthSummaryType === "staff" && `Employees: ${ops.monthStaffSummary.staff_count} · Active: ${ops.monthStaffSummary.active_staff_count}`}
                      {monthSummaryType === "customer" && `Customers: ${ops.monthCustomerSummary.customer_count} · Active: ${ops.monthCustomerSummary.active_customer_count} · Arrears = last month balance (0 => opening)`}
                      {monthSummaryType === "supplier" && `Suppliers: ${ops.monthSupplierSummary.supplier_count} · Active: ${ops.monthSupplierSummary.active_supplier_count} · Arrears = last month balance (0 => opening)`}
                      {monthSummaryType === "crp" && `CRP Staff: ${ops.monthCrpStaffSummary.staff_count} · Active: ${ops.monthCrpStaffSummary.active_staff_count}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-[220px]">
                      <Input
                        name="month_summary_search"
                        required={false}
                        value={monthSummarySearch}
                        onChange={(e) => setMonthSummarySearch(e.target.value)}
                        placeholder="Search by name"
                        showClear
                        className="py-2"
                      />
                    </div>
                    <div className="w-[180px]">
                      <Select
                        value={monthSummaryType}
                        onChange={setMonthSummaryType}
                        options={[
                          { label: "Summary", value: "summary" },
                          { label: "Staff", value: "staff" },
                          { label: "Customer", value: "customer" },
                          { label: "Supplier", value: "supplier" },
                          { label: "CRP Staff", value: "crp" },
                        ]}
                        placeholder="Select Summary"
                      />
                    </div>
                  </div>
                </div>

                <div className="max-h-[460px] overflow-auto">
                  {monthSummaryType === "summary" && (
                    <table className="w-full text-left border-collapse font-medium">
                      <thead className="sticky top-0 z-10 bg-gray-200/95 boder-t border-b border-gray-300">
                        <tr className="text-xs uppercase tracking-wide text-gray-500">
                          <th className="px-4 py-2.5 font-semibold">Entity</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Count</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Work / Amount</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Arrears</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Inflow</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Outflow</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-300">
                        {combinedSummaryRows.rows.map((row) => (
                          <tr key={row.entity} className="hover:bg-gray-50/70">
                            <td className="px-4 py-2.5">{row.entity}</td>
                            <td className="px-4 py-2.5 text-sm text-right tabular-nums text-gray-700">{formatNumbers(row.total_count, 0)}</td>
                            <td className="px-4 py-2.5 text-sm text-right tabular-nums text-gray-900">{formatNumbers(row.work_amount, 2)}</td>
                            <td className="px-4 py-2.5 text-sm text-right tabular-nums text-amber-700">{formatNumbers(row.arrears_amount, 2)}</td>
                            <td className="px-4 py-2.5 text-sm text-right tabular-nums text-emerald-700">{formatNumbers(row.inflow_amount, 2)}</td>
                            <td className="px-4 py-2.5 text-sm text-right tabular-nums text-rose-600">{formatNumbers(row.outflow_amount, 2)}</td>
                            <td className={`px-4 py-2.5 text-sm text-right tabular-nums font-semibold ${row.balance_amount < 0 ? "text-rose-600" : "text-teal-700"}`}>{formatNumbers(row.balance_amount, 2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="sticky bottom-0 z-10">
                        <tr className="bg-gray-200/95 border-t border-gray-300">
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">Grand Total</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums">{formatNumbers(combinedSummaryRows.totals.total_count, 0)}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums text-gray-900">{formatNumbers(combinedSummaryRows.totals.work_amount, 2)}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums text-amber-700">{formatNumbers(combinedSummaryRows.totals.arrears_amount, 2)}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums text-emerald-700">{formatNumbers(combinedSummaryRows.totals.inflow_amount, 2)}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums text-rose-600">{formatNumbers(combinedSummaryRows.totals.outflow_amount, 2)}</td>
                          <td className={`px-4 py-3 text-sm text-right font-semibold tabular-nums ${combinedSummaryRows.totals.balance_amount < 0 ? "text-rose-600" : "text-teal-700"}`}>{formatNumbers(combinedSummaryRows.totals.balance_amount, 2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}

                  {monthSummaryType === "staff" && (
                    <table className="w-full text-left border-collapse font-medium">
                      <thead className="sticky top-0 z-10 bg-gray-200/95 boder-t border-b border-gray-300">
                        <tr className="text-xs uppercase tracking-wide text-gray-500">
                          <th className="px-4 py-2.5 font-semibold">Staff</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Records</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Work</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Arrears</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Allowance</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Bonus</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Deductions</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-300">
                        {filteredStaffSummaryRows.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">
                              {ops.monthStaffSummary.by_staff.length === 0 ? "No staff summary available for selected month." : "No matching records found."}
                            </td>
                          </tr>
                        ) : (
                          filteredStaffSummaryRows.map((row) => (
                            <tr key={row.staff_id || row.staff_name} className="hover:bg-gray-50/70">
                              <td className="px-4 py-2.5">{row.staff_name}</td>
                              <td className="px-4 py-2.5 text-sm text-right tabular-nums text-gray-700">{formatNumbers(row.records, 0)}</td>
                              <td className="px-4 py-2.5 text-sm text-right tabular-nums text-gray-800">{formatNumbers(row.work_amount, 2)}</td>
                              <td className="px-4 py-2.5 text-sm text-right tabular-nums">{formatNumbers(row.arrears_amount, 2)}</td>
                              <td className="px-4 py-2.5 text-sm text-right tabular-nums text-indigo-700">{formatNumbers(row.allowance_amount)}</td>
                              <td className="px-4 py-2.5 text-sm text-right tabular-nums text-emerald-700">{formatNumbers(row.bonus_amount)} ({formatNumbers(row.bonus_qty, 1)})</td>
                              <td className="px-4 py-2.5 text-xs text-right tabular-nums text-rose-600">{formatNumbers(row.deduction_amount, 2)}</td>
                              <td className="px-4 py-2.5 text-sm text-right tabular-nums font-semibold text-teal-700">{formatNumbers(row.balance_amount, 2)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot className="sticky bottom-0 z-10">
                        <tr className="bg-gray-200/95 border-t border-gray-300">
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">Total</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums text-gray-800">{formatNumbers(ops.monthStaffSummary.record_count, 0)}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums text-gray-900">{formatNumbers(ops.monthStaffSummary.work_amount, 2)}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums text-amber-700">{formatNumbers(ops.monthStaffSummary.arrears_amount, 2)}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums text-indigo-700">{formatNumbers(ops.monthStaffSummary.allowance_amount)}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums text-emerald-700">
                            {formatNumbers(ops.monthStaffSummary.bonus_amount)} ({formatNumbers(ops.monthStaffSummary.bonus_qty, 1)})
                          </td>
                          <td className="px-4 py-3 text-xs text-right font-semibold tabular-nums text-rose-600">{formatNumbers(ops.monthStaffSummary.deduction_amount, 2)}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums text-teal-700">{formatNumbers(ops.monthStaffSummary.balance_amount, 2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}

                  {monthSummaryType === "customer" && (
                    <table className="w-full text-left border-collapse font-medium">
                      <thead className="sticky top-0 z-10 bg-gray-200/95 boder-t border-b border-gray-300">
                        <tr className="text-xs uppercase tracking-wide text-gray-500">
                          <th className="px-4 py-2.5 font-semibold">Customer</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Arrears</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Billed</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Received</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-300">
                        {filteredCustomerSummaryRows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                              {ops.monthCustomerSummary.by_customer.length === 0 ? "No customer summary available for selected month." : "No matching records found."}
                            </td>
                          </tr>
                        ) : (
                          filteredCustomerSummaryRows.map((row) => (
                            <tr key={row.customer_id || row.customer_name} className="hover:bg-gray-50/70">
                              <td className="px-4 py-2.5">{row.customer_name}</td>
                              <td className="px-4 py-2.5 text-sm text-right tabular-nums text-amber-700">{formatNumbers(row.arrears_amount, 2)}</td>
                              <td className="px-4 py-2.5 text-sm text-right tabular-nums text-indigo-700">{formatNumbers(row.billed_amount, 2)}</td>
                              <td className="px-4 py-2.5 text-sm text-right tabular-nums text-emerald-700">{formatNumbers(row.received_amount, 2)}</td>
                              <td className={`px-4 py-2.5 text-sm text-right tabular-nums font-semibold ${row.balance_amount < 0 ? "text-rose-600" : "text-teal-700"}`}>{formatNumbers(row.balance_amount, 2)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot className="sticky bottom-0 z-10">
                        <tr className="bg-gray-200/95 border-t border-gray-300">
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">Total</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums text-amber-700">{formatNumbers(ops.monthCustomerSummary.arrears_amount, 2)}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums text-indigo-700">{formatNumbers(ops.monthCustomerSummary.billed_amount, 2)}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums text-emerald-700">{formatNumbers(ops.monthCustomerSummary.received_amount, 2)}</td>
                          <td className={`px-4 py-3 text-sm text-right font-semibold tabular-nums ${ops.monthCustomerSummary.balance_amount < 0 ? "text-rose-600" : "text-teal-700"}`}>{formatNumbers(ops.monthCustomerSummary.balance_amount, 2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}

                  {monthSummaryType === "supplier" && (
                    <table className="w-full text-left border-collapse font-medium">
                      <thead className="sticky top-0 z-10 bg-gray-200/95 boder-t border-b border-gray-300">
                        <tr className="text-xs uppercase tracking-wide text-gray-500">
                          <th className="px-4 py-2.5 font-semibold">Supplier</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Arrears</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Expense</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Paid</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-300">
                        {filteredSupplierSummaryRows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                              {ops.monthSupplierSummary.by_supplier.length === 0 ? "No supplier summary available for selected month." : "No matching records found."}
                            </td>
                          </tr>
                        ) : (
                          filteredSupplierSummaryRows.map((row) => (
                            <tr key={row.supplier_id || row.supplier_name} className="hover:bg-gray-50/70">
                              <td className="px-4 py-2.5">{row.supplier_name}</td>
                              <td className="px-4 py-2.5 text-sm text-right tabular-nums text-amber-700">{formatNumbers(row.arrears_amount, 2)}</td>
                              <td className="px-4 py-2.5 text-sm text-right tabular-nums text-rose-600">{formatNumbers(row.expense_amount, 2)}</td>
                              <td className="px-4 py-2.5 text-sm text-right tabular-nums text-emerald-700">{formatNumbers(row.paid_amount, 2)}</td>
                              <td className={`px-4 py-2.5 text-sm text-right tabular-nums font-semibold ${row.balance_amount < 0 ? "text-rose-600" : "text-teal-700"}`}>{formatNumbers(row.balance_amount, 2)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot className="sticky bottom-0 z-10">
                        <tr className="bg-gray-200/95 border-t border-gray-300">
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">Total</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums text-amber-700">{formatNumbers(ops.monthSupplierSummary.arrears_amount, 2)}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums text-rose-600">{formatNumbers(ops.monthSupplierSummary.expense_amount, 2)}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums text-emerald-700">{formatNumbers(ops.monthSupplierSummary.paid_amount, 2)}</td>
                          <td className={`px-4 py-3 text-sm text-right font-semibold tabular-nums ${ops.monthSupplierSummary.balance_amount < 0 ? "text-rose-600" : "text-teal-700"}`}>{formatNumbers(ops.monthSupplierSummary.balance_amount, 2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}

                  {monthSummaryType === "crp" && (
                    <table className="w-full text-left border-collapse font-medium">
                      <thead className="sticky top-0 z-10 bg-gray-200/95 boder-t border-b border-gray-300">
                        <tr className="text-xs uppercase tracking-wide text-gray-500">
                          <th className="px-4 py-2.5 font-semibold">Staff</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Records</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Arrears</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Work</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Deduction</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-300">
                        {filteredCrpSummaryRows.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                              {ops.monthCrpStaffSummary.by_staff.length === 0 ? "No CRP staff summary available for selected month." : "No matching records found."}
                            </td>
                          </tr>
                        ) : (
                          filteredCrpSummaryRows.map((row) => (
                            <tr key={row.staff_id || row.staff_name} className="hover:bg-gray-50/70">
                              <td className="px-4 py-2.5">{row.staff_name}</td>
                              <td className="px-4 py-2.5 text-sm text-right tabular-nums text-gray-700">{formatNumbers(row.records, 0)}</td>
                              <td className="px-4 py-2.5 text-sm text-right tabular-nums">{formatNumbers(row.arrears_amount, 2)}</td>
                              <td className="px-4 py-2.5 text-sm text-right tabular-nums text-indigo-700">{formatNumbers(row.work_amount, 2)}</td>
                              <td className="px-4 py-2.5 text-sm text-right tabular-nums text-rose-600">{formatNumbers(row.deduction_amount, 2)}</td>
                              <td className={`px-4 py-2.5 text-sm text-right tabular-nums font-semibold ${row.balance_amount < 0 ? "text-rose-600" : "text-teal-700"}`}>{formatNumbers(row.balance_amount, 2)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot className="sticky bottom-0 z-10">
                        <tr className="bg-gray-200/95 border-t border-gray-300">
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">Total</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums">{formatNumbers(ops.monthCrpStaffSummary.record_count, 0)}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums">{formatNumbers(ops.monthCrpStaffSummary.arrears_amount, 2)}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums text-indigo-700">{formatNumbers(ops.monthCrpStaffSummary.work_amount, 2)}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums text-rose-600">{formatNumbers(ops.monthCrpStaffSummary.deduction_amount, 2)}</td>
                          <td className={`px-4 py-3 text-sm text-right font-semibold tabular-nums ${ops.monthCrpStaffSummary.balance_amount < 0 ? "text-rose-600" : "text-teal-700"}`}>{formatNumbers(ops.monthCrpStaffSummary.balance_amount, 2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
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
      </div>
    </>
  );
}
