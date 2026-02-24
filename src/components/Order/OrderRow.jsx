import { Copy, Edit3, Eye, MoreVertical } from "lucide-react";
import { useState } from "react";
import ContextMenu from "../ContextMenu";
import { formatDate, formatNumbers } from "../../utils";

export default function OrderRow({ item, index, startIndex, onView, onEdit, onRepeat }) {
  const [activeMenu, setActiveMenu] = useState(null);

  return (
    <tr className="group hover:bg-gray-50/80 transition-colors cursor-pointer" onClick={() => onView(item)}>
      <td className="px-5 py-4 font-medium text-gray-500">{startIndex + index + 1}</td>
      <td className="px-5 py-4 font-semibold text-gray-800">{item.customer_name}</td>
      <td className="px-5 py-4 text-sm text-gray-500">{formatDate(item.date, "DD MMM yyyy")}</td>
      <td className="px-5 py-4 text-sm text-gray-600">{item.lot_no || "---"}</td>
      <td className="px-5 py-4 text-sm text-gray-600">{item.machine_no || "---"}</td>
      <td className="px-5 py-4 text-sm text-gray-600">
        {formatNumbers(item.quantity, 0)} {item.unit || ""}
      </td>
      <td className="px-5 py-4 text-sm text-gray-600">{formatNumbers(item.rate, 2)}</td>
      <td className="px-5 py-4 text-sm font-semibold text-emerald-700">{formatNumbers(item.total_amount, 2)}</td>
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
            onClick={(e) => {
              e.stopPropagation();
              onView(item);
              setActiveMenu(null);
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl text-gray-600 hover:bg-gray-200 cursor-pointer"
          >
            <Eye size={16} strokeWidth={2.5} />
            View Details
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(item);
              setActiveMenu(null);
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl text-gray-600 hover:bg-gray-200 cursor-pointer"
          >
            <Edit3 size={16} strokeWidth={2.5} />
            Edit Order
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRepeat(item);
              setActiveMenu(null);
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl text-gray-600 hover:bg-gray-200 cursor-pointer"
          >
            <Copy size={16} strokeWidth={2.5} />
            Repeat Item
          </button>
        </ContextMenu>
      </td>
    </tr>
  );
}
