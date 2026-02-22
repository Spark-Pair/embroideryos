import { CheckCircle2, Lock } from "lucide-react";
import { formatNumbers } from "../utils";

export function FinalAmountCard({ amount, isFixed, breakdown }) {
  if (!amount && amount !== 0) return null;
  return (
    <div className={`rounded-2xl px-3 py-2.5 border ${isFixed ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"}`}>
      <div className="flex items-center justify-between px-1.5">
        <div className="flex items-center gap-2">
          {isFixed
            ? <Lock className="h-4 w-4 text-amber-600" />
            : <CheckCircle2 className="h-4 w-4 text-gray-600" />
          }
          <span className={`text-sm font-semibold ${isFixed ? "text-amber-700" : "text-gray-700"}`}>
            {isFixed ? "Final Amount (Fixed)" : "Final Amount"}
          </span>
        </div>
        <span className={`text-2xl font-bold tabular-nums ${isFixed ? "text-amber-700" : "text-gray-700"}`}>
          {formatNumbers(amount, 2)}
        </span>
      </div>
      {breakdown && (
        <div className={`mt-2 p-2 pb-1 border-t ${isFixed ? "border-amber-200" : "border-gray-200"} flex flex-wrap gap-x-4 gap-y-1`}>
          {breakdown.map((item, i) => (
            <span key={i} className={`text-xs ${isFixed ? "text-amber-600" : "text-gray-600"}`}>
              {item.label}: <span className="font-semibold">{formatNumbers(item.value, 2)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}