import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2, Printer } from "lucide-react";
import PageHeader from "../components/PageHeader";
import Select from "../components/Select";
import Input from "../components/Input";
import Button from "../components/Button";
import { fetchCustomers } from "../api/customer";
import { fetchSuppliers } from "../api/supplier";
import { fetchCustomerStatement } from "../api/customerPayment";
import { fetchSupplierStatement } from "../api/supplierPayment";
import { formatDate, formatNumbers } from "../utils";
import { useToast } from "../context/ToastContext";

const PRINT_STYLE = `
@media print {
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
  }

  body * {
    visibility: hidden !important;
  }

  #statement-print-root,
  #statement-print-root * {
    visibility: visible !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  #statement-print-root {
    position: fixed !important;
    left: 50% !important;
    top: 0 !important;
    width: 794px !important;
    min-height: auto !important;
    transform: translateX(-50%) !important;
    margin: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    padding: 20px !important;
    box-sizing: border-box !important;
  }

  @page { size: A4 portrait; margin: 0; }
}
`;

function injectPrintStyle() {
  if (document.getElementById("statement-print-style")) return;
  const s = document.createElement("style");
  s.id = "statement-print-style";
  s.textContent = PRINT_STYLE;
  document.head.appendChild(s);
}

function toDateInput(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
}

