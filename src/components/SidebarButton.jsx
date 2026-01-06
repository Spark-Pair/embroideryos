import React from 'react';

const SidebarButton = ({ icon, label, onClick, className = '' }) => (
  <button
    onClick={onClick}
    className={`
      w-full flex items-center gap-3 px-4 py-3
      rounded-xl transition-all duration-200
      hover:bg-teal-50 hover:text-teal-600
      focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
      ${className}
    `}
  >
    <span className="text-xl">{icon}</span>
    <span className="font-medium whitespace-nowrap">{label}</span>
  </button>
);

export default SidebarButton;