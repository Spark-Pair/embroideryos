import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AuthProvider from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import Layout from './layouts/Layout';
import { ToastProvider } from './context/ToastContext';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Businesses from './pages/Businesses';
import Staff from './pages/Staff';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import Expenses from './pages/Expenses';
import Orders from './pages/Orders';
import Invoices from './pages/Invoices';
import CustomerPayments from './pages/CustomerPayments';
import SupplierPayments from './pages/SupplierPayments';
import StaffRecords from './pages/StaffRecords';
import Users from './pages/Users';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
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

            <Route path="*" element={<Login />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
