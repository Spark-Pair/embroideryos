export const formatDate = (dateInput, format = 'DD/MM/YYYY') => {
  if (!dateInput) return '';

  let d;

  // Date-only values represent a calendar day, not a UTC instant.
  if (typeof dateInput === 'string') {
    const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
    if (match) {
      const [, year, month, day] = match;
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

  const tokens = {
    YYYY: String(year),
    yyyy: String(year),
    MMM: monthNames[month],
    MM: String(month + 1).padStart(2, '0'),
    mm: String(month + 1).padStart(2, '0'),
    DDD: weekdayNames[d.getDay()],
    DD: day,
    dd: day,
  };
  return format.replace(/YYYY|yyyy|MMM|MM|mm|DDD|DD|dd/g, (token) => tokens[token]);
};

export const formatNumbers = (num, decimals = 0) => {
  if (num === null || num === undefined) return null;
  return Number(num).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
