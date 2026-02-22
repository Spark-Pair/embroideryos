export function SectionHeader({ icon: Icon, title, subtitle, step, right, color = "text-gray-500" }) {
  return (
    <div className="flex items-center gap-2 justify-between mb-3">
        <div className="flex items-center gap-2">
            {Icon && <Icon className={`h-4 w-4 ${color}`} />}
            {step && <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#127475] text-white text-xs font-bold shrink-0">
                {step}
            </div>}
            <div className="flex flex-col gap-3.5">
                <span className={`text-xs font-medium text-gray-500 uppercase tracking-wider ${Icon ? "leading-0" : "leading-0"}`}>{title}</span>
                {subtitle && <p className="text-xs text-gray-400 leading-0">{subtitle}</p>}
            </div>
        </div>
        {!right && <div className="flex-1 h-px bg-gray-300" />}
        {right}
    </div>
  );
}