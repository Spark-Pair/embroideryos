import { Edit3, Power } from "lucide-react";
import Button from "../Button";
import Modal from "../Modal";
import ModalDetails from "../ModalDetails";
import StatusBadge from "../StatusBadge";
import { formatNumbers } from "../../utils";

export default function SupplierDetailsModal({
  isOpen,
  onClose,
  initialData,
  onAction,
}) {
  const isActive = initialData?.isActive;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Supplier Info"
      subtitle="Overview of registered details"
      badge={<StatusBadge active={initialData?.isActive} />}
      footer={
        <div className="flex gap-3">
          <Button
            icon={Edit3}
            variant="secondary"
            className="grow"
            onClick={() => onAction("openEdit", initialData)}
          >
            Edit Supplier
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
          { label: "Supplier Name", value: initialData?.name },
          { label: "Opening Balance", value: formatNumbers(initialData?.opening_balance, 1) },
        ]}
      />
    </Modal>
  );
}
