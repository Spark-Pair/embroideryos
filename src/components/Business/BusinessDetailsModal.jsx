import { Edit3, Power } from "lucide-react";
import Button from "../Button";
import Modal from "../Modal";
import ModalDetails from "../ModalDetails";
import StatusBadge from "../StatusBadge";
import { formatDate } from "../../utils";

export default function BusinessDetailsModal({
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
      title="Business Info"
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
            Edit Business
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
            { label: "Business Name", value: initialData?.name },
            { label: "Contact Person", value: initialData?.person },
            { label: "Price", value: initialData?.price },
            {
              label: "Registration Date",
              value: formatDate(
                initialData?.registration_date,
                "dd-MMM-YYYY, DDD"
              ),
            },
          ]}
        />
      }
    </Modal>
  );
}
