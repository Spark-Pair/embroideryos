import React, { useState } from 'react' // <--- यह लाइन अब ठीक कर दी गई है

export default function TargetCalculatorModal({ onClose }) {
  const emptyDesign = { stitches: '', appliques: '', pcs: '' }
  const [designs, setDesigns] = useState([emptyDesign])

  const addDesign = () => setDesigns([...designs, emptyDesign])

  const removeDesign = (idx) => {
    if (designs.length > 1) {
        setDesigns(designs.filter((_, i) => i !== idx));
    }
  }

  const updateDesign = (idx, field, value) => {
    const copy = [...designs]
    copy[idx][field] = value
    setDesigns(copy)
  }

  // --- LOGIC REMAINS UNCHANGED ---
  const stitchRate = 0.001
  const appliqueRate = 1.11

  const calculateDesign = (d) => {
    const userStitch = Number(d.stitches) || 0
    const stitchForCalc = userStitch < 5000 ? 5000 : userStitch
    const pcs = Number(d.pcs) || 0
    const appliques = Number(d.appliques) || 0

    const rawStitch = stitchForCalc * stitchRate * pcs
    const rawApplique = appliques * appliqueRate * pcs
    const totalRaw = rawStitch + rawApplique

    const thirty = totalRaw * 0.3
    const thirtyNine = totalRaw * 0.39

    const rounds = Math.ceil(pcs / 12)

    return { thirty, thirtyNine, rounds }
  }

  const totals = designs
    .map(calculateDesign)
    .reduce(
      (a, d) => {
        a.total30 += d.thirty
        a.total39 += d.thirtyNine
        a.totalRounds += d.rounds
        return a
      },
      { total30: 0, total39: 0, totalRounds: 0 }
    )

  const getVariant = (amount) => {
    return Number(amount) < 1000 ? "danger" : "normal";
  };

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
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 text-center">🎯 Target Calculator</h2>
        </header>

        {/* Designs List */}
        <div className="space-y-4">
          {designs.map((d, i) => {
            const calc = calculateDesign(d)

            return (
              <div
                key={i}
                className="bg-gray-50 border border-gray-300 p-4 sm:p-6 rounded-3xl shadow-sm transition-all hover:shadow-md"
              >
                <div className="flex justify-between items-center mb-4 px-2 pb-2 border-b border-gray-400">
                  <h3 className="text-lg sm:text-xl font-bold tracking-wide text-[#0a6465]">Design {i + 1}</h3>
                  
                  {/* Remove Button */}
                  {designs.length > 1 && (
                      <button 
                          onClick={() => removeDesign(i)}
                          className="text-gray-500 hover:text-red-500 p-2 transition-colors active:scale-95"
                          aria-label="Remove design"
                      >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                      </button>
                  )}
                </div>

                {/* Input Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <InputField
                    label="Stitch"
                    value={d.stitches}
                    placeholder="e.g., 8500"
                    onChange={(e) => updateDesign(i, 'stitches', e.target.value)}
                  />
                  <InputField
                    label="Appliques"
                    value={d.appliques}
                    placeholder="Optional"
                    onChange={(e) => updateDesign(i, 'appliques', e.target.value)}
                  />
                  <InputField
                    label="PCS (Total Pieces)"
                    value={d.pcs}
                    placeholder="e.g., 144"
                    onChange={(e) => updateDesign(i, 'pcs', e.target.value)}
                  />
                </div>

                {/* Calculation Results */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-gray-300 pt-4 mt-4">
                  <ResultField label="30%" value={calc.thirty.toFixed(2)} daynamicVariant />
                  <ResultField label="39%" value={calc.thirtyNine.toFixed(2)} />
                  <ResultField label="Rounds" value={calc.rounds} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Add Design Button */}
        <button
          onClick={addDesign}
          className="w-full py-3 mt-4 bg-[#127475]/90 text-white rounded-2xl font-medium hover:bg-[#127475] cursor-pointer active:scale-[0.99] transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
          <span>Add Another Design</span>
        </button>

        {/* Summary Block */}
        <div className="mt-4 p-4 sm:p-6 bg-white border border-indigo-200 rounded-3xl shadow-lg grid grid-cols-1 md:grid-cols-3 gap-3">
          <ResultField label="Total 30%" value={totals.total30.toFixed(2)} daynamicVariant />
          <ResultField label="Total 39%" value={totals.total39.toFixed(2)} />
          <ResultField label="Total Rounds" value={totals.totalRounds} />
        </div>
      </div>
    </div>
  )
}

// --- Helper Components ---

function InputField({ label, value, onChange, placeholder }) {
  return (
    <div className="flex flex-col">
      <label className="mb-1.5 text-gray-700 font-normal text-sm block">{label}</label>
      <input
        type="number"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="border border-gray-400 px-4 py-2 rounded-xl bg-white focus:ring-2 focus:ring-teal-300 focus:border-teal-400 focus:outline-none transition-all w-full"
      />
    </div>
  )
}

function ResultField({ label, value, daynamicVariant }) {
  let variant = 'normal'
  if (daynamicVariant) {
    variant = Number(value) < 1000 ? "danger" : "normal";
  }
  return (
      <div className="flex items-center justify-between bg-white border border-gray-400 px-4 py-2 rounded-xl">
          <label className="text-gray-700 tracking-wide">{label}</label>
          <div className={`text-lg font-bold ${variant == 'normal' ? 'text-teal-600' : variant == 'danger' ? 'text-red-600' : ''}`}>
              {value}
          </div>
      </div>
  )
}