import { forwardRef, useEffect } from 'react';

const Input = forwardRef(
  (
    {
      label,
      id,
      name,
      required = true,
      className = '',
      capitalize = false,
      amount = false,
      value,
      onChange,
      icon,         // icon element
      iconPosition = 'left', // 'left' or 'right'
      shortcutKey,  // e.g., 's' -> Alt+S
      ...props
    },
    ref
  ) => {

    // Handle change
    const handleLocalChange = (e) => {
      let val = e.target.value;

      // Capitalize Words
      if (capitalize) {
        val = val
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .replace(/\b\w/g, (char) => char.toUpperCase());
      }


      // Amount formatting
      if (amount) {
        let [integer, decimal] = val.replace(/[^0-9.]/g, '').split('.');
        if (integer) integer = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        if (decimal) decimal = decimal.slice(0, 2);
        val = decimal ? `${integer}.${decimal}` : integer;
      }

      if (onChange) onChange({ target: { name: e.target.name, value: val } });
    };

    // Keyboard shortcut
    useEffect(() => {
      if (!shortcutKey || !ref?.current) return;
      const handler = (e) => {
        if (e.altKey && e.key.toLowerCase() === shortcutKey.toLowerCase()) {
          e.preventDefault();
          ref.current.focus();
        }
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }, [shortcutKey, ref]);

    const handleFocus = (e) => {
      if (e.target.type === 'date') {
        try {
          e.target.showPicker();
        } catch {
          e.target.click();
        }
      }

      // agar user ne apna onFocus diya ho to wo bhi chale
      if (props.onFocus) props.onFocus(e);
    };

    return (
      <div className="relative">
        {label && (
          <label htmlFor={id} className="block mb-1.5 text-sm text-gray-700">
            {label} {!required && <span className="text-gray-400">(Optional)</span>}
          </label>
        )}

        <div className="relative">
          {icon && iconPosition === 'left' && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
              {icon}
            </div>
          )}

          <input
            ref={ref}
            id={id}
            name={name}
            required={required}
            value={value}
            {...props}
            onFocus={handleFocus}
            onChange={handleLocalChange}
            className={`
              w-full border border-gray-400 px-4 py-2 rounded-xl
              focus:ring-2 focus:ring-teal-300 focus:outline-none
              transition disabled:opacity-50 disabled:cursor-not-allowed
              bg-gray-50
              ${icon ? (iconPosition === 'left' ? 'pl-9' : 'pr-10') : ''}
              ${className}
            `}
          />

          {icon && iconPosition === 'right' && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
              {icon}
            </div>
          )}
        </div>
      </div>
    );
  }
);

export default Input;
