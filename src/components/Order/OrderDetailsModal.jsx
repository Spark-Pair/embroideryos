import { Copy, Edit3, Calendar, Cpu, Hash, Tag, Scissors } from "lucide-react";
import Button from "../Button";
import Modal from "../Modal";
import { formatDate, formatNumbers } from "../../utils";

// ─── Small reusable pieces ────────────────────────────────────────────────────

function DetailItem({ label, value }) {
  if (value == null || value === "" || value === "0" || value === 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value}</span>
    </div>
  );
}

function SectionBlock({ icon, title, children }) {
  const Icon = icon;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="h-5 w-5 rounded-md bg-gray-100 flex items-center justify-center">
          <Icon className="h-3 w-3 text-gray-500" />
        </div>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
      </div>
      <div className="grid grid-cols-3 gap-x-6 gap-y-4 pl-1">
        {children}
      </div>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-gray-100" />;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrderDetailsModal({ isOpen, onClose, initialData, onAction }) {
  const d            = initialData;
  const totalAmount  = formatNumbers(d?.total_amount, 2);
  const rate         = formatNumbers(d?.rate, 2);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Order Details"
      subtitle="Overview of generated order information"
      maxWidth="max-w-3xl"
      footer={
        <div className="flex gap-3 w-full">
          <Button
            icon={Edit3}
            variant="secondary"
            className="grow"
            onClick={() => onAction("openEdit", d)}
          >
            Edit Order
          </Button>
          <Button
            icon={Copy}
            variant="secondary"
            className="grow"
            onClick={() => onAction("repeatItem", d)}
          >
            Repeat Item
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5 p-0.5">

        {/* ── Hero: Customer + Amount ── */}
        <div className="flex items-start justify-between gap-4 bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Customer</span>
            <span className="text-lg font-bold text-gray-900 truncate">{d?.customer_name || "—"}</span>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Calendar className="h-3 w-3" />
                {formatDate(d?.date, "DD MMM yyyy") || "—"}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Cpu className="h-3 w-3" />
                {d?.machine_no || "—"}
              </span>
            </div>
          </div>

          {/* Total Amount pill */}
          {d?.total_amount > 0 && (
            <div className="flex flex-col items-end gap-0.5 shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Total Amount</span>
              <span className="text-2xl font-bold text-gray-900 tabular-nums">{totalAmount}</span>
              <span className="text-xs text-gray-400">Rate: {rate} × {formatNumbers(d?.qt_pcs, 0)} pcs</span>
            </div>
          )}
        </div>

        {/* ── Section 1: Order Info ── */}
        <SectionBlock icon={Tag} title="Order Info">
          <DetailItem label="Description"  value={d?.description} />
          <DetailItem label="Lot No"       value={d?.lot_no} />
          <DetailItem
            label="Quantity"
            value={d?.quantity ? `${formatNumbers(d.quantity, 0)} ${d.unit || ""}` : null}
          />
          <DetailItem
            label="Pieces"
            value={d?.qt_pcs ? `${formatNumbers(d.qt_pcs, 0)} pcs` : null}
          />
        </SectionBlock>

        <Divider />

        {/* ── Section 2: Stitch Details ── */}
        <SectionBlock icon={Scissors} title="Stitch Details">
          <DetailItem label="Actual Stitches" value={formatNumbers(d?.actual_stitches, 0)} />
          <DetailItem label="Design Stitches" value={d?.design_stitches > 0 ? String(d.design_stitches) : null} />
          <DetailItem label="APQ"             value={formatNumbers(d?.apq, 0)} />
          <DetailItem label="APQ Charges"     value={formatNumbers(d?.apq_chr, 2)} />
        </SectionBlock>

        <Divider />

        {/* ── Section 3: Rate Details ── */}
        <SectionBlock icon={Hash} title="Rate Details">
          <DetailItem label="Rate"             value={rate} />
          <DetailItem label="Calculated Rate"  value={formatNumbers(d?.calculated_rate, 2)} />
          <DetailItem label="Stitch Rate"      value={formatNumbers(d?.stitch_rate, 4)} />
        </SectionBlock>

      </div>
    </Modal>
  );
}
