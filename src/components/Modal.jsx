import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  children,
  footer,
  maxWidth = "max-w-md",
}) {

  // ✅ ESC key close + scroll lock
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onMouseDown={onClose}
            className="absolute inset-0 bg-gray-900/20 backdrop-blur-sm no-default-transition"
          />

          {/* Modal Wrapper */}
          <motion.div
            initial={{ scale: 0.90, opacity: 0, y: 50 }}
            animate={{ 
              scale: 1, 
              opacity: 1, 
              y: 0,
              transition: {
                type: "spring",
                damping: 25,
                stiffness: 300,
                duration: 0.3
              }
            }}
            exit={{ 
              scale: 0.90, 
              opacity: 0, 
              y: 50,
              transition: {
                duration: 0.2,
                ease: "easeIn"
              }
            }}
            className="relative h-full w-full flex items-center justify-center overflow-hidden no-default-transition p-3"

            // ✅ prevent close when clicking inside modal
            onMouseDown={onClose}
          >
            <div className={`p-7 max-h-full flex flex-col overflow-hidden bg-white w-full ${maxWidth} rounded-4xl shadow-md`} onMouseDown={(e) => e.stopPropagation()}>
              
              {/* Header */}
              {(title || badge) && (
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-semibold text-gray-900">
                        {title}
                      </h2>
                      {badge}
                    </div>
                    {subtitle && (
                      <p className="text-gray-400 text-sm font-light">
                        {subtitle}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 rounded-full cursor-pointer"
                  >
                    <X size={20} className="text-gray-400" />
                  </button>
                </div>
              )}

              {/* Body */}
              <div className="overflow-auto grow">
                {children}
              </div>

              {/* Footer */}
              {footer && <div className="mt-6">{footer}</div>}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}