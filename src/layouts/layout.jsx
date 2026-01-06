import React from 'react';
import SidebarNav from '../components/SidebarNav';
import useAuth from '../hooks/useAuth';
import { useLocation } from 'react-router-dom';

export default function Layout({ children }) {
  const { logout } = useAuth();
  const location = useLocation();

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
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
