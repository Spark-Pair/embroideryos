import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, Users, FileText, DollarSign, CreditCard, Users2, Settings, LogOut,   Building2, Banknote, Repeat } from 'lucide-react';
import SidebarNavItem from './SidebarNavItem';
import useAuth from '../hooks/useAuth';

const developerNav = [
  { id: 'dashboard', icon: <LayoutGrid className="w-4.5 h-4.5" />, label: 'Dashboard', path: '/dashboard' },
  { id: 'businesses', icon: <Building2 className="w-4.5 h-4.5" />, label: 'Businesses', path: '/businesses' },
  { id: 'users', icon: <Users2 className="w-4.5 h-4.5" />, label: 'Users', path: '/users' },
  { id: 'subscriptions', icon: <Repeat className="w-4.5 h-4.5" />, label: 'Subscriptions', path: '/subscriptions' },
  { id: 'payments', icon: <Banknote className="w-4.5 h-4.5" />, label: 'Payments', path: '/payments' },
];

const adminNav = [
  { id: 'dashboard', icon: <LayoutGrid className="w-4.5 h-4.5" />, label: 'Dashboard', path: '/dashboard' },
  { id: 'customers', icon: <Users className="w-4.5 h-4.5" />, label: 'Customers', path: '/customers' },
  { id: 'customer_payment', icon: <DollarSign className="w-4.5 h-4.5" />, label: 'Customer Payments', path: '/customer_payments' },
  { id: 'suppliers', icon: <Users className="w-4.5 h-4.5" />, label: 'Suppliers', path: '/suppliers' },
  { id: 'supplier_payment', icon: <DollarSign className="w-4.5 h-4.5" />, label: 'Supplier Payments', path: '/supplier_payments' },
  { id: 'expenses', icon: <CreditCard className="w-4.5 h-4.5" />, label: 'Expenses', path: '/expenses' },
  { id: 'orders', icon: <FileText className="w-4.5 h-4.5" />, label: 'Orders', path: '/orders' },
  { id: 'invoices', icon: <FileText className="w-4.5 h-4.5" />, label: 'Invoices', path: '/invoices' },
  { id: 'staff', icon: <Users2 className="w-4.5 h-4.5" />, label: 'Staff', path: '/staff' },
  { id: 'staff-records', icon: <FileText className="w-4.5 h-4.5" />, label: 'Staff Records', path: '/staff-records' },
];

const staffNav = [
  { id: 'dashboard', icon: <LayoutGrid className="w-4.5 h-4.5" />, label: 'Dashboard', path: '/dashboard' },
  { id: 'customers', icon: <Users className="w-4.5 h-4.5" />, label: 'Customers', path: '/customers' },
  { id: 'customer_payment', icon: <DollarSign className="w-4.5 h-4.5" />, label: 'Customer Payments', path: '/customer_payments' },
  { id: 'suppliers', icon: <Users className="w-4.5 h-4.5" />, label: 'Suppliers', path: '/suppliers' },
  { id: 'supplier_payment', icon: <DollarSign className="w-4.5 h-4.5" />, label: 'Supplier Payments', path: '/supplier_payments' },
  { id: 'expenses', icon: <CreditCard className="w-4.5 h-4.5" />, label: 'Expenses', path: '/expenses' },
  { id: 'orders', icon: <FileText className="w-4.5 h-4.5" />, label: 'Orders', path: '/orders' },
  { id: 'invoices', icon: <FileText className="w-4.5 h-4.5" />, label: 'Invoices', path: '/invoices' },
  { id: 'staff', icon: <Users2 className="w-4.5 h-4.5" />, label: 'Staff', path: '/staff' },
  { id: 'staff-records', icon: <FileText className="w-4.5 h-4.5" />, label: 'Staff Records', path: '/staff-records' },
];

const SidebarNav = ({ currentPath, handleLogout }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const searchRef = useRef(null);

  console.log(user);
  
  let navItems = [];

  if (user.role === 'developer') navItems = developerNav;
  if (user.role === 'admin') navItems = adminNav;
  if (user.role === 'staff') navItems = staffNav;

  // 🔥 ACTIVE CHECK (URL based)
  const isActive = (path) => {
    if (!path) return false;
    return currentPath === path || currentPath.startsWith(path + '/');
  };

  return (
    <aside className="w-78 p-6">
      <div className="bg-white p-4 flex flex-col gap-4 h-full border border-gray-300 rounded-3xl">

        {/* Top */}
        <div className="flex items-center gap-1.5 ps-3 pt-2.5 pb-5 border-b border-gray-300">
          <div className="w-8 h-8">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 129.13 201.55"
              className="w-full h-full fill-[#1C7773]"
            >
              <path d="M221.9,182.51h40.94a137.1,137.1,0,0,0-7,32.07c1.25-2.88,9.25-20.48,28.55-26.46,20-6.22,42.26,3,51.49,18.64,13.43,22.74,1.54,51.69-6.65,62.91-14.87,20.35-38.68,34.3-47.84,39,16.53,20.05,46.66,22.39,66.75,21.12v54.23c-53.35-3.52-100.83-31.69-117.07-80.31l25.29-15.64H232.59A198,198,0,0,1,219,221.36,195.84,195.84,0,0,1,221.9,182.51Z" transform="translate(-218.97 -182.51)" />
            </svg>
          </div>
          <h1 className="text-[1.35rem] font-semibold tracking-wide text-[#1C7773]">
            EmbroideryOS
          </h1>
        </div>

        {/* Menu */}
        <div className="flex flex-col justify-between h-full">
          <nav className="space-y-1">
            {navItems.map(item => (
              <SidebarNavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                isActive={isActive(item.path)}
                onClick={() => navigate(item.path)}
              />
            ))}
          </nav>

          {/* Bottom */}
          <div className="space-y-1 pt-3 border-t border-gray-300">
            <SidebarNavItem
              icon={<Settings className="w-4.5 h-4.5" />}
              label="Settings"
              isActive={isActive('/settings')}
              onClick={() => navigate('/settings')}
            />
            <SidebarNavItem
              className="bg-red-100 text-red-500 hover:bg-red-200 hover:text-red-600"
              icon={<LogOut className="w-4.5 h-4.5" />}
              label="Logout"
              onClick={handleLogout}
            />
          </div>
        </div>
      </div>
    </aside>
  );
};

export default SidebarNav;
