import { useEffect, useMemo, useState } from "react";
import { ImageUp, RefreshCcw, Save, Trash2 } from "lucide-react";
import Modal from "../Modal";
import Button from "../Button";
import Input from "../Input";
import { fetchInvoiceOrderGroups } from "../../api/invoice";
import { formatDate, formatNumbers } from "../../utils";

function toDateInput(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read image"));
    reader.readAsDataURL(file);
  });
}

export default function InvoiceFormModal({ isOpen, onClose, onAction }) {
  const [orderGroups, setOrderGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [invoiceDate, setInvoiceDate] = useState(toDateInput());
  const [note, setNote] = useState("");
  const [invoiceImageData, setInvoiceImageData] = useState("");
  const [error, setError] = useState("");

  const loadGroups = async () => {
    setLoadingGroups(true);
    try {
      const res = await fetchInvoiceOrderGroups();
      setOrderGroups(res?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load grouped orders");
    } finally {
      setLoadingGroups(false);
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
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Invoice image size should be less than 5MB.");
      return;
    }

    try {
      const data = await readFileAsDataUrl(file);
      setInvoiceImageData(data);
      setError("");
    } catch {
      setError("Failed to read selected image.");
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    resetForm();
    loadGroups();
  }, [isOpen]);

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
    setSelectedOrderIds((group.orders || []).map((o) => o._id));
  };

  const handleSave = async () => {
    if (!selectedCustomerId || selectedOrderIds.length === 0) {
      setError("Select at least one order first.");
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
        image_data: invoiceImageData || "",
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save invoice");
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
              <p className="text-xs text-gray-500">Sorted by date (latest first)</p>
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
                          className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 cursor-pointer transition ${
                            selectedSet.has(order._id) ? "border-teal-300 bg-teal-50" : "border-gray-200 bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selectedSet.has(order._id)}
                              onChange={() => toggleOrder(group, order._id)}
                              className="h-4 w-4"
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-800">{formatDate(order.date, "DD MMM yyyy")}</p>
                              <p className="text-xs text-gray-500">
                                Lot: {order.lot_no || "---"} • {order.machine_no || "---"}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-emerald-700">{formatNumbers(order.total_amount, 2)}</p>
                            <p className="text-xs text-gray-500">
                              {formatNumbers(order.quantity, 0)} {order.unit}
                            </p>
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
            <Input label="Customer" value={selectedSummary.customerName || ""} placeholder="Select orders first" readOnly required={false} />
            <Input label="Selected Orders" value={selectedSummary.orderCount ? String(selectedSummary.orderCount) : ""} placeholder="0" readOnly required={false} />
            <Input
              label="Selected Total"
              value={selectedSummary.orderCount ? formatNumbers(selectedSummary.totalAmount, 2) : ""}
              placeholder="0.00"
              readOnly
              required={false}
            />
            <Input label="Invoice Date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            <Input label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" required={false} />
            <div>
              <label className="block mb-1.5 text-sm text-gray-700">Invoice Image (Optional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePickImage}
                className="block w-full text-sm text-gray-700 file:mr-3 file:px-3 file:py-1.5 file:rounded-xl file:border file:border-gray-300 file:bg-gray-50 file:cursor-pointer"
              />
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