export default function Statements() {
  injectPrintStyle();
  const { showToast } = useToast();

  const [entityType, setEntityType] = useState("customer");
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [dateFrom, setDateFrom] = useState(toDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [dateTo, setDateTo] = useState(toDateInput());
  const [loadingLists, setLoadingLists] = useState(false);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [statement, setStatement] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoadingLists(true);
        const [customersRes, suppliersRes] = await Promise.all([
          fetchCustomers({ page: 1, limit: 5000 }),
          fetchSuppliers({ page: 1, limit: 5000 }),
        ]);
        const cRows = Array.isArray(customersRes?.data) ? customersRes.data : [];
        const sRows = Array.isArray(suppliersRes?.data) ? suppliersRes.data : [];
        setCustomers(cRows);
        setSuppliers(sRows);
        if (!customerId && cRows[0]?._id) setCustomerId(cRows[0]._id);
        if (!supplierId && sRows[0]?._id) setSupplierId(sRows[0]._id);
      } catch {
        setCustomers([]);
        setSuppliers([]);
        showToast({ type: "error", message: "Failed to load customer/supplier lists" });
      } finally {
        setLoadingLists(false);
      }
    })();
  }, []);

  const customerOptions = useMemo(
    () =>
      customers.map((c) => ({
        label: c.name || "",
        value: c._id,
      })),
    [customers]
  );

  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ label: s.name, value: s._id })),
    [suppliers]
  );

  const handleGenerate = async () => {
    if (!dateFrom || !dateTo) {
      showToast({ type: "warning", message: "Start and end date are required" });
      return;
    }

    try {
      setLoadingStatement(true);
      if (entityType === "customer") {
        if (!customerId) throw new Error("Customer is required");
        const res = await fetchCustomerStatement({
          customer_id: customerId,
          date_from: dateFrom,
          date_to: dateTo,
        });
        setStatement({ type: "customer", ...(res?.data || {}) });
      } else {
        if (!supplierId) throw new Error("Supplier is required");
        const res = await fetchSupplierStatement({
          supplier_id: supplierId,
          date_from: dateFrom,
          date_to: dateTo,
        });
        setStatement({ type: "supplier", ...(res?.data || {}) });
      }
    } catch (err) {
      setStatement(null);
      showToast({
        type: "error",
        message: err?.response?.data?.message || err?.message || "Failed to generate statement",
      });
    } finally {
      setLoadingStatement(false);
    }
  };

  const title = entityType === "customer" ? "Customer Statement" : "Supplier Statement";
  const opening = Number(statement?.opening_balance || 0);
  const closing = Number(statement?.closing_balance || 0);
  const totalDebit = Number(
    statement?.type === "customer"
      ? statement?.total_invoices || 0
      : statement?.total_expenses || 0
  );
  const totalCredit = Number(statement?.total_payments || 0);

  return (
    <div className="relative z-10 max-w-7xl mx-auto h-full flex flex-col">
      <PageHeader
        title="Statements"
        subtitle="Generate customer and supplier statements with date range."
      />

      <div className="rounded-3xl border border-gray-300 bg-white p-4 md:p-5 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Select
            label="Statement Type"
            value={entityType}
            onChange={(v) => {
              setEntityType(v);
              setStatement(null);
            }}
            options={[
              { label: "Customer", value: "customer" },
              { label: "Supplier", value: "supplier" },
            ]}
          />

          {entityType === "customer" ? (
            <Select
              label="Customer"
              value={customerId}
              onChange={setCustomerId}
              options={customerOptions}
              placeholder={loadingLists ? "Loading..." : "Select customer"}
            />
          ) : (
            <Select
              label="Supplier"
              value={supplierId}
              onChange={setSupplierId}
              options={supplierOptions}
              placeholder={loadingLists ? "Loading..." : "Select supplier"}
            />
          )}

          <Input label="Start Date" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input label="End Date" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />

          <div className="flex items-end gap-2">
            <Button icon={FileText} onClick={handleGenerate} disabled={loadingStatement || loadingLists}>
              Generate
            </Button>
            <Button
              variant="secondary"
              outline
              icon={Printer}
              onClick={() => window.print()}
              disabled={!statement || loadingStatement}
            >
              Print
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-3xl border border-gray-300 bg-white p-3">
        {loadingStatement ? (
          <div className="h-full min-h-[320px] flex items-center justify-center text-sm text-gray-500">
            <Loader2 className="animate-spin mr-2" size={16} />
            Generating statement...
          </div>
        ) : !statement ? (
          <div className="h-full min-h-[320px] flex items-center justify-center text-sm text-gray-400">
            Generate a statement to view report.
          </div>
        ) : (
          <div id="statement-print-root" className="mx-auto rounded-2xl border border-gray-300 bg-white p-5 space-y-4 text-gray-900" style={{ width: "794px", minHeight: "1123px", fontFamily: "'Segoe UI', sans-serif" }}>
            <div className="flex items-start justify-between gap-4 border-b border-gray-300 pb-3">
              <div>
                <p className="text-2xl font-bold">{title}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {statement.type === "customer" ? statement?.customer?.name : statement?.supplier?.name}
                </p>
              </div>
              <div className="text-right text-sm text-gray-600">
                <p>From: <span className="font-semibold">{formatDate(statement.date_from, "DD MMM yyyy")}</span></p>
                <p>To: <span className="font-semibold">{formatDate(statement.date_to, "DD MMM yyyy")}</span></p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="rounded-xl border border-gray-300 p-3">
                <p className="text-xs text-gray-500 uppercase">Opening Balance</p>
                <p className="text-lg font-semibold tabular-nums">{formatNumbers(opening, 2)}</p>
              </div>
              <div className="rounded-xl border border-gray-300 p-3">
                <p className="text-xs text-gray-500 uppercase">{statement.type === "customer" ? "Total Invoices" : "Total Expenses"}</p>
                <p className="text-lg font-semibold tabular-nums">{formatNumbers(totalDebit, 2)}</p>
              </div>
              <div className="rounded-xl border border-gray-300 p-3">
                <p className="text-xs text-gray-500 uppercase">Total Payments</p>
                <p className="text-lg font-semibold tabular-nums">{formatNumbers(totalCredit, 2)}</p>
              </div>
              <div className="rounded-xl border border-gray-300 p-3">
                <p className="text-xs text-gray-500 uppercase">Closing Balance</p>
                <p className="text-xl font-bold tabular-nums">{formatNumbers(closing, 2)}</p>
              </div>
            </div>

            <div className="overflow-auto rounded-xl border border-gray-300">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-800 text-slate-200 uppercase tracking-wide">
                    {["#", "Date", "Type", "Ref / Method", "Details", "Debit", "Credit", "Balance"].map((h) => (
                      <th key={h} className={`px-3 py-2.5 font-medium ${["Debit", "Credit", "Balance"].includes(h) ? "text-right" : ""}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(statement.rows || []).map((row, idx) => (
                    <tr key={row._id || idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-3 py-2.5">{idx + 1}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(row.date, "DD MMM yyyy")}</td>
                      <td className="px-3 py-2.5 capitalize font-medium">{row.kind}</td>
                      <td className="px-3 py-2.5">
                        {statement.type === "customer"
                          ? row.kind === "invoice"
                            ? row.invoice_number || "—"
                            : row.method || "—"
                          : row.reference_no || row.method || "—"}
                      </td>
                      <td className="px-3 py-2.5">{row.details || "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{row.debit ? formatNumbers(row.debit, 2) : "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{row.credit ? formatNumbers(row.credit, 2) : "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{formatNumbers(row.balance, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
