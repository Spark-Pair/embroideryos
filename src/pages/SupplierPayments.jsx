import { useEffect, useMemo, useRef, useState } from "react";
import { Banknote, Landmark, PackageCheck, Plus, Smartphone } from "lucide-react";
import {
  createSupplierPayment,
  fetchSupplierPaymentStats,
  fetchSupplierPayments,
} from "../api/supplierPayment";
import { fetchSuppliers } from "../api/supplier";
import StatCard from "../components/StatCard";
import TableToolbar from "../components/table/TableToolbar";
import TableSkeleton from "../components/table/TableLoader";
import FilterDrawer from "../components/FilterDrawer";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import Select from "../components/Select";
import Input from "../components/Input";
import Button from "../components/Button";
import { useToast } from "../context/ToastContext";
import { formatDate, formatNumbers } from "../utils";

const METHOD_BADGE_CLASS = {
  cash: "bg-emerald-100 text-emerald-700",
  cheque: "bg-amber-100 text-amber-700",
  online: "bg-indigo-100 text-indigo-700",
  goods_return: "bg-cyan-100 text-cyan-700",
};

const METHOD_LABEL = {
  cash: "Cash",
  cheque: "Cheque",
  online: "Online",
  goods_return: "Goods Return",
};

function SupplierPaymentFormModal({ isOpen, onClose, onAction }) {
  const [supplierList, setSupplierList] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    supplier_id: "",
    date: new Date().toISOString().slice(0, 10),
    method: "",
    amount: "",
    reference_no: "",
    remarks: "",
  });

  const supplierOptions = useMemo(
    () => supplierList.map((s) => ({ label: s.name, value: s._id })),
    [supplierList]
  );

  useEffect(() => {
    if (!isOpen) return;
    setFormData({
      supplier_id: "",
      date: new Date().toISOString().slice(0, 10),
      method: "",
      amount: "",
      reference_no: "",
      remarks: "",
    });
    setError("");

    const load = async () => {
      setLoadingSuppliers(true);
      try {
        const res = await fetchSuppliers({ page: 1, limit: 5000, status: "active" });
        setSupplierList(res?.data || []);
      } catch {
        setSupplierList([]);
      } finally {
        setLoadingSuppliers(false);
      }
    };

    load();
  }, [isOpen]);

  const isValid =
    !!formData.supplier_id &&
    !!formData.date &&
    !!formData.method &&
    Number(formData.amount) > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-2xl"
      title="Supplier Payment"
      subtitle="Record a payment to supplier"
      footer={
        <div className="w-full flex items-center justify-between gap-3">
          <p className="text-xs text-red-600">{error}</p>
          <div className="flex gap-2">
            <Button variant="secondary" outline onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!isValid) {
                  setError("Please fill all required fields.");
                  return;
                }
                setError("");
                setSubmitting(true);
                try {
                  await onAction("add", {
                    ...formData,
                    amount: Number(formData.amount),
                  });
                  onClose();
                } catch {
                  // toast by parent
                } finally {
                  setSubmitting(false);
                }
              }}
              loading={submitting}
              disabled={!isValid}
            >
              Save Payment
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-0.5">
        <div className="md:col-span-2">
          <Select
            label="Supplier"
            value={formData.supplier_id}
            onChange={(value) => setFormData((prev) => ({ ...prev, supplier_id: value }))}
            options={supplierOptions}
            placeholder={loadingSuppliers ? "Loading suppliers..." : "Select supplier..."}
          />
        </div>

        <Input label="Date" type="date" value={formData.date} onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))} />
        <Select
          label="Method"
          value={formData.method}
          onChange={(value) => setFormData((prev) => ({ ...prev, method: value }))}
          options={[
            { label: "Cash", value: "cash" },
            { label: "Cheque", value: "cheque" },
            { label: "Online", value: "online" },
            { label: "Goods Return", value: "goods_return" },
          ]}
          placeholder="Select method"
        />
        <Input label="Amount" type="number" value={formData.amount} onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))} />
        <Input label="Reference No" required={false} value={formData.reference_no} onChange={(e) => setFormData((prev) => ({ ...prev, reference_no: e.target.value }))} />

        <div className="md:col-span-2">
          <label className="block mb-1.5 text-sm text-gray-700">Remarks <span className="text-gray-400">(Optional)</span></label>
          <textarea value={formData.remarks} onChange={(e) => setFormData((prev) => ({ ...prev, remarks: e.target.value }))} rows={3} className="w-full border border-gray-400 px-4 py-2 rounded-xl focus:ring-2 focus:ring-teal-300 focus:outline-none bg-gray-50 resize-y" />
        </div>
      </div>
    </Modal>
  );
}

