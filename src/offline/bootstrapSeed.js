import { apiClient } from "../api/apiClient";
import { getEntitySnapshot, upsertEntitySnapshot } from "./idb";
import { logDataSource } from "./logger";

const CUSTOMERS_LIST_KEY = "customers:list:page=1&limit=30";
const CUSTOMERS_ALL_KEY = "customers:all";
const CUSTOMERS_STATS_KEY = "customers:stats";
const SUPPLIERS_ALL_KEY = "suppliers:all";
const SUPPLIERS_STATS_KEY = "suppliers:stats";
const STAFFS_ALL_KEY = "staffs:all";
const STAFFS_STATS_KEY = "staffs:stats";
const STAFFS_NAMES_KEY = "staffs:names";
const STAFF_RECORDS_ALL_KEY = "staffRecords:all";
const STAFF_RECORDS_STATS_KEY = "staffRecords:stats";
const STAFF_RECORDS_MONTHS_KEY = "staffRecords:months";
const STAFF_PAYMENTS_ALL_KEY = "staffPayments:all";
const STAFF_PAYMENTS_STATS_KEY = "staffPayments:stats";
const STAFF_PAYMENTS_MONTHS_KEY = "staffPayments:months";
const PRODUCTION_CONFIGS_ALL_KEY = "productionConfigs:all";
const CUSTOMER_PAYMENTS_ALL_KEY = "customerPayments:all";
const CUSTOMER_PAYMENTS_STATS_KEY = "customerPayments:stats";
const CUSTOMER_PAYMENTS_MONTHS_KEY = "customerPayments:months";
const SUPPLIER_PAYMENTS_ALL_KEY = "supplierPayments:all";
const SUPPLIER_PAYMENTS_STATS_KEY = "supplierPayments:stats";
const SUPPLIER_PAYMENTS_MONTHS_KEY = "supplierPayments:months";
const EXPENSES_ALL_KEY = "expenses:all";
const EXPENSES_STATS_KEY = "expenses:stats";
const ORDERS_ALL_KEY = "orders:all";
const ORDERS_STATS_KEY = "orders:stats";
const INVOICES_ALL_KEY = "invoices:all";
const EXPENSE_ITEMS_ALL_KEY = "expenseItems:all";
const BUSINESS_INVOICE_BANNER_KEY = "business:invoice_banner";
const SUBSCRIPTION_ME_KEY = "subscription:me";

let customersSeedInFlight = false;

export const seedCustomersCache = async () => {
  if (customersSeedInFlight) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  const existingAll = await getEntitySnapshot(CUSTOMERS_ALL_KEY);
  if (Array.isArray(existingAll) && existingAll.length > 0) {
    logDataSource("IDB", "seed.customers.skip_existing", { count: existingAll.length });
    return;
  }

  customersSeedInFlight = true;
  try {
    const [listRes, statsRes] = await Promise.all([
      apiClient.get("/customers?page=1&limit=5000"),
      apiClient.get("/customers/stats"),
    ]);

    const rows = Array.isArray(listRes?.data?.data) ? listRes.data.data : [];

    await Promise.all([
      upsertEntitySnapshot(CUSTOMERS_LIST_KEY, {
        data: rows.slice(0, 30),
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: rows.length,
          itemsPerPage: 30,
        },
      }),
      upsertEntitySnapshot(CUSTOMERS_ALL_KEY, rows),
      upsertEntitySnapshot(CUSTOMERS_STATS_KEY, statsRes?.data || null),
    ]);

    logDataSource("IDB", "seed.customers.done", {
      listCount: Number(rows.length || 0),
    });
  } catch (error) {
    logDataSource("IDB", "seed.customers.failed", {
      message: error?.response?.data?.message || error?.message || "seed failed",
    });
  } finally {
    customersSeedInFlight = false;
  }
};

let suppliersSeedInFlight = false;

