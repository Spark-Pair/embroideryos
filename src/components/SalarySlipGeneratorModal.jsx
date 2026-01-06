import React, { useState } from 'react';

// --- Helper Components ---
// Copied and slightly adapted from TargetCalculatorModal for uniform styling
function InputField({ label, value, onChange, placeholder, color = 'text-gray-800' }) {
    // Custom logic to handle dynamic text color for Arrears/Deductions fields
    let inputColor = color;
    if (label.includes('Arrears') && (Number(value) || 0) < 0) {
        inputColor = "text-red-600";
    } else if (label.includes('Deduction')) {
        inputColor = "text-red-700";
    } else if (label.includes('Arrears') && (Number(value) || 0) > 0) {
        inputColor = "text-green-700";
    }

    return (
        <div className="flex flex-col">
            <label className="mb-1.5 text-gray-700 font-normal text-sm block">{label}</label>
            <input
                type="text"
                value={value}
                onChange={onChange}
                placeholder={placeholder || "0"}
                className={`border border-gray-400 px-4 py-2 rounded-xl bg-white focus:ring-2 focus:ring-teal-300 focus:border-teal-400 focus:outline-none transition-all w-full capitalize ${inputColor}`}
            />
        </div>
    )
}

// Adapted ResultField for displaying calculated totals - Color changed to TEAL
function ResultField({ label, value }) {
    return (
      <div className="flex items-center justify-between bg-white border border-gray-400 px-4 py-2 rounded-xl">
          <label className="text-gray-700 tracking-wide">{label}</label>
          <div className={`text-lg font-bold text-teal-600`}>
              {value}
          </div>
      </div>
  )
}

