import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, Users, FileText, DollarSign, CreditCard, Users2, Settings, LogOut, Building2, Banknote, Repeat, ChevronDown, History, Keyboard, Crown, Scissors, ScrollText } from 'lucide-react';
import SidebarNavItem from './SidebarNavItem';
import useAuth from '../hooks/useAuth';
import { AnimatePresence } from "framer-motion";

const developerNav = [
  { id: 'dashboard', icon: <LayoutGrid className="w-4.5 h-4.5" />, label: 'Dashboard', path: '/dashboard' },
  { id: 'businesses', icon: <Building2 className="w-4.5 h-4.5" />, label: 'Businesses', path: '/businesses' },
  { id: 'users', icon: <Users2 className="w-4.5 h-4.5" />, label: 'Users', path: '/users' },
  { id: 'subscriptions', icon: <Repeat className="w-4.5 h-4.5" />, label: 'Subscriptions', path: '/subscriptions' },
  { id: 'plans', icon: <Crown className="w-4.5 h-4.5" />, label: 'Plans', path: '/plans' },
  { id: 'payments', icon: <Banknote className="w-4.5 h-4.5" />, label: 'Payments', path: '/payments' },
];

const adminNav = [
  { id: 'dashboard', icon: <LayoutGrid className="w-4.5 h-4.5" />, label: 'Dashboard', path: '/dashboard' },
  { id: 'users', icon: <Users2 className="w-4.5 h-4.5" />, label: 'Users', path: '/users' },
  { id: 'customers', icon: <Users className="w-4.5 h-4.5" />, label: 'Customers', path: '/customers' },
  { id: 'customer_payment', icon: <DollarSign className="w-4.5 h-4.5" />, label: 'Customer Payments', path: '/customer_payments' },
  { id: 'suppliers', icon: <Users className="w-4.5 h-4.5" />, label: 'Suppliers', path: '/suppliers' },
  { id: 'supplier_payment', icon: <DollarSign className="w-4.5 h-4.5" />, label: 'Supplier Payments', path: '/supplier_payments' },
  { id: 'statements', icon: <ScrollText className="w-4.5 h-4.5" />, label: 'Statements', path: '/statements' },
  { id: 'expenses', icon: <CreditCard className="w-4.5 h-4.5" />, label: 'Expenses', path: '/expenses' },
  { id: 'orders', icon: <FileText className="w-4.5 h-4.5" />, label: 'Orders', path: '/orders' },
  { id: 'invoices', icon: <FileText className="w-4.5 h-4.5" />, label: 'Invoices', path: '/invoices' },
  { id: 'staff', icon: <Users2 className="w-4.5 h-4.5" />, label: 'Staff', path: '/staff' },
  { id: 'staff-records', icon: <FileText className="w-4.5 h-4.5" />, label: 'Staff Records', path: '/staff-records' },
  { id: 'crp-staff-records', icon: <Scissors className="w-4.5 h-4.5" />, label: 'CRP Records', path: '/crp-staff-records' },
  { id: 'staff-payments', icon: <Banknote className="w-4.5 h-4.5" />, label: 'Staff Payments', path: '/staff-payments' },
  { id: 'salary-slips', icon: <FileText className="w-4.5 h-4.5" />, label: 'Salary Slips', path: '/salary-slips' },
];

const staffNav = [
  { id: 'dashboard', icon: <LayoutGrid className="w-4.5 h-4.5" />, label: 'Dashboard', path: '/dashboard' },
  { id: 'customers', icon: <Users className="w-4.5 h-4.5" />, label: 'Customers', path: '/customers' },
  { id: 'customer_payment', icon: <DollarSign className="w-4.5 h-4.5" />, label: 'Customer Payments', path: '/customer_payments' },
  { id: 'suppliers', icon: <Users className="w-4.5 h-4.5" />, label: 'Suppliers', path: '/suppliers' },
  { id: 'supplier_payment', icon: <DollarSign className="w-4.5 h-4.5" />, label: 'Supplier Payments', path: '/supplier_payments' },
  { id: 'statements', icon: <ScrollText className="w-4.5 h-4.5" />, label: 'Statements', path: '/statements' },
  { id: 'expenses', icon: <CreditCard className="w-4.5 h-4.5" />, label: 'Expenses', path: '/expenses' },
  { id: 'orders', icon: <FileText className="w-4.5 h-4.5" />, label: 'Orders', path: '/orders' },
  { id: 'invoices', icon: <FileText className="w-4.5 h-4.5" />, label: 'Invoices', path: '/invoices' },
  { id: 'staff', icon: <Users2 className="w-4.5 h-4.5" />, label: 'Staff', path: '/staff' },
  { id: 'staff-records', icon: <FileText className="w-4.5 h-4.5" />, label: 'Staff Records', path: '/staff-records' },
  { id: 'crp-staff-records', icon: <Scissors className="w-4.5 h-4.5" />, label: 'CRP Records', path: '/crp-staff-records' },
  { id: 'staff-payments', icon: <Banknote className="w-4.5 h-4.5" />, label: 'Staff Payments', path: '/staff-payments' },
];

const SidebarNav = ({ currentPath, handleLogout, isMobileOpen = false, onCloseMobile }) => {
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
  const canManagePersonalSettings = user.role !== "developer";

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

  const handleNav = (path) => {
    navigate(path);
    if (onCloseMobile) onCloseMobile();
  };

  const mobileClasses = `
    fixed inset-y-0 left-0 z-40 w-[280px] p-4
    transition-transform duration-200 ease-out
    ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
    lg:static lg:translate-x-0 lg:w-78 lg:p-6
  `;

  return (
    <aside className={`${mobileClasses} h-full lg:h-screen no-default-transition`}>
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
        <div className="flex flex-col justify-between h-full min-h-0">
          <nav className="space-y-1 overflow-y-auto pr-1">
            {navItems.map(item => (
              <SidebarNavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                isActive={isActive(item.path)}
                onClick={() => handleNav(item.path)}
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
                  <div
                    className="absolute bottom-full left-0 right-0 mb-2 bg-white
                              border border-gray-300 rounded-2xl shadow-lg overflow-hidden no-default-transition"
                  >
                    <div className="p-2">
                      {canManagePersonalSettings && (
                        <>
                          <button
                        onClick={() => handleDropdownAction(() => handleNav('/settings'))}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-200/60 text-left rounded-xl cursor-pointer"
                          >
                            <Settings className="w-4 h-4 text-gray-600" />
                            <span className="text-sm text-gray-700">Settings</span>
                          </button>

                          <button
                            onClick={() => handleDropdownAction(() => handleNav('/keyboard-shortcuts'))}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-200/60 text-left rounded-xl cursor-pointer"
                          >
                            <Keyboard className="w-4 h-4 text-gray-600" />
                            <span className="text-sm text-gray-700">Keyboard Shortcuts</span>
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => handleDropdownAction(() => handleNav('/sessions'))}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-200/60 text-left rounded-xl cursor-pointer"
                      >
                        <History className="w-4 h-4 text-gray-600" />
                        <span className="text-sm text-gray-700">Sessions</span>
                      </button>

                      <div className="h-px bg-gray-300 my-1.5" />

                      <button
                        onClick={() => handleDropdownAction(handleLogout)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-50 text-left rounded-xl cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-red-600" />
                        <span className="text-sm text-red-600 font-medium">Logout</span>
                      </button>
                    </div>
                    </div>
                  )}
                </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default SidebarNav;
