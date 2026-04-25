import React, { useEffect, useMemo, useState } from "react";
import { Cloud, RefreshCcw, WifiOff } from "lucide-react";
import Button from "./Button";
import { useShortcut } from "../hooks/useShortcuts";
import useAuth from "../hooks/useAuth";
import { getOfflineMetaValue, getSyncQueueSnapshot, offlineAccess } from "../offline/idb";
import {
  formatComboDisplay,
  isEventMatchingShortcut,
  shouldIgnoreGlobalShortcutTarget,
} from "../utils/shortcuts";

export default function PageHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  actionIcon,
}) {
  const { user } = useAuth();
  const isReadOnly = Boolean(user?.subscription?.readOnly);
  const primaryActionShortcut = useShortcut("page_header_primary_action");
  const [statusMeta, setStatusMeta] = useState({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    pendingCount: 0,
    failedCount: 0,
    lastSnapshotUpdateAt: 0,
  });

  useEffect(() => {
    if (!user || !offlineAccess.isUnlocked()) return undefined;
    let active = true;
    let timeoutId = null;

    const poll = async () => {
      try {
        const [queue, snapshotMeta] = await Promise.all([
          getSyncQueueSnapshot().catch(() => null),
          getOfflineMetaValue("last_snapshot_update_at").catch(() => null),
        ]);
        if (!active) return;
        setStatusMeta({
          isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
          pendingCount: Number(queue?.pendingCount || 0) + Number(queue?.delayedCount || 0),
          failedCount: Number(queue?.failedCount || 0),
          lastSnapshotUpdateAt: Number(snapshotMeta?.value || 0) || 0,
        });
      } finally {
        if (!active) return;
        timeoutId = window.setTimeout(poll, 5000);
      }
    };

    const handleOnlineState = () => {
      setStatusMeta((prev) => ({
        ...prev,
        isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      }));
    };

    poll();
    window.addEventListener("online", handleOnlineState);
    window.addEventListener("offline", handleOnlineState);
    return () => {
      active = false;
      if (timeoutId) window.clearTimeout(timeoutId);
      window.removeEventListener("online", handleOnlineState);
      window.removeEventListener("offline", handleOnlineState);
    };
  }, [user]);

  const inlineStatus = useMemo(() => {
    if (!user || !offlineAccess.isUnlocked()) return null;
    if (!statusMeta.isOnline) {
      return {
        icon: WifiOff,
        label: "Offline cache mode",
        className: "border-rose-200 bg-rose-50 text-rose-700",
      };
    }
    if (statusMeta.failedCount > 0) {
      return {
        icon: RefreshCcw,
        label: `${statusMeta.failedCount} sync issue${statusMeta.failedCount > 1 ? "s" : ""}`,
        className: "border-rose-200 bg-rose-50 text-rose-700",
      };
    }
    if (statusMeta.pendingCount > 0) {
      return {
        icon: RefreshCcw,
        label: `${statusMeta.pendingCount} change${statusMeta.pendingCount > 1 ? "s" : ""} syncing`,
        className: "border-amber-200 bg-amber-50 text-amber-700",
      };
    }
    return {
      icon: Cloud,
      label: statusMeta.lastSnapshotUpdateAt > 0 ? "Cached data ready" : "Cloud sync ready",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }, [statusMeta, user]);
  const InlineStatusIcon = inlineStatus?.icon || null;

  useEffect(() => {
    if (isReadOnly) return;
    if (!actionLabel || !onAction || !primaryActionShortcut) return;

    const onKeyDown = (e) => {
      if (e.repeat) return;
      if (shouldIgnoreGlobalShortcutTarget(e.target)) return;
      if (!isEventMatchingShortcut(e, primaryActionShortcut)) return;

      e.preventDefault();
      onAction();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actionLabel, onAction, primaryActionShortcut, isReadOnly]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-medium tracking-tight">{title}</h1>
        {subtitle && <p className="text-gray-400 text-sm">{subtitle}</p>}
        {inlineStatus && (
          <div className="mt-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${inlineStatus.className}`}>
              {InlineStatusIcon ? <InlineStatusIcon size={12} className={inlineStatus.icon === RefreshCcw && statusMeta.pendingCount > 0 ? "animate-spin" : ""} /> : null}
              {inlineStatus.label}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {actionLabel && onAction && (
          <Button
            icon={actionIcon}
            iconPosition="right"
            onClick={onAction}
            disabled={isReadOnly}
            title={isReadOnly ? "Read-only mode: renew subscription to enable actions" : `Shortcut: ${formatComboDisplay(primaryActionShortcut)}`}
            aria-label={actionLabel}
          >
            <span className="hidden sm:inline">{actionLabel}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
