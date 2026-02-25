import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import Button from "../Button";
import Input from "../Input";
import Modal from "../Modal";

export default function SupplierFormModal({
  isOpen,
  onClose,
  initialData,
  onAction,
}) {
  const mode = initialData ? "edit" : "add";
  const [formData, setFormData] = useState({});

  useEffect(() => {
    setFormData({
      id: initialData?._id || "",
      name: initialData?.name || "",
      opening_balance: initialData?.opening_balance ?? "",
    });
  }, [initialData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onAction(mode === "add" ? "add" : "edit", formData);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-lg"
      title={mode === "add" ? "Add Supplier" : "Edit Supplier"}
      subtitle="Complete the fields below"
      footer={
        <div className="flex gap-3">
          <Button
            outline
            variant="secondary"
            onClick={onClose}
            className="w-1/3"
          >
            Discard
          </Button>
          <Button icon={Save} className="grow" onClick={handleSubmit}>
            {mode === "add" ? "Create Supplier" : "Save Changes"}
          </Button>
        </div>
      }
    >
      <form className="grid grid-cols-1 gap-3 p-0.5">
        <Input
          label="Supplier Name"
          value={formData.name}
          placeholder="Enter Supplier Name"
          disabled={mode === "edit"}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          capitalize
        />
        <Input
          label="Opening Balance"
          type="number"
          required={false}
          value={formData.opening_balance}
          placeholder="Enter Opening Balance"
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, opening_balance: e.target.value }))
          }
        />
      </form>
    </Modal>
  );
}
