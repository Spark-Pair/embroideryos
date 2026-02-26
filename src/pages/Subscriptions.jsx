import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Repeat, Crown, ShieldCheck, Clock3, AlertTriangle, Plus } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import TableToolbar from "../components/table/TableToolbar";
import FilterDrawer from "../components/FilterDrawer";
import TableSkeleton from "../components/table/TableLoader";
import SubscriptionRow from "../components/Subscriptions/SubscriptionRow";
import SubscriptionDetailsModal from "../components/Subscriptions/SubscriptionDetailsModal";
import SubscriptionFormModal from "../components/Subscriptions/SubscriptionFormModal";
import Modal from "../components/Modal";
import Select from "../components/Select";
import Button from "../components/Button";
import { fetchPlans } from "../api/subscription";
import { fetchBusinesses } from "../api/business";
import {
  createSubscription,
  fetchSubscriptions,
  renewSubscription,
  updateSubscription,
} from "../api/subscription.admin";
import { useToast } from "../context/ToastContext";

const DEFAULT_PAGINATION = {
  currentPage: 1,
  totalPages: 1,
  totalItems: 0,
  itemsPerPage: 30,
};

export default function Subscriptions() {
  const { showToast } = useToast();
  const [plans, setPlans] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ plan: "", status: "", name: "" });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [detailsModal, setDetailsModal] = useState({ isOpen: false, data: null });
  const [formModal, setFormModal] = useState({ isOpen: false, data: null });
  const [createModal, setCreateModal] = useState({ isOpen: false, businessId: "", plan: "trial" });
  const [renewModal, setRenewModal] = useState({ isOpen: false, id: "", plan: "trial" });

  const tableScrollRef = useRef(null);

  const loadPlans = useCallback(async () => {
    try {
      const res = await fetchPlans();
      setPlans(res?.data || []);
    } catch {
      setPlans([]);
    }
  }, []);

  const loadSubscriptions = useCallback(async (page = 1, filterParams = filters) => {
    try {
      setLoading(true);
      const res = await fetchSubscriptions({
        page,
        limit: 30,
        plan: filterParams.plan,
        status: filterParams.status,
      });

      const raw = res?.data || [];
      const nameFilter = filterParams.name?.trim().toLowerCase();
      const filtered = nameFilter
        ? raw.filter((row) => (row.business_name || "").toLowerCase().includes(nameFilter))
        : raw;

      setSubscriptions(filtered);
      setPagination(res.pagination || DEFAULT_PAGINATION);
    } catch (err) {
      showToast({ type: "error", message: err.response?.data?.message || "Failed to load subscriptions" });
    } finally {
      setLoading(false);
    }
  }, [filters, showToast]);

  const loadBusinesses = useCallback(async () => {
    try {
      const res = await fetchBusinesses({ page: 1, limit: 5000 });
      setBusinesses(res?.data || []);
    } catch {
      setBusinesses([]);
    }
  }, []);

  useEffect(() => {
    loadPlans();
    loadBusinesses();
  }, [loadPlans, loadBusinesses]);

  useEffect(() => {
    loadSubscriptions(1, filters);
  }, [loadSubscriptions, filters]);

  useEffect(() => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [pagination.currentPage]);

  const stats = useMemo(() => {
    const total = subscriptions.length;
    const active = subscriptions.filter((s) => s.status === "active").length;
    const trial = subscriptions.filter((s) => s.status === "trial").length;
    const alert = subscriptions.filter((s) => s.status === "past_due" || s.status === "expired").length;
    return { total, active, trial, alert };
  }, [subscriptions]);

  const handlePageChange = (page) => loadSubscriptions(page);

  const handleApplyFilters = () => {
    loadSubscriptions(1, filters);
    setIsFilterOpen(false);
  };

  const handleResetFilters = () => {
    const reset = { plan: "", status: "", name: "" };
    setFilters(reset);
    loadSubscriptions(1, reset);
    setIsFilterOpen(false);
  };

  const filterConfig = [
    {
      label: "Business Name",
      placeholder: "Search business",
      type: "text",
      value: filters.name,
      onChange: (e) => setFilters((p) => ({ ...p, name: e.target.value })),
    },
    {
      label: "Plan",
      type: "select",
      value: filters.plan,
      options: [
        { label: "All", value: "" },
        ...plans.map((plan) => ({ label: plan.name, value: plan.id })),
      ],
      onChange: (val) => setFilters((p) => ({ ...p, plan: val })),
    },
    {
      label: "Status",
      type: "select",
      value: filters.status,
      options: [
        { label: "All", value: "" },
        { label: "Trial", value: "trial" },
        { label: "Active", value: "active" },
        { label: "Past Due", value: "past_due" },
        { label: "Canceled", value: "canceled" },
        { label: "Expired", value: "expired" },
      ],
      onChange: (val) => setFilters((p) => ({ ...p, status: val })),
    },
  ];

  return (
    <>
      <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col">
        <PageHeader
          title="Subscriptions"
          subtitle="Manage plans, billing status, and upgrades."
          actionLabel="Add Subscription"
          actionIcon={Plus}
          onAction={() => setCreateModal({ isOpen: true, businessId: "", plan: plans?.[0]?.id || "trial" })}
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <StatCard label="Total" value={stats.total} icon={Repeat} />
          <StatCard label="Active" value={stats.active} icon={ShieldCheck} variant="success" />
          <StatCard label="Trial" value={stats.trial} icon={Clock3} variant="warning" />
          <StatCard label="Attention" value={stats.alert} icon={AlertTriangle} variant="danger" />
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
              <thead className="sticky top-0 z-20 bg-gray-100" style={{ boxShadow: "0 1px 0 0 rgba(209,213,219,1)" }}>
                <tr className="text-sm tracking-wider text-gray-500">
                  <th className="px-7 py-3.5 font-medium">Id</th>
                  <th className="px-7 py-3.5 font-medium">Business</th>
                  <th className="px-7 py-3.5 font-medium">Plan</th>
                  <th className="px-7 py-3.5 font-medium">Status</th>
                  <th className="px-7 py-3.5 font-medium">Expires</th>
                  <th className="px-7 py-3.5 font-medium text-right">Price</th>
                  <th className="px-7 py-3.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              {loading ? (
                <TableSkeleton rows={30} />
              ) : (
                <tbody className="divide-y divide-gray-200">
                  {subscriptions.map((item, index) => (
                    <SubscriptionRow
                      key={item._id}
                      item={item}
                      index={index}
                      startIndex={(pagination.currentPage - 1) * pagination.itemsPerPage}
                      onView={(data) => setDetailsModal({ isOpen: true, data })}
                      onEdit={(data) => setFormModal({ isOpen: true, data })}
                      onRenew={(data) => setRenewModal({ isOpen: true, id: data._id, plan: data.plan || "trial" })}
                    />
                  ))}
                  {subscriptions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-7 py-16 text-center text-sm text-gray-400">
                        No subscriptions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              )}
            </table>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-gray-300 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <Crown className="text-emerald-700" size={18} />
            <h3 className="text-sm font-semibold text-gray-800">Plans</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {plans.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-400">
                No plans data found.
              </div>
            ) : (
              plans.map((plan) => (
                <div key={plan.id} className="rounded-2xl border border-gray-200 p-4 bg-gray-50">
                  <p className="text-sm font-semibold text-gray-800">{plan.name}</p>
                  <p className="text-xs text-gray-500 mt-1">PKR {plan.price} / {plan.durationDays} days</p>
                  <ul className="mt-3 text-xs text-gray-600 space-y-1">
                    <li>Invoice Banner: {plan.features?.invoice_banner ? "Yes" : "No"}</li>
                    <li>Users Limit: {plan.limits?.users ?? "-"}</li>
                  </ul>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <SubscriptionDetailsModal
        isOpen={detailsModal.isOpen}
        onClose={() => setDetailsModal({ isOpen: false, data: null })}
        data={detailsModal.data}
      />

      <SubscriptionFormModal
        isOpen={formModal.isOpen}
        onClose={() => setFormModal({ isOpen: false, data: null })}
        initialData={formModal.data}
        plans={plans}
        onSave={async (payload) => {
          try {
            if (!formModal.data?._id) return;
            await updateSubscription(formModal.data._id, payload);
            showToast({ type: "success", message: "Subscription updated" });
            loadSubscriptions(pagination.currentPage);
          } catch (err) {
            showToast({ type: "error", message: err.response?.data?.message || "Failed to update subscription" });
          }
        }}
      />

      <FilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filterConfig}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />

      <Modal
        isOpen={createModal.isOpen}
        onClose={() => setCreateModal({ isOpen: false, businessId: "", plan: plans?.[0]?.id || "trial" })}
        maxWidth="max-w-xl"
        title="Add Subscription"
        subtitle="Assign plan and create or replace current business subscription."
        footer={
          <div className="flex gap-3">
            <Button
              outline
              variant="secondary"
              className="w-1/3"
              onClick={() => setCreateModal({ isOpen: false, businessId: "", plan: plans?.[0]?.id || "trial" })}
            >
              Cancel
            </Button>
            <Button
              className="grow"
              onClick={async () => {
                try {
                  await createSubscription({
                    businessId: createModal.businessId,
                    plan: createModal.plan,
                    status: "active",
                    active: true,
                  });
                  showToast({ type: "success", message: "Subscription added" });
                  setCreateModal({ isOpen: false, businessId: "", plan: plans?.[0]?.id || "trial" });
                  loadSubscriptions(1, filters);
                } catch (err) {
                  showToast({ type: "error", message: err.response?.data?.message || "Failed to add subscription" });
                }
              }}
            >
              Save
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <Select
            label="Business"
            value={createModal.businessId}
            onChange={(value) => setCreateModal((p) => ({ ...p, businessId: value }))}
            options={(businesses || []).map((b) => ({ label: b.name, value: b._id }))}
            placeholder="Select business"
          />
          <Select
            label="Plan"
            value={createModal.plan}
            onChange={(value) => setCreateModal((p) => ({ ...p, plan: value }))}
            options={(plans || []).map((p) => ({ label: p.name, value: p.id }))}
          />
        </div>
      </Modal>

      <Modal
        isOpen={renewModal.isOpen}
        onClose={() => setRenewModal({ isOpen: false, id: "", plan: plans?.[0]?.id || "trial" })}
        maxWidth="max-w-xl"
        title="Renew Subscription"
        subtitle="Renew expired or due subscription and extend expiry."
        footer={
          <div className="flex gap-3">
            <Button
              outline
              variant="secondary"
              className="w-1/3"
              onClick={() => setRenewModal({ isOpen: false, id: "", plan: plans?.[0]?.id || "trial" })}
            >
              Cancel
            </Button>
            <Button
              className="grow"
              onClick={async () => {
                try {
                  await renewSubscription(renewModal.id, { plan: renewModal.plan });
                  showToast({ type: "success", message: "Subscription renewed" });
                  setRenewModal({ isOpen: false, id: "", plan: plans?.[0]?.id || "trial" });
                  loadSubscriptions(pagination.currentPage, filters);
                } catch (err) {
                  showToast({ type: "error", message: err.response?.data?.message || "Failed to renew subscription" });
                }
              }}
            >
              Renew
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <Select
            label="Plan"
            value={renewModal.plan}
            onChange={(value) => setRenewModal((p) => ({ ...p, plan: value }))}
            options={(plans || []).map((p) => ({ label: p.name, value: p.id }))}
          />
        </div>
      </Modal>
    </>
  );
}
