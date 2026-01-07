import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, Users, FileText, DollarSign, CreditCard, Users2, Settings, LogOut, Building2, Banknote, Repeat, ChevronDown } from 'lucide-react';
import SidebarNavItem from './SidebarNavItem';
import useAuth from '../hooks/useAuth';
import { motion, AnimatePresence } from "framer-motion";

const developerNav = [
  { id: 'dashboard', icon: <LayoutGrid className="w-4.5 h-4.5" />, label: 'Dashboard', path: '/dashboard' },
  { id: 'businesses', icon: <Building2 className="w-4.5 h-4.5" />, label: 'Businesses', path: '/businesses' },
  { id: 'users', icon: <Users2 className="w-4.5 h-4.5" />, label: 'Users', path: '/users' },
  { id: 'sessions', icon: <Users2 className="w-4.5 h-4.5" />, label: 'Sessions', path: '/sessions' },
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  let navItems = [];
  if (user.role === 'developer') navItems = developerNav;
  if (user.role === 'admin') navItems = adminNav;
  if (user.role === 'staff') navItems = staffNav;

  const isActive = (path) => {
    if (!path) return false;
    return currentPath === path || currentPath.startsWith(path + '/');
  };

  // Get user initials for avatar
  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleDropdownAction = (action) => {
    setIsDropdownOpen(false);
    action();
  };

  return (
    <motion.aside
      className="w-78 p-6 no-default-transition"
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
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

          {/* Profile Dropdown Section */}
          <div className="pt-3 border-t border-gray-300" ref={dropdownRef}>
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-200/70"
              >
                <div className="w-8 h-8 rounded-full bg-[#1C7773] flex items-center justify-center text-white font-medium text-sm">
                  {getInitials(user.name)}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-900">
                    {user.name || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {user.role}
                  </p>
                </div>
                <ChevronDown 
                  className={`w-4 h-4 text-gray-500 transition-transform ${
                    isDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="absolute bottom-full left-0 right-0 mb-2 bg-white
                              border border-gray-300 rounded-2xl shadow-lg overflow-hidden no-default-transition"
                  >
                    <div className="p-2">
                      <button
                        onClick={() => handleDropdownAction(() => navigate('/settings'))}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-200/60 text-left rounded-xl cursor-pointer"
                      >
                        <Settings className="w-4 h-4 text-gray-600" />
                        <span className="text-sm text-gray-700">Settings</span>
                      </button>
                      
                      <button
                        onClick={() => handleDropdownAction(() => navigate('/sessions'))}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-200/60 text-left rounded-xl cursor-pointer"
                      >
                        <Users2 className="w-4 h-4 text-gray-600" />
                        <span className="text-sm text-gray-700">Sessions</span>
                      </button>

                      <div className="h-px bg-gray-300 my-1.5" />

                      <button
                        onClick={() => handleDropdownAction(handleLogout)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 text-left rounded-xl cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-red-600" />
                        <span className="text-sm text-red-600 font-medium">Logout</span>
                      </button>
                    </div>
                    </motion.div>
                  )}
                </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </motion.aside>
  );
};

export default SidebarNav;