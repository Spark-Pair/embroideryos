import { Edit3, Eye, Power, MoreVertical, Gift, Lock } from "lucide-react";
import ContextMenu from "../ContextMenu";
import { useState } from "react";
import { formatDate } from "../../utils";

const ATTENDANCE_META = {
  Day:    "bg-emerald-100 text-emerald-700",
  Night:  "bg-indigo-100  text-indigo-700",
  Half:   "bg-amber-100   text-amber-700",
  Absent: "bg-red-100     text-red-700",
  Off:    "bg-sky-100     text-sky-700",
  Close:  "bg-gray-100    text-gray-600",
  Sunday: "bg-violet-100  text-violet-700",
};

const fmt = (n, d = 0) =>
  n == null || isNaN(n)
    ? "—"
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function StaffRecordRow({ item, index, startIndex, onView, onEdit }) {
  const [activeMenu, setActiveMenu] = useState(null);

  const totals          = item.totals;
  const isFixed         = item.fix_amount != null;
  const hasBonus        = item.bonus_amount > 0;
  const productionCount = item.production?.length ?? 0;
  const configSnapshot  = item.config_snapshot;

  // We show the effective percentage that was actually applied.
  const targetMet = totals
    ? totals.on_target_amt >= configSnapshot?.target_amount
    : false;

  let pctLabel = null;
  let pctStyle = "";
  if (isFixed) {
    pctLabel = "FIX";
    pctStyle = "bg-amber-100 text-amber-700";
  } else if (totals && totals.on_target_amt > 0) {
    if (targetMet) {
      pctLabel = configSnapshot?.after_target_pct != null
        ? `${configSnapshot.after_target_pct}%`
        : "After";
      pctStyle = "bg-emerald-100 text-emerald-700";
    } else {
      pctLabel = configSnapshot?.on_target_pct != null
        ? `${configSnapshot.on_target_pct}%`
        : "On";
      pctStyle = "bg-rose-100 text-rose-700";
    }
  }

  return (
    <tr
      className="group hover:bg-gray-50/80 transition-colors cursor-pointer"
      onClick={() => onView(item)}
    >
      {/* # */}
      <td className="px-5 py-4 font-medium text-gray-400 text-sm">
        {startIndex + index + 1}
      </td>

      {/* Staff Name */}
      <td className="px-5 py-4 font-semibold text-gray-800">
        {item.staff_id?.name ?? "—"}
      </td>

      {/* Date */}
      <td className="px-5 py-4 text-sm text-gray-500">
        {formatDate(item.date, "dd-MMM-YYYY, DDD")}
      </td>

      {/* Attendance */}
      <td className="px-5 py-4">
        {item.attendance ? (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ATTENDANCE_META[item.attendance] ?? "bg-gray-100 text-gray-600"}`}>
            {item.attendance}
          </span>
        ) : "—"}
      </td>

      {/* PCs / Rounds */}
      <td className="px-5 py-4 text-sm tabular-nums">
        {totals ? (
          <span>
            <span className="font-semibold text-gray-800">{fmt(totals.pcs)}</span>
            <span className="text-gray-300 mx-1">/</span>
            <span className="text-gray-500">{fmt(totals.rounds)}</span>
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>

      {/* Production rows + bonus */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-2 flex-wrap">
          {productionCount > 0 ? (
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {productionCount} {productionCount === 1 ? "row" : "rows"}
            </span>
          ) : (
            <span className="text-gray-300 text-xs">—</span>
          )}
          {hasBonus && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full whitespace-nowrap">
              <Gift className="h-3 w-3" />
              {fmt(item.bonus_amount, 2)}
            </span>
          )}
        </div>
      </td>

      {/* Final Amount + % or FIX badge */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold tabular-nums ${isFixed ? "text-amber-700" : "text-emerald-700"}`}>
            {fmt(item.final_amount, 2)}
          </span>
          {pctLabel && (
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${pctStyle}`}>
              {isFixed && <Lock className="h-3 w-3" />}
              {pctLabel}
            </span>
          )}
        </div>
      </td>

      {/* Actions */}
      <td className="px-5 py-4 text-right relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setActiveMenu(activeMenu === item._id ? null : item._id);
          }}
          className="p-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100"
        >
          <MoreVertical size={18} />
        </button>

        <ContextMenu isOpen={activeMenu === item._id}>
          <button
            onClick={(e) => { e.stopPropagation(); onView(item); setActiveMenu(null); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl text-gray-600 hover:bg-gray-200 cursor-pointer"
          >
            <Eye size={16} strokeWidth={2.5} />
            View Details
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(item); setActiveMenu(null); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl text-gray-600 hover:bg-gray-200 cursor-pointer"
          >
            <Edit3 size={16} strokeWidth={2.5} />
            Edit Record
          </button>
        </ContextMenu>
      </td>
    </tr>
  );
}