export default function SalarySlipGeneratorModal({ onClose }) {

    // --- Initialization Logic ---
    const getPreviousMonth = () => {
        const date = new Date();
        date.setMonth(date.getMonth() - 1);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };
    const defaultMonth = getPreviousMonth();

    const [showPreview, setShowPreview] = useState(false);

    const emptyEmployee = {
        id: Date.now(),
        name: '',
        month: defaultMonth,
        amount: '',
        arrears: '',
        advance: '',
        bonusQty: '',
    };

    const [employees, setEmployees] = useState([emptyEmployee]);

    // --- Actions & Calculations ---
    const addEmployee = () => {
        setEmployees([...employees, { ...emptyEmployee, id: Date.now() }]);
    };

    const removeEmployee = (idx) => {
        if (employees.length > 1) {
            setEmployees(employees.filter((_, i) => i !== idx));
        }
    };

    const updateEmployee = (idx, field, value) => {
        const copy = [...employees];
        copy[idx][field] = value;
        setEmployees(copy);
    };

    const BONUS_RATE = 200;

    const calculateEmployee = (emp) => {
        const amount = Number(emp.amount) || 0;
        const arrears = Number(emp.arrears) || 0;
        const advance = Number(emp.advance) || 0;
        const bonusQty = Number(emp.bonusQty) || 0;
        const bonusAmt = bonusQty * BONUS_RATE;

        const total = (amount + arrears + bonusAmt) - advance;

        return { amount, arrears, advance, bonusQty, bonusAmt, total };
    };

    const grandTotal = employees.reduce((sum, emp) => {
        return sum + calculateEmployee(emp).total;
    }, 0);

    const handlePrint = () => {
        window.print();
    };

    // ---------------------------------
    // RENDER: PREVIEW MODE 
    // ---------------------------------
    if (showPreview) {
      return (
          <div className="fixed inset-0 bg-gray-900/90 z-50 overflow-y-auto flex justify-center">
              <style>{`
                @media print {
                  @page {
                    size: A4 portrait;
                    margin: 0 !important; /* Ensures the page box itself has zero margin */
                  }

                  body * { 
                      visibility: hidden; 
                  }
                  
                  /* Ensure the body and HTML have no default margins/padding from the browser or OS */
                  html, body {
                      margin: 0 !important;
                      padding: 0 !important;
                      width: 100%;
                      min-height: 100%;
                      overflow: hidden; /* Prevent extra scrollbars/pages */
                  }
                  
                  #printable-area, #printable-area * { 
                      visibility: visible; 
                  }
                  
                  /* Ensure the printable area takes full width and starts from the top */
                  #printable-area { 
                      position: absolute; 
                      left: 0; 
                      top: 0; 
                      width: 100%; 
                      padding: 0 !important; 
                      margin: 0 !important; /* Added margin: 0 */
                  } 
                  
                  .no-print { 
                      display: none !important; 
                  }
                  
                  * { 
                      -webkit-print-color-adjust: exact !important; 
                      print-color-adjust: exact !important; 
                  } 
                }
              `}</style>

              {/* Main A4 Container */}
              <div className="w-full max-w-[210mm] min-h-screen bg-white shadow-2xl relative m-5">
                  
                  {/* --- Minimal Fixed Toolbar (No Change) --- */}
                  <div className="no-print fixed top-4 right-4 z-20 flex gap-3 p-4 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-300">
                      <button onClick={() => setShowPreview(false)} className="px-4 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-xl text-sm transition-colors font-medium">
                          ← Back to Edit
                      </button>
                      <button onClick={handlePrint} className="px-4 py-2 bg-[#127475] text-white hover:bg-teal-700 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-md">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                          Print All Slips
                      </button>
                  </div>

                  {/* A4 Printable Area - 3 Columns for 6 Slips */}
                  <div id="printable-area" className="p-8 grid grid-cols-3 gap-5 content-start bg-white print-slip-container">
                      <h1 className="text-3xl font-extrabold text-gray-800 text-center mb-6 col-span-3 no-print">Salary Slip Preview (6 per page)</h1>

                      {employees.map((emp) => {
                          const calc = calculateEmployee(emp);
                          return (
                            <div key={emp.id} className="border border-gray-500 rounded-2xl overflow-hidden print-slip break-inside-avoid p-1.5">
                                <div className="bg-teal-700/20 py-2.5 px-4.5 flex items-center justify-between rounded-xl">
                                    <h3 className="text-base font-bold tracking-wide text-gray-900 capitalize text-nowrap">{emp.name || 'EMPLOYEE NAME'}</h3>
                                    <p className="text-teal-800 font-semibold text-xs text-nowrap">{emp.month}</p>
                                </div>

                                <div className="p-2 text-[10px] space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-gray-800">Arrears:</span>
                                        <span className={`font-semibold ${calc.arrears < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {calc.arrears.toLocaleString()}
                                        </span>
                                    </div>
                                    <hr className='border-gray-500'/>
                                    <div className="flex justify-between">
                                        <span className="text-gray-800">Amount:</span>
                                        <span className="font-semibold text-gray-800">{calc.amount.toLocaleString()}</span>
                                    </div>
                                    <hr className='border-gray-500'/>
                                    <div className="flex justify-between">
                                        <span className="text-gray-800">Bonus ({calc.bonusQty} units):</span>
                                        <span className="font-semibold text-gray-800">{calc.bonusAmt.toLocaleString()}</span>
                                    </div>
                                    <hr className='border-gray-500'/>
                                    <div className="flex justify-between">
                                        <span className="text-gray-800">Advance:</span>
                                        <span className="font-semibold text-red-600">-{calc.advance.toLocaleString()}</span>
                                    </div>
                                </div>
                                
                                <div className="bg-teal-700/20 py-2 px-3.5 flex items-center justify-between rounded-lg">
                                    <h3 className="font-bold tracking-wide text-gray-900 capitalize text-xs">Net Amount:</h3>
                                    <p className="text-teal-800 font-semibold text-sm">{calc.total.toLocaleString()}</p>
                                </div>

                                <div className="mt-2 py-2 px-3 text-xs border border-gray-500 rounded-xl">
                                  <div className="">
                                    <span className="font-medium text-gray-700 mr-2 whitespace-nowrap">Payment:</span>
                                    <div className="line h-4.5 border-b border-dashed border-gray-600 w-[98%] mx-auto"></div>
                                  </div>
                                </div>
                            </div>
                          );
                      })}
                  </div>
              </div>
          </div>
      );
    }

    // ---------------------------------
    // RENDER: INPUT MODE (Fixed button and colors)
    // ---------------------------------
    return (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 z-50 transition-opacity duration-300">
            <div className="bg-white sm:rounded-4xl w-full max-w-4xl p-6 md:p-8 max-h-full sm:max-h-[95vh] overflow-y-auto relative border border-gray-400">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors text-3xl leading-none z-10"
                    aria-label="Close"
                >
                    &times;
                </button>

                <header className="mb-4 border-b border-gray-400 pb-4">
                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 text-center">🧾 Salary Slip Generator</h2>
                </header>

                {/* Employee List */}
                <div className="space-y-4">
                    {employees.map((emp, i) => {
                        const calc = calculateEmployee(emp);

                        return (
                            <div key={emp.id} className="bg-gray-50 border border-gray-300 p-4 sm:p-6 rounded-3xl shadow-sm transition-all hover:shadow-md">

                                {/* Employee Header (Name & Month & Remove) */}
                                <div className="flex justify-between items-center mb-4 px-2 pb-2 border-b border-gray-400">
                                    <h3 className="text-lg sm:text-xl font-bold tracking-wide text-[#0a6465]">Employee {i + 1}</h3>

                                    {/* Remove Button */}
                                    {employees.length > 1 && (
                                        <button
                                            onClick={() => removeEmployee(i)}
                                            className="text-gray-500 hover:text-red-500 p-2 transition-colors active:scale-95"
                                            aria-label="Remove design"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                        </button>
                                    )}
                                </div>

                                {/* Input Fields - Design style */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                    <InputField
                                        label="Employee Full Name"
                                        type="text"
                                        value={emp.name}
                                        onChange={(e) => updateEmployee(i, 'name', e.target.value)}
                                        placeholder="Name"
                                        color="text-gray-900"
                                    />
                                    <InputField
                                        label="Salary Month"
                                        type="text"
                                        value={emp.month}
                                        onChange={(e) => updateEmployee(i, 'month', e.target.value)}
                                        placeholder="e.g. December 2025"
                                        color="text-gray-900"
                                    />
                                </div>


                                {/* Financial Input Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 border-t border-gray-300 pt-4">
                                    {/* Earnings */}
                                    <InputField
                                        label="Amount"
                                        value={emp.amount}
                                        onChange={(e) => updateEmployee(i, 'amount', e.target.value)}
                                    />
                                    <InputField
                                        label="Arrears (+/-)"
                                        value={emp.arrears}
                                        onChange={(e) => updateEmployee(i, 'arrears', e.target.value)}
                                    />

                                    {/* Bonus */}
                                    <div className="flex flex-col">
                                        <InputField
                                            label={`Bonus (Units - ${BONUS_RATE}/unit)`}
                                            value={emp.bonusQty}
                                            onChange={(e) => updateEmployee(i, 'bonusQty', e.target.value)}
                                            placeholder="0"
                                        />
                                        <span className="text-sm font-semibold text-teal-800 mt-1 pl-1">
                                            Amount: {calc.bonusAmt.toLocaleString()}
                                        </span>
                                    </div>

                                    {/* Deduction */}
                                    <InputField
                                        label="Advance"
                                        value={emp.advance}
                                        onChange={(e) => updateEmployee(i, 'advance', e.target.value)}
                                    />
                                </div>

                                {/* Calculation Result for Employee */}
                                <div className="mt-6 border-t border-gray-300 pt-4">
                                    <ResultField label="Net Amount Payable" value={calc.total} />
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Footer Actions (Add Employee and Generate Slips) */}
                <div className="flex flex-col sm:flex-row gap-4 pt-4 mt-8 border-t border-gray-300">
                    <button
                        onClick={addEmployee}
                        className="w-full py-3 bg-[#127475]/90 text-white rounded-2xl font-medium hover:bg-[#127475] cursor-pointer active:scale-[0.99] transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center space-x-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                        <span>Add Another Employee</span>
                    </button>
                    <button
                        onClick={() => setShowPreview(true)}
                        className="w-full py-3 bg-[#127475]/90 text-white rounded-2xl font-medium hover:bg-[#127475] cursor-pointer active:scale-[0.99] transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center space-x-2"
                    >
                        <span>Generate & Preview Slips</span>
                    </button>
                </div>

                {/* Grand Total Summary Block (Color changed to TEAL) */}
                <div className="mt-4 p-4 sm:p-6 bg-white border border-indigo-200 rounded-3xl shadow-lg gap-3">
                    <ResultField label="Grand Total Payable Amount" value={grandTotal} />
                </div>
            </div>
        </div>
    )
}