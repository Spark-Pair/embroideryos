import { useEffect } from "react";

export function useFormKeyboard({ onEnterSubmit } = {}) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== "Enter") return;
      if (e.target.tagName === "TEXTAREA") return;
      if (e.target.type === "submit") return;
      if (e.target.closest("[data-select-dropdown='true']")) return;

      const FOCUSABLE = [
        'input:not([disabled])',
        '[data-focusable]:not([disabled])',
      ].join(", ");

      const all = [...document.querySelectorAll(FOCUSABLE)]
        .filter(el => el.offsetParent !== null);

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