export const seedSuppliersCache = async () => {
  if (suppliersSeedInFlight) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  const existingAll = await getEntitySnapshot(SUPPLIERS_ALL_KEY);
  if (Array.isArray(existingAll) && existingAll.length > 0) {
    logDataSource("IDB", "seed.suppliers.skip_existing", { count: existingAll.length });
    return;
  }

  suppliersSeedInFlight = true;
  try {
    const [listRes, statsRes] = await Promise.all([
      apiClient.get("/suppliers?page=1&limit=5000"),
      apiClient.get("/suppliers/stats"),
    ]);

    const rows = Array.isArray(listRes?.data?.data) ? listRes.data.data : [];
    await Promise.all([
      upsertEntitySnapshot(SUPPLIERS_ALL_KEY, rows),
      upsertEntitySnapshot(SUPPLIERS_STATS_KEY, statsRes?.data || null),
    ]);

    logDataSource("IDB", "seed.suppliers.done", {
      listCount: Number(rows.length || 0),
    });
  } catch (error) {
    logDataSource("IDB", "seed.suppliers.failed", {
      message: error?.response?.data?.message || error?.message || "seed failed",
    });
  } finally {
    suppliersSeedInFlight = false;
  }
};

let staffsSeedInFlight = false;

export const seedStaffsCache = async () => {
  if (staffsSeedInFlight) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  const existingAll = await getEntitySnapshot(STAFFS_ALL_KEY);
  if (Array.isArray(existingAll) && existingAll.length > 0) {
    logDataSource("IDB", "seed.staffs.skip_existing", { count: existingAll.length });
    return;
  }

  staffsSeedInFlight = true;
  try {
    const [listRes, statsRes] = await Promise.all([
      apiClient.get("/staffs?page=1&limit=5000"),
      apiClient.get("/staffs/stats"),
    ]);

    const rows = Array.isArray(listRes?.data?.data) ? listRes.data.data : [];
    await Promise.all([
      upsertEntitySnapshot(STAFFS_ALL_KEY, rows),
      upsertEntitySnapshot(STAFFS_STATS_KEY, statsRes?.data || null),
      upsertEntitySnapshot(
        STAFFS_NAMES_KEY,
        rows
          .map((row) => ({ _id: row?._id, name: row?.name, joining_date: row?.joining_date }))
          .filter((row) => row?._id && row?.name)
          .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")))
      ),
    ]);

    logDataSource("IDB", "seed.staffs.done", {
      listCount: Number(rows.length || 0),
    });
  } catch (error) {
    logDataSource("IDB", "seed.staffs.failed", {
      message: error?.response?.data?.message || error?.message || "seed failed",
    });
  } finally {
    staffsSeedInFlight = false;
  }
};

let staffRecordsSeedInFlight = false;

export const seedStaffRecordsCache = async () => {
  if (staffRecordsSeedInFlight) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  const existingAll = await getEntitySnapshot(STAFF_RECORDS_ALL_KEY);
  if (Array.isArray(existingAll) && existingAll.length > 0) {
    logDataSource("IDB", "seed.staffRecords.skip_existing", { count: existingAll.length });
    return;
  }

  staffRecordsSeedInFlight = true;
  try {
    const [listRes, statsRes, monthsRes] = await Promise.all([
      apiClient.get("/staff-records?page=1&limit=5000"),
      apiClient.get("/staff-records/stats"),
      apiClient.get("/staff-records/months"),
    ]);

    const rows = Array.isArray(listRes?.data?.data) ? listRes.data.data : [];
    await Promise.all([
      upsertEntitySnapshot(STAFF_RECORDS_ALL_KEY, rows),
      upsertEntitySnapshot(STAFF_RECORDS_STATS_KEY, statsRes?.data || null),
      upsertEntitySnapshot(STAFF_RECORDS_MONTHS_KEY, monthsRes?.data || null),
    ]);

    logDataSource("IDB", "seed.staffRecords.done", {
      listCount: Number(rows.length || 0),
    });
  } catch (error) {
    logDataSource("IDB", "seed.staffRecords.failed", {
      message: error?.response?.data?.message || error?.message || "seed failed",
    });
  } finally {
    staffRecordsSeedInFlight = false;
  }
};

let staffPaymentsSeedInFlight = false;