export default function SupplierPayments() {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState({ total: 0, cash: 0, cheque: 0, online: 0, goods_return: 0 });
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 30 });
  const [formModal, setFormModal] = useState({ isOpen: false });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ name: "", method: "", month: "", date_from: "", date_to: "" });

  const tableScrollRef = useRef(null);

  const loadStats = async () => {
    try {
      const res = await fetchSupplierPaymentStats();
      setStats(res.data || { total: 0, cash: 0, cheque: 0, online: 0, goods_return: 0 });
    } catch {
      showToast({ type: "error", message: "Failed to load supplier payment stats" });
    }
  };

  const loadPayments = async (page = 1, filterParams = filters) => {
    try {
      setLoading(true);
      const res = await fetchSupplierPayments({ page, limit: 30, ...filterParams });
      setPayments(res.data || []);
      if (res.pagination) setPagination(res.pagination);
      loadStats();
    } catch {
      showToast({ type: "error", message: "Failed to load supplier payments" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!tableScrollRef.current) return;
    tableScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
  }, [pagination.currentPage]);

  return (
    <>
      <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col">
        <PageHeader title="Supplier Payments" subtitle="Track payments made to suppliers." actionLabel="Add Payment" actionIcon={Plus} onAction={() => setFormModal({ isOpen: true })} />

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
          <StatCard label="Total" value={stats.total} icon={Banknote} />
          <StatCard label="Cash" value={stats.cash} icon={Banknote} variant="success" />
          <StatCard label="Cheque" value={stats.cheque} icon={Landmark} variant="warning" />
          <StatCard label="Online" value={stats.online} icon={Smartphone} variant="normal" />
          <StatCard label="Goods Return" value={stats.goods_return} icon={PackageCheck} variant="normal" />
        </div>

        <div className="rounded-3xl bg-white border border-gray-300 overflow-hidden flex-1 flex flex-col">
          <TableToolbar currentPage={pagination.currentPage} totalPages={pagination.totalPages} onPageChange={(page) => loadPayments(page, filters)} onFilter={() => setIsFilterOpen(true)} />

          <div ref={tableScrollRef} className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-20 bg-gray-100" style={{ boxShadow: "0 1px 0 0 rgba(209,213,219,1)" }}>
                <tr className="text-sm tracking-wider text-gray-500">
                  <th className="px-7 py-3.5 font-medium">#</th>
                  <th className="px-7 py-3.5 font-medium">Supplier</th>
                  <th className="px-7 py-3.5 font-medium">Date</th>
                  <th className="px-7 py-3.5 font-medium">Method</th>
                  <th className="px-7 py-3.5 font-medium">Amount</th>
                  <th className="px-7 py-3.5 font-medium">Reference</th>
                  <th className="px-7 py-3.5 font-medium">Remarks</th>
                </tr>
              </thead>

              {loading ? (
                <TableSkeleton rows={8} columns={7} />
              ) : (
                <tbody>
                  {payments.length === 0 ? (
                    <tr><td colSpan={7} className="px-7 py-12 text-center text-gray-500">No supplier payments found.</td></tr>
                  ) : payments.map((item, index) => (
                    <tr key={item._id} className="border-b border-gray-200/80 hover:bg-gray-50/70">
                      <td className="px-7 py-4 text-sm text-gray-500">{String(index + 1 + (pagination.currentPage - 1) * pagination.itemsPerPage).padStart(2, "0")}</td>
                      <td className="px-7 py-4 text-sm font-medium text-gray-800">{item.supplier_id?.name || item.supplier_name || "-"}</td>
                      <td className="px-7 py-4 text-sm text-gray-600">{formatDate(item.date, "dd-MMM-YYYY, DDD")}</td>
                      <td className="px-7 py-4"><span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${METHOD_BADGE_CLASS[item.method] || "bg-gray-100 text-gray-700"}`}>{METHOD_LABEL[item.method] || item.method}</span></td>
                      <td className="px-7 py-4 text-sm text-gray-600 font-semibold">{formatNumbers(item.amount, 2)}</td>
                      <td className="px-7 py-4 text-sm text-gray-500">{item.reference_no || "-"}</td>
                      <td className="px-7 py-4 text-sm text-gray-500">{item.remarks || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
        </div>
      </div>

      <SupplierPaymentFormModal
        isOpen={formModal.isOpen}
        onClose={() => setFormModal({ isOpen: false })}
        onAction={async (_action, payload) => {
          try {
            await createSupplierPayment(payload);
            showToast({ type: "success", message: "Supplier payment saved successfully" });
            loadPayments(pagination.currentPage, filters);
          } catch (err) {
            showToast({ type: "error", message: err.response?.data?.message || "Failed to save supplier payment" });
            throw err;
          }
        }}
      />

      <FilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={[
          { label: "Supplier Name", type: "text", value: filters.name, onChange: (e) => setFilters((prev) => ({ ...prev, name: e.target.value })) },
          {
            label: "Method",
            type: "select",
            value: filters.method,
            options: [
              { label: "All", value: "" },
              { label: "Cash", value: "cash" },
              { label: "Cheque", value: "cheque" },
              { label: "Online", value: "online" },
              { label: "Goods Return", value: "goods_return" },
            ],
            onChange: (v) => setFilters((prev) => ({ ...prev, method: v })),
          },
          { label: "Month", type: "month", value: filters.month, onChange: (e) => setFilters((prev) => ({ ...prev, month: e.target.value })) },
          { label: "Date From", type: "date", value: filters.date_from, onChange: (e) => setFilters((prev) => ({ ...prev, date_from: e.target.value })) },
          { label: "Date To", type: "date", value: filters.date_to, onChange: (e) => setFilters((prev) => ({ ...prev, date_to: e.target.value })) },
        ]}
        onApply={() => {
          loadPayments(1, filters);
          setIsFilterOpen(false);
        }}
        onReset={() => {
          const reset = { name: "", method: "", month: "", date_from: "", date_to: "" };
          setFilters(reset);
          loadPayments(1, reset);
          setIsFilterOpen(false);
        }}
      />
    </>
  );
}
