import { ChevronLeft, ChevronRight, SlidersHorizontal, Download } from "lucide-react";
import Button from "../Button";

export default function TableToolbar({ currentPage, totalPages, onPageChange, onFilter, onExport }) {
  return (
    <div className="p-5 border-b border-gray-300 flex flex-wrap justify-between items-center gap-4">
      <div className="flex items-center bg-gray-100 rounded-xl p-1 border border-gray-300">
        <button
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          disabled={currentPage === 1}
          className="p-2 text-gray-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="px-3 flex items-center gap-2 text-xs">
          <span className="text-gray-500">Page</span>
          <input
            type="text"
            value={currentPage}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              const page = Number(e.target.value);
              if (!isNaN(page) && page >= 1 && page <= totalPages) onPageChange(page);
            }}
            className="w-8 h-8 bg-white border border-gray-300 rounded-md text-center font-medium focus:outline-0"
          />
          <span className="text-gray-500">of {totalPages}</span>
        </div>
        <button
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="p-2 text-gray-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="flex items-center gap-3.5">
        <Button icon={SlidersHorizontal} outline={true} variant="secondary" size="sm" onClick={onFilter}>
          Filters
        </Button>
        <Button icon={Download} outline={true} variant="secondary" size="sm" onClick={onExport}>
          Export
        </Button>
      </div>
    </div>
  );
}
