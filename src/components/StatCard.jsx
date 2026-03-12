const VARIANTS = {
  normal: {
    bg: "bg-teal-100/60",
    text: "text-teal-700",
  },
  success: {
    bg: "bg-emerald-100/60",
    text: "text-emerald-700",
  },
  danger: {
    bg: "bg-rose-100/60",
    text: "text-rose-700",
  },
  warning: {
    bg: "bg-amber-100/60",
    text: "text-amber-700",
  },
};

export default function StatCard({
  label,
  value,
  icon: Icon,
  variant = "normal",
}) {
  const styles = VARIANTS[variant] || VARIANTS.normal;

  return (
    <div className="stat-card bg-white p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-gray-300 flex items-center gap-3 sm:gap-5 min-w-0">
      <div
        className={`w-10 h-10 sm:w-13 sm:h-13 rounded-xl flex items-center justify-center ${styles.bg} ${styles.text} shrink-0`}
      >
        <Icon size={22} className="sm:hidden" strokeWidth={1.5} />
        <Icon size={26} className="hidden sm:block" strokeWidth={1.5} />
      </div>

      <div className="min-w-0">
        <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-gray-400 truncate">
          {label}
        </p>
        <p className="text-lg sm:text-2xl text-gray-900 truncate">{value}</p>
      </div>
    </div>
  );
}
