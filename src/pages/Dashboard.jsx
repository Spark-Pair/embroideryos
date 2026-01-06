import React, { useState } from 'react';

// Hooks and Modals (Existing)
import useAuth from '../hooks/useAuth';
import TargetCalculatorModal from '../components/TargetCalculatorModal';
import SalarySlipGeneratorModal from '../components/SalarySlipGeneratorModal';

export default function Dashboard() {
  
  // State for Modals and Sidebar
  const [openTarget, setOpenTarget] = useState(false);
  const [openSalary, setOpenSalary] = useState(false);
  
  const handleModalOpen = (type) => {
      if (type === 'target') setOpenTarget(true);
      if (type === 'salary') setOpenSalary(true);
  };

  return (
    <div>
        {openTarget && <TargetCalculatorModal onClose={() => setOpenTarget(false)} />}
        {openSalary && <SalarySlipGeneratorModal onClose={() => setOpenSalary(false)} />}
    </div>
  );
}