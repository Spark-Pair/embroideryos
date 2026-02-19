import { Edit3, Power } from "lucide-react";
import Button from "../Button";
import Modal from "../Modal";
import ModalDetails from "../ModalDetails";
import StatusBadge from "../StatusBadge";

export default function CustomerDetailsModal({
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
      title="Customer Info"
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
            Edit Customer
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
      {
        <ModalDetails
          data={[
            { label: "Customer Name", value: initialData?.name },
            { label: "Contact Person", value: initialData?.person },
            { label: "Rate", value: initialData?.rate },
          ]}
        />
      }
    </Modal>
  );
}
