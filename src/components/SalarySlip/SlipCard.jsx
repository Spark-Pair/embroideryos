import { formatNumbers } from "../../utils";

export default function SlipCard({ emp }) {
  const amount = Number(emp.amount) || 0;
  const arrears = Number(emp.arrears) || 0;
  const advance = Number(emp.advance) || 0;
  const payment = Number(emp.payment) || 0;
  const adjustment = Number(emp.adjustment) || 0;
  const allowance = Number(emp.allowance) || 0;
  const bonusQty = Number(emp.bonusQty) || 0;
  const bonusAmt = Number(emp.bonusAmt) || 0;
  const total = Number(emp.total) || 0;
  const positiveArrears = arrears > 0 ? arrears : 0;
  const negativeArrears = arrears < 0 ? Math.abs(arrears) : 0;
  const grossTotal = amount + bonusAmt + allowance + positiveArrears;
  const deductionTotal = advance + payment + adjustment + negativeArrears;

  return (
    <div className="border border-gray-300 bg-white rounded-2xl overflow-hidden print-slip break-inside-avoid p-1.5 shadow-sm">
      <div className="bg-gray-100 border border-gray-200 py-2.5 px-4.5 flex items-center justify-between rounded-xl">
        <h3 className="font-semibold text-lg tracking-wide text-gray-900 capitalize text-nowrap">
          {emp.name || "EMPLOYEE NAME"}
        </h3>
        <p className="text-[#127475] font-semibold text-base text-nowrap">{emp.month}</p>
      </div>

      <div className="p-2 text-sm space-y-2">
        <div className="flex justify-between px-1.5">
          <span className="text-gray-800">Arrears:</span>
          <span className={`font-medium ${arrears < 0 ? "text-red-600" : "text-green-600"}`}>
            {formatNumbers(arrears, 2)}
          </span>
        </div>
        <hr className="border-gray-300" />
        <div className="flex justify-between px-1.5">
          <span className="text-gray-800">Amount:</span>
          <span className="font-medium text-gray-800">{formatNumbers(amount, 2)}</span>
        </div>
        <hr className="border-gray-300" />
        <div className="flex justify-between px-1.5">
          <span className="text-gray-800">Bonus ({bonusQty} units):</span>
          <span className="font-medium text-gray-800">{formatNumbers(bonusAmt, 2)}</span>
        </div>
        <hr className="border-gray-300" />
        <div className="flex justify-between px-1.5">
          <span className="text-gray-800">Allowance:</span>
          <span className="font-medium text-[#127475]">{formatNumbers(allowance, 2)}</span>
        </div>
        <hr className="border-gray-300" />
        <div className="flex justify-between px-1.5">
          <span className="text-gray-800">Advance:</span>
          <span className="font-medium text-red-600">-{formatNumbers(advance, 2)}</span>
        </div>
        {payment > 0 && (
          <>
            <hr className="border-gray-300" />
            <div className="flex justify-between px-1.5">
              <span className="text-gray-800">Payment:</span>
              <span className="font-medium text-red-600">-{formatNumbers(payment, 2)}</span>
            </div>
          </>
        )}
        {adjustment > 0 && (
          <>
            <hr className="border-gray-300" />
            <div className="flex justify-between px-1.5">
              <span className="text-gray-800">Adjustment:</span>
              <span className="font-medium text-red-600">-{formatNumbers(adjustment, 2)}</span>
            </div>
          </>
        )}
        <div className="mt-1 rounded-xl border border-gray-300 overflow-hidden">
          <div className="flex justify-between items-center px-2.5 py-2 bg-gray-50 border-b border-gray-300">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">Gross Total (+)</span>
            <span className="text-sm font-extrabold text-[#127475] tabular-nums">{formatNumbers(grossTotal, 2)}</span>
          </div>
          <div className="flex justify-between items-center px-2.5 py-2 bg-gray-50">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">Total Deduction (-)</span>
            <span className="text-sm font-extrabold text-red-600 tabular-nums">{formatNumbers(deductionTotal, 2)}</span>
          </div>
        </div>
      </div>

      <div className="bg-[#127475] py-2 px-3.5 flex items-center justify-between rounded-lg">
        <h3 className="font-semibold tracking-wide text-base text-white capitalize">Net Amount:</h3>
        <p className="text-white font-semibold text-base tabular-nums">{formatNumbers(total, 2)}</p>
      </div>

      <div className="mt-2 py-2 px-3 text-sm border border-gray-300 rounded-xl">
        <div>
          <span className="font-medium text-gray-700 mr-2 whitespace-nowrap">Payment:</span>
          <div className="line h-5 border-b border-dashed border-gray-500 w-[98%] mx-auto"></div>
        </div>
      </div>
    </div>
  );
}
