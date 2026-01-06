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
    <div className="bg-white p-4 rounded-3xl border border-gray-300 flex items-center gap-5">
      <div
        className={`w-13 h-13 rounded-xl flex items-center justify-center ${styles.bg} ${styles.text}`}
      >
        <Icon size={26} strokeWidth={1.5} />
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
          {label}
        </p>
        <p className="text-2xl text-gray-900">{value}</p>
      </div>
    </div>
  );
}
