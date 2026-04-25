// src/api/apiClient.js
import axios from "axios";
import { logDataSource } from "../offline/logger";
import { clearOfflineData, offlineAccess } from "../offline/idb";

const API = import.meta.env.VITE_API_URL;
const READ_ONLY_BYPASS_PATHS = new Set(["/auth/logout", "/auth/logout-all", "/auth/refresh"]);
const AUTH_REDIRECT_BYPASS_PATHS = new Set([
  "/auth/logout",
  "/auth/logout-all",
  "/auth/refresh",
  "/auth/me",
  "/auth/sessions",
]);

export const apiClient = axios.create({
  baseURL: API,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Storage helper
export const storage = {
  getAuth() {
    return {
      accessToken: localStorage.getItem("accessToken"),
      refreshToken: localStorage.getItem("refreshToken"),
      sessionId: localStorage.getItem("sessionId"),
    };
  },
  
  setAuth(accessToken, refreshToken, sessionId) {
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    localStorage.setItem("sessionId", sessionId);
  },
  
  clearAuth() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("sessionId");
  },
  
  updateAccessToken(accessToken) {
    localStorage.setItem("accessToken", accessToken);
  }
};

const getCachedUser = () => {
  try {
    const raw = localStorage.getItem("cachedUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const isSubscriptionExpired = (subscription) => {
  const expiresAt = subscription?.expiresAt;
  if (!expiresAt) return false;
  const ts = new Date(expiresAt).getTime();
  if (!Number.isFinite(ts)) return false;
  return Date.now() >= ts;
};

const isReadOnlyBlockedRequest = (config) => {
  const method = String(config?.method || "get").toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;

  const cachedUser = getCachedUser();
  const isReadOnly =
    Boolean(cachedUser?.subscription?.readOnly) ||
    isSubscriptionExpired(cachedUser?.subscription);
  if (!isReadOnly) return false;

  const urlPath = String(config?.url || "");
  if (READ_ONLY_BYPASS_PATHS.has(urlPath)) return false;
  return true;
};

const isOfflineBlockedRequest = () => {
  if (typeof navigator === "undefined") return false;
  return navigator.onLine === false;
};

let authRedirectInProgress = false;
const HARD_ACCESS_REVOKED_CODES = new Set([
  "SESSION_INVALID",
  "SESSION_MISMATCH",
  "USER_INACTIVE",
  "BUSINESS_INACTIVE",
  "BUSINESS_MISSING",
  "SUBSCRIPTION_INACTIVE",
]);

const dispatchWindowEvent = (name, detail = {}) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
};

const shouldBypassUnauthorizedRedirect = (config = {}) => {
  const urlPath = String(config?.url || "");
  if (AUTH_REDIRECT_BYPASS_PATHS.has(urlPath)) return true;
  if (typeof window !== "undefined" && window.location.pathname === "/login") return true;
  if (localStorage.getItem("auth:logout_in_progress") === "1") return true;
  const { accessToken, sessionId } = storage.getAuth();
  if (!accessToken && !sessionId) return true;
  return false;
};

const isHardAccessRevokedError = ({ status, code }) => {
  if (status === 401) {
    return code !== "TOKEN_EXPIRED";
  }
  if (status === 402 || status === 403) {
    return HARD_ACCESS_REVOKED_CODES.has(code);
  }
  return false;
};

const redirectToLoginOnce = () => {
  if (authRedirectInProgress) return;
  authRedirectInProgress = true;
  storage.clearAuth();
  localStorage.removeItem("cachedUser");
  offlineAccess.lock();
  clearOfflineData().catch(() => null);
  dispatchWindowEvent("app:auth-invalidated", {
    reason: "redirect",
  });
  if (typeof window !== "undefined") {
    window.location.replace("/login");
  }
};

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    if (isOfflineBlockedRequest()) {
      logDataSource("IDB", "request.blocked.offline", {
        method: String(config?.method || "get").toUpperCase(),
        url: String(config?.url || ""),
        offlineUnlocked: offlineAccess.isUnlocked(),
      });

      return Promise.reject({
        config,
        isAxiosError: true,
        response: {
          status: 0,
          data: {
            message: "Offline mode active. Cloud requests are blocked.",
            code: "OFFLINE_REQUEST_BLOCKED",
            offline: true,
          },
        },
      });
    }

    if (isReadOnlyBlockedRequest(config)) {
      return Promise.reject({
        config,
        isAxiosError: true,
        response: {
          status: 402,
          data: {
            message: "Subscription expired. Account is in read-only mode.",
            code: "SUBSCRIPTION_EXPIRED_READ_ONLY",
            readOnly: true,
          },
        },
      });
    }

    const { accessToken, sessionId } = storage.getAuth();
    
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    
    if (sessionId) {
      config.headers['x-session-id'] = sessionId;
    }

    logDataSource("CLOUD", "request.start", {
      method: String(config?.method || "get").toUpperCase(),
      url: String(config?.url || ""),
    });
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor with refresh token logic
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => {
    logDataSource("CLOUD", "request.success", {
      method: String(response?.config?.method || "get").toUpperCase(),
      url: String(response?.config?.url || ""),
      status: Number(response?.status || 0),
    });
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const status = Number(error?.response?.status || 0);
    const code = String(error?.response?.data?.code || "");
    const message = String(error?.response?.data?.message || "");

    logDataSource("CLOUD", "request.error", {
      method: String(originalRequest?.method || "get").toUpperCase(),
      url: String(originalRequest?.url || ""),
      status,
      code,
    });

    if (status === 402 && code === "SUBSCRIPTION_EXPIRED_READ_ONLY") {
      dispatchWindowEvent("app:subscription-readonly", {
        code,
        message,
        expiresAt: error?.response?.data?.expiresAt || null,
      });
      return Promise.reject(error);
    }

    // Handle token expiration
    if (status === 401 &&
        code === 'TOKEN_EXPIRED' &&
        !originalRequest._retry) {
      
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const { refreshToken, sessionId } = storage.getAuth();

      if (!refreshToken || !sessionId) {
        if (!shouldBypassUnauthorizedRedirect(originalRequest)) {
          dispatchWindowEvent("app:auth-invalidated", {
            status,
            code,
            message: message || "Session expired. Please sign in again.",
          });
          redirectToLoginOnce();
        } else {
          storage.clearAuth();
        }
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${API}/auth/refresh`, {
          refreshToken,
          sessionId
        });

        storage.updateAccessToken(data.accessToken);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        
        processQueue(null, data.accessToken);
        
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        if (!shouldBypassUnauthorizedRedirect(originalRequest)) {
          dispatchWindowEvent("app:auth-invalidated", {
            status: Number(refreshError?.response?.status || 401),
            code: String(refreshError?.response?.data?.code || "TOKEN_REFRESH_FAILED"),
            message: String(refreshError?.response?.data?.message || "Session expired. Please sign in again."),
          });
          redirectToLoginOnce();
        } else {
          storage.clearAuth();
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle invalid session
    if (status === 401 &&
        (code === 'SESSION_INVALID' ||
         code === 'SESSION_MISMATCH')) {
      if (!shouldBypassUnauthorizedRedirect(originalRequest)) {
        dispatchWindowEvent("app:auth-invalidated", {
          status,
          code,
          message: message || "This session is no longer valid.",
        });
        redirectToLoginOnce();
      } else {
        storage.clearAuth();
      }
    }

    if (isHardAccessRevokedError({ status, code })) {
      if (!shouldBypassUnauthorizedRedirect(originalRequest)) {
        dispatchWindowEvent("app:auth-invalidated", {
          status,
          code,
          message: message || "Access has been revoked for this account.",
        });
        redirectToLoginOnce();
      } else {
        storage.clearAuth();
      }
    }

    // Handle other 401 errors
    if (status === 401) {
      if (!shouldBypassUnauthorizedRedirect(originalRequest)) {
        dispatchWindowEvent("app:auth-invalidated", {
          status,
          code,
          message: message || "Authentication failed. Please sign in again.",
        });
        redirectToLoginOnce();
      } else {
        storage.clearAuth();
      }
    }

    return Promise.reject(error);
  }
);
