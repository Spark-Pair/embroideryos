import { Save } from "lucide-react";
import Button from "../Button";
import Input from "../Input";
import Modal from "../Modal";
import Select from "../Select";
import { useEffect, useState } from "react";
import { formatDate } from "../../utils";

export default function StaffFormModal({
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
      category: initialData?.category || "Embroidery",
      joining_date: formatDate(initialData?.joining_date, "yyyy-mm-dd") || "",
      salary: initialData?.salary || "",
      opening_balance: initialData?.opening_balance ?? "",
    });
  }, [initialData]); // ✅ dependency array

  const handleSubmit = (e) => {
    e.preventDefault();
    onAction(mode === "add" ? "add" : "edit", formData);
    setFormData({});
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-lg"
      title={mode === "add" ? "Add Staff" : "Edit Staff"}
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
            {mode === "add" ? "Create Staff" : "Save Changes"}
          </Button>
        </div>
      }
    >
      {
        <form className="grid grid-cols-1 gap-3 p-0.5">
          <Input
            label="Staff Name"
            value={formData.name}
            placeholder="Enter Staff Name"
            disabled={mode === "edit"}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            capitalize={true}
          />
          <Select
            label="Category"
            value={formData.category}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, category: value }))
            }
            options={[
              { label: "Embroidery", value: "Embroidery" },
              { label: "Cropping", value: "Cropping" },
            ]}
          />
          <Input
            label="Joining Date"
            type="date"
            value={formData.joining_date}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, joining_date: e.target.value }))
            }
          />
          <Input
            label="Salary"
            type="number"
            value={formData.salary}
            required={false}
            placeholder="Enter Decided Salary"
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, salary: e.target.value }))
            }
          />
          <Input
            label="Opening Balance"
            type="number"
            value={formData.opening_balance}
            required={false}
            placeholder="Enter Opening Balance"
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, opening_balance: e.target.value }))
            }
          />
        </form>
      }
    </Modal>
  );
}
