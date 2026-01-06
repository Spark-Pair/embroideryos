import React from "react";
import Button from "./Button";

export default function PageHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  actionIcon,
}) {
  return (
    <div className="flex justify-between items-start mb-5">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">{title}</h1>
        {subtitle && <p className="text-gray-400 text-sm">{subtitle}</p>}
      </div>

      {actionLabel && onAction && (
        <Button icon={actionIcon} onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