export const seedStaffPaymentsCache = async () => {
  if (staffPaymentsSeedInFlight) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  const existingAll = await getEntitySnapshot(STAFF_PAYMENTS_ALL_KEY);
  if (Array.isArray(existingAll) && existingAll.length > 0) {
    logDataSource("IDB", "seed.staffPayments.skip_existing", { count: existingAll.length });
    return;
  }

  staffPaymentsSeedInFlight = true;
  try {
    const [listRes, statsRes, monthsRes] = await Promise.all([
      apiClient.get("/staff-payments?page=1&limit=5000"),
      apiClient.get("/staff-payments/stats"),
      apiClient.get("/staff-payments/months"),
    ]);

    const rows = Array.isArray(listRes?.data?.data) ? listRes.data.data : [];
    await Promise.all([
      upsertEntitySnapshot(STAFF_PAYMENTS_ALL_KEY, rows),
      upsertEntitySnapshot(STAFF_PAYMENTS_STATS_KEY, statsRes?.data || null),
      upsertEntitySnapshot(STAFF_PAYMENTS_MONTHS_KEY, monthsRes?.data || null),
    ]);

    logDataSource("IDB", "seed.staffPayments.done", {
      listCount: Number(rows.length || 0),
    });
  } catch (error) {
    logDataSource("IDB", "seed.staffPayments.failed", {
      message: error?.response?.data?.message || error?.message || "seed failed",
    });
  } finally {
    staffPaymentsSeedInFlight = false;
  }
};

let productionConfigsSeedInFlight = false;

export const seedProductionConfigsCache = async () => {
  if (productionConfigsSeedInFlight) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  const existingAll = await getEntitySnapshot(PRODUCTION_CONFIGS_ALL_KEY);
  if (Array.isArray(existingAll) && existingAll.length > 0) {
    logDataSource("IDB", "seed.productionConfigs.skip_existing", { count: existingAll.length });
    return;
  }

  productionConfigsSeedInFlight = true;
  try {
    const res = await apiClient.get("/production-configs");
    const config = res?.data?.data || res?.data || null;
    const rows = config ? [config] : [];
    await upsertEntitySnapshot(PRODUCTION_CONFIGS_ALL_KEY, rows);

    logDataSource("IDB", "seed.productionConfigs.done", {
      listCount: Number(rows.length || 0),
    });
  } catch (error) {
    logDataSource("IDB", "seed.productionConfigs.failed", {
      message: error?.response?.data?.message || error?.message || "seed failed",
    });
  } finally {
    productionConfigsSeedInFlight = false;
  }
};

let customerPaymentsSeedInFlight = false;

export const seedCustomerPaymentsCache = async () => {
  if (customerPaymentsSeedInFlight) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  const existingAll = await getEntitySnapshot(CUSTOMER_PAYMENTS_ALL_KEY);
  if (Array.isArray(existingAll) && existingAll.length > 0) {
    logDataSource("IDB", "seed.customerPayments.skip_existing", { count: existingAll.length });
    return;
  }

  customerPaymentsSeedInFlight = true;
  try {
    const [listRes, statsRes, monthsRes] = await Promise.all([
      apiClient.get("/customer-payments?page=1&limit=5000"),
      apiClient.get("/customer-payments/stats"),
      apiClient.get("/customer-payments/months"),
    ]);

    const rows = Array.isArray(listRes?.data?.data) ? listRes.data.data : [];
    await Promise.all([
      upsertEntitySnapshot(CUSTOMER_PAYMENTS_ALL_KEY, rows),
      upsertEntitySnapshot(CUSTOMER_PAYMENTS_STATS_KEY, statsRes?.data || null),
      upsertEntitySnapshot(CUSTOMER_PAYMENTS_MONTHS_KEY, monthsRes?.data || null),
    ]);

    logDataSource("IDB", "seed.customerPayments.done", {
      listCount: Number(rows.length || 0),
    });
  } catch (error) {
    logDataSource("IDB", "seed.customerPayments.failed", {
      message: error?.response?.data?.message || error?.message || "seed failed",
    });
  } finally {
    customerPaymentsSeedInFlight = false;
  }
};

