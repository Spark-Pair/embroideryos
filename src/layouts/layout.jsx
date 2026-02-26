import React, { useEffect, useRef } from 'react';
import SidebarNav from '../components/SidebarNav';
import useAuth from '../hooks/useAuth';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { formatDate } from "../utils";
import { useToast } from "../context/ToastContext";

export default function Layout({ children }) {
  const { logout, user } = useAuth();
  const location = useLocation();
  const { showToast } = useToast();
  const lastReadOnlyBlockToastAtRef = useRef(0);
  const isReadOnly = Boolean(user?.subscription?.readOnly);
  const expiryText = user?.subscription?.expiresAt
    ? formatDate(user.subscription.expiresAt, "DD MMM yyyy")
    : "";

  useEffect(() => {
    if (!isReadOnly) return;

    const blockKeywords = [
      "add",
      "create",
      "save",
      "update",
      "edit",
      "delete",
      "remove",
      "repeat",
      "renew",
      "revoke",
      "toggle",
      "mark",
      "receive",
      "payment",
      "discard",
      "submit",
    ];
    const allowKeywords = [
      "print",
      "export",
      "report",
      "download",
      "filter",
      "search",
      "view",
      "detail",
      "next",
      "prev",
      "previous",
      "all",
      "session",
      "logout",
    ];

    const shouldBlockElement = (target) => {
      if (!target || !(target instanceof Element)) return false;
      if (target.closest('[data-readonly-allow="true"]')) return false;
      if (target.closest("aside")) return false; // allow navigation/logout

      const actionEl = target.closest("button, [role='button'], a");
      if (!actionEl) return false;

      const textBlob = [
        actionEl.textContent || "",
        actionEl.getAttribute("aria-label") || "",
        actionEl.getAttribute("title") || "",
      ]
        .join(" ")
        .toLowerCase()
        .trim();

      if (!textBlob) return false;
      if (allowKeywords.some((k) => textBlob.includes(k))) return false;
      return blockKeywords.some((k) => textBlob.includes(k));
    };

    const showReadOnlyToast = () => {
      const now = Date.now();
      if (now - lastReadOnlyBlockToastAtRef.current < 1200) return;
      lastReadOnlyBlockToastAtRef.current = now;
      showToast({
        type: "warning",
        message: "Subscription expired. Read-only mode active. You can only view, report, and print.",
      });
    };

    const onClickCapture = (e) => {
      if (!shouldBlockElement(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      showReadOnlyToast();
    };

    const onSubmitCapture = (e) => {
      const formEl = e.target instanceof Element ? e.target.closest("form") : null;
      if (!formEl) return;
      if (formEl.closest('[data-readonly-allow="true"]')) return;
      if (formEl.closest("aside")) return;
      e.preventDefault();
      e.stopPropagation();
      showReadOnlyToast();
    };

    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("submit", onSubmitCapture, true);
    return () => {
      document.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("submit", onSubmitCapture, true);
    };
  }, [isReadOnly, showToast]);

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <SidebarNav
        currentPath={location.pathname}
        handleLogout={handleLogout} // bottom logout button
      />

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">
        {isReadOnly && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm font-medium">
              Subscription expired{expiryText ? ` on ${expiryText}` : ""}. App is in read-only mode. Please renew your subscription.
            </p>
          </div>
        )}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="no-default-transition h-full"
          >
            {children || <Outlet />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
