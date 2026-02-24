import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, Plus } from "lucide-react";
import PageHeader from "../components/PageHeader";
import TableToolbar from "../components/table/TableToolbar";
import TableSkeleton from "../components/table/TableLoader";
import FilterDrawer from "../components/FilterDrawer";
import { useToast } from "../context/ToastContext";
import { formatDate, formatNumbers } from "../utils";
import { createInvoice, fetchInvoice, fetchInvoices } from "../api/invoice";
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

  const handlePrintPreview = () => {
    const invoice = previewModal.data;
    if (!invoice) return;
    const invoiceNo = invoice?._id ? String(invoice._id).slice(-8).toUpperCase() : "N/A";
    const customerPerson = invoice.customer_person || "---";
    const outstandingBalance = Number(invoice.outstanding_balance) || 0;
    const newBalance = Number(invoice.new_balance) || outstandingBalance + (Number(invoice.total_amount) || 0);

    const rows = (invoice.orders || [])
      .map(
        (order, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${formatDate(order.date, "DD MMM yyyy")}</td>
            <td>${order.lot_no || "---"}</td>
            <td>${order.machine_no || "---"}</td>
            <td>${formatNumbers(order.quantity, 0)} ${order.unit || ""}</td>
            <td style="text-align:right;">${formatNumbers(order.rate, 2)}</td>
            <td style="text-align:right;">${formatNumbers(order.total_amount, 2)}</td>
          </tr>
        `
      )
      .join("");

    const w = window.open("", "_blank", "width=1100,height=900");
    if (!w) {
      showToast({ type: "error", message: "Pop-up blocked. Please allow pop-ups to print." });
      return;
    }

    w.document.write(`
      <html>
        <head>
          <title>Invoice - ${invoice.customer_name}</title>
          <style>
            @page { margin: 12mm; size: A4; }
            body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; margin: 0; }
            .doc { width: 100%; max-width: 1000px; margin: 0 auto; }
            .header { border-bottom: 3px solid #1e293b; padding: 18px 0 14px; display: flex; justify-content: space-between; }
            .brand-title { font-size: 20px; font-weight: 800; letter-spacing: -0.01em; margin: 0; }
            .brand-sub { font-size: 10px; color: #64748b; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.12em; }
            .invoice-title { font-size: 34px; font-weight: 900; letter-spacing: -0.03em; margin: 0; color: #1e293b; text-align: right; }
            .meta-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; margin: 14px 0; }
            .meta-cell { padding: 10px 12px; border-right: 1px solid #e2e8f0; }
            .meta-cell:last-child { border-right: 0; }
            .label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; }
            .value { font-size: 14px; font-weight: 700; margin-top: 5px; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th { background: #1e293b; color: #fff; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; padding: 9px 8px; text-align: left; }
            td { border-bottom: 1px solid #e2e8f0; padding: 8px; font-size: 12px; color: #334155; }
            tbody tr:nth-child(even) td { background: #f8fafc; }
            tfoot td { background: #1e293b; color: #fff; font-size: 12px; font-weight: 800; padding: 9px 8px; }
            .right { text-align: right; }
            .note { margin-top: 14px; border: 1px solid #fde68a; background: #fffbeb; border-radius: 10px; padding: 10px; }
            .note p { margin: 0; font-size: 11px; color: #92400e; }
            .summary { margin-top: 14px; margin-left: auto; width: 320px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
            .summary-row { display: flex; justify-content: space-between; padding: 8px 10px; font-size: 12px; border-bottom: 1px solid #e2e8f0; }
            .summary-row:last-child { border-bottom: 0; font-size: 13px; font-weight: 800; background: #f8fafc; color: #0f172a; }
            .footer { border-top: 1px solid #e2e8f0; margin-top: 18px; padding-top: 12px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="doc">
            <div class="header">
              <div>
                <p class="brand-title">${businessName}</p>
                <p class="brand-sub">Management System</p>
              </div>
              <div>
                <p class="invoice-title">INVOICE</p>
              </div>
            </div>

            <div class="meta-grid">
              <div class="meta-cell">
                <div class="label">Customer Name</div>
                <div class="value">${invoice.customer_name}</div>
              </div>
              <div class="meta-cell">
                <div class="label">Customer Person</div>
                <div class="value">${customerPerson}</div>
              </div>
              <div class="meta-cell">
                <div class="label">Invoice Date</div>
                <div class="value">${formatDate(invoice.invoice_date, "DD MMM yyyy")}</div>
              </div>
              <div class="meta-cell">
                <div class="label">Bill No</div>
                <div class="value">INV-${invoiceNo}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Lot No</th>
                  <th>Machine</th>
                  <th class="right">Quantity</th>
                  <th class="right">Rate</th>
                  <th class="right">Amount</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
              <tfoot>
                <tr>
                  <td colspan="6" class="right">TOTAL</td>
                  <td class="right">${formatNumbers(invoice.total_amount, 2)}</td>
                </tr>
              </tfoot>
            </table>

            <div class="summary">
              <div class="summary-row"><span>Outstanding Balance</span><span>${formatNumbers(outstandingBalance, 2)}</span></div>
              <div class="summary-row"><span>Total Orders</span><span>${formatNumbers(invoice.order_count, 0)}</span></div>
              <div class="summary-row"><span>Sub Total</span><span>${formatNumbers(invoice.total_amount, 2)}</span></div>
              <div class="summary-row"><span>Invoice Amount</span><span>${formatNumbers(invoice.total_amount, 2)}</span></div>
              <div class="summary-row"><span>New Balance</span><span>${formatNumbers(newBalance, 2)}</span></div>
            </div>

            ${invoice.note ? `<div class="note"><p>${invoice.note}</p></div>` : ""}

            <div class="footer">
              <span>Generated by ${businessName}</span>
              <span>Authorized Signature __________________</span>
            </div>
          </div>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
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
        businessName={businessName}
        loading={previewLoading}
        onPrint={handlePrintPreview}
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
