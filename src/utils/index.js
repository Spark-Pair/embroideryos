export const formatDate = (dateInput, format = 'DD/MM/YYYY') => {
  if (!dateInput) return '';

  let d;

  // Safe parsing for YYYY-MM-DD strings
  if (typeof dateInput === 'string') {
    const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [_, year, month, day] = match;
      d = new Date(Number(year), Number(month) - 1, Number(day)); // Local date
    } else {
      d = new Date(dateInput);
    }
  } else if (dateInput instanceof Date) {
    d = dateInput;
  } else {
    return '';
  }

  if (isNaN(d.getTime())) return '';

  const day = String(d.getDate()).padStart(2, '0');
  const month = d.getMonth();
  const year = d.getFullYear();

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const weekdayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // Replace tokens in order: longest first
  let formatted = format;
  formatted = formatted.replace(/yyyy/g, year);
  formatted = formatted.replace(/YYYY/g, year);
  formatted = formatted.replace(/mm/g, String(month + 1).padStart(2, '0'));
  formatted = formatted.replace(/MMM/g, monthNames[month]);
  formatted = formatted.replace(/DDD/g, weekdayNames[d.getDay()]);
  formatted = formatted.replace(/DD/g, day);
  formatted = formatted.replace(/dd/g, day);

  return formatted;
};

export const formatNumbers = (num, decimals = 0) => {
  if (num === null || num === undefined) return null;
  return Number(num).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}