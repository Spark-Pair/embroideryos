import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import Modal from "../Modal";
import Input from "../Input";
import Select from "../Select";
import Button from "../Button";

const INITIAL_STATE = {
  name: "",
  username: "",
  password: "",
  role: "staff",
};

export default function UserFormModal({ isOpen, onClose, onSubmit, loading = false }) {
  const [formData, setFormData] = useState(INITIAL_STATE);

  useEffect(() => {
    if (isOpen) {
      setFormData(INITIAL_STATE);
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-lg"
      title="Add User"
      subtitle="Create a business user"
      footer={
        <div className="flex gap-3">
          <Button outline variant="secondary" onClick={onClose} className="w-1/3">
            Discard
          </Button>
          <Button icon={Save} className="grow" onClick={handleSubmit} disabled={loading}>
            Create User
          </Button>
        </div>
      }
    >
      <form className="grid grid-cols-1 gap-3 p-0.5">
        <Input
          label="Name"
          value={formData.name}
          placeholder="Enter full name"
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          capitalize
        />
        <Input
          label="Username"
          value={formData.username}
          placeholder="Unique username"
          onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
          autoComplete="off"
        />
        <Input
          label="Password"
          type="password"
          value={formData.password}
          placeholder="Set a password"
          onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
          autoComplete="new-password"
        />
        <Select
          label="Role"
          value={formData.role}
          onChange={(value) => setFormData((prev) => ({ ...prev, role: value }))}
          options={[
            { label: "Staff", value: "staff" },
            { label: "Admin", value: "admin" },
          ]}
        />
      </form>
    </Modal>
  );
}
