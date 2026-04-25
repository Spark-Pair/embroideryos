// src/api/auth.api.js
import { apiClient, storage } from "./apiClient";
import { updateShortcutsLocalFirst } from "../offline/shortcutsLocalFirst";

export const loginUser = async (data) => {
  const res = await apiClient.post("/auth/login", data);
  
  if (res.data.accessToken) {
    storage.setAuth(
      res.data.accessToken,
      res.data.refreshToken,
      res.data.sessionId
    );
  }

  return res;
};

export const logoutUser = async () => {
  const { accessToken, sessionId } = storage.getAuth();

  try {
    await apiClient.post(
      "/auth/logout",
      {},
      {
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(sessionId ? { "x-session-id": sessionId } : {}),
        },
      }
    );
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    storage.clearAuth();
  }
};

export const logoutAllDevices = async () => {
  const { accessToken, sessionId } = storage.getAuth();

  try {
    await apiClient.post(
      "/auth/logout-all",
      {},
      {
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(sessionId ? { "x-session-id": sessionId } : {}),
        },
      }
    );
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

export const updateMyShortcuts = async (shortcuts) => {
  return updateShortcutsLocalFirst(shortcuts);
};
