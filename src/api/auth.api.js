// src/api/auth.api.js
import { apiClient, storage } from "./apiClient";

export const loginUser = async (data) => {
  try {
    const res = await apiClient.post("/auth/login", data);
    
    if (res.data.accessToken) {
      storage.setAuth(
        res.data.accessToken,
        res.data.refreshToken,
        res.data.sessionId
      );
    }
    
    return res;
  } catch (error) {
    throw error;
  }
};

export const forceLoginUser = async (data) => {
  try {
    const res = await apiClient.post("/auth/force-login", data);
    
    if (res.data.accessToken) {
      storage.setAuth(
        res.data.accessToken,
        res.data.refreshToken,
        res.data.sessionId
      );
    }
    
    return res;
  } catch (error) {
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    await apiClient.post("/auth/logout");
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    storage.clearAuth();
  }
};

export const logoutAllDevices = async () => {
  try {
    await apiClient.post("/auth/logout-all");
  } catch (error) {
    console.error('Logout all error:', error);
  } finally {
    storage.clearAuth();
  }
};

export const getMe = async () => {
  const res = await apiClient.get("/auth/me");
  return res.data;
};

export const getUserSessions = async () => {
  const res = await apiClient.get("/auth/sessions");
  return res.data;
};

export const revokeSession = async (sessionId) => {
  const res = await apiClient.delete(`/auth/sessions/${sessionId}`);
  return res.data;
};

export const refreshAccessToken = async () => {
  const { refreshToken, sessionId } = storage.getAuth();
  
  if (!refreshToken || !sessionId) {
    throw new Error('No refresh credentials available');
  }

  const res = await apiClient.post("/auth/refresh", {
    refreshToken,
    sessionId
  });
  
  storage.updateAccessToken(res.data.accessToken);
  return res.data;
};