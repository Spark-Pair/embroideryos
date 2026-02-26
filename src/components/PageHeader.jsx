import React, { useEffect } from "react";
import Button from "./Button";
import { useShortcut } from "../hooks/useShortcuts";
import useAuth from "../hooks/useAuth";
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
    <div className="flex justify-between items-start mb-5">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">{title}</h1>
        {subtitle && <p className="text-gray-400 text-sm">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {actionLabel && onAction && (
          <Button
            icon={actionIcon}
            onClick={onAction}
            disabled={isReadOnly}
            title={isReadOnly ? "Read-only mode: renew subscription to enable actions" : `Shortcut: ${formatComboDisplay(primaryActionShortcut)}`}
          >
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
