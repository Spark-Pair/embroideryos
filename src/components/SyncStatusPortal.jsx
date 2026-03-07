import { useEffect, useMemo, useState } from "react";
import { RefreshCcw, WifiOff, X, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  discardSyncAction,
  getPendingSyncActions,
  getSyncQueueSnapshot,
  offlineAccess,
  resetFailedSyncActions,
  retrySyncAction,
} from "../offline/idb";
import { resetBootstrapSync, subscribeBootstrapSyncState } from "../offline/bootstrapSyncState";
import { runFullBootstrapSeed } from "../offline/bootstrapSeed";
import { logDataSource } from "../offline/logger";
import useAuth from "../hooks/useAuth";
import { useToast } from "../context/ToastContext";

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const formatCount = (n) => (n > 99 ? "99+" : String(n));
const CHECK_TICK_MS = 30000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const warmSyncWorkers = async () => {
  await Promise.all([
    import("../offline/customersLocalFirst"),
    import("../offline/suppliersLocalFirst"),
    import("../offline/staffLocalFirst"),
    import("../offline/staffRecordsLocalFirst"),
    import("../offline/staffPaymentsLocalFirst"),
    import("../offline/customerPaymentsLocalFirst"),
    import("../offline/supplierPaymentsLocalFirst"),
    import("../offline/expensesLocalFirst"),
    import("../offline/ordersLocalFirst"),
    import("../offline/invoicesLocalFirst"),
    import("../offline/expenseItemsLocalFirst"),
    import("../offline/productionConfigLocalFirst"),
    import("../offline/crpRateConfigsLocalFirst"),
    import("../offline/crpStaffRecordsLocalFirst"),
    import("../offline/businessLocalFirst"),
    import("../offline/shortcutsLocalFirst"),
  ]);
};

const relativeTime = (ts) => {
  if (!ts) return "Checking…";
  const d = Date.now() - Number(ts);
  if (d < 60000)   return "Just now";
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  return `${Math.floor(d / 3600000)}h ago`;
};

const STATUS = {
  offline: { label: "Offline",    color: "#f43f5e" },
  syncing: { label: "Syncing",    color: "#009689" },
  pending: { label: "Pending",    color: "#f59e0b" },
  error:   { label: "Sync Error", color: "#f43f5e" },
  synced:  { label: "All Synced", color: "#10b981" },
};

