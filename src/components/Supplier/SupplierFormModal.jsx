import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import Button from "../Button";
import Input from "../Input";
import Modal from "../Modal";

export default function SupplierFormModal({
  isOpen,
  onClose,
  initialData,
  expenseItemOptions = [],
  onAction,
}) {
  const mode = initialData ? "edit" : "add";
  const [formData, setFormData] = useState({});

  useEffect(() => {
    setFormData({
      id: initialData?._id || "",
      name: initialData?.name || "",
      opening_balance: initialData?.opening_balance ?? "",
      assigned_expense_items: Array.isArray(initialData?.assigned_expense_items)
        ? initialData.assigned_expense_items
        : [],
    });
  }, [initialData]);

  const toggleAssignedItem = (name) => {
    setFormData((prev) => {
      const set = new Set(Array.isArray(prev.assigned_expense_items) ? prev.assigned_expense_items : []);
      if (set.has(name)) set.delete(name);
      else set.add(name);
      return { ...prev, assigned_expense_items: Array.from(set) };
    });
  };

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

        <div className="rounded-xl border border-gray-300 bg-gray-50 p-3">
          <p className="text-sm text-gray-700 mb-2">Manage Category (Expense / Item)</p>
          {expenseItemOptions.length === 0 ? (
            <p className="text-xs text-gray-400">No active expense items found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-auto pr-1">
              {expenseItemOptions.map((name) => {
                const checked = Array.isArray(formData.assigned_expense_items)
                  ? formData.assigned_expense_items.includes(name)
                  : false;
                return (
                  <label
                    key={name}
                    className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAssignedItem(name)}
                      className="h-4 w-4 rounded border-gray-400"
                    />
                    <span>{name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
