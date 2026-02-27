import { Edit3 } from "lucide-react";
import Button from "../Button";
import Modal from "../Modal";
import ModalDetails from "../ModalDetails";
import { formatDate, formatNumbers } from "../../utils";

const METHOD_LABEL = {
  cash: "Cash",
  cheque: "Cheque",
  slip: "Slip",
  online: "Online",
  adjustment: "Adjustment",
};

export default function CustomerPaymentDetailsModal({
  isOpen,
  onClose,
  initialData,
  onAction,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Customer Payment Info"
      subtitle="Overview of payment details"
      footer={
        <div className="flex gap-3">
          <Button
            icon={Edit3}
            variant="secondary"
            className="grow"
            onClick={() => onAction("openEdit", initialData)}
          >
            Edit Payment
          </Button>
        </div>
      }
    >
      <ModalDetails
        data={[
          { label: "Customer Name", value: initialData?.customer_id?.name || initialData?.customer_name || "-" },
          { label: "Date", value: formatDate(initialData?.date, "dd-MMM-YYYY, DDD") || "-" },
          { label: "Method", value: METHOD_LABEL[initialData?.method] || initialData?.method || "-" },
          { label: "Amount", value: formatNumbers(initialData?.amount, 2) || "0.00" },
          { label: "Reference No", value: initialData?.reference_no || "-" },
          { label: "Bank / Party", value: initialData?.bank_name || initialData?.party_name || "-" },
          {
            label: "Cheque/Slip Date",
            value: initialData?.cheque_date ? formatDate(initialData?.cheque_date, "dd-MMM-YYYY") : "-",
          },
          {
            label: "Clear Date",
            value: initialData?.clear_date ? formatDate(initialData?.clear_date, "dd-MMM-YYYY") : "-",
          },
          { label: "Remarks", value: initialData?.remarks || "-" },
        ]}
      />
    </Modal>
  );
}