/* ─── Pulsing dot ─────────────────────────────────────────────────────────── */
function StatusDot({ statusKey, color }) {
  const pulse = statusKey === "syncing" || statusKey === "pending";
  return (
    <span className="relative flex items-center justify-center" style={{ width: 10, height: 10 }}>
      {pulse && (
        <motion.span
          className="absolute inset-0 rounded-full no-default-transition"
          style={{ backgroundColor: color }}
          animate={{ scale: [1, 2.4, 2.4], opacity: [0.5, 0, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      <span className="relative rounded-full" style={{ width: 8, height: 8, backgroundColor: color }} />
    </span>
  );
}

/* ─── Main ────────────────────────────────────────────────────────────────── */
export default function SyncStatusPortal() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [pendingCount, setPendingCount]   = useState(0);
  const [isOnline, setIsOnline]           = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [lastCheckedAt, setLastCheckedAt] = useState(0);
  const [pollError, setPollError]         = useState(false);
  const [collapsed, setCollapsed]         = useState(false);
  const [clockTick, setClockTick]         = useState(0);
  const [bootstrap, setBootstrap]         = useState({
    phase: "idle", totalSteps: 0, completedSteps: 0,
    failedSteps: 0, currentStepLabel: "", startedAt: 0,
  });
  const [manualSyncing, setManualSyncing] = useState(false);
  const [rowActionBusyId, setRowActionBusyId] = useState(null);
  const [queueSnapshot, setQueueSnapshot] = useState({
    pendingCount: 0,
    delayedCount: 0,
    failedCount: 0,
    nextAction: null,
    latestErrors: [],
  });

  const bootstrapInProgress = bootstrap.phase === "syncing";
  const bootstrapPercent = useMemo(() => {
    if (!bootstrapInProgress || !bootstrap.totalSteps) return 0;
    return Math.max(0, Math.min(100, Math.round((bootstrap.completedSteps / bootstrap.totalSteps) * 100)));
  }, [bootstrap.completedSteps, bootstrap.totalSteps, bootstrapInProgress]);

  const hasPendingQueue = pendingCount > 0;
  const isBusy          = bootstrapInProgress || hasPendingQueue || manualSyncing;
  const hasBootstrapError = bootstrap.phase === "done" && bootstrap.failedSteps > 0;
  const hasQueueError = Number(queueSnapshot?.failedCount || 0) > 0;
  const hasError = hasBootstrapError || hasQueueError;
  const latestQueueError = queueSnapshot?.latestErrors?.[0] || null;

  const statusKey = !isOnline        ? "offline"
    : (bootstrapInProgress || manualSyncing) ? "syncing"
    : hasPendingQueue                ? "pending"
    : hasError                       ? "error"
    : "synced";
  const status = STATUS[statusKey];

  useEffect(() => {
    if (!user || !offlineAccess.isUnlocked()) return;
    const up = () => setIsOnline(true);
    const dn = () => setIsOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", dn);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", dn); };
  }, [user]);

  useEffect(() => {
    if (!user || !offlineAccess.isUnlocked()) return;
    let active = true, tid = null;
    const poll = async () => {
      try {
        const [p, details] = await Promise.all([
          getPendingSyncActions(),
          getSyncQueueSnapshot().catch(() => null),
        ]);
        if (!active) return;
        setPendingCount(p.length); setPollError(false); setLastCheckedAt(Date.now());
        if (details) setQueueSnapshot(details);
      } catch {
        if (!active) return;
        setPollError(true); setLastCheckedAt(Date.now());
      } finally {
        if (!active) return;
        tid = setTimeout(poll, isOnline ? (isBusy ? 1800 : 5000) : 7000);
      }
    };
    poll();
    return () => { active = false; if (tid) clearTimeout(tid); };
  }, [bootstrapInProgress, hasPendingQueue, isOnline, user]);

  useEffect(() => {
    if (!user || !offlineAccess.isUnlocked()) {
      resetBootstrapSync();
      return;
    }
    return subscribeBootstrapSyncState((s) => setBootstrap(s));
  }, [user]);

  useEffect(() => {
    const id = setInterval(() => setClockTick((v) => (v + 1) % 100000), CHECK_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const triggerQueueWorkers = () => {
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("visibilitychange"));
    document.dispatchEvent(new Event("visibilitychange"));
  };

  const waitUntilQueueDrained = async (timeoutMs = 90000) => {
    const startedAt = Date.now();
    let zeroSeenAt = 0;
    while (Date.now() - startedAt < timeoutMs) {
      const actions = await getPendingSyncActions();
      const count = Array.isArray(actions) ? actions.length : 0;
      setPendingCount(count);
      if (count === 0) {
        if (!zeroSeenAt) zeroSeenAt = Date.now();
        if (Date.now() - zeroSeenAt >= 1200) return true;
      } else {
        zeroSeenAt = 0;
      }
      triggerQueueWorkers();
      await sleep(900);
    }
    return false;
  };

  const handleManualSync = async () => {
    if (!isOnline || isBusy) return;
    setManualSyncing(true);
    setPollError(false);
    try {
      await resetFailedSyncActions().catch(() => 0);
      await warmSyncWorkers();
      triggerQueueWorkers();
      const drained = await waitUntilQueueDrained(90000);
      if (!drained) {
        showToast({
          type: "warning",
          message: "Some pending local changes are still syncing in background.",
        });
      }

      // Cloud -> IDB refresh for all bootstrap modules.
      await runFullBootstrapSeed({ forceRefresh: true });
      logDataSource("IDB", "sync.manual.complete", { drained });
      showToast({ type: "success", message: "Manual sync completed." });
    } catch (error) {
      logDataSource("IDB", "sync.manual.failed", {
        message: error?.response?.data?.message || error?.message || "manual sync failed",
      });
      showToast({ type: "error", message: "Manual sync failed. Please retry." });
    } finally {
      setManualSyncing(false);
      setLastCheckedAt(Date.now());
      const actions = await getPendingSyncActions().catch(() => []);
      setPendingCount(Array.isArray(actions) ? actions.length : 0);
    }
  };

  const refreshQueueState = async () => {
    const [actions, details] = await Promise.all([
      getPendingSyncActions().catch(() => []),
      getSyncQueueSnapshot().catch(() => null),
    ]);
    setPendingCount(Array.isArray(actions) ? actions.length : 0);
    if (details) setQueueSnapshot(details);
    setLastCheckedAt(Date.now());
  };

  const handleRetryOne = async (id) => {
    if (!id || rowActionBusyId) return;
    setRowActionBusyId(String(id));
    try {
      const ok = await retrySyncAction(id);
      if (!ok) throw new Error("Unable to retry this action");
      triggerQueueWorkers();
      await refreshQueueState();
      showToast({ type: "success", message: "Sync action moved to retry queue." });
    } catch (error) {
      showToast({ type: "error", message: error?.message || "Failed to retry action." });
    } finally {
      setRowActionBusyId(null);
    }
  };

  const handleDiscardOne = async (id) => {
    if (!id || rowActionBusyId) return;
    setRowActionBusyId(String(id));
    try {
      const ok = await discardSyncAction(id);
      if (!ok) throw new Error("Unable to discard this action");
      await refreshQueueState();
      showToast({ type: "warning", message: "Failed action discarded from queue." });
    } catch (error) {
      showToast({ type: "error", message: error?.message || "Failed to discard action." });
    } finally {
      setRowActionBusyId(null);
    }
  };

  if (!user || !offlineAccess.isUnlocked()) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[60]">
      <AnimatePresence mode="wait">

        {/* ── Collapsed: small round chip ── */}
        {collapsed ? (
          <motion.button
            key="chip"
            onClick={() => setCollapsed(false)}
            className="flex items-center gap-2 rounded-2xl border border-gray-300 bg-white px-3.5 py-2.5 cursor-pointer no-default-transition"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1,   opacity: 1 }}
            exit={{    scale: 0.7, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <StatusDot statusKey={statusKey} color={status.color} />
            <span className="text-xs font-semibold text-gray-700">{status.label}</span>
            {hasPendingQueue && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-100 px-1 text-[10px] font-bold text-amber-700">
                {formatCount(pendingCount)}
              </span>
            )}
            <ChevronDown size={13} className="text-gray-400" />
          </motion.button>

        ) : (

          /* ── Expanded: full card ── */
          <motion.div
            key="card"
            className="w-72 rounded-2xl border border-gray-300 bg-white overflow-hidden"
            initial={{ scale: 0.85, opacity: 0, y: 12 }}
            animate={{ scale: 1,    opacity: 1, y: 0  }}
            exit={{    scale: 0.85, opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            style={{ transformOrigin: "bottom right" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between ps-4 p-2.5">
              <div className="flex items-center gap-2.5">
                <StatusDot statusKey={statusKey} color={status.color} />
                <span className="text-sm font-semibold text-gray-800">{status.label}</span>
                {/* Spinning icon only when syncing — no orbit, no bounce dots */}
                {statusKey === "syncing" && (
                  <RefreshCcw size={13} className="animate-spin text-teal-700" />
                )}
                {hasPendingQueue && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700">
                    {formatCount(pendingCount)}
                  </span>
                )}
              </div>
              <button
                onClick={() => setCollapsed(true)}
                className="flex h-7 w-7 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="h-px bg-gray-300" />

            {/* Bootstrap progress */}
            <AnimatePresence>
              {bootstrapInProgress && (
                <>
                  <motion.div
                    className="px-4 py-3 no-default-transition"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{    opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="truncate pr-2 text-xs text-gray-500">
                        {bootstrap.currentStepLabel ? `Fetching ${bootstrap.currentStepLabel}…` : "Syncing data…"}
                      </p>
                      <p className="shrink-0 text-xs font-semibold text-teal-700">{bootstrapPercent}%</p>
                    </div>
                    {/* Clean progress bar — no shine, just smooth fill */}
                    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                      <motion.div
                        className="h-1.5 rounded-full bg-teal-600 no-default-transition"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(4, bootstrapPercent)}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    </div>
                    <p className="mt-1.5 text-[10px] text-gray-400">
                      {bootstrap.completedSteps} of {bootstrap.totalSteps || 0} steps
                    </p>
                  </motion.div>

                  <div className="h-px bg-gray-300" />
                </>
              )}
            </AnimatePresence>

            {/* Error */}
            <AnimatePresence>
              {hasError && (
                <>
                  <motion.div
                    className="bg-rose-50 px-4 py-2.5 no-default-transition"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{    opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {hasBootstrapError && (
                      <p className="text-xs font-medium text-rose-600">
                        {bootstrap.failedSteps} step{bootstrap.failedSteps > 1 ? "s" : ""} failed during cloud refresh.
                      </p>
                    )}
                    {hasQueueError && (
                      <p className="mt-1 text-xs font-medium text-rose-700">
                        {queueSnapshot.failedCount} pending change{queueSnapshot.failedCount > 1 ? "s" : ""} stopped.
                        {latestQueueError?.message ? ` Latest: ${latestQueueError.message}` : ""}
                      </p>
                    )}
                  </motion.div>

                  <div className="h-px bg-gray-300" />
                </>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {hasQueueError && Array.isArray(queueSnapshot?.latestErrors) && queueSnapshot.latestErrors.length > 0 && (
                <>
                  <motion.div
                    className="max-h-40 overflow-auto px-3 py-2"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {queueSnapshot.latestErrors.map((err) => {
                      const rowId = String(err?.id || "");
                      const busy = rowActionBusyId === rowId;
                      return (
                        <div key={rowId || `${err?.entity}-${err?.method}-${err?.url}`} className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 last:mb-0">
                          <p className="truncate text-[10px] font-semibold text-rose-700">
                            {err?.entity || "Unknown"} {err?.method || ""}
                          </p>
                          <p className="truncate text-[10px] text-rose-700/90">
                            {err?.message || "Sync failed"}
                          </p>
                          <div className="mt-1 flex items-center gap-1">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleRetryOne(err?.id)}
                              className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${busy ? "border-gray-200 text-gray-400" : "border-teal-300 text-teal-700 hover:bg-teal-50 cursor-pointer"}`}
                            >
                              Retry
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleDiscardOne(err?.id)}
                              className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${busy ? "border-gray-200 text-gray-400" : "border-rose-300 text-rose-700 hover:bg-rose-100 cursor-pointer"}`}
                            >
                              Discard
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                  <div className="h-px bg-gray-300" />
                </>
              )}
            </AnimatePresence>

            {/* Footer */}
            <div className="flex items-center justify-between ps-4 p-2">
              <div className="flex flex-col items-start gap-0.5">
                {queueSnapshot?.nextAction && (
                  <p className="text-[10px] font-medium text-teal-700">
                    Pushing: {String(queueSnapshot.nextAction.entity || "").replace(/([A-Z])/g, " $1").trim()} {queueSnapshot.nextAction.method}
                  </p>
                )}
                {Number(queueSnapshot?.delayedCount || 0) > 0 && (
                  <p className="text-[10px] text-amber-600">
                    Retry queued: {queueSnapshot.delayedCount}
                  </p>
                )}
                <div className="flex items-center gap-1.5">
                {!isOnline && <WifiOff size={12} className="text-rose-400" />}
                <p className="text-xs text-gray-400">
                  {pollError ? "Read failed" : relativeTime(lastCheckedAt)}
                </p>
                <span className="hidden">{clockTick}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleManualSync}
                disabled={!isOnline || isBusy}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isOnline && !isBusy
                    ? "border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 cursor-pointer"
                    : "border-gray-100 text-gray-300 cursor-not-allowed"
                }`}
              >
                <RefreshCcw size={12} className={isBusy ? "animate-spin" : ""} />
                {isBusy ? "Syncing" : "Sync Now"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
