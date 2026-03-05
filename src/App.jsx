import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AuthProvider from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import RoleRoute from './routes/RoleRoute';
import Layout from './layouts/layout';
import { ToastProvider } from './context/ToastContext';

// Pages
import Login from './pages/Login';

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Businesses = lazy(() => import("./pages/Businesses"));
const Staff = lazy(() => import("./pages/Staff"));
const Customers = lazy(() => import("./pages/Customers"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Orders = lazy(() => import("./pages/Orders"));
const Invoices = lazy(() => import("./pages/Invoices"));
const CustomerPayments = lazy(() => import("./pages/CustomerPayments"));
const SupplierPayments = lazy(() => import("./pages/SupplierPayments"));
const Statements = lazy(() => import("./pages/Statements"));
const StaffRecords = lazy(() => import("./pages/StaffRecords"));
const CrpStaffRecords = lazy(() => import("./pages/CrpStaffRecords"));
const Users = lazy(() => import("./pages/Users"));
const Sessions = lazy(() => import("./pages/Sessions"));
const Settings = lazy(() => import("./pages/Settings"));
const Subscriptions = lazy(() => import("./pages/Subscriptions"));
const Plans = lazy(() => import("./pages/Plans"));
const Payments = lazy(() => import("./pages/Payments"));
const SalarySlips = lazy(() => import("./pages/SalarySlips"));
const KeyboardShortcuts = lazy(() => import("./pages/KeyboardShortcuts"));
const StaffPayments = lazy(() => import("./pages/StaffPayments"));

export default function App() {
  useEffect(() => {
    let rafId = 0;

    const NEGATIVE_NUMBER_REGEX = /^\(?\s*(?:PKR|RS\.?)?\s*-\s*\d[\d,]*(?:\.\d+)?\s*\)?$/i;

    const applyNegativeClass = () => {
      const root = document.getElementById("root");
      if (!root) return;

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();

      while (node) {
        const parent = node.parentElement;
        if (parent) {
          const tag = parent.tagName;
          if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "OPTION") {
            const text = (node.nodeValue || "").trim().replace(/\s+/g, " ");
            const isNegative = NEGATIVE_NUMBER_REGEX.test(text);
            parent.classList.toggle("is-negative-number", isNegative);
          }
        }
        node = walker.nextNode();
      }
    };

    const scheduleApply = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(applyNegativeClass);
    };

    scheduleApply();

    const root = document.getElementById("root");
    if (!root) return undefined;

    const observer = new MutationObserver(scheduleApply);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const NON_SELECTABLE_INPUT_TYPES = new Set([
      "checkbox",
      "radio",
      "file",
      "date",
      "month",
      "time",
      "datetime-local",
      "color",
      "range",
      "button",
      "submit",
      "reset",
      "image",
      "hidden",
    ]);

    const canAutoSelect = (el) => {
      if (!el) return false;
      if (el.hasAttribute("data-no-auto-select")) return false;
      if (el.disabled || el.readOnly) return false;
      if (el instanceof HTMLTextAreaElement) return true;
      if (el instanceof HTMLInputElement) {
        return !NON_SELECTABLE_INPUT_TYPES.has(String(el.type || "").toLowerCase());
      }
      return false;
    };

    const selectFieldValue = (el) => {
      if (!canAutoSelect(el)) return;
      const value = String(el.value || "");
      if (!value) return;
      try {
        el.select();
      } catch {
        if (typeof el.setSelectionRange === "function") {
          el.setSelectionRange(0, value.length);
        }
      }
    };

    const handleFocusIn = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
      requestAnimationFrame(() => {
        if (document.activeElement === target) {
          selectFieldValue(target);
        }
      });
    };

    document.addEventListener("focusin", handleFocusIn, true);
    return () => {
      document.removeEventListener("focusin", handleFocusIn, true);
    };
  }, []);

  const routeFallback = (
    <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
      Loading...
    </div>
  );

  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Suspense fallback={routeFallback}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Dashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/businesses" element={<Businesses />} />
                <Route path="/users" element={<Users />} />
                <Route path="/subscriptions" element={<Subscriptions />} />
                <Route path="/plans" element={<Plans />} />
                <Route path="/payments" element={<Payments />} />
                <Route path="/sessions" element={<Sessions />} />
                <Route
                  path="/settings"
                  element={
                    <RoleRoute allow={["admin", "staff"]}>
                      <Settings />
                    </RoleRoute>
                  }
                />
                <Route path="/staff" element={<Staff />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/suppliers" element={<Suppliers />} />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/invoices" element={<Invoices />} />
                <Route path="/customer_payments" element={<CustomerPayments />} />
                <Route path="/supplier_payments" element={<SupplierPayments />} />
                <Route path="/statements" element={<Statements />} />
                <Route path="/staff-records" element={<StaffRecords />} />
                <Route path="/crp-staff-records" element={<CrpStaffRecords />} />
                <Route path="/salary-slips" element={<SalarySlips />} />
                <Route path="/staff-payments" element={<StaffPayments />} />
                <Route
                  path="/keyboard-shortcuts"
                  element={
                    <RoleRoute allow={["admin", "staff"]}>
                      <KeyboardShortcuts />
                    </RoleRoute>
                  }
                />
              </Route>

              <Route path="*" element={<Login />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
