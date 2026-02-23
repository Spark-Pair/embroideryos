import { Copy, Edit3, Power } from "lucide-react";
import Button from "../Button";
import Modal from "../Modal";
import ModalDetails from "../ModalDetails";
import StatusBadge from "../StatusBadge";
import { formatDate, formatNumbers } from "../../utils";

export default function OrderDetailsModal({ isOpen, onClose, initialData, onAction }) {
  const isActive = initialData?.isActive;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Order Details"
      subtitle="Overview of generated order information"
      badge={<StatusBadge active={initialData?.isActive} />}
      maxWidth="max-w-3xl"
      footer={
        <div className="flex gap-3">
          <Button
            icon={Edit3}
            variant="secondary"
            className="grow"
            onClick={() => onAction("openEdit", initialData)}
          >
            Edit Order
          </Button>
          <Button
            icon={Copy}
            variant="secondary"
            className="grow"
            onClick={() => onAction("repeatItem", initialData)}
          >
            Repeat Item
          </Button>
          <Button
            icon={Power}
            outline
            variant={isActive ? "danger" : "success"}
            className="w-40"
            onClick={() => onAction("toggleStatus", initialData)}
          >
            {isActive ? "Deactivate" : "Activate"}
          </Button>
        </div>
      }
    >
      <ModalDetails
        data={[
          { label: "Customer Name", value: initialData?.customer_name },
          { label: "Date", value: formatDate(initialData?.date, "DD MMM yyyy") },
          { label: "Description", value: initialData?.description },
          { label: "Lot No", value: initialData?.lot_no },
          { label: "Quantity", value: `${formatNumbers(initialData?.quantity, 0) || 0} ${initialData?.unit || ""}` },
          { label: "Actual Stitches", value: formatNumbers(initialData?.actual_stitches, 0) },
          { label: "Design Stitches", value: formatNumbers(initialData?.design_stitches, 0) },
          { label: "APQ", value: formatNumbers(initialData?.apq, 0) },
          { label: "APQ Charges", value: formatNumbers(initialData?.apq_chr, 2) },
          { label: "Rate", value: formatNumbers(initialData?.rate, 2) },
          { label: "Calculated Rate", value: formatNumbers(initialData?.calculated_rate, 2) },
          { label: "Stitch Rate", value: formatNumbers(initialData?.stitch_rate, 4) },
          { label: "Machine No", value: initialData?.machine_no },
          { label: "Total Amount", value: formatNumbers(initialData?.total_amount, 2) },
        ]}
      />
    </Modal>
  );
}
