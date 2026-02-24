import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, Plus } from "lucide-react";
import PageHeader from "../components/PageHeader";
import TableToolbar from "../components/table/TableToolbar";
import TableSkeleton from "../components/table/TableLoader";
import FilterDrawer from "../components/FilterDrawer";
import { useToast } from "../context/ToastContext";
import { formatDate, formatNumbers } from "../utils";
import { createInvoice, fetchInvoice, fetchInvoices } from "../api/invoice";
import { fetchMyInvoiceBanner } from "../api/business";
import InvoiceFormModal from "../components/Invoice/InvoiceFormModal";
import InvoicePreviewModal from "../components/Invoice/InvoicePreviewModal";
import Button from "../components/Button";
import useAuth from "../hooks/useAuth";

export default function Invoices() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const businessName = user?.business?.name || "EmbroideryOS";

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formModal, setFormModal] = useState({ isOpen: false });
  const [previewModal, setPreviewModal] = useState({ isOpen: false, data: null });
  const [previewLoading, setPreviewLoading] = useState(false);
  const [invoiceBanner, setInvoiceBanner] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    customer_name: "",
    date_from: "",
    date_to: "",
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 30,
  });

  const tableScrollRef = useRef(null);

  const loadInvoices = useCallback(async (page = 1, filterParams = {}) => {
    try {
      setLoading(true);
      const res = await fetchInvoices({ page, limit: 30, ...filterParams });
      setInvoices(res?.data || []);
      if (res.pagination) setPagination(res.pagination);
    } catch (err) {
      showToast({ type: "error", message: err.response?.data?.message || "Failed to load invoices" });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  useEffect(() => {
    const loadBanner = async () => {
      try {
        const res = await fetchMyInvoiceBanner();
        setInvoiceBanner(res?.invoice_banner_data || "");
      } catch {
        setInvoiceBanner("");
      }
    };

    loadBanner();
  }, []);

  useEffect(() => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [pagination.currentPage]);

  const handleInvoiceFormAction = async (payload) => {
    try {
      await createInvoice(payload);
      showToast({ type: "success", message: "Invoice saved successfully" });
      await loadInvoices(pagination.currentPage, filters);
    } catch (err) {
      showToast({ type: "error", message: err.response?.data?.message || "Failed to save invoice" });
      throw err;
    }
  };

  const handlePageChange = (page) => loadInvoices(page, filters);
  const handleApplyFilters = () => {
    loadInvoices(1, filters);
    setIsFilterOpen(false);
  };
  const handleResetFilters = () => {
    const reset = { customer_name: "", date_from: "", date_to: "" };
    setFilters(reset);
    loadInvoices(1, reset);
    setIsFilterOpen(false);
  };

  const filterConfig = [
    {
      label: "Customer Name",
      placeholder: "Search by customer name",
      type: "text",
      value: filters.customer_name,
      onChange: (e) => setFilters((prev) => ({ ...prev, customer_name: e.target.value })),
    },
    {
      label: "Date From",
      type: "date",
      value: filters.date_from,
      onChange: (e) => setFilters((prev) => ({ ...prev, date_from: e.target.value })),
    },
    {
      label: "Date To",
      type: "date",
      value: filters.date_to,
      onChange: (e) => setFilters((prev) => ({ ...prev, date_to: e.target.value })),
    },
  ];

  const handleOpenPreview = async (invoiceId) => {
    setPreviewModal({ isOpen: true, data: null });
    setPreviewLoading(true);
    try {
      const res = await fetchInvoice(invoiceId);
      setPreviewModal({ isOpen: true, data: res?.data || null });
    } catch (err) {
      showToast({ type: "error", message: err.response?.data?.message || "Failed to load invoice preview" });
      setPreviewModal({ isOpen: false, data: null });
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <>
      <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col">
        <PageHeader
          title="Invoices"
          subtitle="Generate and manage customer invoices from grouped orders."
          actionLabel="Generate Invoice"
          actionIcon={Plus}
          onAction={() => setFormModal({ isOpen: true })}
        />

        <div className="rounded-3xl bg-white border border-gray-300 overflow-hidden flex-1 flex flex-col">
          <TableToolbar
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            onPageChange={handlePageChange}
            onFilter={() => setIsFilterOpen(true)}
          />

          <div ref={tableScrollRef} className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-20 bg-gray-100" style={{ boxShadow: "0 1px 0 0 rgba(209,213,219,1)" }}>
                <tr className="text-sm tracking-wider text-gray-500">
                  <th className="px-5 py-3.5 font-medium">#</th>
                  <th className="px-5 py-3.5 font-medium">Invoice Date</th>
                  <th className="px-5 py-3.5 font-medium">Customer</th>
                  <th className="px-5 py-3.5 font-medium">Orders</th>
                  <th className="px-5 py-3.5 font-medium">Total Amount</th>
                  <th className="px-5 py-3.5 font-medium text-right">Actions</th>
                </tr>
              </thead>

              {loading ? (
                <TableSkeleton rows={30} columns={6} />
              ) : (
                <tbody className="divide-y divide-gray-200">
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-7 py-16 text-center text-sm text-gray-400">
                        No invoices found.
                      </td>
                    </tr>
                  ) : (
                    invoices.map((invoice, index) => (
                      <tr key={invoice._id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-5 py-4 font-medium text-gray-500">
                          {(pagination.currentPage - 1) * pagination.itemsPerPage + index + 1}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-600">{formatDate(invoice.invoice_date, "DD MMM yyyy")}</td>
                        <td className="px-5 py-4 text-sm font-semibold text-gray-800">{invoice.customer_name}</td>
                        <td className="px-5 py-4 text-sm text-gray-600">{formatNumbers(invoice.order_count, 0)}</td>
                        <td className="px-5 py-4 text-sm font-semibold text-emerald-700">{formatNumbers(invoice.total_amount, 2)}</td>
                        <td className="px-5 py-4 text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            outline
                            icon={Eye}
                            onClick={() => handleOpenPreview(invoice._id)}
                          >
                            Preview
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              )}
            </table>
          </div>
        </div>
      </div>

      <InvoiceFormModal
        isOpen={formModal.isOpen}
        onClose={() => setFormModal({ isOpen: false })}
        onAction={handleInvoiceFormAction}
      />

      <InvoicePreviewModal
        isOpen={previewModal.isOpen}
        onClose={() => setPreviewModal({ isOpen: false, data: null })}
        invoice={previewModal.data}
        bannerUrl={invoiceBanner}
        businessName={businessName}
        loading={previewLoading}
      />

      <FilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filterConfig}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />
    </>
  );
}
