import { Edit3, Eye, MoreVertical, Power } from "lucide-react";
import { useState } from "react";
import ContextMenu from "../ContextMenu";
import StatusBadge from "../StatusBadge";
import { formatNumbers } from "../../utils";

export default function SupplierRow({ item, index, startIndex, onView, onEdit, onToggleStatus }) {
  const [activeMenu, setActiveMenu] = useState(null);

  return (
    <tr
      className="group hover:bg-gray-50/80 transition-colors cursor-pointer"
      onClick={() => onView(item)}
    >
      <td className="px-7 py-4 font-medium text-gray-500">{startIndex + index + 1}</td>
      <td className="px-7 py-4 font-semibold text-gray-800">{item.name}</td>
      <td className="px-7 py-4 text-sm text-gray-500 font-light">
        {formatNumbers(item.current_balance ?? item.opening_balance, 2)}
      </td>
      <td className="px-7 py-3.5">
        <StatusBadge active={item.isActive} />
      </td>
      <td className="px-7 py-4 text-right relative">
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
            Edit Supplier
          </button>
          <div className="h-[1px] bg-gray-200 my-1.5" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleStatus(item);
              setActiveMenu(null);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl cursor-pointer ${item.isActive ? "text-rose-500 hover:bg-rose-50" : "text-emerald-500 hover:bg-emerald-50"}`}
          >
            <Power size={16} strokeWidth={2.5} />
            {item.isActive ? "Mark Inactive" : "Mark Active"}
          </button>
        </ContextMenu>
      </td>
    </tr>
  );
}