let supplierPaymentsSeedInFlight = false;

export const seedSupplierPaymentsCache = async () => {
  if (supplierPaymentsSeedInFlight) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  const existingAll = await getEntitySnapshot(SUPPLIER_PAYMENTS_ALL_KEY);
  if (Array.isArray(existingAll) && existingAll.length > 0) {
    logDataSource("IDB", "seed.supplierPayments.skip_existing", { count: existingAll.length });
    return;
  }

  supplierPaymentsSeedInFlight = true;
  try {
    const [listRes, statsRes, monthsRes] = await Promise.all([
      apiClient.get("/supplier-payments?page=1&limit=5000"),
      apiClient.get("/supplier-payments/stats"),
      apiClient.get("/supplier-payments/months"),
    ]);

    const rows = Array.isArray(listRes?.data?.data) ? listRes.data.data : [];
    await Promise.all([
      upsertEntitySnapshot(SUPPLIER_PAYMENTS_ALL_KEY, rows),
      upsertEntitySnapshot(SUPPLIER_PAYMENTS_STATS_KEY, statsRes?.data || null),
      upsertEntitySnapshot(SUPPLIER_PAYMENTS_MONTHS_KEY, monthsRes?.data || null),
    ]);

    logDataSource("IDB", "seed.supplierPayments.done", {
      listCount: Number(rows.length || 0),
    });
  } catch (error) {
    logDataSource("IDB", "seed.supplierPayments.failed", {
      message: error?.response?.data?.message || error?.message || "seed failed",
    });
  } finally {
    supplierPaymentsSeedInFlight = false;
  }
};

let expensesSeedInFlight = false;

export const seedExpensesCache = async () => {
  if (expensesSeedInFlight) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  const existingAll = await getEntitySnapshot(EXPENSES_ALL_KEY);
  if (Array.isArray(existingAll) && existingAll.length > 0) {
    logDataSource("IDB", "seed.expenses.skip_existing", { count: existingAll.length });
    return;
  }

  expensesSeedInFlight = true;
  try {
    const [listRes, statsRes] = await Promise.all([
      apiClient.get("/expenses?page=1&limit=5000"),
      apiClient.get("/expenses/stats"),
    ]);

    const rows = Array.isArray(listRes?.data?.data) ? listRes.data.data : [];
    await Promise.all([
      upsertEntitySnapshot(EXPENSES_ALL_KEY, rows),
      upsertEntitySnapshot(EXPENSES_STATS_KEY, statsRes?.data || null),
    ]);

    logDataSource("IDB", "seed.expenses.done", {
      listCount: Number(rows.length || 0),
    });
  } catch (error) {
    logDataSource("IDB", "seed.expenses.failed", {
      message: error?.response?.data?.message || error?.message || "seed failed",
    });
  } finally {
    expensesSeedInFlight = false;
  }
};

let ordersSeedInFlight = false;

export const seedOrdersCache = async () => {
  if (ordersSeedInFlight) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  const existingAll = await getEntitySnapshot(ORDERS_ALL_KEY);
  if (Array.isArray(existingAll) && existingAll.length > 0) {
    logDataSource("IDB", "seed.orders.skip_existing", { count: existingAll.length });
    return;
  }

  ordersSeedInFlight = true;
  try {
    const [listRes, statsRes] = await Promise.all([
      apiClient.get("/orders?page=1&limit=5000"),
      apiClient.get("/orders/stats"),
    ]);

    const rows = Array.isArray(listRes?.data?.data) ? listRes.data.data : [];
    await Promise.all([
      upsertEntitySnapshot(ORDERS_ALL_KEY, rows),
      upsertEntitySnapshot(ORDERS_STATS_KEY, statsRes?.data || null),
    ]);

    logDataSource("IDB", "seed.orders.done", {
      listCount: Number(rows.length || 0),
    });
  } catch (error) {
    logDataSource("IDB", "seed.orders.failed", {
      message: error?.response?.data?.message || error?.message || "seed failed",
    });
  } finally {
    ordersSeedInFlight = false;
  }
};

