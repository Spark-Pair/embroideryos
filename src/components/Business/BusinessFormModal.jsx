import { Save } from "lucide-react";
import Button from "../Button";
import Input from "../Input";
import Modal from "../Modal";
import { useEffect, useState } from "react";
import { formatDate } from "../../utils";

export default function BusinessFormModal({
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
      price: initialData?.price || "",
      registration_date:
        formatDate(initialData?.registration_date, "yyyy-mm-dd") || "",
      username: "",
      password: "",
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
      maxWidth="max-w-xl"
      title={mode === "add" ? "Add Business" : "Edit Business"}
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
            {mode === "add" ? "Create Business" : "Save Changes"}
          </Button>
        </div>
      }
    >
      {
        <form className="grid grid-cols-2 gap-x-5 gap-y-3">
          <Input
            label="Business Name"
            value={formData.name}
            placeholder="Enter Business Name"
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            className="capitalize"
          />
          <Input
            label="Contact Person"
            value={formData.person}
            placeholder="Enter Contact Person Name"
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, person: e.target.value }))
            }
            className="capitalize"
          />
          <Input
            label="Price"
            type="number"
            value={formData.price}
            placeholder="Enter Decided Price"
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, price: e.target.value }))
            }
          />
          <Input
            label="Registration Date"
            type="date"
            value={formData.registration_date}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                registration_date: e.target.value,
              }))
            }
          />

          {mode === "add" && (
            <div className="col-span-full grid grid-cols-2 gap-x-5 gap-y-3 bg-emerald-100/30 border border-emerald-400 p-4 rounded-2xl mt-2">
              <p className="col-span-full mb-1 px-1 text-emerald-800 font-medium tracking-wide">Admin Credentials</p>
              <Input
                label="Username"
                value={formData.username}
                placeholder="Enter Admin Username"
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, username: e.target.value }))
                }
              />
              <Input
                label="Password"
                type="password"
                value={formData.password}
                placeholder="Enter Admin Password"
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, password: e.target.value }))
                }
              />
            </div>
          )}
        </form>
      }
    </Modal>
  );
}
