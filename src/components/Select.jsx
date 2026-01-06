import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Select({ label, options = [], value, onChange, placeholder = "Select..." }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedOption = options.find(opt => opt.value === value);

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

  return (
    <div className="mb-4 relative" ref={containerRef}>
      {label && (
        <label className="block mb-1.5 text-sm text-gray-700">
          {label}
        </label>
      )}
      
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-gray-50 border border-gray-400 rounded-xl px-4 py-2 flex justify-between items-center cursor-pointer hover:border-gray-500 focus-within:ring-2 focus-within:ring-teal-300 transition"
      >
        <span className={`${selectedOption ? "text-gray-900" : "text-gray-400"}`}>
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
            className="absolute z-50 w-full mt-2 bg-white border border-gray-300 rounded-xl shadow max-h-60 overflow-hidden no-default-transition"
          >
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full px-4 py-2.5 text-sm border-b border-gray-200 outline-none focus:ring-0"
              onClick={(e) => e.stopPropagation()}
            />

            <div className="max-h-48 overflow-auto">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <div
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`flex items-center justify-between px-4 py-2.5 cursor-pointer ${
                      value === opt.value
                        ? "bg-teal-50 text-teal-700 hover:bg-teal-100"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <span className="text-sm">{opt.label}</span>
                    {value === opt.value && (
                      <Check size={16} className="text-teal-600" />
                    )}
                  </div>
                ))
              ) : (
                <div className="px-4 py-2.5 text-sm text-gray-400">
                  No options found
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}