// src/context/AuthContext.jsx
import { createContext, useEffect, useState, useCallback, useRef } from 'react';
import { getMe, logoutUser } from '../api/auth.api';
import { storage } from '../api/apiClient';
import { useToast } from "./ToastContext";

export const AuthContext = createContext();

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const lastReadOnlyToastKeyRef = useRef("");

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
    const initAuth = async () => {
      const { accessToken, sessionId } = storage.getAuth();

      if (!accessToken || !sessionId) {
        setLoading(false);
        return;
      }

      try {
        const userData = await getMe();
        setUser(userData);
        localStorage.setItem("cachedUser", JSON.stringify(userData));
        maybeShowReadOnlyToast(userData);
      } catch (error) {
        console.error('Auth init error:', error);
        storage.clearAuth();
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
      maybeShowReadOnlyToast(userData);

      showToast({
        type: "success",
        message: `Welcome back, ${userData.name || userData.username}!`,
      });

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      storage.clearAuth();

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
