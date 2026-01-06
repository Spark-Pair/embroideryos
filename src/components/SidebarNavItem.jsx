import React from 'react';

const SidebarNavItem = ({ icon, label, isActive, onClick, isSubItem = false, className }) => {
  const baseClasses = `
    w-full text-left py-2.5 px-4 flex items-center gap-3 cursor-pointer
    ${isSubItem ? 'pl-8 text-sm text-gray-600' : ''}
  `;
  
  const activeClasses = isActive
    ? 'bg-teal-100/60 text-teal-700 rounded-xl'
    : 'text-gray-700 hover:bg-gray-200/70 rounded-xl';

  return (
    <button
      onClick={onClick}
      className={`${className} ${baseClasses} ${activeClasses}`}
    >
      {!isSubItem && <span>{icon}</span>}
      <span>{label}</span>
    </button>
  );
};

export default SidebarNavItem;