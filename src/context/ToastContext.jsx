import { createContext, useContext, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = ({ message, type = "success", duration = 3000 }) => {
    const id = Math.random().toString(36).substr(2, 9); // Unique ID for each toast
    
    // Naya toast array mein add karein
    setToasts((prev) => [...prev, { id, message, type }]);

    // Duration ke baad sirf us specific toast ko remove karein
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Container for toasts stack */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none items-end">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id} // Unique key helps Framer Motion track each toast
              initial={{ opacity: 0, y: 20, scale: 0.9, x: 20 }}
              animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: 20, transition: { duration: 0.2 } }}
              layout // Smoothly slides other toasts when one disappears
              className="pointer-events-auto"
            >
              <div
                className={`flex items-center gap-2.5 px-4.5 py-2.5 rounded-2xl shadow-lg border-2 backdrop-blur-md
                  ${toast.type === "success" && "bg-emerald-100/70 border-emerald-600/40 text-emerald-800"}
                  ${toast.type === "warning" && "bg-yellow-100/70 border-yellow-600/40 text-yellow-800"}
                  ${toast.type === "error" && "bg-rose-100/70 border-rose-600/40 text-rose-800"}
                  ${toast.type === "info" && "bg-sky-100/70 border-sky-600/40 text-sky-800"}
                `}
              >
                <span className="text-sm font-medium whitespace-nowrap">
                  {toast.message}
                </span>
                
                <button 
                  onClick={() => removeToast(toast.id)}
                  className="hover:opacity-70 transition-opacity cursor-pointer p-0.5"
                >
                  <X size={16}/>
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);