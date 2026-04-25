import { formatNumbers } from "../../utils";

export default function SlipCard({ emp }) {
  const amount = Number(emp.amount) || 0;
  const arrears = Number(emp.arrears) || 0;
  const paymentBreakdown = emp.payment_breakdown || {};
  const paymentAddition = Number(emp.payment_addition) || 0;
  const paymentDeduction = Number(emp.payment_deduction) || 0;
  const allowance = Number(emp.allowance) || 0;
  const bonusQty = Number(emp.bonusQty) || 0;
  const bonusAmt = Number(emp.bonusAmt) || 0;
  const total = Number(emp.total) || 0;
  const positiveArrears = arrears > 0 ? arrears : 0;
  const negativeArrears = arrears < 0 ? Math.abs(arrears) : 0;
  const grossTotal = amount + bonusAmt + allowance + positiveArrears;
  const deductionTotal = paymentDeduction + negativeArrears;
  const visibleFields = emp.display_preferences?.salary_slip_fields || [];
  const showField = (key) => visibleFields.includes(key);
  const labels = emp.labels || {};

  return (
    <div className="border border-gray-300 bg-white rounded-2xl overflow-hidden print-slip break-inside-avoid p-1 shadow-sm">
      <div className="bg-gray-100 border border-gray-200 py-2 px-4 flex items-center justify-between rounded-xl">
        <h3 className="font-semibold text-base tracking-wide text-gray-900 capitalize text-nowrap">
          {emp.name || "EMPLOYEE NAME"}
        </h3>
        <p className="text-[#127475] font-semibold text-sm text-nowrap">{emp.month}</p>
      </div>

      <div className="p-1.5 text-[13px] space-y-1.5">
        <div className="flex justify-between px-1.5">
          <span className="text-gray-800">{labels.arrears || "Arrears"}:</span>
          <span className={`font-medium ${arrears < 0 ? "text-red-600" : "text-green-600"}`}>
            {formatNumbers(arrears, 2)}
          </span>
        </div>
        {showField("amount") && (
          <>
            <hr className="border-gray-300" />
            <div className="flex justify-between px-1.5">
              <span className="text-gray-800">{labels.amount || "Amount"}:</span>
              <span className="font-medium text-gray-800">{formatNumbers(amount, 2)}</span>
            </div>
          </>
        )}
        {showField("bonus") && (
          <>
            <hr className="border-gray-300" />
            <div className="flex justify-between px-1.5">
              <span className="text-gray-800">{labels.bonus || "Bonus"} ({bonusQty} units):</span>
              <span className="font-medium text-gray-800">{formatNumbers(bonusAmt, 2)}</span>
            </div>
          </>
        )}
        {showField("allowance") && (
          <>
            <hr className="border-gray-300" />
            <div className="flex justify-between px-1.5">
              <span className="text-gray-800">{labels.allowance || "Allowance"}:</span>
              <span className="font-medium text-[#127475]">{formatNumbers(allowance, 2)}</span>
            </div>
          </>
        )}
        {showField("payments") && Object.entries(paymentBreakdown).map(([label, value]) => (
          Number(value) !== 0 ? (
            <div key={label}>
              <hr className="border-gray-300" />
              <div className="flex justify-between px-1.5">
                <span className="text-gray-800 capitalize">{label}:</span>
                <span className={`font-medium ${Number(value) < 0 ? "text-red-600" : "text-emerald-700"}`}>
                  {Number(value) < 0 ? "-" : "+"}{formatNumbers(Math.abs(Number(value)), 2)}
                </span>
              </div>
            </div>
          ) : null
        ))}
        {(showField("gross_total") || showField("deduction_total")) && (
          <div className="mt-1 rounded-xl border border-gray-300 overflow-hidden">
            {showField("gross_total") && (
              <div className="flex justify-between items-center px-2 py-1.5 bg-gray-50 border-b border-gray-300">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">{labels.gross_total || "Gross Total (+)"}</span>
                <span className="text-[13px] font-extrabold text-[#127475] tabular-nums">{formatNumbers(grossTotal + paymentAddition, 2)}</span>
              </div>
            )}
            {showField("deduction_total") && (
              <div className="flex justify-between items-center px-2 py-1.5 bg-gray-50">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">{labels.deduction_total || "Total Deduction (-)"}</span>
                <span className="text-[13px] font-extrabold text-red-600 tabular-nums">{formatNumbers(deductionTotal, 2)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {showField("net_amount") && (
        <div className="bg-[#127475] py-1.5 px-3 flex items-center justify-between rounded-lg">
          <h3 className="font-semibold tracking-wide text-sm text-white capitalize">{labels.net_amount || "Net Amount"}:</h3>
          <p className="text-white font-semibold text-sm tabular-nums">{formatNumbers(total, 2)}</p>
        </div>
      )}

      <div className="mt-1.5 py-1.5 px-3 text-[13px] border border-gray-300 rounded-xl">
        <div>
          <span className="font-medium text-gray-700 mr-2 whitespace-nowrap">{labels.payments || "Payment"}:</span>
          <div className="line h-5 border-b border-dashed border-gray-500 w-[98%] mx-auto"></div>
        </div>
      </div>
    </div>
  );
}
