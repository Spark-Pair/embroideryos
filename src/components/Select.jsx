import React, { useState, useEffect, useCallback, useRef, forwardRef } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const Select = forwardRef(function Select(
  { label, options = [], value, onChange, placeholder = "Select...", disabled = false },
  ref
) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const optionRefs = useRef([]);
  const suppressNextFocusOpenRef = useRef(false);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedOption = options.find(opt => opt.value === value);
  const selectedFilteredIndex = filteredOptions.findIndex(opt => opt.value === value);

  const updateDropdownPosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownStyle({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    }
  };

  const openDropdown = useCallback(() => {
    if (disabled) return;
    updateDropdownPosition();
    setIsOpen(true);
  }, [disabled]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setSearch("");
    setActiveIndex(-1);
  }, []);

  const selectOption = useCallback((opt) => {
    onChange(opt.value);
    closeDropdown();
    suppressNextFocusOpenRef.current = true;
    triggerRef.current?.focus();
  }, [onChange, closeDropdown]);

  // Expose focus on trigger via ref
  useEffect(() => {
    if (ref) {
      ref.current = triggerRef.current;
    }
  }, [ref, triggerRef.current]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        closeDropdown();
      }
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [closeDropdown]);

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

  useEffect(() => {
    if (!isOpen) return;
    if (selectedFilteredIndex >= 0) setActiveIndex(selectedFilteredIndex);
    else setActiveIndex(filteredOptions.length ? 0 : -1);
  }, [isOpen, search, selectedFilteredIndex, filteredOptions.length]);

  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen]);

  const moveActive = (delta) => {
    if (!filteredOptions.length) return;
    setActiveIndex((prev) => {
      const next = prev < 0 ? 0 : prev + delta;
      if (next < 0) return filteredOptions.length - 1;
      if (next >= filteredOptions.length) return 0;
      return next;
    });
  };

  const handleTriggerFocus = () => {
    if (suppressNextFocusOpenRef.current) {
      suppressNextFocusOpenRef.current = false;
      return;
    }
    openDropdown();
  };

  return (
    <div className="relative" ref={containerRef}>
      {label && (
        <label className="block mb-1.5 text-sm text-gray-700">{label}</label>
      )}

      <div
        ref={triggerRef}
        onClick={openDropdown}
        onFocus={handleTriggerFocus}
        tabIndex={disabled ? -1 : 0}
        data-focusable="select"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            closeDropdown();
            return;
          }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            e.stopPropagation();
            if (!isOpen) {
              openDropdown();
              return;
            }
            moveActive(e.key === "ArrowDown" ? 1 : -1);
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            if (!isOpen) {
              openDropdown();
              return;
            }
            if (activeIndex >= 0 && filteredOptions[activeIndex]) {
              selectOption(filteredOptions[activeIndex]);
            }
          }
        }}
        className={`w-full bg-gray-50 border border-gray-400 rounded-xl px-4 py-2 flex justify-between items-center transition
          ${disabled ? "opacity-55 cursor-not-allowed" : "cursor-pointer hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-300"}`}
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
              zIndex: 9999,
            }}
            data-select-dropdown="true"
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
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    closeDropdown();
                    return;
                  }
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    e.stopPropagation();
                    moveActive(e.key === "ArrowDown" ? 1 : -1);
                    return;
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    if (activeIndex >= 0 && filteredOptions[activeIndex]) {
                      selectOption(filteredOptions[activeIndex]);
                    }
                  }
                }}
              />
            </div>
            <hr className="my-1.5 border-gray-300" />
            <div className="max-h-48 grid overflow-auto p-0.5 pt-0 gap-0.5 rounded-b-xl">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt, idx) => (
                  <div
                    key={opt.value}
                    ref={(el) => { optionRefs.current[idx] = el; }}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => selectOption(opt)}
                    className={`flex items-center justify-between px-4 py-2.5 cursor-pointer rounded-xl ${
                      idx === activeIndex
                        ? "bg-teal-50 text-teal-800"
                        : value === opt.value
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
});

export default Select;
