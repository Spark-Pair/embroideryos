import { useEffect, useMemo, useState } from "react";
import { Crown, ShieldCheck, Users, ImageIcon, Plus, PencilLine } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import Modal from "../components/Modal";
import Input from "../components/Input";
import Select from "../components/Select";
import Button from "../components/Button";
import { useToast } from "../context/ToastContext";
import { createPlan, fetchPlans, updatePlan } from "../api/subscription";
import { fetchSubscriptions } from "../api/subscription.admin";
import { formatNumbers } from "../utils";

export default function Plans() {
  const { showToast } = useToast();
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [planModal, setPlanModal] = useState({
    isOpen: false,
    isEdit: false,
    id: "",
    name: "",
    price: "",
    durationDays: "",
    invoiceBanner: false,
    invoiceImageUpload: false,
    users: "",
    sortOrder: "",
    isActive: true,
  });

  const load = async () => {
    try {
      setLoading(true);
      const [planRes, subRes] = await Promise.all([
        fetchPlans(),
        fetchSubscriptions({ page: 1, limit: 5000 }),
      ]);
      setPlans(planRes?.data || []);
      setSubscriptions(subRes?.data || []);
    } catch (err) {
      showToast({ type: "error", message: err.response?.data?.message || "Failed to load plans" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [showToast]);

  const stats = useMemo(() => {
    const totalPlans = plans.length;
    const assigned = subscriptions.length;
    const premiumCount = subscriptions.filter((s) => s.plan === "premium").length;
    const active = subscriptions.filter((s) => s.active && ["trial", "active", "past_due"].includes(s.status)).length;
    return { totalPlans, assigned, premiumCount, active };
  }, [plans, subscriptions]);

  const planUsage = useMemo(() => {
    const map = new Map();
    subscriptions.forEach((sub) => {
      map.set(sub.plan, (map.get(sub.plan) || 0) + 1);
    });
    return map;
  }, [subscriptions]);

  return (
    <>
      <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col">
        <PageHeader
          title="Plans"
          subtitle="SaaS pricing plans, features, and adoption."
          actionLabel="Add Plan"
          actionIcon={Plus}
          onAction={() =>
            setPlanModal({
              isOpen: true,
              isEdit: false,
              id: "",
              name: "",
              price: "",
              durationDays: "30",
              invoiceBanner: false,
              invoiceImageUpload: false,
              users: "1",
              sortOrder: "99",
              isActive: true,
            })
          }
        />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Plans" value={stats.totalPlans} icon={Crown} />
        <StatCard label="Assigned Subs" value={stats.assigned} icon={Users} variant="success" />
        <StatCard label="Premium Subs" value={stats.premiumCount} icon={ShieldCheck} variant="warning" />
        <StatCard label="Active Subs" value={stats.active} icon={Users} variant="normal" />
      </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {loading ? (
            <div className="col-span-full rounded-3xl border border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
              Loading plans...
            </div>
          ) : plans.length === 0 ? (
            <div className="col-span-full rounded-3xl border border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
              No plans data found.
            </div>
          ) : (
            plans.map((plan) => (
              <div key={plan.id} className="rounded-3xl border border-gray-300 bg-white p-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-teal-100/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-teal-700">
                      {plan.id}
                    </span>
                    <button
                      className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                      onClick={() =>
                        setPlanModal({
                          isOpen: true,
                          isEdit: true,
                          id: plan.id,
                          name: plan.name || "",
                          price: plan.price ?? 0,
                          durationDays: plan.durationDays ?? 30,
                          invoiceBanner: Boolean(plan?.features?.invoice_banner),
                          invoiceImageUpload: Boolean(plan?.features?.invoice_image_upload),
                          users: plan?.limits?.users ?? 1,
                          sortOrder: plan.sortOrder ?? 99,
                          isActive: plan.isActive !== false,
                        })
                      }
                    >
                      <PencilLine size={14} />
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-2xl font-semibold text-gray-900">PKR {formatNumbers(plan.price, 0)}</p>
                <p className="text-xs text-gray-500">{plan.durationDays} days</p>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Users Limit</span>
                    <span className="font-medium text-gray-800">{plan?.limits?.users ?? "-"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Invoice Banner</span>
                    <span className={`inline-flex items-center gap-1 font-medium ${plan?.features?.invoice_banner ? "text-emerald-600" : "text-gray-400"}`}>
                      <ImageIcon size={14} />
                      {plan?.features?.invoice_banner ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Invoice Image Upload</span>
                    <span className={`font-medium ${plan?.features?.invoice_image_upload ? "text-emerald-600" : "text-gray-400"}`}>
                      {plan?.features?.invoice_image_upload ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Status</span>
                    <span className={`font-medium ${plan?.isActive ? "text-emerald-600" : "text-rose-600"}`}>
                      {plan?.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Subscriptions</span>
                    <span className="font-semibold text-gray-800">{planUsage.get(plan.id) || 0}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal
        isOpen={planModal.isOpen}
        onClose={() => setPlanModal((p) => ({ ...p, isOpen: false }))}
        maxWidth="max-w-xl"
        title={planModal.isEdit ? "Edit Plan" : "Add Plan"}
        subtitle="Configure pricing, features and limits."
        footer={
          <div className="flex gap-3">
            <Button outline variant="secondary" className="w-1/3" onClick={() => setPlanModal((p) => ({ ...p, isOpen: false }))}>
              Cancel
            </Button>
            <Button
              className="grow"
              onClick={async () => {
                try {
                  const payload = {
                    id: planModal.id,
                    name: planModal.name,
                    price: Number(planModal.price || 0),
                    durationDays: Number(planModal.durationDays || 30),
                    features: {
                      invoice_banner: planModal.invoiceBanner,
                      invoice_image_upload: planModal.invoiceImageUpload,
                    },
                    limits: { users: Number(planModal.users || 1) },
                    sortOrder: Number(planModal.sortOrder || 99),
                    isActive: planModal.isActive,
                  };
                  if (planModal.isEdit) {
                    await updatePlan(planModal.id, payload);
                    showToast({ type: "success", message: "Plan updated" });
                  } else {
                    await createPlan(payload);
                    showToast({ type: "success", message: "Plan created" });
                  }
                  setPlanModal((p) => ({ ...p, isOpen: false }));
                  load();
                } catch (err) {
                  showToast({ type: "error", message: err.response?.data?.message || "Failed to save plan" });
                }
              }}
            >
              Save
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Plan Id"
            value={planModal.id}
            disabled={planModal.isEdit}
            onChange={(e) => setPlanModal((p) => ({ ...p, id: e.target.value.toLowerCase().replace(/\s+/g, "-") }))}
          />
          <Input
            label="Plan Name"
            value={planModal.name}
            onChange={(e) => setPlanModal((p) => ({ ...p, name: e.target.value }))}
          />
          <Input
            label="Price"
            type="number"
            value={planModal.price}
            onChange={(e) => setPlanModal((p) => ({ ...p, price: e.target.value }))}
          />
          <Input
            label="Duration (Days)"
            type="number"
            value={planModal.durationDays}
            onChange={(e) => setPlanModal((p) => ({ ...p, durationDays: e.target.value }))}
          />
          <Input
            label="Users Limit"
            type="number"
            value={planModal.users}
            onChange={(e) => setPlanModal((p) => ({ ...p, users: e.target.value }))}
          />
          <Input
            label="Sort Order"
            type="number"
            value={planModal.sortOrder}
            onChange={(e) => setPlanModal((p) => ({ ...p, sortOrder: e.target.value }))}
          />
          <Select
            label="Invoice Banner"
            value={planModal.invoiceBanner ? "yes" : "no"}
            onChange={(value) => setPlanModal((p) => ({ ...p, invoiceBanner: value === "yes" }))}
            options={[
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ]}
          />
          <Select
            label="Invoice Image Upload"
            value={planModal.invoiceImageUpload ? "yes" : "no"}
            onChange={(value) => setPlanModal((p) => ({ ...p, invoiceImageUpload: value === "yes" }))}
            options={[
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ]}
          />
          <Select
            label="Plan Active"
            value={planModal.isActive ? "yes" : "no"}
            onChange={(value) => setPlanModal((p) => ({ ...p, isActive: value === "yes" }))}
            options={[
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ]}
          />
        </div>
      </Modal>
    </>
  );
}
