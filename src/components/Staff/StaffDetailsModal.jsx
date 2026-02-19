import { Edit3, Power } from "lucide-react";
import Button from "../Button";
import Modal from "../Modal";
import ModalDetails from "../ModalDetails";
import StatusBadge from "../StatusBadge";
import { formatDate, formatNumbers } from "../../utils";

export default function StaffDetailsModal({
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
      title="Staff Info"
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
            Edit Staff
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
            { label: "Staff Name", value: initialData?.name },
            { label: "Joining Date", value: formatDate(initialData?.joining_date, "dd-MMM-YYYY, DDD") },
            { label: "Salary", value: formatNumbers(initialData?.salary, 1) },
          ]}
        />
      }
    </Modal>
  );
}
