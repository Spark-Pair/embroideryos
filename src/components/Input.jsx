import { X } from 'lucide-react';
import { forwardRef, useEffect } from 'react';

const Input = forwardRef(
  (
    {
      label,
      id,
      name,
      required = true,
      disabled = false,
      className = '',
      capitalize = false,
      amount = false,
      value,
      onChange,
      icon,         // icon element
      iconPosition = 'left', // 'left' or 'right'
      shortcutKey,  // e.g., 's' -> Alt+S
      showClear = false, // show clear button when there's a value
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

    // Clear input function
    const handleClear = () => {
      if (onChange) {
        onChange({ target: { name: name || id, value: '' } });
      }
      // Focus wapis input par le aane ke liye
      if (ref?.current) ref.current.focus();
    };

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
          <label htmlFor={id} className={`block mb-1.5 text-sm text-gray-700 ${disabled ? 'opacity-60 cursor-not-allowed' : ''} `}>
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
            disabled={disabled}
            className={`
              w-full border border-gray-400 px-4 py-2 rounded-xl
              focus:ring-2 focus:ring-teal-300 focus:outline-none
              transition ${disabled ? 'cursor-not-allowed opacity-55' : ''}
              bg-gray-50
              ${icon ? (iconPosition === 'left' ? 'pl-9' : 'pr-10') : ''}
              ${className}
            `}
          />

          {showClear && value && !disabled && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
                  title="Clear input"
                >
                  <X className="h-4 w-4" />
                </button>

              {icon}
            </div>
          )}

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
