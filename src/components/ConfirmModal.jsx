import { AlertTriangle, CircleCheck, Info, Power, XCircle } from 'lucide-react';
import Button from './Button';
import Modal from './Modal';

export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Confirm Action",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger" // danger, success, warning, info
}) {
  
  const icons = {
    danger: XCircle,
    success: CircleCheck,
    warning: AlertTriangle,
    info: Info
  };

  const Icon = icons[variant];

  const colorClasses = {
    danger: {
      iconBg: 'bg-red-50',
      iconText: 'text-red-600',
      border: 'border-red-100'
    },
    success: {
      iconBg: 'bg-green-50',
      iconText: 'text-green-600',
      border: 'border-green-100'
    },
    warning: {
      iconBg: 'bg-yellow-50',
      iconText: 'text-yellow-600',
      border: 'border-yellow-100'
    },
    info: {
      iconBg: 'bg-blue-50',
      iconText: 'text-blue-600',
      border: 'border-blue-100'
    }
  };

  const colors = colorClasses[variant];

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-md"
    >
      <div className="text-center">
        {/* Icon Circle */}
        <div className={`
          inline-flex items-center justify-center
          w-16 h-16 rounded-full mb-5
          ${colors.iconBg} ${colors.iconText}
          border-4 ${colors.border}
        `}>
          <Icon size={32} strokeWidth={2} />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-semibold text-gray-900 mb-3">
          {title}
        </h2>

        {/* Message */}
        <p className="text-gray-600 leading-relaxed mb-8 px-4">
          {message}
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
            <Button
              outline
              variant="secondary"
              className="w-1/3"
              onClick={onClose}
            >
              {cancelText}
            </Button>
            <Button
              icon={Power}
              outline
              variant={variant}
              onClick={handleConfirm}
              className="flex-1"
            >
              {confirmText}
            </Button>
        </div>
      </div>
    </Modal>
  );
}