let invoicesSeedInFlight = false;

export const seedInvoicesCache = async () => {
  if (invoicesSeedInFlight) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  const existingAll = await getEntitySnapshot(INVOICES_ALL_KEY);
  if (Array.isArray(existingAll) && existingAll.length > 0) {
    logDataSource("IDB", "seed.invoices.skip_existing", { count: existingAll.length });
    return;
  }

  invoicesSeedInFlight = true;
  try {
    const listRes = await apiClient.get("/invoices?page=1&limit=5000");
    const rows = Array.isArray(listRes?.data?.data) ? listRes.data.data : [];
    await upsertEntitySnapshot(INVOICES_ALL_KEY, rows);

    logDataSource("IDB", "seed.invoices.done", {
      listCount: Number(rows.length || 0),
    });
  } catch (error) {
    logDataSource("IDB", "seed.invoices.failed", {
      message: error?.response?.data?.message || error?.message || "seed failed",
    });
  } finally {
    invoicesSeedInFlight = false;
  }
};

let expenseItemsSeedInFlight = false;

export const seedExpenseItemsCache = async () => {
  if (expenseItemsSeedInFlight) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  const existingAll = await getEntitySnapshot(EXPENSE_ITEMS_ALL_KEY);
  if (Array.isArray(existingAll) && existingAll.length > 0) {
    logDataSource("IDB", "seed.expenseItems.skip_existing", { count: existingAll.length });
    return;
  }

  expenseItemsSeedInFlight = true;
  try {
    const res = await apiClient.get("/expense-items");
    const rows = Array.isArray(res?.data?.data) ? res.data.data : res?.data || [];
    await upsertEntitySnapshot(EXPENSE_ITEMS_ALL_KEY, rows);

    logDataSource("IDB", "seed.expenseItems.done", {
      listCount: Number(rows.length || 0),
    });
  } catch (error) {
    logDataSource("IDB", "seed.expenseItems.failed", {
      message: error?.response?.data?.message || error?.message || "seed failed",
    });
  } finally {
    expenseItemsSeedInFlight = false;
  }
};

let invoiceBannerSeedInFlight = false;

export const seedInvoiceBannerCache = async () => {
  if (invoiceBannerSeedInFlight) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  const existing = await getEntitySnapshot(BUSINESS_INVOICE_BANNER_KEY);
  if (existing) {
    logDataSource("IDB", "seed.invoiceBanner.skip_existing", { hasBanner: Boolean(existing) });
    return;
  }

  invoiceBannerSeedInFlight = true;
  try {
    const res = await apiClient.get("/businesses/me/invoice-banner");
    const banner = res?.data?.invoice_banner_data || "";
    await upsertEntitySnapshot(BUSINESS_INVOICE_BANNER_KEY, banner);
    logDataSource("IDB", "seed.invoiceBanner.done", { hasBanner: Boolean(banner) });
  } catch (error) {
    logDataSource("IDB", "seed.invoiceBanner.failed", {
      message: error?.response?.data?.message || error?.message || "seed failed",
    });
  } finally {
    invoiceBannerSeedInFlight = false;
  }
};

let subscriptionSeedInFlight = false;

export const seedSubscriptionCache = async () => {
  if (subscriptionSeedInFlight) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  const existing = await getEntitySnapshot(SUBSCRIPTION_ME_KEY);
  if (existing) {
    logDataSource("IDB", "seed.subscription.skip_existing", { hasData: true });
    return;
  }

  subscriptionSeedInFlight = true;
  try {
    const res = await apiClient.get("/subscriptions/me");
    await upsertEntitySnapshot(SUBSCRIPTION_ME_KEY, res?.data || null);
    logDataSource("IDB", "seed.subscription.done", { ok: true });
  } catch (error) {
    logDataSource("IDB", "seed.subscription.failed", {
      message: error?.response?.data?.message || error?.message || "seed failed",
    });
  } finally {
    subscriptionSeedInFlight = false;
  }
};
