import { Edit3, Eye, Power, MoreVertical } from "lucide-react";
import ContextMenu from "../ContextMenu";
import StatusBadge from "../StatusBadge";
import { useState } from "react";
import { formatDate } from "../../utils";

export default function BusinessRow({ item, index, startIndex, onView, onEdit, onToggleStatus }) {
  const [activeMenu, setActiveMenu] = useState(null);

  return (
    <tr
      className="group hover:bg-gray-50/80 transition-colors cursor-pointer"
      onClick={() => onView(item)}
    >
      <td className="px-7 py-4 font-medium text-gray-500">{startIndex + index + 1}</td>
      <td className="px-7 py-4 font-semibold text-gray-800">{item.name}</td>
      <td className="px-7 py-4 text-sm text-gray-500 font-light">{item.person}</td>
      <td className="px-7 py-3.5 text-sm font-medium tracking-wider">{item.price}</td>
      <td className="px-7 py-3.5 text-sm tracking-wider">{formatDate(item.registration_date, 'dd-MMM-YYYY, DDD')}</td>
      <td className="px-7 py-3.5">
        <StatusBadge active={item.isActive} />
      </td>
      <td className="px-7 py-4 text-right relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setActiveMenu(activeMenu === item.id ? null : item.id);
          }}
          className="p-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100"
        >
          <MoreVertical size={18} />
        </button>

        <ContextMenu isOpen={activeMenu === item.id}>
          <button
            onClick={(e) => { e.stopPropagation(); onView(item); setActiveMenu(null); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl text-gray-600 hover:bg-gray-50 cursor-pointer"
          >
            <Eye size={16} strokeWidth={2.5} />
            View Details
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(item); setActiveMenu(null); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl text-gray-600 hover:bg-gray-50 cursor-pointer"
          >
            <Edit3 size={16} strokeWidth={2.5} />
            Edit Business
          </button>
          <div className="h-[1px] bg-gray-50 my-1" />
          <button
            onClick={(e) => { e.stopPropagation(); onToggleStatus(item); setActiveMenu(null); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl cursor-pointer
              ${item.isActive ? "text-rose-500 hover:bg-rose-50" : "text-emerald-500 hover:bg-emerald-50"}`}
          >
            <Power size={16} strokeWidth={2.5} />
            {item.isActive ? "Mark Inactive" : "Mark Active"}
          </button>
        </ContextMenu>
      </td>
    </tr>
  );
}
