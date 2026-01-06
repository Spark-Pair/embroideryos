import { AnimatePresence, motion } from "framer-motion";

export default function ContextMenu({ isOpen, children }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -10 }}
        onClick={(e) => e.stopPropagation()}
        className="absolute right-7 top-14 z-[50] w-48 bg-white rounded-2xl shadow-xl border border-gray-200 p-2 overflow-hidden text-left"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}