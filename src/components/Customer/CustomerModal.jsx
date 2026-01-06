import { Edit3, Power, Save } from 'lucide-react';
import Button from '../Button';
import Input from '../Input';
import Modal from '../Modal';
import ModalDetails from '../ModalDetails';
import StatusBadge from "../StatusBadge";

export default function CustomerModal ({ isOpen, onClose, initialData, mode = "add", onAction }) {
  const isDetails = mode === "details";
  const isActive = initialData?.isActive;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        mode === "add"
          ? "Add Customer"
          : isDetails
          ? "Customer Info"
          : "Edit Customer"
      }
      subtitle={
        isDetails
          ? "Overview of registered details"
          : "Complete the fields below"
      }
      badge={
        isDetails && (
          <StatusBadge active={isActive} />
        )
      }
      footer={
        isDetails ? (
          <div className="flex gap-3">
            <Button
              icon={Edit3}
              variant="secondary"
              className="grow"
              onClick={() => onAction("edit", initialData)}
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
        ) : (
          <div className="flex gap-3">
            <Button outline variant="secondary" onClick={onClose} className="w-1/3">
              Discard
            </Button>
            <Button icon={Save} className="grow">
              {mode === "add" ? "Create Customer" : "Save Changes"}
            </Button>
          </div>
        )
      }
    >
      {/* BODY CONTENT */}
      {isDetails ? (
        <ModalDetails
          data={[
            { label: "Customer Name", value: initialData?.name },
            { label: "Person Name", value: initialData?.person },
            { label: "Rate", value: initialData?.rate },
          ]}
        />
      ) : (
        <form>
          <Input label="Customer Name" defaultValue={initialData?.name} />
          <Input label="Contact Person" defaultValue={initialData?.person} />
          <Input label="Rate" type="number" defaultValue={initialData?.rate} />
        </form>
      )}
    </Modal>
  );
};