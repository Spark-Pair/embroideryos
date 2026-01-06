import { Save, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import Button from "../Button";
import Input from "../Input";
import Modal from "../Modal";

export default function UserPasswordResetModal({
  isOpen,
  onClose,
  userData,
  onSubmit,
}) {
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setFormData({
        newPassword: "",
        confirmPassword: "",
      });
      setErrors({});
    }
  }, [isOpen]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.newPassword) {
      newErrors.newPassword = "Password is required";
    } else if (formData.newPassword.length < 4) {
      newErrors.newPassword = "Password must be at least 4 characters";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm password";
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    onSubmit({
      userId: userData._id,
      newPassword: formData.newPassword,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-md"
      title="Reset User Password"
      subtitle={userData ? `Reset password for ${userData.name}` : ""}
      footer={
        <div className="flex gap-3">
          <Button
            outline
            variant="secondary"
            onClick={onClose}
            className="w-1/3"
          >
            Cancel
          </Button>
          <Button 
            icon={KeyRound} 
            className="grow" 
            onClick={handleSubmit}
            disabled={!formData.newPassword || !formData.confirmPassword}
          >
            Reset Password
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <Input
            label="New Password"
            type="password"
            placeholder="Enter new password"
            value={formData.newPassword}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, newPassword: e.target.value }));
              if (errors.newPassword) {
                setErrors((prev) => ({ ...prev, newPassword: "" }));
              }
            }}
          />
          {errors.newPassword && (
            <p className="text-sm text-red-500 mt-1">{errors.newPassword}</p>
          )}
        </div>

        <div>
          <Input
            label="Confirm Password"
            type="password"
            placeholder="Re-enter new password"
            value={formData.confirmPassword}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }));
              if (errors.confirmPassword) {
                setErrors((prev) => ({ ...prev, confirmPassword: "" }));
              }
            }}
          />
          {errors.confirmPassword && (
            <p className="text-sm text-red-500 mt-1">{errors.confirmPassword}</p>
          )}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> The user will need to use this new password for their next login.
          </p>
        </div>
      </div>
    </Modal>
  );
}