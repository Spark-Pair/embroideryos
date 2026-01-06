import React, { useState, useRef, useEffect } from "react";
import { Plus, Users, CircleCheck, XCircle } from "lucide-react";

import StatCard from "../components/StatCard";
import TableToolbar from "../components/table/TableToolbar";
import CustomerModal from "../components/customer/CustomerModal";
import CustomerRow from "../components/Customer/CustomerRow";
import FilterDrawer from "../components/FilterDrawer";
import TableSkeleton from "../components/table/TableLoader";
import PageHeader from "../components/PageHeader";

import usePagination from "../hooks/usePagination";

// Dummy Data
const data = [
  { id: 1, name: 'ABC Traders', person: 'Junaid Ahmed', rate: '1.75', isActive: true },
  { id: 2, name: 'Junaid Ki Dukaan', person: 'Sana Khan', rate: '1.60', isActive: false },
  { id: 3, name: 'Imran Bukhari', person: 'imran Khan', rate: '1.80', isActive: true },
];

export default function Customers() {
  const [customers, setCustomers] = useState(data);
  const [loading, setLoading] = useState(false);

  // Pagination
  const {
    pageData,
    currentPage,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    setCurrentPage,
  } = usePagination(customers, 30);

  const tableScrollRef = useRef(null);

  useEffect(() => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentPage, pageData]);

  // Filter Sidebar
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Modal
  const [modal, setModal] = useState({
    isOpen: false,
    data: null,
    mode: "add",
  });

  const [filters, setFilters] = useState([
    { label: "Customer Name", type: "text", value: "", onChange: (val) => setFilters(f => {
      const newFilters = [...f];
      newFilters[0].value = val;
      return newFilters;
    }) },
    { label: "Status", type: "select", value: "active", options: [
      { label: "Active Only", value: "active" },
      { label: "Inactive Only", value: "inactive" },
    ], onChange: (val) => setFilters(f => {
      const newFilters = [...f];
      newFilters[1].value = val;
      return newFilters;
    }) },
  ]);

  // Simulate API load (Skeleton Loader)
  const loadPage = (page) => {
    setLoading(true);
    setTimeout(() => {
      goToPage(page);
      setLoading(false);
    }, 500); // simulate backend delay
  };

  const handleCustomerAction = (action, data) => {
    if (action === "edit") {
      setModal({ isOpen: true, mode: "edit", data });
    }
    if (action === "toggleStatus") {
      // Toggle active/inactive
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === data.id ? { ...c, isActive: !c.isActive } : c
        )
      );
    }
  };

  return (
    <>
      <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col">
        {/* Header */}
        <PageHeader
          title="Customer"
          subtitle="Manage all your customers effortlessly."
          actionLabel="Add Customer"
          actionIcon={Plus}
          onAction={() => setModal({ isOpen: true, data: null, mode: "add" })}
        />

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <StatCard
            label="Total Customer"
            value={customers.length}
            icon={Users}
          />
          <StatCard
            label="Active Customers"
            value={customers.filter((c) => c.isActive).length}
            icon={CircleCheck}
            variant="success"
          />
          <StatCard
            label="In Active Customer"
            value={customers.filter((c) => !c.isActive).length}
            icon={XCircle}
            variant="danger"
          />
        </div>

        {/* Table Container */}
        <div className="rounded-3xl bg-white border border-gray-300 overflow-hidden flex-1 flex flex-col">
          {/* Table Toolbar */}
          <TableToolbar
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => loadPage(page)}
            onFilter={() => setIsFilterOpen(true)}
            onExport={() => console.log("Export clicked")}
          />

          {/* Table Data */}
          <div ref={tableScrollRef} className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead
                className="sticky top-0 z-20 bg-gray-100"
                style={{ boxShadow: "0 1px 0 0 rgba(209,213,219,1)" }}
              >
                <tr className="text-sm tracking-wider text-gray-500">
                  <th className="px-7 py-3.5 font-medium">Id</th>
                  <th className="px-7 py-3.5 font-medium">Customer Name</th>
                  <th className="px-7 py-3.5 font-medium">Person Name</th>
                  <th className="px-7 py-3.5 font-medium">Rate</th>
                  <th className="px-7 py-3.5 font-medium">Status</th>
                  <th className="px-7 py-3.5 font-medium text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              {loading ? (
                <TableSkeleton rows={pageData.length} />
              ) : (
                <tbody className="divide-y divide-gray-200">
                  {pageData.map((item, index) => (
                    <CustomerRow
                      key={item.id}
                      item={item}
                      index={index}
                      startIndex={(currentPage - 1) * 30}
                      onView={(data) =>
                        setModal({ isOpen: true, data, mode: "details" })
                      }
                      onEdit={(data) =>
                        setModal({ isOpen: true, data, mode: "edit" })
                      }
                      onToggleStatus={(data) =>
                        handleCustomerAction("toggleStatus", data)
                      }
                    />
                  ))}
                </tbody>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* Customer Modal */}
      <CustomerModal
        isOpen={modal.isOpen}
        mode={modal.mode}
        initialData={modal.data}
        onClose={() => setModal({ ...modal, isOpen: false })}
        onAction={handleCustomerAction}
      />

      {/* Filter Drawer */}
      <FilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        onApply={() => console.log("Apply filters", filters)}
        onReset={() => console.log("Reset filters")}
      />
    </>
  );
}
