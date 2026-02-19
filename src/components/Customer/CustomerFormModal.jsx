import { Save } from "lucide-react";
import Button from "../Button";
import Input from "../Input";
import Modal from "../Modal";
import { useEffect, useState } from "react";

export default function CustomerFormModal({
  isOpen,
  onClose,
  initialData,
  onAction,
}) {
  const mode = initialData ? 'edit' : 'add';
  const [formData, setFormData] = useState({});

  useEffect(() => {
    setFormData({
      id: initialData?._id || "",
      name: initialData?.name || "",
      person: initialData?.person || "",
      rate: initialData?.rate || "",
    });
  }, [initialData]); // ✅ dependency array

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
      title={mode === "add" ? "Add Customer" : "Edit Customer"}
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
            {mode === "add" ? "Create Customer" : "Save Changes"}
          </Button>
        </div>
      }
    >
      {
        <form className="grid grid-cols-1 gap-3">
          <Input
            label="Customer Name"
            value={formData.name}
            placeholder="Enter Customer Name"
            disabled={mode === "edit"}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            capitalize={true}
          />
          <Input
            label="Contact Person"
            value={formData.person}
            disabled={mode === "edit"}
            placeholder="Enter Contact Person Name"
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, person: e.target.value }))
            }
            capitalize={true}
          />
          <Input
            label="Rate"
            type="number"
            value={formData.rate}
            placeholder="Enter Decided Rate"
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, rate: e.target.value }))
            }
          />
        </form>
      }
    </Modal>
  );
}
