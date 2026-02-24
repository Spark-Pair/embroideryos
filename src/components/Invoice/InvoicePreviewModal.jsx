import { Printer, X } from "lucide-react";
import Modal from "../Modal";
import Button from "../Button";
import { formatDate, formatNumbers } from "../../utils";

const PRINT_STYLE = `
@media print {
  body * { visibility: hidden !important; }
  #invoice-print-root, #invoice-print-root * { visibility: visible !important; }

  #invoice-print-root {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 297mm !important;
    min-height: 210mm !important;
    margin: 0 !important;
    padding: 4mm !important;
    box-sizing: border-box !important;
    border: 0 !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    background: #fff !important;
  }

  #invoice-print-root .print-layout {
    display: flex !important;
    gap: 4mm !important;
    width: 100% !important;
    min-height: 200mm !important;
  }

  #invoice-print-root .invoice-copy {
    width: calc((100% - 4mm) / 2) !important;
    min-height: 200mm !important;
    border: 1px solid #d1d5db !important;
    border-radius: 2mm !important;
    overflow: hidden !important;
    background: #fff !important;
    page-break-inside: avoid !important;
  }

  #invoice-print-root .invoice-body {
    padding: 4mm !important;
  }

  #invoice-print-root .invoice-banner {
    max-height: 22mm !important;
  }

  #invoice-print-root .invoice-image {
    max-height: 40mm !important;
  }

  #invoice-print-root .print-only {
    display: block !important;
  }

  #invoice-print-root .screen-only {
    display: none !important;
  }

  #invoice-print-root * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  @page {
    size: A4 landscape;
    margin: 0;
  }
}
`;

function injectPrintStyle() {
  if (document.getElementById("invoice-print-style")) return;
  const s = document.createElement("style");
  s.id = "invoice-print-style";
  s.textContent = PRINT_STYLE;
  document.head.appendChild(s);
}

