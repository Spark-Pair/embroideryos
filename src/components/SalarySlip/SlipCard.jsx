import { formatNumbers } from "../../utils";

export default function SlipCard({ emp }) {
  const amount = Number(emp.amount) || 0;
  const arrears = Number(emp.arrears) || 0;
  const advance = Number(emp.advance) || 0;
  const payment = Number(emp.payment) || 0;
  const allowance = Number(emp.allowance) || 0;
  const bonusQty = Number(emp.bonusQty) || 0;
  const bonusAmt = Number(emp.bonusAmt) || 0;
  const total = Number(emp.total) || 0;

  return (
    <div className="border border-gray-500 rounded-2xl overflow-hidden print-slip break-inside-avoid p-1.5">
      <div className="bg-teal-700/20 py-2.5 px-4.5 flex items-center justify-between rounded-xl">
        <h3 className="font-semibold text-lg tracking-wide text-gray-900 capitalize text-nowrap">
          {emp.name || "EMPLOYEE NAME"}
        </h3>
        <p className="text-teal-800 font-medium text-base text-nowrap">{emp.month}</p>
      </div>

      <div className="p-2 text-sm space-y-2">
        <div className="flex justify-between px-1.5">
          <span className="text-gray-800">Arrears:</span>
          <span className={`font-medium ${arrears < 0 ? "text-red-600" : "text-green-600"}`}>
            {formatNumbers(arrears, 2)}
          </span>
        </div>
        <hr className="border-gray-500" />
        <div className="flex justify-between px-1.5">
          <span className="text-gray-800">Amount:</span>
          <span className="font-medium text-gray-800">{formatNumbers(amount, 2)}</span>
        </div>
        <hr className="border-gray-500" />
        <div className="flex justify-between px-1.5">
          <span className="text-gray-800">Bonus ({bonusQty} units):</span>
          <span className="font-medium text-gray-800">{formatNumbers(bonusAmt, 2)}</span>
        </div>
        <hr className="border-gray-500" />
        <div className="flex justify-between px-1.5">
          <span className="text-gray-800">Allowance:</span>
          <span className="font-medium text-emerald-700">{formatNumbers(allowance, 2)}</span>
        </div>
        <hr className="border-gray-500" />
        <div className="flex justify-between px-1.5">
          <span className="text-gray-800">Advance:</span>
          <span className="font-medium text-red-600">-{formatNumbers(advance, 2)}</span>
        </div>
        {payment > 0 && (
          <>
            <hr className="border-gray-500" />
            <div className="flex justify-between px-1.5">
              <span className="text-gray-800">Payment:</span>
              <span className="font-medium text-red-600">-{formatNumbers(payment, 2)}</span>
            </div>
          </>
        )}
      </div>

      <div className="bg-teal-700/20 py-2 px-3.5 flex items-center justify-between rounded-lg">
        <h3 className="font-semibold tracking-wide text-base text-gray-900 capitalize">Net Amount:</h3>
        <p className="text-teal-800 font-medium text-sm">{formatNumbers(total, 2)}</p>
      </div>

      <div className="mt-2 py-2 px-3 text-sm border border-gray-500 rounded-xl">
        <div>
          <span className="font-medium text-gray-700 mr-2 whitespace-nowrap">Payment:</span>
          <div className="line h-5 border-b border-dashed border-gray-600 w-[98%] mx-auto"></div>
        </div>
      </div>
    </div>
  );
}
