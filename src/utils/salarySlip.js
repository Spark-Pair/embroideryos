export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const getMonthLabel = (monthValue) => {
  const [yr, mo] = monthValue.split("-");
  return `${MONTH_NAMES[parseInt(mo, 10) - 1]} ${yr}`;
};

const formatLocalYmd = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const toMonthWindow = (monthValue) => {
  const [yr, mo] = monthValue.split("-");
  const y = parseInt(yr, 10);
  const m = parseInt(mo, 10);
  const from = formatLocalYmd(new Date(y, m - 1, 1));
  const to = formatLocalYmd(new Date(y, m, 0));
  return { from, to, year: y, month: m };
};

export const getPreviousMonthKey = (monthValue) => {
  const { year, month } = toMonthWindow(monthValue);
  const prevDate = new Date(year, month - 2, 1);
  return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
};

export const getMonthKeyFromDate = (dateInput) => {
  if (!dateInput) return "";
  if (typeof dateInput === "string") {
    const dateOnly = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
    if (dateOnly) return `${dateOnly[1]}-${dateOnly[2]}`;
  }
  const d = typeof dateInput === "string"
    ? (() => {
        const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
        return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(dateInput);
      })()
    : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

export const isAllowanceEligible = ({ recordCount, absentCount, halfCount }) =>
  recordCount >= 26 && absentCount === 0 && halfCount <= 1;

export const mergeAndSortMonths = (...monthLists) =>
  [...new Set(monthLists.flat().filter(Boolean))]
    .filter((m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m))
    .sort((a, b) => (a < b ? 1 : -1));

export const toExcelCsv = (rows) => {
  const escaped = rows.map((row) =>
    row.map((cell) => {
      const str = cell == null ? "" : String(cell);
      return `"${str.replace(/"/g, '""')}"`;
    }).join(",")
  );
  return escaped.join("\n");
};
