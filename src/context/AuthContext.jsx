// src/context/AuthContext.jsx
import { createContext, useEffect, useState, useCallback } from 'react';
import { getMe, logoutUser } from '../api/auth.api';
import { storage } from '../api/apiClient';
import { useToast } from "./ToastContext";

export const AuthContext = createContext();

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

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
      } catch (error) {
        console.error('Auth init error:', error);
        storage.clearAuth();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Login function
  const login = useCallback(async (authData) => {
    try {
      setLoading(true);
      
      // Auth data already stored by loginUser in auth.api.js
      const userData = await getMe();
      setUser(userData);
      
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
  }, [showToast]);

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
    }
  }, [showToast]);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    try {
      const userData = await getMe();
      setUser(userData);
      return userData;
    } catch (error) {
      console.error('Refresh user error:', error);
      throw error;
    }
  }, []);

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