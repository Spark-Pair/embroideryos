export default function Card({
  title,
  subtitle,
  step,
  totalSteps,
  children,
  className = '',
}) {
  return (
    <div
      className={`
        bg-white/90 backdrop-blur-xl
        p-10 rounded-3xl shadow-md
        border border-gray-300
        ${className}
      `}
    >
      {step && totalSteps && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <p className="text-sm text-gray-500">Step {step} of {totalSteps}</p>
          </div>
          <div className="w-full h-1 bg-gray-200 rounded-full">
            <div
              className="h-1 bg-[#127475] rounded-full transition-all"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>
      )}

      {title && (
        <h2 className="text-3xl font-bold text-center text-[#0a6465] mb-2">{title}</h2>
      )}

      {subtitle && (
        <p className="text-center text-gray-600 mb-6">{subtitle}</p>
      )}

      {children}
    </div>
  );
}
