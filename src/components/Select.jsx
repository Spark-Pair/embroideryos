import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Select({ label, options = [], value, onChange, placeholder = "Select..." }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState({});
  const containerRef = useRef(null);
  const triggerRef = useRef(null);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedOption = options.find(opt => opt.value === value);

  const updateDropdownPosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownStyle({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  };

  const handleToggle = () => {
    if (!isOpen) updateDropdownPosition();
    setIsOpen(prev => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!isOpen) return;
    const handle = () => updateDropdownPosition();
    window.addEventListener("scroll", handle, true);
    window.addEventListener("resize", handle);
    return () => {
      window.removeEventListener("scroll", handle, true);
      window.removeEventListener("resize", handle);
    };
  }, [isOpen]);

  return (
    <div className="mb-4 relative" ref={containerRef}>
      {label && (
        <label className="block mb-1.5 text-sm text-gray-700">{label}</label>
      )}

      <div
        ref={triggerRef}
        onClick={handleToggle}
        className="w-full bg-gray-50 border border-gray-400 rounded-xl px-4 py-2 flex justify-between items-center cursor-pointer hover:border-gray-500 focus-within:ring-2 focus-within:ring-teal-300 transition"
      >
        <span className={selectedOption ? "text-gray-900" : "text-gray-400"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={18}
          className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{
              position: "fixed",
              top: dropdownStyle.top,
              left: dropdownStyle.left,
              width: dropdownStyle.width,
              zIndex: 50,
            }}
            className="bg-white border border-gray-400 rounded-2xl shadow max-h-65 overflow-hidden p-1"
          >
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-4 py-2.5 text-sm border border-gray-400 outline-none focus:ring-0 rounded-xl"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <hr className="my-1.5 border-gray-300" />
            <div className="max-h-48 grid overflow-auto px-0.5 gap-0.5 rounded-b-xl">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <div
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`flex items-center justify-between px-4 py-2.5 cursor-pointer rounded-xl ${
                      value === opt.value
                        ? "bg-teal-100/85 text-teal-700 hover:bg-teal-200/85"
                        : "text-gray-700 hover:bg-gray-200/85"
                    }`}
                  >
                    <span className="text-sm">{opt.label}</span>
                    {value === opt.value && <Check size={16} className="text-teal-600" />}
                  </div>
                ))
              ) : (
                <div className="px-4 py-2.5 text-sm text-gray-400">No options found</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}