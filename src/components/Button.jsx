import { forwardRef } from "react";
import clsx from "clsx";

const VARIANTS = {
  primary: "bg-[#127475] text-white hover:bg-[#0f6465]",
  secondary: "bg-gray-800 text-gray-50 hover:bg-black",
  success: "bg-emerald-600 text-white hover:bg-emerald-700",
  danger: "bg-red-600 text-white hover:bg-red-700",
  warning: "bg-amber-500 text-white hover:bg-amber-600",
  info: "bg-sky-600 text-white hover:bg-sky-700",
};

const OUTLINE_VARIANTS = {
  primary: "border-[#127475]/40 text-[#127475] hover:bg-[#127475]/10",
  secondary: "border-gray-400 text-gray-600 hover:bg-gray-200/40",
  success: "border-emerald-600 text-emerald-600 hover:bg-emerald-50",
  danger: "border-red-600 text-red-600 hover:bg-red-50",
  warning: "border-amber-500 text-amber-500 hover:bg-amber-50",
  info: "border-sky-600 text-sky-600 hover:bg-sky-50",
};

const Button = forwardRef(
  (
    {
      children,
      variant = "primary",
      outline = false,
      icon: Icon,
      iconPosition = "left",
      loading = false,
      disabled = false,
      className = "",
      type = "button",
      size = "normal",
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={clsx(
          className,
          `inline-flex items-center justify-center gap-2 ${size == 'sm' ? 'px-3.5 py-1.5 text-sm rounded-xl' : 'px-4.5 py-2.5 rounded-2xl'} transition-all cursor-pointer`,
          "disabled:opacity-60 disabled:cursor-not-allowed",
          outline
            ? `border ${OUTLINE_VARIANTS[variant]}`
            : VARIANTS[variant],
        )}
        {...props}
      >
        {loading && (
          <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
        )}

        {!loading && Icon && iconPosition === "left" && (
          <Icon className={size == 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5'} />
        )}

        <span>{children}</span>

        {!loading && Icon && iconPosition === "right" && (
          <Icon className={size == 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5'} />
        )}
      </button>
    );
  }
);

export default Button;