function InvoiceDocument({ invoice, businessName, bannerUrl }) {
  const invoiceNo = invoice?._id ? String(invoice._id).slice(-8).toUpperCase() : "N/A";
  const orders = invoice?.orders || [];
  const totalAmt = invoice?.total_amount ?? 0;
  const outstandingBalance = Number(invoice?.outstanding_balance) || 0;
  const newBalance = Number(invoice?.new_balance) || outstandingBalance + Number(totalAmt || 0);

  return (
    <div className="invoice-copy bg-white text-gray-900 overflow-hidden">
      {bannerUrl && (
        <img
          src={bannerUrl}
          alt="Invoice banner"
          className="invoice-banner w-full h-auto object-cover"
        />
      )}

      <div className="invoice-body space-y-3" style={{ fontFamily: "'Segoe UI', sans-serif" }}>
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 pb-2">
          <div>
            <p className="text-base font-semibold tracking-tight text-gray-900 leading-tight">
              {businessName || "EmbroideryOS"}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">Billing Statement</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold tracking-tight text-gray-900">Invoice</p>
          </div>
        </div>

        <div className="grid grid-cols-4 border border-gray-200 rounded-lg overflow-hidden text-[11px]">
          {[
            { label: "Customer Name", value: invoice.customer_name || "-" },
            { label: "Customer Person", value: invoice.customer_person || "-" },
            { label: "Invoice Date", value: formatDate(invoice.invoice_date, "DD MMM yyyy") || "-" },
            { label: "Bill No", value: `INV-${invoiceNo}` },
          ].map((item, idx) => (
            <div key={item.label} className={`px-2 py-1.5 ${idx !== 3 ? "border-r border-gray-100" : ""}`}>
              <p className="text-[9px] uppercase tracking-wider text-gray-500 font-medium">{item.label}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-gray-900 truncate">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-left border-collapse text-[10px]">
            <thead>
              <tr className="bg-gray-50 text-gray-700 uppercase tracking-wider">
                {["#", "Date", "Lot", "Machine", "Description", "Qty", "Rate", "Amount"].map((h, i) => (
                  <th key={h} className={`${i >= 5 ? "text-right" : ""} px-1.5 py-1.5 font-medium`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order, idx) => (
                <tr key={order._id} className={idx % 2 === 0 ? "bg-white text-gray-800" : "bg-gray-50/60 text-gray-800"}>
                  <td className="px-1.5 py-1 text-gray-600">{idx + 1}</td>
                  <td className="px-1.5 py-1 whitespace-nowrap font-medium">{formatDate(order.date, "DD MMM yyyy")}</td>
                  <td className="px-1.5 py-1">{order.lot_no || "-"}</td>
                  <td className="px-1.5 py-1">{order.machine_no || "-"}</td>
                  <td className="px-1.5 py-1">{order.description || "-"}</td>
                  <td className="px-1.5 py-1 text-right tabular-nums">{formatNumbers(order.quantity, 0)} {order.unit}</td>
                  <td className="px-1.5 py-1 text-right tabular-nums">{formatNumbers(order.rate, 2)}</td>
                  <td className="px-1.5 py-1 text-right tabular-nums font-semibold">{formatNumbers(order.total_amount, 2)}</td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr className="bg-gray-50">
                <td colSpan={7} className="px-1.5 py-1.5 text-right font-bold tracking-wider text-gray-700 uppercase">Total</td>
                <td className="px-1.5 py-1.5 text-right font-extrabold text-gray-900 tabular-nums">{formatNumbers(totalAmt, 2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            {invoice.note && (
              <div className="rounded-lg px-2 py-1.5 border border-gray-200 bg-gray-50/70">
                <p className="text-[9px] font-medium uppercase tracking-wider text-gray-600">Notes</p>
                <p className="text-[10px] text-gray-700 mt-0.5 break-words">{invoice.note}</p>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 p-2 bg-gray-50/70">
            <div className="space-y-1.5 text-[10px]">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Outstanding</span>
                <span className="tabular-nums text-gray-800">{formatNumbers(outstandingBalance, 2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Sub Total</span>
                <span className="tabular-nums text-gray-800">{formatNumbers(totalAmt, 2)}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                <span className="font-semibold text-gray-900">New Balance</span>
                <span className="font-extrabold text-sm tabular-nums text-gray-900">{formatNumbers(newBalance, 2)}</span>
              </div>
            </div>
          </div>
        </div>

        {invoice.image_data && (
          <div className="rounded-lg border border-gray-300 bg-gray-50 p-2">
            <img
              src={invoice.image_data}
              alt="Invoice attachment"
              className="invoice-image w-full h-auto object-contain rounded"
            />
          </div>
        )}

        <div className="pt-1 border-t border-gray-200 flex items-end justify-between">
          <div>
            <p className="text-[8px] text-gray-400 uppercase tracking-wider">Generated by</p>
            <p className="text-[10px] font-semibold text-gray-600 mt-0.5">{businessName || "EmbroideryOS"}</p>
          </div>
          <div className="text-center">
            <div style={{ width: "110px", borderTop: "1px solid #6b7280", paddingTop: "4px" }}>
              <p className="text-[8px] text-gray-400 uppercase tracking-wider">Signature</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InvoicePreviewModal({
  isOpen,
  onClose,
  invoice,
  bannerUrl = "",
  businessName = "",
  loading = false,
  onPrint,
}) {
  injectPrintStyle();

  function handlePrint() {
    if (onPrint) {
      onPrint();
      return;
    }
    window.print();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Invoice Preview"
      subtitle="Review and print"
      maxWidth="max-w-6xl"
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
          Loading invoice...
        </div>
      )}

      {!loading && !invoice && (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400">
          No invoice data available.
        </div>
      )}

      {!loading && invoice && (
        <div className="p-1 overflow-auto">
          <div id="invoice-print-root" className="mx-auto bg-white">
            <div className="print-layout block">
              <div className="screen-only" style={{ width: "560px", margin: "0 auto" }}>
                <InvoiceDocument invoice={invoice} businessName={businessName} bannerUrl={bannerUrl} />
              </div>

              <div className="print-only" style={{ display: "none" }}>
                <InvoiceDocument invoice={invoice} businessName={businessName} bannerUrl={bannerUrl} />
              </div>

              <div className="print-only" style={{ display: "none" }}>
                <InvoiceDocument invoice={invoice} businessName={businessName} bannerUrl={bannerUrl} />
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
