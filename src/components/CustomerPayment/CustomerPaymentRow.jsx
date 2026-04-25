import { Edit3, Eye, MoreVertical } from "lucide-react";
import { useState } from "react";
import ContextMenu from "../ContextMenu";
import { formatDate, formatNumbers } from "../../utils";

const needsClearDate = (method) => method === "cheque" || method === "slip";

export default function CustomerPaymentRow({ item, index, startIndex, onView, onEdit }) {
  const [activeMenu, setActiveMenu] = useState(null);

  return (
    <tr
      className="group cursor-pointer transition-colors hover:bg-gray-50/80"
      onClick={() => onView(item)}
    >
      <td className="px-7 py-4 font-medium text-gray-500">{startIndex + index + 1}</td>
      <td className="px-7 py-4 text-sm font-semibold text-gray-800">
        {item.customer_id?.name || item.customer_name || "-"}
      </td>
      <td className="px-7 py-4 text-sm text-gray-500 font-light">
        {formatDate(item.date, "dd-MMM-YYYY, DDD")}
      </td>
      <td className="px-7 py-4 text-sm text-gray-500 font-light">
        {item.method || "-"}
      </td>
      <td className="px-7 py-4 text-sm font-medium tracking-wider text-gray-800">
        {formatNumbers(item.amount, 2)}
      </td>
      <td className="px-7 py-4 text-sm text-gray-500 font-light">
        {needsClearDate(item.method)
          ? (item.clear_date ? formatDate(item.clear_date, "dd-MMM-YYYY") : "Pending")
          : "-"}
      </td>
      <td className="max-w-[220px] truncate px-7 py-4 text-sm font-light text-gray-500" title={item.remarks || ""}>
        {item.remarks || "-"}
      </td>
      <td className="relative px-7 py-4 text-right">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActiveMenu(activeMenu === item._id ? null : item._id);
          }}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900"
        >
          <MoreVertical size={18} />
        </button>

        <ContextMenu isOpen={activeMenu === item._id}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onView(item);
              setActiveMenu(null);
            }}
            className="w-full cursor-pointer rounded-xl px-3 py-2.5 text-left text-sm font-medium text-gray-600 hover:bg-gray-200"
          >
            <span className="inline-flex items-center gap-3">
              <Eye size={16} strokeWidth={2.5} />
              View Details
            </span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(item);
              setActiveMenu(null);
            }}
            className="w-full cursor-pointer rounded-xl px-3 py-2.5 text-left text-sm font-medium text-gray-600 hover:bg-gray-200"
          >
            <span className="inline-flex items-center gap-3">
              <Edit3 size={16} strokeWidth={2.5} />
              Edit Payment
            </span>
          </button>
        </ContextMenu>
      </td>
    </tr>
  );
}
