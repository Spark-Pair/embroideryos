import { useEffect, useMemo, useState } from "react";
import { ImageUp, RefreshCcw, Save, Trash2 } from "lucide-react";
import Modal from "../Modal";
import Button from "../Button";
import Input from "../Input";
import { fetchInvoiceOrderGroups } from "../../api/invoice";
import { fetchMyInvoiceCounter } from "../../api/business";
import { formatDate, formatNumbers } from "../../utils";
import { useToast } from "../../context/ToastContext";

const MAX_INVOICE_ORDERS = 8;

function toDateInput(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function maxDateStr(...values) {
  const valid = values.filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")));
  if (!valid.length) return "";
  return valid.sort().at(-1) || "";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read image"));
    reader.readAsDataURL(file);
  });
}

function formatInvoiceNumber(year, nextInvoiceNo) {
  const y = Number(year) || new Date().getFullYear();
  const seq = Number(nextInvoiceNo) || 1;
  return `${y}-${String(Math.max(1, seq)).padStart(4, "0")}`;
}

export default function InvoiceFormModal({ isOpen, onClose, onAction, canUploadInvoiceImage = false }) {
  const { showToast } = useToast();
  const [orderGroups, setOrderGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [invoiceDate, setInvoiceDate] = useState(toDateInput());
  const [lastInvoiceDate, setLastInvoiceDate] = useState("");
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState("");
  const [loadingInvoiceCounter, setLoadingInvoiceCounter] = useState(false);
  const [note, setNote] = useState("");
  const [invoiceImageData, setInvoiceImageData] = useState("");
  const [error, setError] = useState("");

  const loadGroups = async () => {
    setLoadingGroups(true);
    try {
      const res = await fetchInvoiceOrderGroups();
      setOrderGroups(res?.data || []);
      setLastInvoiceDate(String(res?.meta?.last_invoice_date || ""));
    } catch (err) {
      const message = err.response?.data?.message || "Failed to load grouped orders";
      setError(message);
      showToast({ type: "error", message });
    } finally {
      setLoadingGroups(false);
    }
  };

  const loadInvoiceCounter = async (year) => {
    setLoadingInvoiceCounter(true);
    try {
      const res = await fetchMyInvoiceCounter({ year });
      const formatted = formatInvoiceNumber(res?.year || year, res?.next_invoice_no || 1);
      setNextInvoiceNumber(formatted);
    } catch {
      setNextInvoiceNumber(formatInvoiceNumber(year, 1));
    } finally {
      setLoadingInvoiceCounter(false);
    }
  };

  const resetForm = () => {
    setSelectedCustomerId("");
    setSelectedOrderIds([]);
    setInvoiceDate(toDateInput());
    setNote("");
    setInvoiceImageData("");
    setError("");
  };

  const handlePickImage = async (e) => {
    if (!canUploadInvoiceImage) {
      const message = "Premium plan required for invoice image upload.";
      setError(message);
      showToast({ type: "warning", message });
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      const message = "Please select an image file.";
      setError(message);
      showToast({ type: "warning", message });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      const message = "Invoice image size should be less than 5MB.";
      setError(message);
      showToast({ type: "warning", message });
      return;
    }

    try {
      const data = await readFileAsDataUrl(file);
      setInvoiceImageData(data);
      setError("");
    } catch {
      const message = "Failed to read selected image.";
      setError(message);
      showToast({ type: "error", message });
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    resetForm();
    loadGroups();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const selectedYear = new Date(invoiceDate || new Date()).getFullYear();
    loadInvoiceCounter(selectedYear);
  }, [isOpen, invoiceDate]);

  useEffect(() => {
    if (!canUploadInvoiceImage && invoiceImageData) {
      setInvoiceImageData("");
    }
  }, [canUploadInvoiceImage, invoiceImageData]);

  const selectedSummary = useMemo(() => {
    if (!selectedCustomerId || selectedOrderIds.length === 0) {
      return { customerName: "", orderCount: 0, totalAmount: 0 };
    }

    const group = orderGroups.find((g) => g.customer_id === selectedCustomerId);
    if (!group) return { customerName: "", orderCount: 0, totalAmount: 0 };

    const selectedSet = new Set(selectedOrderIds);
    const totalAmount = (group.orders || []).reduce((sum, order) => {
      if (!selectedSet.has(order._id)) return sum;
      return sum + Number(order.total_amount || 0);
    }, 0);

    return {
      customerName: group.customer_name,
      orderCount: selectedOrderIds.length,
      totalAmount,
    };
  }, [orderGroups, selectedCustomerId, selectedOrderIds]);

  const selectedLatestOrderDate = useMemo(() => {
    if (!selectedCustomerId || selectedOrderIds.length === 0) return "";
    const group = orderGroups.find((g) => g.customer_id === selectedCustomerId);
    if (!group) return "";
    const selectedSet = new Set(selectedOrderIds);
    const latestTs = (group.orders || []).reduce((latest, order) => {
      if (!selectedSet.has(order?._id)) return latest;
      const ts = new Date(order?.date || "").getTime();
      if (!Number.isFinite(ts)) return latest;
      return ts > latest ? ts : latest;
    }, 0);
    return latestTs ? toDateInput(new Date(latestTs)) : "";
  }, [orderGroups, selectedCustomerId, selectedOrderIds]);

  const todayDate = toDateInput();
  const minInvoiceDate = maxDateStr(lastInvoiceDate, selectedLatestOrderDate);
  const maxInvoiceDate = todayDate;

  useEffect(() => {
    if (!invoiceDate) return;
    if (minInvoiceDate && invoiceDate < minInvoiceDate) {
      setInvoiceDate(minInvoiceDate);
      return;
    }
    if (maxInvoiceDate && invoiceDate > maxInvoiceDate) {
      setInvoiceDate(maxInvoiceDate);
    }
  }, [invoiceDate, maxInvoiceDate, minInvoiceDate]);

  const toggleOrder = (group, orderId) => {
    if (!selectedCustomerId) setSelectedCustomerId(group.customer_id);
    if (selectedCustomerId && selectedCustomerId !== group.customer_id) {
      setError("You can select orders from one customer at a time.");
      return;
    }

    setError("");
    setSelectedOrderIds((prev) => {
      if (prev.includes(orderId)) {
        const next = prev.filter((id) => id !== orderId);
        if (next.length === 0) setSelectedCustomerId("");
        return next;
      }
      if (prev.length >= MAX_INVOICE_ORDERS) {
        setError(`Maximum ${MAX_INVOICE_ORDERS} orders allowed in one invoice.`);
        return prev;
      }
      return [...prev, orderId];
    });
  };

  const selectAllForCustomer = (group) => {
    if (selectedCustomerId && selectedCustomerId !== group.customer_id && selectedOrderIds.length > 0) {
      setError("Clear current selection before selecting another customer.");
      return;
    }
    setError("");
    setSelectedCustomerId(group.customer_id);
    const allIds = (group.orders || []).map((o) => o._id);
    if (allIds.length > MAX_INVOICE_ORDERS) {
      setError(`Customer has more than ${MAX_INVOICE_ORDERS} orders. First ${MAX_INVOICE_ORDERS} selected.`);
    }
    setSelectedOrderIds(allIds.slice(0, MAX_INVOICE_ORDERS));
  };

  const handleSave = async () => {
    if (!selectedCustomerId || selectedOrderIds.length === 0) {
      const message = "Select at least one order first.";
      setError(message);
      showToast({ type: "warning", message });
      return;
    }
    if (selectedOrderIds.length > MAX_INVOICE_ORDERS) {
      const message = `Maximum ${MAX_INVOICE_ORDERS} orders allowed in one invoice.`;
      setError(message);
      showToast({ type: "warning", message });
      return;
    }
    if (invoiceDate && minInvoiceDate && invoiceDate < minInvoiceDate) {
      const message = selectedLatestOrderDate && selectedLatestOrderDate > (lastInvoiceDate || "")
        ? `Invoice date cannot be before selected order date (${selectedLatestOrderDate}).`
        : `Invoice date cannot be before last invoice date (${lastInvoiceDate}).`;
      setError(message);
      showToast({ type: "warning", message });
      return;
    }
    if (invoiceDate && maxInvoiceDate && invoiceDate > maxInvoiceDate) {
      const message = "Invoice date cannot be after today.";
      setError(message);
      showToast({ type: "warning", message });
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await onAction({
        customer_id: selectedCustomerId,
        order_ids: selectedOrderIds,
        invoice_date: invoiceDate || undefined,
        note,
        image_data: canUploadInvoiceImage ? (invoiceImageData || "") : "",
      });
      onClose();
    } catch (err) {
      const message = err.response?.data?.message || "Failed to save invoice";
      setError(message);
      showToast({ type: "error", message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generate Invoice"
      subtitle="Select orders from one customer and save."
      maxWidth="max-w-6xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-red-600">{error}</div>
          <div className="flex gap-2.5">
            <Button variant="secondary" outline icon={Trash2} onClick={resetForm} disabled={submitting}>
              Clear
            </Button>
            <Button icon={Save} onClick={handleSave} loading={submitting}>
              Save Invoice
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 p-0.5">
        <div className="xl:col-span-2 rounded-2xl border border-gray-300 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Orders Grouped by Customer</h3>
              <p className="text-xs text-gray-500">Sorted by date (oldest first)</p>
            </div>
            <Button variant="secondary" outline size="sm" icon={RefreshCcw} onClick={loadGroups} disabled={loadingGroups}>
              Refresh
            </Button>
          </div>

          <div className="max-h-[56vh] overflow-auto p-4 space-y-4">
            {loadingGroups && <p className="text-sm text-gray-500">Loading grouped orders...</p>}
            {!loadingGroups && orderGroups.length === 0 && (
              <p className="text-sm text-gray-500">No pending orders available for invoicing.</p>
            )}

            {!loadingGroups &&
              orderGroups.map((group) => {
                const groupSelected = selectedCustomerId === group.customer_id;
                const selectedSet = new Set(selectedOrderIds);

                return (
                  <div key={group.customer_id} className={`rounded-2xl border ${groupSelected ? "border-teal-400 bg-teal-50/30" : "border-gray-200"} p-4`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{group.customer_name}</p>
                        <p className="text-xs text-gray-500">
                          {group.total_orders} orders • {formatNumbers(group.total_amount, 2)}
                        </p>
                      </div>
                      <Button size="sm" variant="secondary" outline onClick={() => selectAllForCustomer(group)}>
                        Select All
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {(group.orders || []).map((order) => (
                        <label
                          key={order._id}
                          className={`block rounded-xl border px-3.5 py-2.5 cursor-pointer transition ${
                            selectedSet.has(order._id) ? "border-teal-300 bg-teal-50" : "border-gray-200 bg-white"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={selectedSet.has(order._id)}
                              onChange={() => toggleOrder(group, order._id)}
                              className="h-4 w-4 mt-0.5 shrink-0"
                            />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 leading-tight truncate">
                                  {order.description || "No description"}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Date: {formatDate(order.date, "DD MMM yyyy")} • Customer: {group.customer_name || "---"}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Lot: {order.lot_no || "---"} • Machine: {order.machine_no || "---"}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Design Stitch: {Number(order.design_stitches || 0) > 0 ? formatNumbers(order.design_stitches, 0) : "-"}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold text-emerald-700">{formatNumbers(order.total_amount, 2)}</p>
                              <p className="text-xs text-gray-500">
                                Qty: {formatNumbers(order.quantity, 0)} {order.unit}
                              </p>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-300 bg-white p-4 h-fit">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Invoice Details</h3>
          <div className="space-y-3">
            <Input
              label="New Invoice No"
              value={loadingInvoiceCounter ? "Loading..." : nextInvoiceNumber}
              placeholder="—"
              readOnly
              required={false}
            />
            <Input label="Customer" value={selectedSummary.customerName || ""} placeholder="Select orders first" readOnly required={false} />
            <Input label="Selected Orders" value={selectedSummary.orderCount ? String(selectedSummary.orderCount) : ""} placeholder="0" readOnly required={false} />
            <p className="text-[11px] text-gray-500 -mt-2">Max {MAX_INVOICE_ORDERS} orders per invoice</p>
            <Input
              label="Selected Total"
              value={selectedSummary.orderCount ? formatNumbers(selectedSummary.totalAmount, 2) : ""}
              placeholder="0.00"
              readOnly
              required={false}
            />
            <Input
              label="Invoice Date"
              type="date"
              value={invoiceDate}
              min={minInvoiceDate || undefined}
              max={maxInvoiceDate || undefined}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
            <p className="text-[11px] text-gray-500 -mt-2">
              Allowed range: {minInvoiceDate || "—"} to {maxInvoiceDate || "—"}
            </p>
            <Input label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" required={false} />
            <div>
              <label className="block mb-1.5 text-sm text-gray-700">Invoice Image (Optional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePickImage}
                disabled={!canUploadInvoiceImage}
                className="block w-full text-sm text-gray-700 file:mr-3 file:px-3 file:py-1.5 file:rounded-xl file:border file:border-gray-300 file:bg-gray-50 file:cursor-pointer"
              />
              {!canUploadInvoiceImage && (
                <p className="mt-1 text-xs text-amber-700">Premium plan required to upload invoice image.</p>
              )}
            </div>
            {invoiceImageData ? (
              <div className="rounded-xl border border-gray-300 bg-white p-2">
                <img
                  src={invoiceImageData}
                  alt="Invoice image preview"
                  className="w-full max-h-40 object-cover rounded-lg"
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    outline
                    onClick={() => setInvoiceImageData("")}
                  >
                    Remove Image
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-6 flex flex-col items-center justify-center text-gray-400">
                <ImageUp className="h-5 w-5 mb-1.5" />
                <p className="text-xs">No image selected</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
