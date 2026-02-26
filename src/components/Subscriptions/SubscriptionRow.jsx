import { MoreVertical } from "lucide-react";
import { useState } from "react";
import ContextMenu from "../ContextMenu";
import { formatDate, formatNumbers } from "../../utils";

export default function SubscriptionRow({ item, index, startIndex, onView, onEdit }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const statusTone =
    item.status === "active"
      ? "success"
      : item.status === "trial"
      ? "warning"
      : item.status === "past_due"
      ? "danger"
      : item.status === "expired"
      ? "danger"
      : "normal";

  return (
    <tr className="group hover:bg-gray-50/80 transition-colors cursor-pointer" onClick={() => onView(item)}>
      <td className="px-7 py-4 font-medium text-gray-500">{startIndex + index + 1}</td>
      <td className="px-7 py-4 font-semibold text-gray-800">{item.business_name || "-"}</td>
      <td className="px-7 py-4 text-sm text-gray-600 capitalize">{item.plan}</td>
      <td className="px-7 py-4">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
            statusTone === "success"
              ? "bg-emerald-100 text-emerald-700"
              : statusTone === "warning"
              ? "bg-amber-100 text-amber-700"
              : statusTone === "danger"
              ? "bg-rose-100 text-rose-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {item.status || "-"}
        </span>
      </td>
      <td className="px-7 py-4 text-sm text-gray-600">{formatDate(item.expiresAt, "dd MMM yyyy")}</td>
      <td className="px-7 py-4 text-sm text-gray-600 text-right">{formatNumbers(item.plan_details?.price || 0, 0)}</td>
      <td className="px-7 py-4 text-right relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          className="p-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100"
        >
          <MoreVertical size={18} />
        </button>
        <ContextMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onView(item);
              setMenuOpen(false);
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl text-gray-600 hover:bg-gray-200 cursor-pointer"
          >
            View Details
          </button>
          <div className="h-[1px] bg-gray-200 my-1.5" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(item);
              setMenuOpen(false);
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl text-gray-600 hover:bg-gray-200 cursor-pointer"
          >
            Update Plan
          </button>
        </ContextMenu>
      </td>
    </tr>
  );
}
