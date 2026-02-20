// pages/Settings.jsx

import React, { useState, useEffect } from "react";
import { Plus, SlidersHorizontal, CalendarDays, CheckCircle2, Clock } from "lucide-react";
import { fetchProductionConfig, createProductionConfig } from "../api/productionConfig";
import PageHeader from "../components/PageHeader";
import ProductionConfigFormModal from "../components/StaffRecord/ProductionConfigFormModal";
import { useToast } from "../context/ToastContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (val, isDate = false) => {
  if (val === null || val === undefined || val === "") return "—";
  if (isDate) {
    return new Date(val).toLocaleDateString("en-US", {
      day: "numeric", month: "short", year: "numeric",
    });
  }
  return typeof val === "number" ? val.toLocaleString() : val;
};

// Fields to display in each config card — same keys as modal
const DISPLAY_FIELDS = [
  { key: "stitch_rate",      label: "Stitch Rate"          },
  { key: "applique_rate",    label: "Applique Rate"         },
  { key: "on_target_pct",    label: "On Target %"           },
  { key: "after_target_pct", label: "After Target %"        },
  { key: "pcs_per_round",    label: "PCs Per Round"         },
  { key: "target_amount",    label: "Daily Target Amount"   },
  { key: "off_amount",       label: "Off Day Amount"        },
  { key: "bonus_rate",       label: "Bonus Rate"            },
];

// ── Config Card ───────────────────────────────────────────────────────────────

function ConfigCard({ record, isActive }) {
  return (
    <div
      className={`rounded-2xl border bg-white overflow-hidden transition-shadow hover:shadow-sm ${
        isActive ? "border-gray-900" : "border-gray-200"
      }`}
    >
      {/* Card header */}
      <div
        className={`flex items-center justify-between px-5 py-3.5 border-b ${
          isActive ? "bg-gray-900 border-gray-900" : "bg-gray-50 border-gray-100"
        }`}
      >
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className={isActive ? "text-gray-300" : "text-gray-400"} />
          <span className={`text-sm font-medium ${isActive ? "text-white" : "text-gray-700"}`}>
            {fmt(record.effective_date, true)}
          </span>
        </div>

        {isActive ? (
          <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white">
            <CheckCircle2 size={11} />
            Active
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500">
            <Clock size={11} />
            History
          </span>
        )}
      </div>

      {/* Fields grid */}
      <div className="grid grid-cols-2 gap-px bg-gray-100">
        {DISPLAY_FIELDS.map(({ key, label }) => (
          <div key={key} className="bg-white px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">{label}</p>
            <p className="text-sm font-medium text-gray-800">{fmt(record[key])}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function SettingsSection({ title, description, icon: Icon, action, children }) {
  return (
    <div className="rounded-3xl bg-white border border-gray-300 overflow-hidden">
      <div className="flex items-center justify-between px-7 py-5 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gray-100 border border-gray-200">
            <Icon size={17} className="text-gray-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
            {description && (
              <p className="text-xs text-gray-400 mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function ConfigCardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden animate-pulse">
      <div className="h-12 bg-gray-100" />
      <div className="grid grid-cols-2 gap-px bg-gray-100">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white px-4 py-3">
            <div className="h-3 w-20 bg-gray-100 rounded mb-1.5" />
            <div className="h-4 w-12 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { showToast } = useToast();

  const [records,    setRecords]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [formModal,  setFormModal]  = useState(false);

  // ── Load all configs ───────────────────────────────────────────────────────
  // Assumes API returns array when no params — adjust if your endpoint differs

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const res = await fetchProductionConfig();
      // Handle both: array response or single object
      const data = Array.isArray(res.data) ? res.data : [res.data].filter(Boolean);
      // Sort descending by effective_date — latest first
      data.sort((a, b) => new Date(b.effective_date) - new Date(a.effective_date));
      setRecords(data);
    } catch {
      showToast({ type: "error", message: "Failed to load configurations" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConfigs(); }, []);

  // ── Save new config ────────────────────────────────────────────────────────

  const handleSave = async (payload) => {
    try {
      await createProductionConfig(payload);
      showToast({ type: "success", message: "Config added successfully" });
      loadConfigs();
    } catch (err) {
      showToast({
        type: "error",
        message: err.response?.data?.message || "Failed to add config",
      });
      throw err; // keep modal open on error
    }
  };

  // Active = record with latest effective_date that is <= today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeRecord = records.find(
    (r) => r.effective_date && new Date(r.effective_date) <= today
  );

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col">
        <PageHeader
          title="Settings"
          subtitle="Manage system configuration and preferences."
        />

        <div className="flex flex-col gap-6 pb-10">

          {/* ── Production Configuration ─────────────────────────────────── */}
          <SettingsSection
            title="Production Configuration"
            description="Global rates and targets applied to all staff records."
            icon={SlidersHorizontal}
            action={
              <button
                onClick={() => setFormModal(true)}
                className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
              >
                <Plus size={15} />
                Add Config
              </button>
            }
          >
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => <ConfigCardSkeleton key={i} />)}
              </div>
            ) : records.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gray-100 border border-gray-200 mb-3">
                  <SlidersHorizontal size={20} className="text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-600">No configs yet</p>
                <p className="text-xs text-gray-400 mt-1">Click "Add Config" to create your first production configuration.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {records.map((record) => (
                  <ConfigCard
                    key={record._id}
                    record={record}
                    isActive={activeRecord?._id === record._id}
                  />
                ))}
              </div>
            )}
          </SettingsSection>

        </div>
      </div>

      {/* Add Config Modal */}
      <ProductionConfigFormModal
        isOpen={formModal}
        onClose={() => setFormModal(false)}
        onSave={handleSave}
      />
    </>
  );
}