import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { formatDate, formatNumbers } from "../utils";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-gray-600 mb-1">{label}</p>
      {payload.map((point) => (
        <p key={point.dataKey} style={{ color: point.color }} className="font-semibold">
          {point.name}: {point.dataKey === "orders"
            ? formatNumbers(Number(point.value || 0), 0)
            : formatNumbers(Number(point.value || 0), 2)}
        </p>
      ))}
    </div>
  );
}

export default function DashboardTrendChart({ data, height = 130, idPrefix = "trend" }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`${idPrefix}-orders`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0d9488" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`${idPrefix}-expenses`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#e11d48" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`${idPrefix}-out`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`${idPrefix}-in`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
          </linearGradient>
        </defs>

        <XAxis
          dataKey="day"
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => (typeof value === "string" && value.includes("-") ? formatDate(value, "DD MMM") : value)}
        />
        <YAxis hide />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#e5e7eb", strokeWidth: 1 }} />

        <Area type="monotone" dataKey="orders" name="Orders" stroke="#0d9488" strokeWidth={2} fill={`url(#${idPrefix}-orders)`} dot={false} />
        <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#e11d48" strokeWidth={2} fill={`url(#${idPrefix}-expenses)`} dot={false} />
        <Area type="monotone" dataKey="paymentsOut" name="Payment Out" stroke="#f59e0b" strokeWidth={2} fill={`url(#${idPrefix}-out)`} dot={false} />
        <Area type="monotone" dataKey="paymentsIn" name="Payment In" stroke="#16a34a" strokeWidth={2} fill={`url(#${idPrefix}-in)`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
