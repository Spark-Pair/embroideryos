import { defaultAccessRules, normalizeAccessRules } from "./accessConfig";

export const ATTENDANCE_PAY_MODES = {
  ZERO: "zero",
  SALARY_DAY_OR_PRODUCTION: "salary_day_or_production",
  SALARY_HALF_OR_PRODUCTION: "salary_half_or_production",
  SALARY_DAY_OR_OFF_AMOUNT: "salary_day_or_off_amount",
};

export const ATTENDANCE_ALLOWANCE_CODES = {
  NORMAL: "normal",
  HALF: "half",
  ABSENT: "absent",
  IGNORE: "ignore",
};

export const PAYMENT_EFFECT_MODES = {
  SUBTRACT: "subtract",
  ADD: "add",
  IGNORE: "ignore",
};

const normalizeText = (value) => String(value || "").trim();
const CANONICAL_EXPENSE_LABELS = {
  supplier: "Supplier",
  cash: "Cash",
  fixed_cash: "Fixed Cash",
  fixed_supplier: "Fixed Supplier",
  fixed: "Fixed",
};
const LEGACY_EXPENSE_LABEL_ALIASES = {
  supplier: new Set(["expense (supplier)", "supplier"]),
  cash: new Set(["expense (cash)", "cash"]),
  fixed_cash: new Set(["fixed expense (cash)", "fixed cash"]),
  fixed_supplier: new Set(["fixed expense (supplier)", "fixed supplier"]),
  fixed: new Set(["fixed expense", "fixed"]),
};

const normalizeExpenseTypeLabel = (key, label) => {
  const cleanKey = normalizeText(key).toLowerCase();
  const cleanLabel = normalizeText(label);
  if (!cleanKey) return cleanLabel;
  const aliases = LEGACY_EXPENSE_LABEL_ALIASES[cleanKey];
  if (!cleanLabel || aliases?.has(cleanLabel.toLowerCase())) {
    return CANONICAL_EXPENSE_LABELS[cleanKey] || cleanLabel;
  }
  return cleanLabel;
};

