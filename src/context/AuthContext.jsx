// src/context/AuthContext.jsx
import { createContext, useEffect, useState, useCallback, useRef } from 'react';
import { getMe, logoutUser } from '../api/auth.api';
import { storage } from '../api/apiClient';
import { useToast } from "./ToastContext";
import { clearOfflineData, getOfflineSessionMeta, initOfflineForUser, offlineAccess } from "../offline/idb";
import { logDataSource } from "../offline/logger";
import {
  runFullBootstrapSeed,
} from "../offline/bootstrapSeed";

export const AuthContext = createContext();

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const lastReadOnlyToastKeyRef = useRef("");
  const authBootstrappedRef = useRef(false);

  const isSubscriptionExpired = useCallback((subscription) => {
    const expiresAt = subscription?.expiresAt;
    if (!expiresAt) return false;
    const ts = new Date(expiresAt).getTime();
    if (!Number.isFinite(ts)) return false;
    return Date.now() >= ts;
  }, []);

  const applySubscriptionGuard = useCallback((userData) => {
    if (!userData) return userData;
    const subscription = userData?.subscription || {};
    const expiredByTime = isSubscriptionExpired(subscription);
    const readOnly = Boolean(subscription?.readOnly || expiredByTime);
    return {
      ...userData,
      subscription: {
        ...subscription,
        readOnly,
      },
    };
  }, [isSubscriptionExpired]);

  const triggerBootstrapSync = useCallback(async ({ forceRefresh = false, notifyOnFinish = false } = {}) => {
    try {
      await runFullBootstrapSeed({ forceRefresh });
      if (notifyOnFinish) {
        showToast({
          type: "info",
          message: "Sync completed. Latest cloud updates fetched. Refresh app if needed.",
        });
      }
    } catch (error) {
      logDataSource("IDB", "seed.bootstrap.failed", {
        message: error?.response?.data?.message || error?.message || "bootstrap failed",
      });
    }
  }, [showToast]);

  const maybeShowReadOnlyToast = useCallback((userData) => {
    const normalized = applySubscriptionGuard(userData);
    const readOnly = Boolean(normalized?.subscription?.readOnly);
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
  }, [applySubscriptionGuard, showToast]);

  // Check auth on app load
  useEffect(() => {
    if (authBootstrappedRef.current) return;
    authBootstrappedRef.current = true;

    const initAuth = async () => {
      localStorage.removeItem("auth:logout_in_progress");
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
        const guardedCached = applySubscriptionGuard(cachedUser);
        setUser(guardedCached);
        localStorage.setItem("cachedUser", JSON.stringify(guardedCached));
        logDataSource("IDB", "auth.init.cached_session");
        setLoading(false);
        // On refresh with cached session we do not pull cloud bootstrap data.
        // Cloud bootstrap runs only on explicit login.
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
        const guardedUser = applySubscriptionGuard(userData);
        const offlineMeta = await getOfflineSessionMeta().catch(() => null);
        const nextUserId = String(userData?._id || userData?.id || "");
        const nextBusinessId = String(userData?.businessId?._id || userData?.businessId || "");
        const prevUserId = String(offlineMeta?.userId || "");
        const prevBusinessId = String(offlineMeta?.businessId || "");
        const isDifferentSessionScope =
          Boolean(prevUserId && prevUserId !== nextUserId) ||
          Boolean(prevBusinessId && prevBusinessId !== nextBusinessId);
        if (isDifferentSessionScope) {
          await clearOfflineData().catch(() => null);
        }
        setUser(guardedUser);
        localStorage.setItem("cachedUser", JSON.stringify(guardedUser));
        offlineAccess.unlock();
        await initOfflineForUser({
          userId: userData?._id || userData?.id,
          businessId: userData?.businessId?._id || userData?.businessId,
        });
        maybeShowReadOnlyToast(guardedUser);
        triggerBootstrapSync({ forceRefresh: false, notifyOnFinish: true });
      } catch (error) {
        console.error('Auth init error:', error);
        const status = Number(error?.response?.status || 0);
        const canFallbackToOffline = canUseOfflineSession && (!navigator.onLine || status >= 500 || !status);

        if (canFallbackToOffline) {
          const guardedCached = applySubscriptionGuard(cachedUser);
          setUser(guardedCached);
          localStorage.setItem("cachedUser", JSON.stringify(guardedCached));
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
  }, [applySubscriptionGuard, maybeShowReadOnlyToast, triggerBootstrapSync]);

  // Login function
  const login = useCallback(async (_authData) => {
    try {
      setLoading(true);
      localStorage.removeItem("auth:logout_in_progress");

      // Auth data already stored by loginUser in auth.api.js
      const userData = await getMe();
      const guardedUser = applySubscriptionGuard(userData);
      const offlineMeta = await getOfflineSessionMeta().catch(() => null);
      const nextUserId = String(userData?._id || userData?.id || "");
      const nextBusinessId = String(userData?.businessId?._id || userData?.businessId || "");
      const prevUserId = String(offlineMeta?.userId || "");
      const prevBusinessId = String(offlineMeta?.businessId || "");
      const isDifferentSessionScope =
        Boolean(prevUserId && prevUserId !== nextUserId) ||
        Boolean(prevBusinessId && prevBusinessId !== nextBusinessId);
      if (isDifferentSessionScope) {
        await clearOfflineData().catch(() => null);
      }
      setUser(guardedUser);
      localStorage.setItem("cachedUser", JSON.stringify(guardedUser));
      offlineAccess.unlock();
      await initOfflineForUser({
        userId: userData?._id || userData?.id,
        businessId: userData?.businessId?._id || userData?.businessId,
      });
      triggerBootstrapSync({ forceRefresh: false, notifyOnFinish: true });
      maybeShowReadOnlyToast(guardedUser);

      showToast({
        type: "success",
        message: `Welcome back, ${guardedUser.name || guardedUser.username}!`,
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
  }, [applySubscriptionGuard, maybeShowReadOnlyToast, showToast, triggerBootstrapSync]);

  // Logout function
  const logout = useCallback(async () => {
    localStorage.setItem("auth:logout_in_progress", "1");
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
      logDataSource("IDB", "offline.locked");
      localStorage.removeItem("auth:logout_in_progress");
    }
  }, [showToast]);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    try {
      const userData = await getMe();
      const guardedUser = applySubscriptionGuard(userData);
      setUser(guardedUser);
      localStorage.setItem("cachedUser", JSON.stringify(guardedUser));
      maybeShowReadOnlyToast(guardedUser);
      return guardedUser;
    } catch (error) {
      console.error('Refresh user error:', error);
      throw error;
    }
  }, [applySubscriptionGuard, maybeShowReadOnlyToast]);

  useEffect(() => {
    if (!user?.subscription?.expiresAt) return;
    const interval = setInterval(() => {
      setUser((prev) => {
        if (!prev) return prev;
        const next = applySubscriptionGuard(prev);
        if (Boolean(prev?.subscription?.readOnly) === Boolean(next?.subscription?.readOnly)) {
          return prev;
        }
        localStorage.setItem("cachedUser", JSON.stringify(next));
        maybeShowReadOnlyToast(next);
        return next;
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [applySubscriptionGuard, maybeShowReadOnlyToast, user?.subscription?.expiresAt]);

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
