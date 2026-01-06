import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, RotateCcw } from "lucide-react";
import Button from "./Button";
import Input from "./Input";
import Select from "./Select";

export default function FilterDrawer({ isOpen, onClose, filters = [], onApply, onReset }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(4px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-gray-900/20 no-default-transition"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%", opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0.8 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="fixed right-0 top-0 h-full w-105 z-[70] p-6 flex flex-col no-default-transition"
          >
            <div className="bg-white p-4 flex flex-col gap-4 h-full border border-gray-300 rounded-3xl">
              {/* Header */}
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-medium px-2">Filters</h2>
                <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-full cursor-pointer">
                  <X size={20}/>
                </button>
              </div>

              {/* Filter Fields */}
              <div className="flex-1 space-y-6 overflow-auto px-3">
                {filters.map((f, i) => (
                  <div key={i}>
                    {f.type === "text" || f.type === "number" || f.type === "date" ? (
                      <Input
                        label={f.label}
                        type={f.type}
                        placeholder={f.placeholder}
                        value={f.value}
                        onChange={f.onChange}
                      />
                    ) : f.type === "select" ? (
                      <Select
                        label={f.label}
                        options={f.options}
                        value={f.value}
                        onChange={f.onChange}
                      />
                    ) : null}

                    {/* Include/Exclude toggle */}
                    {f.include !== undefined && (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="checkbox"
                          checked={f.include}
                          onChange={(e) => f.onIncludeChange(e.target.checked)}
                          id={`include-${i}`}
                          className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-2 focus:ring-teal-500"
                        />
                        <label htmlFor={`include-${i}`} className="text-xs text-gray-500">
                          Include in filter
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="grid grid-cols-2 gap-4 mt-auto">
                <Button outline icon={RotateCcw} variant="secondary" onClick={onReset}>
                  Reset
                </Button>
                <Button onClick={onApply} >
                  Apply
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
