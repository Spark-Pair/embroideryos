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

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext();

export default function AuthProvider({ children }) {
  const SESSION_VALIDATE_INTERVAL_MS = 60000;
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const lastReadOnlyToastKeyRef = useRef("");
  const authBootstrappedRef = useRef(false);
  const authSyncInFlightRef = useRef(false);
  const sessionValidationInFlightRef = useRef(false);
  const accessRevokedRef = useRef(false);

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

  const syncCachedUserFromStorage = useCallback(() => {
    try {
      const raw = localStorage.getItem("cachedUser");
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed) {
        setUser(null);
        return;
      }
      const guarded = applySubscriptionGuard(parsed);
      setUser(guarded);
    } catch {
      setUser(null);
    }
  }, [applySubscriptionGuard]);

  const forceAccessRevoked = useCallback(async ({
    message = "Your session is no longer active. Please sign in again.",
    clearOffline = true,
  } = {}) => {
    if (accessRevokedRef.current) return;
    accessRevokedRef.current = true;
    localStorage.setItem("auth:logout_in_progress", "1");
    try {
      setUser(null);
      setLoading(false);
      storage.clearAuth();
      localStorage.removeItem("cachedUser");
      lastReadOnlyToastKeyRef.current = "";
      offlineAccess.lock();
      logDataSource("IDB", "offline.locked", { reason: "access_revoked" });
      if (clearOffline) {
        await clearOfflineData().catch(() => null);
      }
      showToast({
        type: "error",
        message,
      });
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    } finally {
      localStorage.removeItem("auth:logout_in_progress");
    }
  }, [showToast]);

  const finalizeAuthenticatedUser = useCallback(async (userData, { bootstrap = false } = {}) => {
    const guardedUser = applySubscriptionGuard(userData);
    const offlineMeta = await getOfflineSessionMeta().catch(() => null);
    const nextUserId = String(userData?._id || userData?.id || "");
    const nextBusinessId = String(userData?.businessId?._id || userData?.businessId || userData?.business?.id || "");
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
    accessRevokedRef.current = false;
    await initOfflineForUser({
      userId: userData?._id || userData?.id,
      businessId: userData?.businessId?._id || userData?.businessId || userData?.business?.id,
    });
    maybeShowReadOnlyToast(guardedUser);

    if (
      guardedUser?.role !== "developer" &&
      guardedUser?.subscription &&
      guardedUser.subscription.active === false &&
      guardedUser.subscription.readOnly !== true
    ) {
      await forceAccessRevoked({
        message: "Subscription is inactive. Please contact the owner or renew access.",
      });
      return null;
    }

    if (bootstrap) {
      triggerBootstrapSync({ forceRefresh: false, notifyOnFinish: true });
    }

    return guardedUser;
  }, [applySubscriptionGuard, forceAccessRevoked, maybeShowReadOnlyToast, triggerBootstrapSync]);

  const validateActiveSession = useCallback(async ({ silent = true } = {}) => {
    if (sessionValidationInFlightRef.current) return null;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return null;

    const { accessToken, sessionId } = storage.getAuth();
    if (!accessToken || !sessionId) return null;

    sessionValidationInFlightRef.current = true;
    try {
      const userData = await getMe();
      return await finalizeAuthenticatedUser(userData);
    } catch (error) {
      const status = Number(error?.response?.status || 0);
      const message = error?.response?.data?.message || "Session is no longer valid.";

      if (status === 401 || status === 403) {
        await forceAccessRevoked({ message });
        return null;
      }

      if (status === 402) {
        const code = String(error?.response?.data?.code || "");
        if (code === "SUBSCRIPTION_EXPIRED_READ_ONLY") {
          setUser((prev) => {
            if (!prev) return prev;
            const nextUser = applySubscriptionGuard({
              ...prev,
              subscription: {
                ...(prev.subscription || {}),
                expiresAt: error?.response?.data?.expiresAt || prev?.subscription?.expiresAt || null,
                readOnly: true,
                active: false,
                status: "expired",
              },
            });
            localStorage.setItem("cachedUser", JSON.stringify(nextUser));
            maybeShowReadOnlyToast(nextUser);
            return nextUser;
          });
          return null;
        }

        await forceAccessRevoked({ message });
        return null;
      }

      if (!silent) {
        console.error("Session validation failed:", error);
      }
      return null;
    } finally {
      sessionValidationInFlightRef.current = false;
    }
  }, [applySubscriptionGuard, finalizeAuthenticatedUser, forceAccessRevoked, maybeShowReadOnlyToast]);

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
      const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
      const hasOfflineSession = offlineAccess.isUnlocked() && Boolean(cachedUser);
      const canUseOfflineSession = isOffline && hasOfflineSession;

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
        if (!isOffline) {
          localStorage.removeItem("cachedUser");
          offlineAccess.lock();
        }
        setLoading(false);
        return;
      }

      try {
        const userData = await getMe();
        await finalizeAuthenticatedUser(userData, { bootstrap: true });
      } catch (error) {
        console.error('Auth init error:', error);
        const status = Number(error?.response?.status || 0);
        const canFallbackToOffline = hasOfflineSession && (!navigator.onLine || status >= 500 || !status);

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
          await forceAccessRevoked({
            message: error?.response?.data?.message || "Session is no longer valid. Please sign in again.",
          });
        }
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [applySubscriptionGuard, finalizeAuthenticatedUser, forceAccessRevoked, showToast]);

  useEffect(() => {
    const handleStorage = async (event) => {
      const key = String(event?.key || "");
      if (!["accessToken", "refreshToken", "sessionId", "cachedUser", "offlineUnlocked"].includes(key)) {
        return;
      }

      if (authSyncInFlightRef.current) return;
      authSyncInFlightRef.current = true;

      try {
        const { accessToken, sessionId } = storage.getAuth();
        const cachedUserRaw = localStorage.getItem("cachedUser");
        const hasCachedUser = Boolean(cachedUserRaw);
        const offlineUnlocked = offlineAccess.isUnlocked();

        if (!accessToken && !sessionId && !hasCachedUser) {
          await clearOfflineData().catch(() => null);
          offlineAccess.lock();
          lastReadOnlyToastKeyRef.current = "";
          setUser(null);
          setLoading(false);
          return;
        }

        if (key === "cachedUser" && hasCachedUser) {
          syncCachedUserFromStorage();
          return;
        }

        if (offlineUnlocked && hasCachedUser) {
          syncCachedUserFromStorage();
        }
      } finally {
        authSyncInFlightRef.current = false;
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [syncCachedUserFromStorage]);

  // Login function
  const login = useCallback(async (_authData) => {
    try {
      setLoading(true);
      localStorage.removeItem("auth:logout_in_progress");

      const authUser = _authData?.user
        ? {
            _id: _authData.user.id || _authData.user._id,
            id: _authData.user.id || _authData.user._id,
            name: _authData.user.name,
            username: _authData.user.username,
            role: _authData.user.role,
            isActive: _authData.user.isActive,
            shortcuts: _authData.user.shortcuts || {},
            businessId: _authData.user.business?.id || _authData.user.businessId || null,
            business: _authData.user.business || null,
            subscription: _authData.user.subscription || null,
          }
        : null;

      const guardedUser = await finalizeAuthenticatedUser(authUser, { bootstrap: true });
      if (!guardedUser) {
        return { success: false };
      }

      // Refresh richer user payload in background without blocking navigation.
      getMe()
        .then((userData) => {
          finalizeAuthenticatedUser(userData).catch(() => null);
        })
        .catch(() => null);

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
  }, [finalizeAuthenticatedUser, showToast]);

  // Logout function
  const logout = useCallback(async () => {
    localStorage.setItem("auth:logout_in_progress", "1");
    const logoutPromise = logoutUser().catch((error) => {
      console.error('Logout error:', error);
    });
    try {
      setUser(null);
      setLoading(false);
      storage.clearAuth();
      localStorage.removeItem("cachedUser");
      lastReadOnlyToastKeyRef.current = "";
      offlineAccess.lock();
      logDataSource("IDB", "offline.locked");
      clearOfflineData().catch(() => null);
      await logoutPromise;
      showToast({
        type: "success",
        message: "Logged out successfully",
      });
    } finally {
      localStorage.removeItem("auth:logout_in_progress");
    }
  }, [showToast]);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    try {
      const userData = await getMe();
      return await finalizeAuthenticatedUser(userData);
    } catch (error) {
      console.error('Refresh user error:', error);
      throw error;
    }
  }, [finalizeAuthenticatedUser]);

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

  useEffect(() => {
    const handleAuthInvalidated = (event) => {
      forceAccessRevoked({
        message: event?.detail?.message || "Your access has been revoked. Please sign in again.",
      }).catch(() => null);
    };

    const handleSubscriptionReadOnly = (event) => {
      setUser((prev) => {
        if (!prev) return prev;
        const nextUser = applySubscriptionGuard({
          ...prev,
          subscription: {
            ...(prev.subscription || {}),
            expiresAt: event?.detail?.expiresAt || prev?.subscription?.expiresAt || null,
            readOnly: true,
            active: false,
            status: "expired",
          },
        });
        localStorage.setItem("cachedUser", JSON.stringify(nextUser));
        maybeShowReadOnlyToast(nextUser);
        return nextUser;
      });
    };

    window.addEventListener("app:auth-invalidated", handleAuthInvalidated);
    window.addEventListener("app:subscription-readonly", handleSubscriptionReadOnly);
    return () => {
      window.removeEventListener("app:auth-invalidated", handleAuthInvalidated);
      window.removeEventListener("app:subscription-readonly", handleSubscriptionReadOnly);
    };
  }, [applySubscriptionGuard, forceAccessRevoked, maybeShowReadOnlyToast]);

  useEffect(() => {
    if (!user) return undefined;

    const runValidation = () => {
      validateActiveSession().catch(() => null);
    };

    const interval = window.setInterval(runValidation, SESSION_VALIDATE_INTERVAL_MS);
    const handleOnline = () => runValidation();
    const handleFocus = () => runValidation();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        runValidation();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user, validateActiveSession]);

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
