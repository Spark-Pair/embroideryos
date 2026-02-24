import { Printer, X } from "lucide-react";
import Modal from "../Modal";
import Button from "../Button";
import { formatDate, formatNumbers } from "../../utils";

// ─── Print styles injected once ──────────────────────────────────────────────
const PRINT_STYLE = `
@media print {
  body > * { display: none !important; }
  #invoice-print-root { display: block !important; }
  #invoice-print-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { margin: 12mm; size: A4; }
}
`;

function injectPrintStyle() {
  if (document.getElementById("invoice-print-style")) return;
  const s = document.createElement("style");
  s.id = "invoice-print-style";
  s.textContent = PRINT_STYLE;
  document.head.appendChild(s);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InvoicePreviewModal({
  isOpen,
  onClose,
  invoice,
  businessName = "",
  loading = false,
  onPrint,
}) {
  injectPrintStyle();

  const invoiceNo  = invoice?._id ? String(invoice._id).slice(-8).toUpperCase() : "N/A";
  const orders     = invoice?.orders || [];
  const totalAmt   = invoice?.total_amount ?? 0;
  const outstandingBalance = Number(invoice?.outstanding_balance) || 0;
  const newBalance = Number(invoice?.new_balance) || outstandingBalance + Number(totalAmt || 0);

  function handlePrint() {
    if (onPrint) { onPrint(); return; }
    window.print();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Invoice Preview"
      subtitle="Review and print"
      maxWidth="max-w-5xl"
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <Button variant="secondary" outline icon={X} onClick={onClose}>Close</Button>
          <Button icon={Printer} onClick={handlePrint} disabled={!invoice || loading}>
            Print Invoice
          </Button>
        </div>
      }
    >
      {loading && (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400">
          Loading invoice…
        </div>
      )}

      {!loading && !invoice && (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400">
          No invoice data available.
        </div>
      )}

      {!loading && invoice && (
        <div className="p-1 overflow-auto">
          <div
            id="invoice-print-root"
            className="mx-auto rounded-2xl border border-gray-200 overflow-hidden bg-white shadow-sm p-8 space-y-6 text-gray-900"
            style={{ width: "794px", minHeight: "1123px", fontFamily: "'Segoe UI', sans-serif" }}
          >
            <div className="flex items-start justify-between gap-6 border-b border-gray-200 pb-4">
              <div>
                <p className="text-2xl font-semibold tracking-tight text-gray-900 leading-tight">
                  {businessName || "EmbroideryOS"}
                </p>
                <p className="text-xs text-gray-500 mt-1">Billing Statement</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-semibold tracking-tight text-gray-900">Invoice</p>
              </div>
            </div>

            {/* Required invoice meta order: customer name, customer person, invoice date, bill no */}
            <div className="grid grid-cols-2 md:grid-cols-4 border border-gray-200 rounded-xl overflow-hidden text-sm">
              {[
                { label: "Customer Name", value: invoice.customer_name || "—" },
                { label: "Customer Person", value: invoice.customer_person || "—" },
                { label: "Invoice Date", value: formatDate(invoice.invoice_date, "DD MMM yyyy") || "—" },
                { label: "Bill No", value: `INV-${invoiceNo}` },
              ].map((item, idx) => (
                <div
                  key={item.label}
                  className={`px-4 py-3 ${idx !== 3 ? "border-r border-gray-100" : ""}`}
                >
                  <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">{item.label}</p>
                  <p className="mt-1 text-base font-semibold text-gray-900">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Line Items */}
            <div className="overflow-auto rounded-xl border border-gray-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-700 uppercase text-xs tracking-wider">
                    {["#", "Date", "Lot No", "Machine", "Description", "Qty", "Rate", "Amount"].map((h, i) => (
                      <th
                        key={h}
                        className={`${i >= 5 ? "text-right" : ""} px-3 py-2.5 font-medium`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((order, idx) => (
                    <tr key={order._id} className={idx % 2 === 0 ? "bg-white text-gray-800" : "bg-gray-50/50 text-gray-800"}>
                      <td className="px-3 py-2.5 text-gray-600 text-xs">{idx + 1}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-medium">{formatDate(order.date, "DD MMM yyyy")}</td>
                      <td className="px-3 py-2.5">{order.lot_no || "—"}</td>
                      <td className="px-3 py-2.5">{order.machine_no || "—"}</td>
                      <td className="px-3 py-2.5">{order.description || "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatNumbers(order.quantity, 0)} {order.unit}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatNumbers(order.rate, 2)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{formatNumbers(order.total_amount, 2)}</td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan={7} className="px-3 py-2.5 text-right font-bold tracking-wider text-gray-700 uppercase">Total</td>
                    <td className="px-3 py-2.5 text-right font-extrabold text-gray-900 tabular-nums">{formatNumbers(totalAmt, 2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Totals + Notes */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                {invoice.note && (
                  <div className="rounded-xl px-4 py-3 border border-gray-200 bg-gray-50/70">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-gray-600">Notes</p>
                    <p className="text-sm text-gray-700 mt-1.5">{invoice.note}</p>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 p-4 bg-gray-50/70">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Outstanding Balance</span>
                    <span className="tabular-nums text-gray-800">{formatNumbers(outstandingBalance, 2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Sub Total</span>
                    <span className="tabular-nums text-gray-800">{formatNumbers(totalAmt, 2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Tax</span>
                    <span className="tabular-nums text-gray-800">0.00</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    <span className="font-semibold text-gray-900">New Balance</span>
                    <span className="font-extrabold text-lg tabular-nums text-gray-900">{formatNumbers(newBalance, 2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2">
              {invoice.note && (
                <p className="text-[11px] text-gray-500 mb-3">Thank you for your business.</p>
              )}

              <div className="flex items-end justify-between border-t border-gray-200 pt-3">
                <div>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider">Generated by</p>
                  <p className="text-xs font-semibold text-gray-600 mt-0.5">{businessName || "EmbroideryOS"}</p>
                </div>
                <div className="text-center">
                  <div style={{ width: "180px", borderTop: "1px solid #6b7280", paddingTop: "6px" }}>
                    <p className="text-[9px] text-gray-400 uppercase tracking-wider">Authorized Signature</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
