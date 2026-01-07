// src/api/apiClient.js
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

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

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const { accessToken, sessionId } = storage.getAuth();
    
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    
    if (sessionId) {
      config.headers['x-session-id'] = sessionId;
    }
    
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
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle token expiration
    if (error.response?.status === 401 && 
        error.response?.data?.code === 'TOKEN_EXPIRED' && 
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
        storage.clearAuth();
        window.location.href = '/login';
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
        storage.clearAuth();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle invalid session
    if (error.response?.status === 401 && 
        (error.response?.data?.code === 'SESSION_INVALID' || 
         error.response?.data?.code === 'SESSION_MISMATCH')) {
      storage.clearAuth();
      window.location.href = '/login';
    }

    // Handle other 401 errors
    if (error.response?.status === 401) {
      storage.clearAuth();
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);