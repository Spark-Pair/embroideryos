const normalizeText = (value) => String(value || "").trim();

const uniqueList = (value = []) => {
  const seen = new Set();
  return (Array.isArray(value) ? value : [])
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const DEFAULT_BUSINESS_USER_ROLES = ["admin", "staff"];

export const normalizeBusinessUserRoles = (value = []) => {
  const merged = uniqueList(DEFAULT_BUSINESS_USER_ROLES.concat(value));
  return merged.length ? merged : [...DEFAULT_BUSINESS_USER_ROLES];
};

export const BUSINESS_ACCESS_ITEMS = [
  { key: "dashboard", label: "Dashboard", path: "/dashboard", default_roles: ["admin", "staff"], show_in_sidebar: true },
  { key: "users_manage", label: "Users", path: "/users", default_roles: ["admin"], show_in_sidebar: true },
  { key: "customers", label: "Customers", path: "/customers", default_roles: ["admin", "staff"], show_in_sidebar: true },
  { key: "customer_payments", label: "Customer Payments", path: "/customer_payments", default_roles: ["admin", "staff"], show_in_sidebar: true },
  { key: "suppliers", label: "Suppliers", path: "/suppliers", default_roles: ["admin", "staff"], show_in_sidebar: true },
  { key: "supplier_payments", label: "Supplier Payments", path: "/supplier_payments", default_roles: ["admin", "staff"], show_in_sidebar: true },
  { key: "statements", label: "Statements", path: "/statements", default_roles: ["admin", "staff"], show_in_sidebar: true },
  { key: "expenses", label: "Expenses", path: "/expenses", default_roles: ["admin", "staff"], show_in_sidebar: true },
  { key: "orders", label: "Orders", path: "/orders", default_roles: ["admin", "staff"], show_in_sidebar: true },
  { key: "invoices", label: "Invoices", path: "/invoices", default_roles: ["admin", "staff"], show_in_sidebar: true },
  { key: "staff", label: "Staff", path: "/staff", default_roles: ["admin", "staff"], show_in_sidebar: true },
  { key: "staff_records", label: "Staff Records", path: "/staff-records", default_roles: ["admin", "staff"], show_in_sidebar: true },
  { key: "crp_staff_records", label: "CRP Records", path: "/crp-staff-records", default_roles: ["admin", "staff"], show_in_sidebar: true },
  { key: "staff_payments", label: "Staff Payments", path: "/staff-payments", default_roles: ["admin", "staff"], show_in_sidebar: true },
  { key: "salary_slips", label: "Salary Slips", path: "/salary-slips", default_roles: ["admin"], show_in_sidebar: true },
  { key: "settings", label: "Settings", path: "/settings", default_roles: ["admin", "staff"], show_in_sidebar: false },
  { key: "keyboard_shortcuts", label: "Keyboard Shortcuts", path: "/keyboard-shortcuts", default_roles: ["admin", "staff"], show_in_sidebar: false },
  { key: "sessions", label: "Sessions", path: "/sessions", default_roles: ["admin", "staff"], show_in_sidebar: false },
];

export const BUSINESS_ACCESS_ITEMS_MAP = new Map(BUSINESS_ACCESS_ITEMS.map((item) => [item.key, item]));

export const defaultAccessRules = (roles = DEFAULT_BUSINESS_USER_ROLES) => {
  const safeRoles = normalizeBusinessUserRoles(roles);
  return BUSINESS_ACCESS_ITEMS.map((item) => ({
    key: item.key,
    label: item.label,
    roles: item.default_roles.filter((role) => safeRoles.includes(role)),
    show_in_sidebar: item.show_in_sidebar !== false,
  }));
};

export const normalizeAccessRules = (value = [], roles = DEFAULT_BUSINESS_USER_ROLES) => {
  const safeRoles = normalizeBusinessUserRoles(roles);
  const byKey = new Map(
    (Array.isArray(value) ? value : []).map((rule) => [
      normalizeText(rule?.key),
      {
        key: normalizeText(rule?.key),
        label: normalizeText(rule?.label),
        roles: uniqueList(rule?.roles || []).filter((role) => safeRoles.includes(role)),
        show_in_sidebar: rule?.show_in_sidebar !== false,
      },
    ])
  );

  return BUSINESS_ACCESS_ITEMS.map((item) => {
    const existing = byKey.get(item.key);
    if (!existing) {
      return {
        key: item.key,
        label: item.label,
        roles: item.default_roles.filter((role) => safeRoles.includes(role)),
        show_in_sidebar: item.show_in_sidebar !== false,
      };
    }
    return {
      key: item.key,
      label: existing.label || item.label,
      roles: existing.roles,
      show_in_sidebar: existing.show_in_sidebar,
    };
  });
};

export const getAccessRule = (ruleData = {}, referenceData = {}, key = "") =>
  normalizeAccessRules(ruleData?.access_rules || [], referenceData?.user_roles || []).find((rule) => rule.key === normalizeText(key))
  || defaultAccessRules(referenceData?.user_roles || []).find((rule) => rule.key === normalizeText(key))
  || null;

export const hasAccessForRole = (ruleData = {}, referenceData = {}, key = "", role = "") => {
  if (!role) return false;
  if (role === "developer") return false;
  const rule = getAccessRule(ruleData, referenceData, key);
  return Boolean(rule && rule.roles.includes(normalizeText(role)));
};
