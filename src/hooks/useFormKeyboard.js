import { useEffect } from "react";

export function useFormKeyboard({ onEnterSubmit } = {}) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== "Enter") return;
      if (e.target.tagName === "TEXTAREA") return;
      if (e.target.type === "submit") return;
      if (e.target.closest("[data-select-dropdown='true']")) return;

      const FOCUSABLE = [
        'input:not([disabled]):not([readonly])',
        '[data-focusable]:not([disabled])',
      ].join(", ");

      const all = [...document.querySelectorAll(FOCUSABLE)]
        .filter((el) => {
          if (el.offsetParent === null) return false;          // hidden
          if (el.type === "date") return false;                // date picker skip
          if (el.closest("[data-shortcut-capture='true']")) return false; // shortcut modal skip
          return true;
        });

      const idx = all.indexOf(e.target);
      const next = all[idx + 1];

      if (next) {
        e.preventDefault();
        e.stopPropagation();
        next.focus();
      } else if (onEnterSubmit) {
        e.preventDefault();
        onEnterSubmit();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onEnterSubmit]);
}