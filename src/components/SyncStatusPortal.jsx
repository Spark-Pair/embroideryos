import { useEffect, useMemo, useState } from "react";
import { RefreshCcw, WifiOff, X, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getPendingSyncActions, offlineAccess } from "../offline/idb";
import { subscribeBootstrapSyncState } from "../offline/bootstrapSyncState";
import useAuth from "../hooks/useAuth";

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const formatCount = (n) => (n > 99 ? "99+" : String(n));
const CHECK_TICK_MS = 30000;
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

  const bootstrapInProgress = bootstrap.phase === "syncing";
  const bootstrapPercent = useMemo(() => {
    if (!bootstrapInProgress || !bootstrap.totalSteps) return 0;
    return Math.max(0, Math.min(100, Math.round((bootstrap.completedSteps / bootstrap.totalSteps) * 100)));
  }, [bootstrap.completedSteps, bootstrap.totalSteps, bootstrapInProgress]);

  const hasPendingQueue = pendingCount > 0;
  const isBusy          = bootstrapInProgress || hasPendingQueue;
  const hasError        = bootstrap.phase === "done" && bootstrap.failedSteps > 0;

  const statusKey = !isOnline        ? "offline"
    : bootstrapInProgress            ? "syncing"
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
        const p = await getPendingSyncActions();
        if (!active) return;
        setPendingCount(p.length); setPollError(false); setLastCheckedAt(Date.now());
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
    if (!user || !offlineAccess.isUnlocked()) return;
    return subscribeBootstrapSyncState((s) => setBootstrap(s));
  }, [user]);

  useEffect(() => {
    const id = setInterval(() => setClockTick((v) => (v + 1) % 100000), CHECK_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const handleManualSync = () => {
    if (!isOnline || isBusy) return;
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("visibilitychange"));
    setLastCheckedAt(Date.now());
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
                    <p className="text-xs font-medium text-rose-600">
                      {bootstrap.failedSteps} step{bootstrap.failedSteps > 1 ? "s" : ""} failed — retrying in background.
                    </p>
                  </motion.div>

                  <div className="h-px bg-gray-300" />
                </>
              )}
            </AnimatePresence>

            {/* Footer */}
            <div className="flex items-center justify-between ps-4 p-2">
              <div className="flex items-center gap-1.5">
                {!isOnline && <WifiOff size={12} className="text-rose-400" />}
                <p className="text-xs text-gray-400">
                  {pollError ? "Read failed" : relativeTime(lastCheckedAt)}
                </p>
                <span className="hidden">{clockTick}</span>
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