const uniqueByKey = (rows, getKey) => {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const key = String(getKey(row) || "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const defaultAttendanceRules = (options = []) => {
  const defaults = {
    Day: { label: "Day", counts_record: true, counts_production: true, allows_bonus: true, pay_mode: ATTENDANCE_PAY_MODES.SALARY_DAY_OR_PRODUCTION, allowance_code: ATTENDANCE_ALLOWANCE_CODES.NORMAL, upgrade_half_to_day: false },
    Night: { label: "Night", counts_record: true, counts_production: true, allows_bonus: true, pay_mode: ATTENDANCE_PAY_MODES.SALARY_DAY_OR_PRODUCTION, allowance_code: ATTENDANCE_ALLOWANCE_CODES.NORMAL, upgrade_half_to_day: false },
    Half: { label: "Half", counts_record: true, counts_production: true, allows_bonus: true, pay_mode: ATTENDANCE_PAY_MODES.SALARY_HALF_OR_PRODUCTION, allowance_code: ATTENDANCE_ALLOWANCE_CODES.HALF, upgrade_half_to_day: true },
    Absent: { label: "Absent", counts_record: true, counts_production: false, allows_bonus: false, pay_mode: ATTENDANCE_PAY_MODES.ZERO, allowance_code: ATTENDANCE_ALLOWANCE_CODES.ABSENT, upgrade_half_to_day: false },
    Off: { label: "Off", counts_record: true, counts_production: false, allows_bonus: false, pay_mode: ATTENDANCE_PAY_MODES.SALARY_DAY_OR_OFF_AMOUNT, allowance_code: ATTENDANCE_ALLOWANCE_CODES.NORMAL, upgrade_half_to_day: false },
    Close: { label: "Close", counts_record: true, counts_production: false, allows_bonus: false, pay_mode: ATTENDANCE_PAY_MODES.ZERO, allowance_code: ATTENDANCE_ALLOWANCE_CODES.NORMAL, upgrade_half_to_day: false },
    Sunday: { label: "Sunday", counts_record: true, counts_production: false, allows_bonus: false, pay_mode: ATTENDANCE_PAY_MODES.SALARY_DAY_OR_PRODUCTION, allowance_code: ATTENDANCE_ALLOWANCE_CODES.NORMAL, upgrade_half_to_day: false },
  };
  const source = Array.isArray(options) && options.length ? options : Object.keys(defaults);
  return source.map((label) => defaults[normalizeText(label)] || {
    label: normalizeText(label),
    counts_record: true,
    counts_production: true,
    allows_bonus: true,
    pay_mode: ATTENDANCE_PAY_MODES.SALARY_DAY_OR_PRODUCTION,
    allowance_code: ATTENDANCE_ALLOWANCE_CODES.NORMAL,
    upgrade_half_to_day: false,
  });
};

export const defaultCustomerPaymentMethodRules = (methods = []) => {
  const defaults = {
    cash: { method: "cash", requires_reference: false, requires_bank: false, requires_party: false, requires_issue_date: false, allows_clear_date: false },
    cheque: { method: "cheque", requires_reference: true, requires_bank: true, requires_party: false, requires_issue_date: true, allows_clear_date: true },
    slip: { method: "slip", requires_reference: true, requires_bank: false, requires_party: true, requires_issue_date: true, allows_clear_date: true },
    online: { method: "online", requires_reference: true, requires_bank: false, requires_party: false, requires_issue_date: false, allows_clear_date: false },
    adjustment: { method: "adjustment", requires_reference: false, requires_bank: false, requires_party: false, requires_issue_date: false, allows_clear_date: false },
  };
  const source = Array.isArray(methods) && methods.length ? methods : Object.keys(defaults);
  return source.map((method) => defaults[normalizeText(method).toLowerCase()] || {
    method: normalizeText(method),
    requires_reference: false,
    requires_bank: false,
    requires_party: false,
    requires_issue_date: false,
    allows_clear_date: false,
  });
};

export const defaultStaffPaymentTypeRules = (types = []) => {
  const defaults = {
    advance: { type: "advance", history_effect: PAYMENT_EFFECT_MODES.SUBTRACT, current_effect: PAYMENT_EFFECT_MODES.SUBTRACT },
    payment: { type: "payment", history_effect: PAYMENT_EFFECT_MODES.SUBTRACT, current_effect: PAYMENT_EFFECT_MODES.SUBTRACT },
    adjustment: { type: "adjustment", history_effect: PAYMENT_EFFECT_MODES.ADD, current_effect: PAYMENT_EFFECT_MODES.SUBTRACT },
  };
  const source = Array.isArray(types) && types.length ? types : Object.keys(defaults);
  return source.map((type) => defaults[normalizeText(type).toLowerCase()] || {
    type: normalizeText(type),
    history_effect: PAYMENT_EFFECT_MODES.SUBTRACT,
    current_effect: PAYMENT_EFFECT_MODES.SUBTRACT,
  });
};

export const defaultExpenseTypeRules = (types = []) => {
  const defaults = {
    supplier: { key: "supplier", label: "Supplier", is_fixed: false, requires_supplier: true },
    cash: { key: "cash", label: "Cash", is_fixed: false, requires_supplier: false },
    fixed_cash: { key: "fixed_cash", label: "Fixed Cash", is_fixed: true, requires_supplier: false },
    fixed_supplier: { key: "fixed_supplier", label: "Fixed Supplier", is_fixed: true, requires_supplier: true },
    fixed: { key: "fixed", label: "Fixed", is_fixed: true, requires_supplier: false },
  };
  const source = Array.isArray(types) && types.length ? types : Object.keys(defaults);
  return source.map((type) => defaults[normalizeText(type).toLowerCase()] || {
    key: normalizeText(type),
    label: normalizeText(type),
    is_fixed: false,
    requires_supplier: false,
  });
};

export const defaultAllowanceRule = () => ({
  min_records: 26,
  max_absent: 0,
  max_half: 1,
});

export const defaultDisplayPreferences = () => ({
  salary_slip_fields: ["arrears", "amount", "bonus", "allowance", "payments", "gross_total", "deduction_total", "net_amount"],
  dashboard_staff_columns: ["records", "work", "arrears", "allowance", "bonus", "deductions", "balance"],
  label_overrides: [
    { key: "arrears", label: "Arrears" },
    { key: "amount", label: "Amount" },
    { key: "bonus", label: "Bonus" },
    { key: "allowance", label: "Allowance" },
    { key: "payments", label: "Payments" },
    { key: "gross_total", label: "Gross Total (+)" },
    { key: "deduction_total", label: "Total Deduction (-)" },
    { key: "net_amount", label: "Net Amount" },
    { key: "records", label: "Records" },
    { key: "work", label: "Work" },
    { key: "deductions", label: "Deductions" },
    { key: "balance", label: "Balance" },
    { key: "staff", label: "Staff" },
  ],
});

export const normalizeRuleData = (raw = {}, referenceData = {}) => ({
  attendance_rules: uniqueByKey(
    (Array.isArray(raw?.attendance_rules) && raw.attendance_rules.length
      ? raw.attendance_rules
      : defaultAttendanceRules(referenceData?.attendance_options)
    ).map((rule) => ({
      label: normalizeText(rule?.label),
      counts_record: rule?.counts_record !== false,
      counts_production: Boolean(rule?.counts_production),
      allows_bonus: Boolean(rule?.allows_bonus),
      pay_mode: rule?.pay_mode || ATTENDANCE_PAY_MODES.SALARY_DAY_OR_PRODUCTION,
      allowance_code: rule?.allowance_code || ATTENDANCE_ALLOWANCE_CODES.NORMAL,
      upgrade_half_to_day: Boolean(rule?.upgrade_half_to_day),
    })),
    (rule) => rule?.label
  ),
  customer_payment_method_rules: uniqueByKey(
    (Array.isArray(raw?.customer_payment_method_rules) && raw.customer_payment_method_rules.length
      ? raw.customer_payment_method_rules
      : defaultCustomerPaymentMethodRules(referenceData?.customer_payment_methods)
    ).map((rule) => ({
      method: normalizeText(rule?.method),
      requires_reference: Boolean(rule?.requires_reference),
      requires_bank: Boolean(rule?.requires_bank),
      requires_party: Boolean(rule?.requires_party),
      requires_issue_date: Boolean(rule?.requires_issue_date),
      allows_clear_date: Boolean(rule?.allows_clear_date),
    })),
    (rule) => rule?.method
  ),
  staff_payment_type_rules: uniqueByKey(
    (Array.isArray(raw?.staff_payment_type_rules) && raw.staff_payment_type_rules.length
      ? raw.staff_payment_type_rules
      : defaultStaffPaymentTypeRules(referenceData?.staff_payment_types)
    ).map((rule) => ({
      type: normalizeText(rule?.type),
      history_effect: rule?.history_effect || PAYMENT_EFFECT_MODES.SUBTRACT,
      current_effect: rule?.current_effect || PAYMENT_EFFECT_MODES.SUBTRACT,
    })),
    (rule) => rule?.type
  ),
  expense_type_rules: uniqueByKey(
    (Array.isArray(raw?.expense_type_rules) && raw.expense_type_rules.length
      ? raw.expense_type_rules
      : defaultExpenseTypeRules(referenceData?.expense_types)
    ).map((rule) => ({
      key: normalizeText(rule?.key || rule?.type),
      label: normalizeExpenseTypeLabel(rule?.key || rule?.type, rule?.label || rule?.key || rule?.type),
      is_fixed: Boolean(rule?.is_fixed),
      requires_supplier: Boolean(rule?.requires_supplier),
    })),
    (rule) => rule?.key
  ),
  access_rules: uniqueByKey(
    normalizeAccessRules(raw?.access_rules || [], referenceData?.user_roles || []).map((rule) => ({
      key: normalizeText(rule?.key),
      label: normalizeText(rule?.label || rule?.key),
      roles: Array.isArray(rule?.roles) ? rule.roles.map((role) => normalizeText(role)).filter(Boolean) : [],
      show_in_sidebar: rule?.show_in_sidebar !== false,
    })),
    (rule) => rule?.key
  ),
  allowance_rule: {
    min_records: Math.max(0, Number(raw?.allowance_rule?.min_records ?? defaultAllowanceRule().min_records) || 0),
    max_absent: Math.max(0, Number(raw?.allowance_rule?.max_absent ?? defaultAllowanceRule().max_absent) || 0),
    max_half: Math.max(0, Number(raw?.allowance_rule?.max_half ?? defaultAllowanceRule().max_half) || 0),
  },
  display_preferences: {
    salary_slip_fields: Array.isArray(raw?.display_preferences?.salary_slip_fields) && raw.display_preferences.salary_slip_fields.length
      ? raw.display_preferences.salary_slip_fields.map((item) => normalizeText(item)).filter(Boolean)
      : defaultDisplayPreferences().salary_slip_fields,
    dashboard_staff_columns: Array.isArray(raw?.display_preferences?.dashboard_staff_columns) && raw.display_preferences.dashboard_staff_columns.length
      ? raw.display_preferences.dashboard_staff_columns.map((item) => normalizeText(item)).filter(Boolean)
      : defaultDisplayPreferences().dashboard_staff_columns,
    label_overrides: uniqueByKey(
      (Array.isArray(raw?.display_preferences?.label_overrides) && raw.display_preferences.label_overrides.length
        ? raw.display_preferences.label_overrides
        : defaultDisplayPreferences().label_overrides
      ).map((entry) => ({
        key: normalizeText(entry?.key),
        label: normalizeText(entry?.label),
      })),
      (entry) => entry?.key
    ),
  },
});

export const getAttendanceRule = (ruleData, attendance, referenceData = {}) => {
  const rules = normalizeRuleData(ruleData, referenceData).attendance_rules;
  return rules.find((rule) => rule.label === normalizeText(attendance)) || defaultAttendanceRules([attendance])[0];
};

export const getCustomerPaymentMethodRule = (ruleData, method, referenceData = {}) => {
  const rules = normalizeRuleData(ruleData, referenceData).customer_payment_method_rules;
  return rules.find((rule) => rule.method === normalizeText(method)) || defaultCustomerPaymentMethodRules([method])[0];
};

export const getStaffPaymentTypeRule = (ruleData, type, referenceData = {}) => {
  const rules = normalizeRuleData(ruleData, referenceData).staff_payment_type_rules;
  return rules.find((rule) => rule.type === normalizeText(type)) || defaultStaffPaymentTypeRules([type])[0];
};

export const getExpenseTypeRule = (ruleData, key, referenceData = {}) => {
  const rules = normalizeRuleData(ruleData, referenceData).expense_type_rules;
  return rules.find((rule) => rule.key === normalizeText(key)) || defaultExpenseTypeRules([key])[0];
};

export const isAllowanceEligibleFromAttendanceRules = ({ record_count = 0, absent_count = 0, half_count = 0 } = {}) =>
  Number(record_count) >= 26 && Number(absent_count) === 0 && Number(half_count) <= 1;

export const applyPaymentEffect = (amount, effect, currentValue = 0) => {
  const safeAmount = Number(amount || 0);
  if (effect === PAYMENT_EFFECT_MODES.ADD) return currentValue + safeAmount;
  if (effect === PAYMENT_EFFECT_MODES.SUBTRACT) return currentValue - safeAmount;
  return currentValue;
};

export const getAllowanceRule = (ruleData, referenceData = {}) =>
  normalizeRuleData(ruleData, referenceData).allowance_rule || defaultAllowanceRule();

export const isAllowanceEligibleWithRule = (attendanceCounts = {}, ruleData = {}, referenceData = {}) => {
  const allowanceRule = getAllowanceRule(ruleData, referenceData);
  return Number(attendanceCounts?.record_count || 0) >= Number(allowanceRule?.min_records || 0)
    && Number(attendanceCounts?.absent_count || 0) <= Number(allowanceRule?.max_absent || 0)
    && Number(attendanceCounts?.half_count || 0) <= Number(allowanceRule?.max_half || 0);
};

export const getDisplayPreferences = (ruleData, referenceData = {}) =>
  normalizeRuleData(ruleData, referenceData).display_preferences || defaultDisplayPreferences();

export const getAccessRules = (ruleData, referenceData = {}) =>
  normalizeRuleData(ruleData, referenceData).access_rules || defaultAccessRules(referenceData?.user_roles || []);

export const getLabelOverride = (ruleData, key, referenceData = {}) => {
  const prefs = getDisplayPreferences(ruleData, referenceData);
  return prefs.label_overrides.find((entry) => entry.key === normalizeText(key))?.label || normalizeText(key);
};
