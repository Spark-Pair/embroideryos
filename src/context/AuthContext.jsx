// src/context/AuthContext.jsx
import { createContext, useEffect, useState, useCallback, useRef } from 'react';
import { getMe, logoutUser } from '../api/auth.api';
import { storage } from '../api/apiClient';
import { useToast } from "./ToastContext";
import { clearOfflineData, initOfflineForUser, offlineAccess } from "../offline/idb";
import { logDataSource } from "../offline/logger";
import {
  seedCustomersCache,
  seedSuppliersCache,
  seedStaffsCache,
  seedStaffRecordsCache,
  seedStaffPaymentsCache,
  seedProductionConfigsCache,
  seedCustomerPaymentsCache,
  seedSupplierPaymentsCache,
  seedExpensesCache,
  seedOrdersCache,
  seedInvoicesCache,
  seedExpenseItemsCache,
  seedInvoiceBannerCache,
  seedSubscriptionCache,
} from "../offline/bootstrapSeed";

export const AuthContext = createContext();

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const lastReadOnlyToastKeyRef = useRef("");
  const authBootstrappedRef = useRef(false);

  const maybeShowReadOnlyToast = useCallback((userData) => {
    const readOnly = Boolean(userData?.subscription?.readOnly);
    const key = readOnly ? String(userData?.subscription?.expiresAt || "expired") : "";

    if (!readOnly) {
      lastReadOnlyToastKeyRef.current = "";
      return;
    }

    if (lastReadOnlyToastKeyRef.current === key) return;

    const expiryText = userData?.subscription?.expiresAt
      ? new Date(userData.subscription.expiresAt).toLocaleDateString()
      : "unknown date";

    showToast({
      type: "warning",
      message: `Subscription expired on ${expiryText}. App is in read-only mode. Please renew subscription.`,
    });

    lastReadOnlyToastKeyRef.current = key;
  }, [showToast]);

  // Check auth on app load
  useEffect(() => {
    if (authBootstrappedRef.current) return;
    authBootstrappedRef.current = true;

    const initAuth = async () => {
      const { accessToken, sessionId } = storage.getAuth();
      let cachedUser = null;
      try {
        const cachedUserRaw = localStorage.getItem("cachedUser");
        cachedUser = cachedUserRaw ? JSON.parse(cachedUserRaw) : null;
      } catch {
        cachedUser = null;
      }
      const canUseOfflineSession = offlineAccess.isUnlocked() && Boolean(cachedUser);
      const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;

      if (canUseOfflineSession) {
        setUser(cachedUser);
        logDataSource("IDB", "auth.init.cached_session");
        setLoading(false);

        // Keep startup instant. No blocking /auth/me during boot when cached session exists.
        // If you want, we can later add a manual "Refresh Session" action.
        seedCustomersCache().catch(() => null);
        seedSuppliersCache().catch(() => null);
        seedStaffsCache().catch(() => null);
        seedStaffRecordsCache().catch(() => null);
        seedStaffPaymentsCache().catch(() => null);
        seedProductionConfigsCache().catch(() => null);
        seedCustomerPaymentsCache().catch(() => null);
        seedSupplierPaymentsCache().catch(() => null);
        seedExpensesCache().catch(() => null);
        seedOrdersCache().catch(() => null);
        seedInvoicesCache().catch(() => null);
        seedExpenseItemsCache().catch(() => null);
        seedInvoiceBannerCache().catch(() => null);
        seedSubscriptionCache().catch(() => null);
        return;
      }

      if (!accessToken || !sessionId) {
        setLoading(false);
        return;
      }

      if (isOffline) {
        setLoading(false);
        return;
      }

      try {
        const userData = await getMe();
        setUser(userData);
        localStorage.setItem("cachedUser", JSON.stringify(userData));
        offlineAccess.unlock();
        await initOfflineForUser({
          userId: userData?._id || userData?.id,
          businessId: userData?.businessId?._id || userData?.businessId,
        });
        maybeShowReadOnlyToast(userData);
        seedCustomersCache().catch(() => null);
        seedSuppliersCache().catch(() => null);
        seedStaffsCache().catch(() => null);
        seedStaffRecordsCache().catch(() => null);
        seedStaffPaymentsCache().catch(() => null);
        seedProductionConfigsCache().catch(() => null);
        seedCustomerPaymentsCache().catch(() => null);
        seedSupplierPaymentsCache().catch(() => null);
        seedExpensesCache().catch(() => null);
        seedOrdersCache().catch(() => null);
        seedInvoicesCache().catch(() => null);
        seedExpenseItemsCache().catch(() => null);
        seedInvoiceBannerCache().catch(() => null);
        seedSubscriptionCache().catch(() => null);
      } catch (error) {
        console.error('Auth init error:', error);
        const status = Number(error?.response?.status || 0);
        const canFallbackToOffline = canUseOfflineSession && (!navigator.onLine || status >= 500 || !status);

        if (canFallbackToOffline) {
          setUser(cachedUser);
          logDataSource("IDB", "auth.init.fallback_cached_user", { status });
          showToast({
            type: "warning",
            message: "Using offline mode with cached login.",
          });
        } else {
          storage.clearAuth();
          offlineAccess.lock();
        }
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [maybeShowReadOnlyToast]);

  // Login function
  const login = useCallback(async (_authData) => {
    try {
      setLoading(true);

      // Auth data already stored by loginUser in auth.api.js
      const userData = await getMe();
      setUser(userData);
      localStorage.setItem("cachedUser", JSON.stringify(userData));
      offlineAccess.unlock();
      await initOfflineForUser({
        userId: userData?._id || userData?.id,
        businessId: userData?.businessId?._id || userData?.businessId,
      });
      seedCustomersCache().catch(() => null);
      seedSuppliersCache().catch(() => null);
      seedStaffsCache().catch(() => null);
      seedStaffRecordsCache().catch(() => null);
      seedStaffPaymentsCache().catch(() => null);
      seedProductionConfigsCache().catch(() => null);
      seedCustomerPaymentsCache().catch(() => null);
      seedSupplierPaymentsCache().catch(() => null);
      seedExpensesCache().catch(() => null);
      seedOrdersCache().catch(() => null);
      seedInvoicesCache().catch(() => null);
      seedExpenseItemsCache().catch(() => null);
      seedInvoiceBannerCache().catch(() => null);
      seedSubscriptionCache().catch(() => null);
      maybeShowReadOnlyToast(userData);

      showToast({
        type: "success",
        message: `Welcome back, ${userData.name || userData.username}!`,
      });

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      storage.clearAuth();
      offlineAccess.lock();

      showToast({
        type: "error",
        message: error.response?.data?.message || "Login failed",
      });

      return { success: false, error };
    } finally {
      setLoading(false);
    }
  }, [maybeShowReadOnlyToast, showToast]);

  // Logout function
  const logout = useCallback(async () => {
    try {
      await logoutUser();

      showToast({
        type: "success",
        message: "Logged out successfully",
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setLoading(false);
      localStorage.removeItem("cachedUser");
      lastReadOnlyToastKeyRef.current = "";
      offlineAccess.lock();
      clearOfflineData().catch(() => null);
      logDataSource("IDB", "offline.locked");
    }
  }, [showToast]);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    try {
      const userData = await getMe();
      setUser(userData);
      localStorage.setItem("cachedUser", JSON.stringify(userData));
      maybeShowReadOnlyToast(userData);
      return userData;
    } catch (error) {
      console.error('Refresh user error:', error);
      throw error;
    }
  }, [maybeShowReadOnlyToast]);

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      loading,
      refreshUser,
      setUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}
