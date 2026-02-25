import { Printer, X } from "lucide-react";
import Modal from "../Modal";
import Button from "../Button";
import { formatDate, formatNumbers } from "../../utils";

/**
 * PRINT LAYOUT MATH
 * A4 landscape = 297mm × 210mm | @page margin: 0
 * Each copy = 148.5mm wide, 5mm padding all sides
 * Content = 138.5mm × 200mm
 * After cut: all 4 sides = 5mm equal ✓
 * MAX ORDERS = 7
 */
export const MAX_INVOICE_ORDERS = 7;

const PRINT_STYLE = `
  @media print {
    html, body {
      width: 297mm !important;
      height: 210mm !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
    }

    body * { visibility: hidden !important; }
    #invoice-print-root, #invoice-print-root * { visibility: visible !important; }

    #invoice-print-root {
      position: fixed !important;
      left: 0 !important;
      top: 0 !important;
      width: 297mm !important;
      height: 210mm !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      background: #fff !important;
      overflow: hidden !important;
      border: 0 !important;
      box-shadow: none !important;
      border-radius: 0 !important;
    }

    #invoice-print-root .screen-only {
      display: none !important;
      visibility: hidden !important;
    }

    #invoice-print-root .print-layout {
      display: flex !important;
      flex-direction: row !important;
      width: 297mm !important;
      height: 210mm !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
    }

    #invoice-print-root .print-copy {
      display: flex !important;
      flex-direction: column !important;
      width: 148.5mm !important;
      height: 210mm !important;
      padding: 5mm !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      flex-shrink: 0 !important;
      background: #fff !important;
    }

    #invoice-print-root .copy-divider {
      display: none !important;
    }

    #invoice-print-root .invoice-copy {
      display: flex !important;
      flex-direction: column !important;
      width: 100% !important;
      height: 100% !important;
      overflow: hidden !important;
      background: #fff !important;
      box-sizing: border-box !important;
    }

    #invoice-print-root .invoice-banner-wrap {
      flex-shrink: 0 !important;
      width: 100% !important;
      line-height: 0 !important;
      margin-bottom: 4mm !important;
    }

    #invoice-print-root .invoice-banner {
      width: 100% !important;
      height: auto !important;
      display: block !important;
    }

    #invoice-print-root .invoice-body {
      flex: 1 1 auto !important;
      overflow: hidden !important;
      width: 100% !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 8px !important;
    }

    #invoice-print-root .invoice-summary {
      flex-shrink: 0 !important;
    }

    #invoice-print-root .invoice-image-wrap {
      flex-shrink: 0 !important;
      width: 100% !important;
      height: 65mm !important;
      border: 1px solid #111111ed !important;
      border-radius: 9px !important;
      background: #dcdcdc !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
      padding: 3mm !important;
    }

    #invoice-print-root .invoice-image {
      max-width: 100% !important;
      max-height: 54mm !important;
      width: auto !important;
      height: auto !important;
      object-fit: contain !important;
      display: block !important;
    }

    #invoice-print-root * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
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

function getQuantityInPcs(order) {
  const pcs = Number(order?.qt_pcs);
  if (Number.isFinite(pcs) && pcs > 0) return pcs;

  const qty = Number(order?.quantity);
  if (!Number.isFinite(qty)) return 0;

  if (order?.unit === "Pcs") return qty;
  if (order?.unit === "Dzn") return qty * 12;
  return qty;
}

function InvoiceDocument({ invoice, businessName, bannerUrl }) {
  const invoiceNo = invoice?._id ? String(invoice._id).slice(-8).toUpperCase() : "N/A";
  const orders = (invoice?.orders || []).slice(0, MAX_INVOICE_ORDERS);
  const totalAmt = invoice?.total_amount ?? 0;
  const outstandingBalance = Number(invoice?.outstanding_balance) || 0;
  const newBalance = Number(invoice?.new_balance) || outstandingBalance + Number(totalAmt || 0);
  const hasBanner = !!bannerUrl;

  return (
    <div
      className="invoice-copy bg-white"
      style={{ fontFamily: "'Segoe UI', sans-serif", boxSizing: "border-box" }}
    >
      {/* ── Banner ── */}
      {hasBanner && (
        <div
          className="invoice-banner-wrap"
          style={{ width: "100%", flexShrink: 0, marginBottom: "10px", lineHeight: 0 }}
        >
          <img
            src={bannerUrl}
            alt="Invoice banner"
            className="invoice-banner"
            style={{ width: "100%", height: "auto", display: "block" }}
          />
        </div>
      )}

      <div
        className="invoice-body"
        style={{ display: "flex", flexDirection: "column", gap: "10px", flex: "1 1 auto", overflow: "hidden" }}
      >
        {/* ── Header: only when NO banner ── */}
        {!hasBanner && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#111827" }}>{businessName || "EmbroideryOS"}</span>
            <span style={{ fontSize: "9px", fontWeight: 500, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>Invoice</span>
          </div>
        )}

        {/* ── Meta ── */}
        <div style={{ flexShrink: 0, padding: "6px 10px", background: "#dcdcdc", borderRadius: "8px", border: "1px solid #111111ed" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "2px" }}>
            <span style={{ fontSize: "13px", fontWeight: 800, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>
              {invoice.customer_name || "-"}
            </span>
            <span style={{ fontSize: "10px", fontWeight: 700, color: "#111827", whiteSpace: "nowrap" }}>
              INV-{invoiceNo}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: "10px", fontWeight: 400, color: "#111827" }}>
              {invoice.customer_person || "-"}
            </span>
            <span style={{ fontSize: "10px", fontWeight: 400, color: "#111827" }}>
              {formatDate(invoice.invoice_date, "DD MMM yyyy") || "-"}
            </span>
          </div>
        </div>

        {/* ── Orders table ── */}
        <div style={{ border: "1px solid #111111ed", borderRadius: "10px", overflow: "hidden", flexShrink: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "5%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "32%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "13%" }} />
            </colgroup>
            <thead>
              <tr style={{ background: "#1e293b" }}>
                {["#", "Date", "Lot", "Description", "Qty (Pcs)", "Rate", "Amount"].map((h, i) => (
                  <th key={h} style={{ padding: "7px 6px", fontWeight: 700, textAlign: i >= 4 ? "right" : "left", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#fff", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order, idx) => (
                <tr key={order._id ?? idx} style={{ background: idx % 2 === 0 ? "#fff" : "#dcdcdc", borderTop: "1px solid #111111ed" }}>
                  <td style={{ padding: "6px", color: "#111827", fontWeight: 400 }}>{idx + 1}</td>
                  <td style={{ padding: "6px", fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {formatDate(order.date, "DD MMM yyyy")}
                  </td>
                  <td style={{ padding: "6px", fontWeight: 400, color: "#111827", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {order.lot_no || "-"}
                  </td>
                  <td style={{ padding: "6px", fontWeight: 400, color: "#111827", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {order.description || "-"}
                  </td>
                  <td style={{ padding: "6px", textAlign: "right", fontWeight: 600, color: "#111827", fontVariantNumeric: "tabular-nums" }}>
                    {formatNumbers(getQuantityInPcs(order), 0)} Pcs
                  </td>
                  <td style={{ padding: "6px", textAlign: "right", fontWeight: 400, color: "#111827", fontVariantNumeric: "tabular-nums" }}>
                    {formatNumbers(order.rate, 2)}
                  </td>
                  <td style={{ padding: "6px", textAlign: "right", fontWeight: 800, color: "#111827", fontVariantNumeric: "tabular-nums" }}>
                    {formatNumbers(order.total_amount, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Spacer */}
        <div style={{ flex: "1 1 auto" }} />

        {/* ── Summary ── */}
        <div className="invoice-summary" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", flexShrink: 0 }}>
          <div>
            {invoice.note && (
              <div style={{ border: "1px solid #111111ed", borderRadius: "10px", padding: "8px 10px", background: "#dcdcdc", height: "100%", boxSizing: "border-box" }}>
                <p style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.07em", color: "#111827", margin: 0, fontWeight: 600 }}>Notes</p>
                <p style={{ fontSize: "11px", fontWeight: 400, color: "#111827", margin: "3px 0 0", wordBreak: "break-word" }}>{invoice.note}</p>
              </div>
            )}
          </div>
          <div style={{ border: "1px solid #111111ed", borderRadius: "10px", padding: "8px 10px", background: "#dcdcdc" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
                <span style={{ fontWeight: 400, color: "#111827" }}>Outstanding</span>
                <span style={{ fontWeight: 600, color: "#111827", fontVariantNumeric: "tabular-nums" }}>{formatNumbers(outstandingBalance, 2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
                <span style={{ fontWeight: 400, color: "#111827" }}>Sub Total</span>
                <span style={{ fontWeight: 600, color: "#111827", fontVariantNumeric: "tabular-nums" }}>{formatNumbers(totalAmt, 2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1.5px solid #111111ed", paddingTop: "5px" }}>
                <span style={{ fontWeight: 700, color: "#111827", fontSize: "11px" }}>New Balance</span>
                <span style={{ fontWeight: 900, fontSize: "14px", fontVariantNumeric: "tabular-nums", color: "#111827" }}>
                  {formatNumbers(newBalance, 2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Image box: always shown, empty if no image ── */}
        {(
          <div
            className="invoice-image-wrap"
            style={{
              flexShrink: 0,
              width: "100%",
              height: "200px",
              border: "1px solid #111111ed",
              borderRadius: "10px",
              background: "#dcdcdc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              boxSizing: "border-box",
              padding: "8px",
            }}
          >
            {invoice.image_data && invoice.image_data.trim() !== "" && (
              <img
                src={invoice.image_data}
                alt=""
                className="invoice-image"
                style={{ maxWidth: "100%", maxHeight: "174px", width: "auto", height: "auto", objectFit: "contain", display: "block" }}
              />
            )}
          </div>
        )}
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

  const ordersCount = invoice?.orders?.length ?? 0;
  const isOverLimit = ordersCount > MAX_INVOICE_ORDERS;

  function handlePrint() {
    if (onPrint) { onPrint(); return; }
    window.print();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Invoice Preview"
      subtitle="2 copies · A5 each · A4 Landscape"
      maxWidth="max-w-6xl"
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <Button variant="secondary" outline icon={X} onClick={onClose}>Close</Button>
          <Button icon={Printer} onClick={handlePrint} disabled={!invoice || loading}>Print Invoice</Button>
        </div>
      }
    >
      {loading && (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400">Loading invoice...</div>
      )}
      {!loading && !invoice && (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400">No invoice data available.</div>
      )}

      {!loading && invoice && (
        <div className="p-2 overflow-auto">
          {isOverLimit && (
            <div style={{ marginBottom: "10px", padding: "8px 12px", background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: "8px", fontSize: "12px", color: "#92400e" }}>
              ⚠️ This invoice has <strong>{ordersCount} orders</strong> — only first <strong>{MAX_INVOICE_ORDERS}</strong> will print. Please split into multiple invoices.
            </div>
          )}

          <div id="invoice-print-root">
            <div
              className="screen-only"
              style={{ display: "flex", justifyContent: "center", background: "#d1d5db", padding: "28px 16px 16px", borderRadius: "12px", position: "relative" }}
            >
              <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", transform: "translateX(-50%)", width: "1px", borderLeft: "2px dashed #9ca3af", pointerEvents: "none", zIndex: 2 }} />
              <div style={{ position: "absolute", top: "7px", left: "50%", transform: "translateX(-50%)", fontSize: "9px", color: "#6b7280", background: "#d1d5db", padding: "1px 6px", borderRadius: "3px", whiteSpace: "nowrap", zIndex: 3, letterSpacing: "0.06em" }}>
                ✂ cut here
              </div>

              {[1, 2].map((copyNum) => (
                <div key={copyNum} style={{ position: "relative", margin: "0 4px" }}>
                  <span style={{ position: "absolute", top: "-20px", left: "50%", transform: "translateX(-50%)", fontSize: "10px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, whiteSpace: "nowrap" }}>
                    Copy {copyNum}
                  </span>
                  <div style={{ width: "390px", height: "553px", background: "#fff", borderRadius: "10px", padding: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.13)", boxSizing: "border-box", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    <InvoiceDocument invoice={invoice} businessName={businessName} bannerUrl={bannerUrl} />
                  </div>
                </div>
              ))}
            </div>

            <div className="print-layout" style={{ display: "none" }}>
              <div className="print-copy">
                <InvoiceDocument invoice={invoice} businessName={businessName} bannerUrl={bannerUrl} />
              </div>
              <div className="copy-divider" />
              <div className="print-copy">
                <InvoiceDocument invoice={invoice} businessName={businessName} bannerUrl={bannerUrl} />
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
