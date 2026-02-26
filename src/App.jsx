import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AuthProvider from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
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
const StaffRecords = lazy(() => import("./pages/StaffRecords"));
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

              <Route path="/" element={
                <ProtectedRoute>
                  <Layout><Dashboard /></Layout>
                </ProtectedRoute>
              } />

              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Layout><Dashboard /></Layout>
                </ProtectedRoute>
              } />

              <Route path="/businesses" element={
                <ProtectedRoute>
                  <Layout><Businesses /></Layout>
                </ProtectedRoute>
              } />

              <Route path="/users" element={
                <ProtectedRoute>
                  <Layout><Users /></Layout>
                </ProtectedRoute>
              } />

              <Route path="/subscriptions" element={
                <ProtectedRoute>
                  <Layout><Subscriptions /></Layout>
                </ProtectedRoute>
              } />

              <Route path="/plans" element={
                <ProtectedRoute>
                  <Layout><Plans /></Layout>
                </ProtectedRoute>
              } />

              <Route path="/payments" element={
                <ProtectedRoute>
                  <Layout><Payments /></Layout>
                </ProtectedRoute>
              } />

              <Route path="/sessions" element={
                <ProtectedRoute>
                  <Layout><Sessions /></Layout>
                </ProtectedRoute>
              } />

              <Route path="/settings" element={
                <ProtectedRoute>
                  <Layout><Settings /></Layout>
                </ProtectedRoute>
              } />

              <Route path="/staff" element={
                <ProtectedRoute>
                  <Layout><Staff /></Layout>
                </ProtectedRoute>
              } />

              <Route path="/customers" element={
                <ProtectedRoute>
                  <Layout><Customers /></Layout>
                </ProtectedRoute>
              } />

              <Route path="/suppliers" element={
                <ProtectedRoute>
                  <Layout><Suppliers /></Layout>
                </ProtectedRoute>
              } />

              <Route path="/expenses" element={
                <ProtectedRoute>
                  <Layout><Expenses /></Layout>
                </ProtectedRoute>
              } />

              <Route path="/orders" element={
                <ProtectedRoute>
                  <Layout><Orders /></Layout>
                </ProtectedRoute>
              } />

              <Route path="/invoices" element={
                <ProtectedRoute>
                  <Layout><Invoices /></Layout>
                </ProtectedRoute>
              } />

              <Route path="/customer_payments" element={
                <ProtectedRoute>
                  <Layout><CustomerPayments /></Layout>
                </ProtectedRoute>
              } />

              <Route path="/supplier_payments" element={
                <ProtectedRoute>
                  <Layout><SupplierPayments /></Layout>
                </ProtectedRoute>
              } />

              <Route path="/staff-records" element={
                <ProtectedRoute>
                  <Layout><StaffRecords /></Layout>
                </ProtectedRoute>
              } />

              <Route path="/salary-slips" element={
                <ProtectedRoute>
                  <Layout><SalarySlips /></Layout>
                </ProtectedRoute>
              } />

              <Route path="/staff-payments" element={
                <ProtectedRoute>
                  <Layout><StaffPayments /></Layout>
                </ProtectedRoute>
              } />

              <Route path="/keyboard-shortcuts" element={
                <ProtectedRoute>
                  <Layout><KeyboardShortcuts /></Layout>
                </ProtectedRoute>
              } />

              <Route path="*" element={<Login />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
