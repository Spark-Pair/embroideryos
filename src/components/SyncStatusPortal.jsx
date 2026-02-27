import { useEffect, useMemo, useState } from "react";
import { Cloud, CloudOff, RefreshCcw } from "lucide-react";
import { getPendingSyncActions, offlineAccess } from "../offline/idb";
import { subscribeBootstrapSyncState } from "../offline/bootstrapSyncState";
import useAuth from "../hooks/useAuth";

const formatCount = (count) => (count > 99 ? "99+" : String(count));

export default function SyncStatusPortal() {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [lastCheckedAt, setLastCheckedAt] = useState(0);
  const [bootstrap, setBootstrap] = useState({
    phase: "idle",
    totalSteps: 0,
    completedSteps: 0,
    failedSteps: 0,
    currentStepLabel: "",
    startedAt: 0,
  });

  const statusText = useMemo(() => {
    if (!isOnline) return "Offline";
    if (bootstrap.phase === "syncing") {
      return `Initial Sync ${bootstrap.completedSteps}/${bootstrap.totalSteps || 0}`;
    }
    if (pendingCount > 0) return "Syncing";
    return "Synced";
  }, [bootstrap.completedSteps, bootstrap.phase, bootstrap.totalSteps, isOnline, pendingCount]);

  const statusTone = useMemo(() => {
    if (!isOnline) return "bg-rose-100 text-rose-700 border-rose-200";
    if (bootstrap.phase === "syncing") return "bg-blue-100 text-blue-700 border-blue-200";
    if (pendingCount > 0) return "bg-amber-100 text-amber-700 border-amber-200";
    return "bg-emerald-100 text-emerald-700 border-emerald-200";
  }, [bootstrap.phase, isOnline, pendingCount]);

  useEffect(() => {
    if (!user || !offlineAccess.isUnlocked()) return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [user]);

  useEffect(() => {
    if (!user || !offlineAccess.isUnlocked()) return;
    let active = true;

    const poll = async () => {
      try {
        const pending = await getPendingSyncActions();
        if (!active) return;
        setPendingCount(pending.length);
        setLastCheckedAt(Date.now());
      } catch {
        if (!active) return;
        setPendingCount(0);
        setLastCheckedAt(Date.now());
      }
    };

    poll();
    const interval = setInterval(poll, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    if (!user || !offlineAccess.isUnlocked()) return;
    return subscribeBootstrapSyncState((nextState) => {
      setBootstrap(nextState);
    });
  }, [user]);

  const handleManualSync = () => {
    if (!isOnline) return;
    window.dispatchEvent(new Event("online"));
    setLastCheckedAt(Date.now());
  };

  if (!user || !offlineAccess.isUnlocked()) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[60]">
      <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-lg">
        <div className={`flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone}`}>
          {isOnline ? <Cloud size={14} /> : <CloudOff size={14} />}
          {statusText}
          {pendingCount > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-amber-700">
              {formatCount(pendingCount)}
            </span>
          )}
        </div>
        {bootstrap.phase === "done" && bootstrap.failedSteps > 0 && (
          <span className="text-[11px] font-semibold text-rose-600">
            {bootstrap.failedSteps} failed
          </span>
        )}
        <button
          type="button"
          onClick={handleManualSync}
          disabled={!isOnline}
          className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
            isOnline ? "border-teal-200 text-teal-700 hover:bg-teal-50" : "border-gray-200 text-gray-400"
          }`}
        >
          <RefreshCcw size={14} />
          Sync
        </button>
        <span className="text-[11px] text-gray-400">
          {bootstrap.phase === "syncing"
            ? `Fetching ${bootstrap.currentStepLabel || "data"}...`
            : lastCheckedAt
              ? `Checked ${new Date(lastCheckedAt).toLocaleTimeString()}`
              : "Checking..."}
        </span>
      </div>
    </div>
  );
}
